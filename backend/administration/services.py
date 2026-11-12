"""Account governance operations with audit trails and notifications."""
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from core.exceptions import BusinessRuleError
from notifications.services import notify
from users.access import revoke_firebase_sessions
from users.models import User

from .models import AccountAction, ActionType, AdminAuditLog, ViolationCategory

RESTRICTABLE_FEATURES = {
    'ordering': 'Place new orders',
    'delivery': 'Request delivery',
    'vendor_payouts': 'Vendor payouts',
    'rider_jobs': 'Receive delivery jobs',
    'chat': 'Chat and messaging',
    'reviews': 'Write reviews',
    'new_applications': 'Submit new applications',
    'payouts': 'Withdraw funds',
}

ACTION_PERMISSIONS = {
    ActionType.WARNING: 'users.warn',
    ActionType.SUSPEND: 'users.suspend',
    ActionType.TERMINATE: 'users.terminate',
    ActionType.RESTRICT: 'users.restrict',
    ActionType.DISABLE_LOGIN: 'users.disable_login',
    ActionType.ENABLE_LOGIN: 'users.disable_login',
    ActionType.REVOKE_SESSIONS: 'users.revoke_sessions',
    ActionType.RESTORE: 'users.restore',
    ActionType.REQUEST_VERIFICATION: 'users.request_verification',
    ActionType.INVESTIGATE: 'users.investigate',
    ActionType.NOTE: 'users.investigate',
}

NOTIFICATION_EVENTS = {
    ActionType.WARNING: 'ACCOUNT_WARNING',
    ActionType.SUSPEND: 'ACCOUNT_SUSPENDED',
    ActionType.TERMINATE: 'ACCOUNT_TERMINATED',
    ActionType.RESTRICT: 'ACCOUNT_RESTRICTED',
    ActionType.RESTORE: 'ACCOUNT_RESTORED',
    ActionType.REQUEST_VERIFICATION: 'ACCOUNT_VERIFICATION_REQUIRED',
    ActionType.INVESTIGATE: 'ACCOUNT_INVESTIGATION',
    ActionType.DISABLE_LOGIN: 'ACCOUNT_LOGIN_DISABLED',
}

SEVERE_STATES = (User.AccountState.TERMINATED, User.AccountState.TEMPORARILY_SUSPENDED)


def request_metadata(request):
    if request is None:
        return {}
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    ip = forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR', '')
    return {
        'ip': ip,
        'user_agent': request.META.get('HTTP_USER_AGENT', '')[:400],
        'method': request.method,
        'path': request.path,
    }


def target_snapshot(user):
    return {
        'account_state': user.account_state,
        'account_state_reason': user.account_state_reason,
        'suspended_until': user.suspended_until.isoformat() if user.suspended_until else None,
        'restriction_flags': list(user.restriction_flags or []),
        'login_disabled': user.login_disabled,
        'is_active': user.is_active,
        'staff_role': user.staff_role,
        'role': user.role,
        'risk_level': user.risk_level,
        'risk_score': user.risk_score,
    }


def record_audit(*, actor, action, target_type='', target_id='', target_label='', reason='',
                 previous_values=None, new_values=None, request=None):
    return AdminAuditLog.objects.create(
        actor=actor,
        actor_label=actor.name if actor else 'system',
        action=action,
        target_type=target_type,
        target_id=str(target_id or ''),
        target_label=target_label or '',
        reason=reason or '',
        previous_values=previous_values or {},
        new_values=new_values or {},
        request_metadata=request_metadata(request),
    )


def _validated_features(features):
    if not features:
        raise BusinessRuleError('Select at least one feature to restrict.')
    unknown = [item for item in features if item not in RESTRICTABLE_FEATURES]
    if unknown:
        raise BusinessRuleError(f'Unknown restriction feature: {unknown[0]}.')
    return sorted(set(features))


def _validate_common(action, reason, category, evidence, confirm):
    if action != ActionType.REVOKE_SESSIONS and len((reason or '').strip()) < 5:
        raise BusinessRuleError('A written reason of at least 5 characters is required.')
    if category not in ViolationCategory.values:
        raise BusinessRuleError('Choose a valid violation category.')
    if action == ActionType.TERMINATE:
        if len((reason or '').strip()) < 10:
            raise BusinessRuleError('Permanent termination requires a detailed reason.')
        if (confirm or '').strip().upper() != 'TERMINATE':
            raise BusinessRuleError('Type TERMINATE to confirm permanent termination.')
        if not (evidence or '').strip():
            raise BusinessRuleError('Supporting evidence is required for permanent termination.')


@transaction.atomic
def apply_account_action(*, actor, target, action, reason='', category=ViolationCategory.OTHER,
                         evidence='', internal_notes='', duration_days=None, features=None,
                         confirm='', request=None):
    if action not in ActionType.values:
        raise BusinessRuleError('Unknown account action.')
    if target.pk == actor.pk and action in (
        ActionType.TERMINATE, ActionType.SUSPEND, ActionType.DISABLE_LOGIN, ActionType.RESTRICT
    ):
        raise BusinessRuleError('You cannot apply this action to your own account.')
    if target.staff_role == User.StaffRole.SUPER_ADMIN and not actor.is_superuser:
        if actor.staff_role != User.StaffRole.SUPER_ADMIN:
            raise BusinessRuleError('Only a super admin can action another super admin.')
    if target.account_state in SEVERE_STATES and action in (
        ActionType.WARNING, ActionType.REQUEST_VERIFICATION, ActionType.INVESTIGATE
    ):
        raise BusinessRuleError('Restore the account before applying a lighter action.')

    _validate_common(action, reason, category, evidence, confirm)

    previous = target_snapshot(target)
    now = timezone.now()
    update_fields = []
    effective_until = None
    restriction_flags = list(target.restriction_flags or [])

    if action == ActionType.WARNING:
        target.account_state = User.AccountState.WARNING
        target.account_state_reason = reason.strip()
        target.account_state_updated_at = now
        target.account_state_updated_by = actor
        update_fields += ['account_state', 'account_state_reason', 'account_state_updated_at', 'account_state_updated_by']
    elif action == ActionType.SUSPEND:
        if not duration_days or not (1 <= int(duration_days) <= 365):
            raise BusinessRuleError('Temporary suspension requires a duration between 1 and 365 days.')
        duration_days = int(duration_days)
        effective_until = now + timedelta(days=duration_days)
        target.account_state = User.AccountState.TEMPORARILY_SUSPENDED
        target.account_state_reason = reason.strip()
        target.suspended_until = effective_until
        target.restriction_flags = []
        target.account_state_updated_at = now
        target.account_state_updated_by = actor
        target.auth_epoch = (target.auth_epoch or 0) + 1
        update_fields += [
            'account_state', 'account_state_reason', 'suspended_until', 'restriction_flags',
            'account_state_updated_at', 'account_state_updated_by', 'auth_epoch',
        ]
        restriction_flags = []
    elif action == ActionType.TERMINATE:
        target.account_state = User.AccountState.TERMINATED
        target.account_state_reason = reason.strip()
        target.suspended_until = None
        target.restriction_flags = ['all']
        target.login_disabled = True
        target.account_state_updated_at = now
        target.account_state_updated_by = actor
        target.auth_epoch = (target.auth_epoch or 0) + 1
        update_fields += [
            'account_state', 'account_state_reason', 'suspended_until', 'restriction_flags',
            'login_disabled', 'account_state_updated_at', 'account_state_updated_by', 'auth_epoch',
        ]
        restriction_flags = ['all']
    elif action == ActionType.RESTRICT:
        restriction_flags = _validated_features(features)
        target.account_state = User.AccountState.RESTRICTED
        target.account_state_reason = reason.strip()
        target.restriction_flags = restriction_flags
        target.account_state_updated_at = now
        target.account_state_updated_by = actor
        update_fields += [
            'account_state', 'account_state_reason', 'restriction_flags',
            'account_state_updated_at', 'account_state_updated_by',
        ]
    elif action == ActionType.DISABLE_LOGIN:
        target.login_disabled = True
        target.auth_epoch = (target.auth_epoch or 0) + 1
        update_fields += ['login_disabled', 'auth_epoch']
    elif action == ActionType.ENABLE_LOGIN:
        target.login_disabled = False
        update_fields += ['login_disabled']
    elif action == ActionType.REVOKE_SESSIONS:
        target.auth_epoch = (target.auth_epoch or 0) + 1
        update_fields += ['auth_epoch']
    elif action == ActionType.RESTORE:
        target.account_state = User.AccountState.ACTIVE
        target.account_state_reason = ''
        target.suspended_until = None
        target.restriction_flags = []
        target.login_disabled = False
        target.account_state_updated_at = now
        target.account_state_updated_by = actor
        update_fields += [
            'account_state', 'account_state_reason', 'suspended_until', 'restriction_flags',
            'login_disabled', 'account_state_updated_at', 'account_state_updated_by',
        ]
        restriction_flags = []
    elif action == ActionType.REQUEST_VERIFICATION:
        target.account_state = User.AccountState.PENDING_VERIFICATION
        target.account_state_reason = reason.strip()
        target.account_state_updated_at = now
        target.account_state_updated_by = actor
        update_fields += ['account_state', 'account_state_reason', 'account_state_updated_at', 'account_state_updated_by']
    elif action == ActionType.INVESTIGATE:
        target.account_state = User.AccountState.UNDER_REVIEW
        target.account_state_reason = reason.strip()
        target.account_state_updated_at = now
        target.account_state_updated_by = actor
        update_fields += ['account_state', 'account_state_reason', 'account_state_updated_at', 'account_state_updated_by']
    elif action == ActionType.NOTE:
        pass

    if update_fields:
        target.save(update_fields=update_fields + ['updated_at'])

    record = AccountAction.objects.create(
        target=target,
        actor=actor,
        action=action,
        violation_category=category,
        reason=reason.strip(),
        evidence=evidence.strip(),
        internal_notes=internal_notes.strip(),
        duration_days=duration_days,
        effective_until=effective_until,
        previous_state=previous['account_state'],
        new_state=target.account_state,
        restriction_flags=restriction_flags,
        request_metadata=request_metadata(request),
    )

    record_audit(
        actor=actor,
        action=f'account.{action.lower()}',
        target_type='user',
        target_id=target.pk,
        target_label=target.name,
        reason=reason.strip(),
        previous_values=previous,
        new_values=target_snapshot(target),
        request=request,
    )

    event = NOTIFICATION_EVENTS.get(action)
    if event:
        ctx = {
            'reason': reason.strip() or 'Platform policy review',
            'until': timezone.localtime(effective_until).strftime('%d %b %Y, %H:%M') if effective_until else '',
            'features': ', '.join(RESTRICTABLE_FEATURES.get(item, item) for item in restriction_flags) or 'Selected features',
        }
        notify(
            target,
            event,
            dedupe_key=f'account:{target.pk}:action:{record.pk}',
            ctx=ctx,
            data={'account_action_id': record.pk, 'account_state': target.account_state},
        )

    if action in (ActionType.SUSPEND, ActionType.TERMINATE, ActionType.DISABLE_LOGIN, ActionType.REVOKE_SESSIONS):
        revoke_firebase_sessions(target)

    return record
