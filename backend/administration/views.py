import csv
from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, DecimalField, F, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.core.cache import cache
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import BusinessRuleError
from core.pagination import StandardPagination
from notifications.services import notify
from users.models import User

from .models import AccountAction, AccountAppeal, AdminAuditLog, AppealStatus, ActionType
from .permissions import (
    HasAdminPermission,
    has_permission,
    is_control_center_user,
    permissions_for_user,
)
from .serializers import (
    AccountActionSerializer,
    AccountAppealSerializer,
    AdminDeliverySerializer,
    AdminMenuItemSerializer,
    AdminOrderDetailSerializer,
    AdminOrderListSerializer,
    AdminPaymentSerializer,
    AdminReviewSerializer,
    AdminRiderSerializer,
    AdminUserDetailSerializer,
    AdminUserListSerializer,
    AdminVendorSerializer,
    ApplyActionSerializer,
    AuditLogSerializer,
    CreateAppealSerializer,
    DecideAppealSerializer,
    ORDER_STATUS_LABELS,
    PlatformOverviewSerializer,
    PublicAppealSerializer,
    StaffRoleUpdateSerializer,
    StaffUserSerializer,
)
from .services import (
    ACTION_PERMISSIONS,
    RESTRICTABLE_FEATURES,
    apply_account_action,
    record_audit,
    target_snapshot,
)


def user_queryset():
    """Users with real aggregate signals, computed by subqueries to avoid join fan-out."""
    from orders.models import Order

    orders = Order.objects.filter(customer=OuterRef('pk'))
    order_count = orders.values('customer').annotate(total=Count('id')).values('total')
    paid_total = (
        orders.filter(payment_status='PAID')
        .values('customer')
        .annotate(total=Sum('total'))
        .values('total')
    )
    violations = (
        AccountAction.objects.filter(target=OuterRef('pk'))
        .exclude(action=ActionType.NOTE)
        .values('target')
        .annotate(total=Count('id'))
        .values('total')
    )
    last_action = (
        AccountAction.objects.filter(target=OuterRef('pk'))
        .order_by('-created_at')
        .values('created_at')[:1]
    )
    money_output = DecimalField(max_digits=14, decimal_places=2)
    return User.objects.select_related('vendor_profile', 'rider_profile').annotate(
        order_count=Coalesce(Subquery(order_count), 0),
        lifetime_value=Coalesce(
            Subquery(paid_total, output_field=money_output),
            Value(Decimal('0.00')),
            output_field=money_output,
        ),
        violation_count=Coalesce(Subquery(violations), 0),
        last_action_at=Subquery(last_action),
    )


class AdminSummaryView(APIView):
    permission_classes = [HasAdminPermission]
    required_permissions = ('users.view', 'reports.view')
    permission_mode = 'any'

    def get(self, request):
        state_counts = {
            row['account_state']: row['total']
            for row in User.objects.values('account_state').annotate(total=Count('id'))
        }
        role_counts = {
            row['role']: row['total']
            for row in User.objects.values('role').annotate(total=Count('id'))
        }
        risk_counts = {
            row['risk_level']: row['total']
            for row in User.objects.values('risk_level').annotate(total=Count('id'))
        }
        seven_days_ago = timezone.now() - timedelta(days=7)
        actions = AccountAction.objects.select_related('actor', 'target')
        recent_actions = actions.order_by('-created_at')[:8]
        recent_audit = AdminAuditLog.objects.select_related('actor').order_by('-created_at')[:8]
        actions_7d = actions.filter(created_at__gte=seven_days_ago).count()

        from riders.models import RiderProfile
        from vendors.models import VendorProfile

        return Response(
            {
                'generated_at': timezone.now().isoformat(),
                'account_states': {
                    'total': sum(state_counts.values()),
                    'active': state_counts.get(User.AccountState.ACTIVE, 0),
                    'warning': state_counts.get(User.AccountState.WARNING, 0),
                    'under_review': state_counts.get(User.AccountState.UNDER_REVIEW, 0),
                    'temporarily_suspended': state_counts.get(User.AccountState.TEMPORARILY_SUSPENDED, 0),
                    'restricted': state_counts.get(User.AccountState.RESTRICTED, 0),
                    'terminated': state_counts.get(User.AccountState.TERMINATED, 0),
                    'pending_verification': state_counts.get(User.AccountState.PENDING_VERIFICATION, 0),
                    'rejected': state_counts.get(User.AccountState.REJECTED, 0),
                    'login_disabled': User.objects.filter(login_disabled=True).count(),
                },
                'roles': {
                    'customers': role_counts.get(User.Role.CUSTOMER, 0),
                    'vendors': role_counts.get(User.Role.VENDOR, 0),
                    'riders': role_counts.get(User.Role.RIDER, 0),
                    'admins': role_counts.get(User.Role.ADMIN, 0),
                },
                'risk': {
                    'low': risk_counts.get(User.RiskLevel.LOW, 0),
                    'medium': risk_counts.get(User.RiskLevel.MEDIUM, 0),
                    'high': risk_counts.get(User.RiskLevel.HIGH, 0),
                    'critical': risk_counts.get(User.RiskLevel.CRITICAL, 0),
                },
                'governance': {
                    'total_actions': actions.count(),
                    'actions_7d': actions_7d,
                    'pending_appeals': AccountAppeal.objects.filter(status=AppealStatus.PENDING).count(),
                    'open_investigations': state_counts.get(User.AccountState.UNDER_REVIEW, 0),
                    'pending_vendor_profiles': VendorProfile.objects.filter(is_approved=False).count(),
                    'pending_rider_profiles': RiderProfile.objects.filter(is_approved=False).count(),
                },
                'recent_actions': AccountActionSerializer(recent_actions, many=True).data,
                'recent_audit': AuditLogSerializer(recent_audit, many=True).data,
                'permissions': sorted(permissions_for_user(request.user)),
                'staff_role': request.user.staff_role,
            }
        )


class AdminUserListView(generics.ListAPIView):
    serializer_class = AdminUserListSerializer
    permission_classes = [HasAdminPermission]
    required_permissions = ('users.view',)
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = user_queryset()
        params = self.request.query_params
        search = (params.get('q') or '').strip()
        if search:
            from django.db.models import Q

            queryset = queryset.filter(
                Q(display_name__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(email__icontains=search)
                | Q(username__icontains=search)
                | Q(vendor_profile__business_name__icontains=search)
            )
        role = (params.get('role') or '').strip()
        if role and role != 'all':
            queryset = queryset.filter(role=role.upper())
        state = (params.get('state') or '').strip()
        if state and state != 'all':
            queryset = queryset.filter(account_state=state.upper())
        staff_role = (params.get('staff_role') or '').strip()
        if staff_role and staff_role != 'all':
            queryset = queryset.filter(staff_role=staff_role.upper())
        risk = (params.get('risk') or '').strip()
        if risk and risk != 'all':
            queryset = queryset.filter(risk_level=risk.upper())
        if params.get('login_disabled') == 'true':
            queryset = queryset.filter(login_disabled=True)

        ordering = params.get('ordering') or '-date_joined'
        allowed = {
            'date_joined', '-date_joined', 'last_login', '-last_login',
            'display_name', '-display_name', 'risk_score', '-risk_score',
            'violation_count', '-violation_count', 'order_count', '-order_count',
        }
        if ordering not in allowed:
            ordering = '-date_joined'
        return queryset.order_by(ordering, '-id')


class AdminUserDetailView(generics.RetrieveAPIView):
    serializer_class = AdminUserDetailSerializer
    permission_classes = [HasAdminPermission]
    required_permissions = ('users.view',)

    def get_queryset(self):
        return user_queryset()


class AdminUserActionsView(APIView):
    permission_classes = [HasAdminPermission]
    required_permissions = ('users.view',)

    def get(self, request, pk):
        target = get_object_or_404(User, pk=pk)
        actions = target.account_actions.select_related('actor').order_by('-created_at')[:100]
        return Response(AccountActionSerializer(actions, many=True).data)


class AdminUserActionView(APIView):
    permission_classes = [HasAdminPermission]
    required_permissions = ()

    def post(self, request, pk):
        target = get_object_or_404(User, pk=pk)
        serializer = ApplyActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        permission = ACTION_PERMISSIONS.get(data['action'])
        if not permission or not has_permission(request.user, permission):
            raise PermissionDenied('You do not have permission to perform this action.')

        record = apply_account_action(
            actor=request.user,
            target=target,
            action=data['action'],
            reason=data.get('reason', ''),
            category=data.get('violation_category'),
            evidence=data.get('evidence', ''),
            internal_notes=data.get('internal_notes', ''),
            duration_days=data.get('duration_days'),
            features=data.get('features', []),
            confirm=data.get('confirm', ''),
            request=request,
        )
        target.refresh_from_db()
        return Response(
            {
                'action': AccountActionSerializer(record).data,
                'user': AdminUserDetailSerializer(user_queryset().get(pk=target.pk)).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminUserExportView(APIView):
    permission_classes = [HasAdminPermission]
    required_permissions = ('users.export',)

    def get(self, request):
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="agiza-users.csv"'
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Name', 'Phone', 'Email', 'Role', 'Staff role', 'Account state',
            'Risk level', 'Risk score', 'Sign-in disabled', 'Joined', 'Last login',
        ])
        for user in user_queryset().order_by('-date_joined')[:10000]:
            writer.writerow([
                user.pk, user.name, user.phone, user.email, user.role, user.staff_role,
                user.account_state, user.risk_level, user.risk_score, user.login_disabled,
                user.date_joined.isoformat() if user.date_joined else '',
                user.last_login.isoformat() if user.last_login else '',
            ])
        record_audit(
            actor=request.user,
            action='users.exported',
            target_type='user',
            target_label='User directory',
            reason='CSV export from the control center.',
            new_values={'rows': min(user_queryset().count(), 10000)},
            request=request,
        )
        return response


class AdminStaffListView(generics.ListAPIView):
    serializer_class = StaffUserSerializer
    permission_classes = [HasAdminPermission]
    required_permissions = ('users.view',)
    pagination_class = StandardPagination

    def get_queryset(self):
        return (
            User.objects.filter(is_staff=True)
            .annotate(action_count=Count('account_actions'))
            .order_by('-date_joined')
        )


class AdminStaffRoleView(APIView):
    permission_classes = [HasAdminPermission]
    required_permissions = ('users.manage_roles',)

    def post(self, request, pk):
        target = get_object_or_404(User, pk=pk)
        serializer = StaffRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_role = serializer.validated_data['staff_role']
        reason = serializer.validated_data['reason'].strip()

        if target.is_superuser:
            raise BusinessRuleError('Django superuser roles must be managed in Django administration.')
        if new_role == User.StaffRole.SUPER_ADMIN and request.user.staff_role != User.StaffRole.SUPER_ADMIN:
            raise PermissionDenied('Only a super admin can grant the super admin role.')
        if (
            target.staff_role == User.StaffRole.SUPER_ADMIN
            and new_role != User.StaffRole.SUPER_ADMIN
            and User.objects.filter(staff_role=User.StaffRole.SUPER_ADMIN, is_active=True).count() <= 1
        ):
            raise BusinessRuleError('The last active super admin cannot be demoted.')

        previous = target_snapshot(target)
        target.staff_role = new_role
        if new_role == User.StaffRole.NONE:
            target.is_staff = False
            if target.role == User.Role.ADMIN:
                target.role = User.Role.CUSTOMER
        else:
            target.role = User.Role.ADMIN
            target.is_staff = True
        target.save(update_fields=['staff_role', 'is_staff', 'role', 'updated_at'])

        record_audit(
            actor=request.user,
            action='staff.role_changed',
            target_type='user',
            target_id=target.pk,
            target_label=target.name,
            reason=reason,
            previous_values=previous,
            new_values=target_snapshot(target),
            request=request,
        )
        notify(
            target,
            'ACCOUNT_ROLE_UPDATED',
            dedupe_key=f'staff-role:{target.pk}:{target.staff_role}:{timezone.now().timestamp()}',
            ctx={'role': target.get_staff_role_display()},
        )
        return Response(StaffUserSerializer(target).data)


class AdminAuditListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [HasAdminPermission]
    required_permissions = ('audit.view',)
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = AdminAuditLog.objects.select_related('actor')
        params = self.request.query_params
        action = (params.get('action') or '').strip()
        if action and action != 'all':
            queryset = queryset.filter(action=action)
        target_type = (params.get('target_type') or '').strip()
        if target_type and target_type != 'all':
            queryset = queryset.filter(target_type=target_type)
        actor = (params.get('actor') or '').strip()
        if actor:
            queryset = queryset.filter(actor_id=actor)
        search = (params.get('q') or '').strip()
        if search:
            from django.db.models import Q

            queryset = queryset.filter(
                Q(target_label__icontains=search)
                | Q(reason__icontains=search)
                | Q(action__icontains=search)
                | Q(actor_label__icontains=search)
            )
        date_from = (params.get('from') or '').strip()
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        date_to = (params.get('to') or '').strip()
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        return queryset


class AdminAppealListView(generics.ListAPIView):
    serializer_class = AccountAppealSerializer
    permission_classes = [HasAdminPermission]
    required_permissions = ('appeals.view',)
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = AccountAppeal.objects.select_related('user', 'action', 'reviewed_by')
        appeal_status = (self.request.query_params.get('status') or '').strip()
        if appeal_status and appeal_status != 'all':
            queryset = queryset.filter(status=appeal_status.upper())
        return queryset


class AdminAppealDecideView(APIView):
    permission_classes = [HasAdminPermission]
    required_permissions = ('appeals.decide',)

    def post(self, request, pk):
        appeal = get_object_or_404(AccountAppeal.objects.select_related('user', 'action'), pk=pk)
        serializer = DecideAppealSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['status']
        reason = serializer.validated_data['decision_reason'].strip()

        previous = {'status': appeal.status, 'decision_reason': appeal.decision_reason}
        appeal.status = new_status
        appeal.reviewed_by = request.user
        appeal.decision_reason = reason
        appeal.reviewed_at = timezone.now()
        appeal.save(update_fields=['status', 'reviewed_by', 'decision_reason', 'reviewed_at', 'updated_at'])

        if new_status == AppealStatus.APPROVED:
            apply_account_action(
                actor=request.user,
                target=appeal.user,
                action=ActionType.RESTORE,
                reason=f'Appeal #{appeal.pk} approved. {reason}',
                category=appeal.action.violation_category if appeal.action else 'OTHER',
                internal_notes=f'Appeal #{appeal.pk} approved.',
                request=request,
            )

        record_audit(
            actor=request.user,
            action='appeal.decided',
            target_type='appeal',
            target_id=appeal.pk,
            target_label=f'Appeal from {appeal.user.name}',
            reason=reason,
            previous_values=previous,
            new_values={'status': appeal.status, 'decision_reason': reason},
            request=request,
        )
        notify(
            appeal.user,
            'ACCOUNT_APPEAL_DECIDED',
            dedupe_key=f'appeal:{appeal.pk}:{appeal.status}',
            ctx={
                'outcome': appeal.get_status_display(),
                'reason': reason,
            },
        )
        return Response(AccountAppealSerializer(appeal).data)


class MyPermissionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                'staff_role': request.user.staff_role,
                'account_state': request.user.account_state,
                'permissions': sorted(permissions_for_user(request.user)),
                'is_control_center_user': is_control_center_user(request.user),
                'restrictable_features': [
                    {'key': key, 'label': label}
                    for key, label in RESTRICTABLE_FEATURES.items()
                ],
            }
        )


class PublicAppealView(APIView):
    """Let a blocked user appeal without signing in.

    The response is intentionally generic so the endpoint cannot be used to
    discover which phone numbers have Agiza accounts.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        from users.web_auth import normalize_phone

        serializer = PublicAppealSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = normalize_phone(serializer.validated_data['phone'])
        message = serializer.validated_data['message'].strip()

        rate_key = f'public_appeal:{phone}'
        if cache.get(rate_key):
            return Response(
                {'message': 'Your appeal has already been received. Our team will review it.'},
                status=status.HTTP_202_ACCEPTED,
            )
        cache.set(rate_key, '1', timeout=60 * 60 * 6)

        user = User.objects.filter(phone=phone).first()
        appealable_states = {
            User.AccountState.WARNING,
            User.AccountState.UNDER_REVIEW,
            User.AccountState.TEMPORARILY_SUSPENDED,
            User.AccountState.RESTRICTED,
            User.AccountState.TERMINATED,
            User.AccountState.REJECTED,
        }
        if user and user.account_state in appealable_states:
            already_open = AccountAppeal.objects.filter(
                user=user,
                status__in=[AppealStatus.PENDING, AppealStatus.UNDER_REVIEW],
            ).exists()
            if not already_open:
                action = user.account_actions.order_by('-created_at').first()
                appeal = AccountAppeal.objects.create(user=user, action=action, message=message)
                record_audit(
                    actor=None,
                    action='appeal.public_created',
                    target_type='appeal',
                    target_id=appeal.pk,
                    target_label=f'Appeal from {user.name}',
                    reason='Blocked user submitted an appeal from the sign-in page.',
                    new_values={'status': appeal.status, 'account_state': user.account_state},
                    request=request,
                )
                notify(
                    user,
                    'ACCOUNT_APPEAL_RECEIVED',
                    dedupe_key=f'appeal:{appeal.pk}:received',
                )
        return Response(
            {'message': 'Your appeal has been received. Our team will review it.'},
            status=status.HTTP_202_ACCEPTED,
        )


class MyAppealsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        appeals = request.user.account_appeals.select_related('action', 'reviewed_by')
        return Response(AccountAppealSerializer(appeals, many=True).data)

    def post(self, request):
        serializer = CreateAppealSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        appealable_states = {
            User.AccountState.WARNING,
            User.AccountState.UNDER_REVIEW,
            User.AccountState.TEMPORARILY_SUSPENDED,
            User.AccountState.RESTRICTED,
            User.AccountState.TERMINATED,
            User.AccountState.REJECTED,
        }
        if user.account_state not in appealable_states:
            raise BusinessRuleError('There is no active account decision to appeal.')
        if AccountAppeal.objects.filter(
            user=user,
            status__in=[AppealStatus.PENDING, AppealStatus.UNDER_REVIEW],
        ).exists():
            raise BusinessRuleError('You already have an appeal under review.')

        action = None
        action_id = serializer.validated_data.get('action_id')
        if action_id:
            action = get_object_or_404(AccountAction, pk=action_id, target=user)
        else:
            action = user.account_actions.order_by('-created_at').first()

        appeal = AccountAppeal.objects.create(
            user=user,
            action=action,
            message=serializer.validated_data['message'].strip(),
        )
        record_audit(
            actor=user,
            action='appeal.created',
            target_type='appeal',
            target_id=appeal.pk,
            target_label=f'Appeal from {user.name}',
            reason='User submitted an account appeal.',
            new_values={'status': appeal.status, 'account_state': user.account_state},
            request=request,
        )
        notify(
            user,
            'ACCOUNT_APPEAL_RECEIVED',
            dedupe_key=f'appeal:{appeal.pk}:received',
        )
        return Response(AccountAppealSerializer(appeal).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Platform operations — live orders, food, riders, vendors and payments
# ---------------------------------------------------------------------------

PENDING_ORDER_STATUSES = ('PENDING_VENDOR_CONFIRMATION',)
ACTIVE_ORDER_STATUSES = (
    'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'AWAITING_RIDER',
    'RIDER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY',
)
DELIVERED_ORDER_STATUSES = ('DELIVERED', 'COMPLETED')
CANCELLED_ORDER_STATUSES = ('REJECTED', 'EXPIRED', 'CANCELLED')


def _platform_range_days(value, default=14, maximum=90):
    try:
        days = int(value)
    except (TypeError, ValueError):
        return default
    return max(1, min(days, maximum))


def _money(value):
    if value is None:
        return '0.00'
    return str(Decimal(str(value)).quantize(Decimal('0.01')))


def _platform_order_queryset():
    from orders.models import Order

    return Order.objects.select_related(
        'customer', 'vendor', 'delivery_job__rider__user'
    ).annotate(item_count=Count('items'))


class AdminPlatformOverviewView(APIView):
    """Aggregated movement across orders, food, riders, vendors and payments."""

    permission_classes = [HasAdminPermission]
    required_permissions = ('orders.view', 'reports.view')
    permission_mode = 'any'

    def get(self, request):
        from orders.models import Order, OrderItem
        from payments.models import Payment
        from riders.models import DeliveryJob, RiderProfile
        from vendors.models import MenuItem, Review, VendorProfile

        days = _platform_range_days(request.query_params.get('days'))
        now = timezone.now()
        start = now - timedelta(days=days)
        today = timezone.localdate()

        orders = Order.objects.all()
        in_range = orders.filter(created_at__gte=start)
        today_orders = orders.filter(created_at__date=today)

        total_orders = orders.count()
        delivered_count = in_range.filter(status__in=DELIVERED_ORDER_STATUSES).count()
        cancelled_count = in_range.filter(status__in=CANCELLED_ORDER_STATUSES).count()
        gmv_in_range = in_range.aggregate(total=Sum('total'))['total'] or Decimal('0.00')
        gmv_today = today_orders.aggregate(total=Sum('total'))['total'] or Decimal('0.00')
        in_range_count = in_range.count()
        avg_order_value = (
            (gmv_in_range / in_range_count) if in_range_count else Decimal('0.00')
        )
        completion_rate = (
            round((delivered_count / in_range_count) * 100, 1) if in_range_count else 0.0
        )

        rider_qs = RiderProfile.objects.all()
        active_jobs = DeliveryJob.objects.filter(status__in=('ASSIGNED', 'PICKED_UP'))
        today_jobs = DeliveryJob.objects.filter(delivered_at__date=today)
        rider_earnings_today = today_jobs.aggregate(
            total=Sum(F('delivery_fee') + F('rider_tip'))
        )['total'] or Decimal('0.00')

        vendor_qs = VendorProfile.objects.all()
        menu_qs = MenuItem.objects.all()
        reviews = Review.objects.all()

        payments = Payment.objects.all()
        payment_rows = (
            payments.filter(created_at__gte=start)
            .values('status')
            .annotate(count=Count('id'), amount=Sum('amount'))
        )
        payment_summary = {
            'total': payments.count(),
            'in_range': payments.filter(created_at__gte=start).count(),
            'paid': 0, 'pending': 0, 'failed': 0, 'refunded': 0, 'unpaid': 0,
            'paid_amount': '0.00', 'pending_amount': '0.00', 'failed_amount': '0.00',
            'refunded_amount': '0.00', 'unpaid_amount': '0.00',
        }
        for row in payment_rows:
            key = str(row['status'] or '').lower()
            if key in ('paid', 'pending', 'failed', 'refunded', 'unpaid'):
                payment_summary[key] = row['count']
                payment_summary[f'{key}_amount'] = _money(row['amount'])

        daily_rows = (
            in_range.annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(orders=Count('id'), gmv=Sum('total'))
            .order_by('day')
        )
        daily_map = {row['day']: row for row in daily_rows}
        daily = []
        cursor = timezone.localtime(start).date()
        end_date = today
        while cursor <= end_date:
            row = daily_map.get(cursor)
            daily.append(
                {
                    'date': cursor.isoformat(),
                    'orders': row['orders'] if row else 0,
                    'gmv': float(row['gmv'] or 0) if row else 0.0,
                }
            )
            cursor += timedelta(days=1)

        status_rows = (
            in_range.values('status').annotate(count=Count('id')).order_by('-count')
        )
        status_breakdown = [
            {
                'status': row['status'],
                'label': ORDER_STATUS_LABELS.get(row['status'], row['status']),
                'count': row['count'],
            }
            for row in status_rows
        ]

        recent_orders = _platform_order_queryset().order_by('-created_at')[:8]

        top_vendors = (
            vendor_qs.filter(
                orders__created_at__gte=start,
                orders__status__in=DELIVERED_ORDER_STATUSES,
            )
            .annotate(
                order_count=Count(
                    'orders',
                    filter=Q(
                        orders__created_at__gte=start,
                        orders__status__in=DELIVERED_ORDER_STATUSES,
                    ),
                    distinct=True,
                ),
                revenue=Sum(
                    'orders__total',
                    filter=Q(
                        orders__created_at__gte=start,
                        orders__status__in=DELIVERED_ORDER_STATUSES,
                    ),
                ),
            )
            .order_by('-revenue')[:5]
        )
        top_vendor_rows = [
            {
                'id': vendor.pk,
                'name': vendor.business_name,
                'orders': vendor.order_count,
                'revenue': _money(vendor.revenue),
            }
            for vendor in top_vendors
        ]

        top_items = (
            OrderItem.objects.filter(order__created_at__gte=start)
            .values('name', 'order__vendor__business_name')
            .annotate(
                quantity=Sum('quantity'),
                revenue=Sum('line_total'),
                orders=Count('order', distinct=True),
            )
            .order_by('-quantity')[:5]
        )
        top_item_rows = [
            {
                'name': row['name'],
                'vendor': row['order__vendor__business_name'],
                'quantity': row['quantity'],
                'revenue': _money(row['revenue']),
                'orders': row['orders'],
            }
            for row in top_items
        ]

        top_riders = (
            rider_qs.filter(
                jobs__status='DELIVERED',
                jobs__delivered_at__gte=start,
            )
            .select_related('user')
            .annotate(
                deliveries=Count(
                    'jobs',
                    filter=Q(jobs__status='DELIVERED', jobs__delivered_at__gte=start),
                    distinct=True,
                ),
                earnings=Sum(
                    F('jobs__delivery_fee') + F('jobs__rider_tip'),
                    filter=Q(jobs__status='DELIVERED', jobs__delivered_at__gte=start),
                ),
            )
            .order_by('-deliveries')[:5]
        )
        top_rider_rows = [
            {
                'id': rider.pk,
                'name': rider.user.name,
                'deliveries': rider.deliveries,
                'earnings': _money(rider.earnings),
            }
            for rider in top_riders
        ]

        avg_rating = reviews.aggregate(avg=Avg('rating'))['avg'] or 0

        payload = {
            'generated_at': now.isoformat(),
            'range_days': days,
            'orders': {
                'total': total_orders,
                'today': today_orders.count(),
                'in_range': in_range_count,
                'pending': orders.filter(status__in=PENDING_ORDER_STATUSES).count(),
                'in_progress': orders.filter(status__in=ACTIVE_ORDER_STATUSES).count(),
                'delivered': delivered_count,
                'cancelled': cancelled_count,
                'gmv_today': _money(gmv_today),
                'gmv_in_range': _money(gmv_in_range),
                'avg_order_value': _money(avg_order_value),
                'completion_rate': completion_rate,
            },
            'riders': {
                'total': rider_qs.count(),
                'approved': rider_qs.filter(is_approved=True).count(),
                'online': rider_qs.filter(is_online=True).count(),
                'active_jobs': active_jobs.count(),
                'deliveries_today': today_jobs.count(),
                'earnings_today': _money(rider_earnings_today),
            },
            'vendors': {
                'total': vendor_qs.count(),
                'approved': vendor_qs.filter(is_approved=True).count(),
                'online': vendor_qs.filter(is_online=True).count(),
                'pending': vendor_qs.filter(is_approved=False).count(),
            },
            'users': {
                'total': User.objects.count(),
                'customers': User.objects.filter(role=User.Role.CUSTOMER).count(),
                'vendors': User.objects.filter(role=User.Role.VENDOR).count(),
                'riders': User.objects.filter(role=User.Role.RIDER).count(),
                'admins': User.objects.filter(role=User.Role.ADMIN).count(),
                'new_today': User.objects.filter(date_joined__date=today).count(),
            },
            'food': {
                'menu_items': menu_qs.count(),
                'available': menu_qs.filter(availability_status='AVAILABLE').count(),
                'sold_out': menu_qs.filter(availability_status='SOLD_OUT').count(),
                'hidden': menu_qs.filter(availability_status='HIDDEN').count(),
                'archived': menu_qs.filter(is_archived=True).count(),
                'reviews': reviews.count(),
                'average_rating': round(float(avg_rating), 2),
            },
            'payments': payment_summary,
            'daily': daily,
            'status_breakdown': status_breakdown,
            'recent_orders': AdminOrderListSerializer(recent_orders, many=True).data,
            'top_vendors': top_vendor_rows,
            'top_items': top_item_rows,
            'top_riders': top_rider_rows,
        }
        return Response(payload)


class AdminOrderListView(generics.ListAPIView):
    serializer_class = AdminOrderListSerializer
    permission_classes = [HasAdminPermission]
    required_permissions = ('orders.view',)
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = _platform_order_queryset()
        params = self.request.query_params
        search = (params.get('q') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(code__icontains=search)
                | Q(customer__display_name__icontains=search)
                | Q(customer__first_name__icontains=search)
                | Q(customer__last_name__icontains=search)
                | Q(customer__phone__icontains=search)
                | Q(customer__email__icontains=search)
                | Q(vendor__business_name__icontains=search)
                | Q(delivery_job__rider__user__display_name__icontains=search)
            )
        order_status = (params.get('status') or '').strip()
        if order_status and order_status != 'all':
            if order_status == 'pending':
                queryset = queryset.filter(status__in=PENDING_ORDER_STATUSES)
            elif order_status == 'in_progress':
                queryset = queryset.filter(status__in=ACTIVE_ORDER_STATUSES)
            elif order_status == 'delivered':
                queryset = queryset.filter(status__in=DELIVERED_ORDER_STATUSES)
            elif order_status == 'cancelled':
                queryset = queryset.filter(status__in=CANCELLED_ORDER_STATUSES)
            else:
                queryset = queryset.filter(status=order_status.upper())
        order_type = (params.get('order_type') or '').strip()
        if order_type and order_type != 'all':
            queryset = queryset.filter(order_type=order_type.upper())
        payment_status = (params.get('payment_status') or '').strip()
        if payment_status and payment_status != 'all':
            queryset = queryset.filter(payment_status=payment_status.upper())
        vendor = (params.get('vendor') or '').strip()
        if vendor:
            queryset = queryset.filter(vendor_id=vendor)
        rider = (params.get('rider') or '').strip()
        if rider:
            queryset = queryset.filter(delivery_job__rider_id=rider)
        date_from = (params.get('from') or '').strip()
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        date_to = (params.get('to') or '').strip()
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        ordering = params.get('ordering') or '-created_at'
        allowed = {
            'created_at', '-created_at', 'total', '-total', 'status', '-status',
            'finished_at', '-finished_at',
        }
        if ordering not in allowed:
            ordering = '-created_at'
        return queryset.order_by(ordering, '-id')


class AdminOrderDetailView(generics.RetrieveAPIView):
    serializer_class = AdminOrderDetailSerializer
    permission_classes = [HasAdminPermission]
    required_permissions = ('orders.view',)

    def get_queryset(self):
        from orders.models import Order

        return Order.objects.select_related(
            'customer', 'vendor', 'delivery_job__rider__user'
        ).prefetch_related('items', 'status_history').annotate(item_count=Count('items'))


class AdminRiderListView(generics.ListAPIView):
    serializer_class = AdminRiderSerializer
    permission_classes = [HasAdminPermission]
    required_permissions = ('orders.view',)
    pagination_class = StandardPagination

    def get_queryset(self):
        from riders.models import DeliveryJob, RiderProfile

        jobs = DeliveryJob.objects.filter(rider=OuterRef('pk'))
        active = (
            jobs.filter(status__in=('ASSIGNED', 'PICKED_UP'))
            .values('rider')
            .annotate(total=Count('id'))
            .values('total')
        )
        completed = (
            jobs.filter(status='DELIVERED')
            .values('rider')
            .annotate(total=Count('id'))
            .values('total')
        )
        earnings = (
            jobs.filter(status='DELIVERED')
            .values('rider')
            .annotate(total=Sum(F('delivery_fee') + F('rider_tip')))
            .values('total')
        )
        money_output = DecimalField(max_digits=14, decimal_places=2)
        queryset = RiderProfile.objects.select_related('user').annotate(
            active_jobs=Coalesce(Subquery(active), 0),
            completed_jobs=Coalesce(Subquery(completed), 0),
            earnings=Coalesce(
                Subquery(earnings, output_field=money_output),
                Value(Decimal('0.00')),
                output_field=money_output,
            ),
        )
        params = self.request.query_params
        search = (params.get('q') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(user__display_name__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(user__phone__icontains=search)
                | Q(user__email__icontains=search)
                | Q(license_plate__icontains=search)
            )
        online = (params.get('online') or '').strip()
        if online in ('true', 'false'):
            queryset = queryset.filter(is_online=online == 'true')
        approved = (params.get('approved') or '').strip()
        if approved in ('true', 'false'):
            queryset = queryset.filter(is_approved=approved == 'true')
        ordering = params.get('ordering') or '-created_at'
        allowed = {
            'created_at', '-created_at', 'total_deliveries', '-total_deliveries',
            'rating_avg', '-rating_avg', 'user__display_name', '-user__display_name',
        }
        if ordering not in allowed:
            ordering = '-created_at'
        return queryset.order_by(ordering, '-id')


class AdminDeliveryListView(generics.ListAPIView):
    serializer_class = AdminDeliverySerializer
    permission_classes = [HasAdminPermission]
    required_permissions = ('orders.view',)
    pagination_class = StandardPagination

    def get_queryset(self):
        from riders.models import DeliveryJob

        queryset = DeliveryJob.objects.select_related('order', 'rider__user')
        params = self.request.query_params
        search = (params.get('q') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(order__code__icontains=search)
                | Q(rider__user__display_name__icontains=search)
                | Q(rider__user__phone__icontains=search)
                | Q(pickup_name__icontains=search)
                | Q(dropoff_address__icontains=search)
            )
        job_status = (params.get('status') or '').strip()
        if job_status and job_status != 'all':
            queryset = queryset.filter(status=job_status.upper())
        rider = (params.get('rider') or '').strip()
        if rider:
            queryset = queryset.filter(rider_id=rider)
        date_from = (params.get('from') or '').strip()
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        date_to = (params.get('to') or '').strip()
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        ordering = params.get('ordering') or '-created_at'
        allowed = {
            'created_at', '-created_at', 'delivery_fee', '-delivery_fee',
            'delivered_at', '-delivered_at',
        }
        if ordering not in allowed:
            ordering = '-created_at'
        return queryset.order_by(ordering, '-id')


class AdminVendorListView(generics.ListAPIView):
    serializer_class = AdminVendorSerializer
    permission_classes = [HasAdminPermission]
    required_permissions = ('users.view', 'reports.view')
    permission_mode = 'any'
    pagination_class = StandardPagination

    def get_queryset(self):
        from orders.models import Order
        from vendors.models import MenuItem, VendorProfile

        orders = Order.objects.filter(vendor=OuterRef('pk'))
        order_count = orders.values('vendor').annotate(total=Count('id')).values('total')
        revenue = (
            orders.filter(status__in=DELIVERED_ORDER_STATUSES)
            .values('vendor')
            .annotate(total=Sum('total'))
            .values('total')
        )
        menu_count = (
            MenuItem.objects.filter(vendor=OuterRef('pk'), is_archived=False)
            .values('vendor')
            .annotate(total=Count('id'))
            .values('total')
        )
        money_output = DecimalField(max_digits=14, decimal_places=2)
        queryset = VendorProfile.objects.select_related('owner').annotate(
            order_count=Coalesce(Subquery(order_count), 0),
            revenue=Coalesce(
                Subquery(revenue, output_field=money_output),
                Value(Decimal('0.00')),
                output_field=money_output,
            ),
            menu_item_count=Coalesce(Subquery(menu_count), 0),
        )
        params = self.request.query_params
        search = (params.get('q') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(business_name__icontains=search)
                | Q(owner__display_name__icontains=search)
                | Q(owner__first_name__icontains=search)
                | Q(owner__last_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(address__icontains=search)
            )
        approved = (params.get('approved') or '').strip()
        if approved in ('true', 'false'):
            queryset = queryset.filter(is_approved=approved == 'true')
        online = (params.get('online') or '').strip()
        if online in ('true', 'false'):
            queryset = queryset.filter(is_online=online == 'true')
        ordering = params.get('ordering') or '-created_at'
        allowed = {
            'created_at', '-created_at', 'business_name', '-business_name',
            'rating_avg', '-rating_avg',
        }
        if ordering not in allowed:
            ordering = '-created_at'
        return queryset.order_by(ordering, '-id')


class AdminMenuItemListView(generics.ListAPIView):
    serializer_class = AdminMenuItemSerializer
    permission_classes = [HasAdminPermission]
    required_permissions = ('users.view', 'content.view')
    permission_mode = 'any'
    pagination_class = StandardPagination

    def get_queryset(self):
        from orders.models import OrderItem
        from vendors.models import MenuItem

        order_items = OrderItem.objects.filter(menu_item=OuterRef('pk'))
        order_count = (
            order_items.values('menu_item')
            .annotate(total=Count('order', distinct=True))
            .values('total')
        )
        quantity = (
            order_items.values('menu_item').annotate(total=Sum('quantity')).values('total')
        )
        revenue = (
            order_items.values('menu_item').annotate(total=Sum('line_total')).values('total')
        )
        money_output = DecimalField(max_digits=14, decimal_places=2)
        queryset = MenuItem.objects.select_related('vendor', 'category').annotate(
            order_count=Coalesce(Subquery(order_count), 0),
            quantity_sold=Coalesce(Subquery(quantity), 0),
            revenue=Coalesce(
                Subquery(revenue, output_field=money_output),
                Value(Decimal('0.00')),
                output_field=money_output,
            ),
        )
        params = self.request.query_params
        search = (params.get('q') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(vendor__business_name__icontains=search)
                | Q(category__name__icontains=search)
            )
        vendor = (params.get('vendor') or '').strip()
        if vendor:
            queryset = queryset.filter(vendor_id=vendor)
        availability = (params.get('availability') or '').strip()
        if availability and availability != 'all':
            queryset = queryset.filter(availability_status=availability.upper())
        archived = (params.get('archived') or '').strip()
        if archived in ('true', 'false'):
            queryset = queryset.filter(is_archived=archived == 'true')
        ordering = params.get('ordering') or '-created_at'
        allowed = {
            'created_at', '-created_at', 'name', '-name', 'price', '-price',
        }
        if ordering not in allowed:
            ordering = '-created_at'
        return queryset.order_by(ordering, '-id')


class AdminReviewListView(generics.ListAPIView):
    serializer_class = AdminReviewSerializer
    permission_classes = [HasAdminPermission]
    required_permissions = ('users.view', 'content.view')
    permission_mode = 'any'
    pagination_class = StandardPagination

    def get_queryset(self):
        from vendors.models import Review

        queryset = Review.objects.select_related('order', 'vendor', 'customer')
        params = self.request.query_params
        search = (params.get('q') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(comment__icontains=search)
                | Q(vendor__business_name__icontains=search)
                | Q(customer__display_name__icontains=search)
                | Q(order__code__icontains=search)
            )
        rating = (params.get('rating') or '').strip()
        if rating and rating != 'all':
            queryset = queryset.filter(rating=rating)
        vendor = (params.get('vendor') or '').strip()
        if vendor:
            queryset = queryset.filter(vendor_id=vendor)
        return queryset.order_by('-created_at', '-id')


class AdminPaymentListView(generics.ListAPIView):
    serializer_class = AdminPaymentSerializer
    permission_classes = [HasAdminPermission]
    required_permissions = ('finance.view', 'orders.view')
    permission_mode = 'any'
    pagination_class = StandardPagination

    def get_queryset(self):
        from payments.models import Payment

        queryset = Payment.objects.select_related('order', 'payer')
        params = self.request.query_params
        search = (params.get('q') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(order__code__icontains=search)
                | Q(payer__display_name__icontains=search)
                | Q(payer__phone__icontains=search)
                | Q(provider_reference__icontains=search)
            )
        payment_status = (params.get('status') or '').strip()
        if payment_status and payment_status != 'all':
            queryset = queryset.filter(status=payment_status.upper())
        method = (params.get('method') or '').strip()
        if method and method != 'all':
            queryset = queryset.filter(method=method.upper())
        date_from = (params.get('from') or '').strip()
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        date_to = (params.get('to') or '').strip()
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        ordering = params.get('ordering') or '-created_at'
        allowed = {
            'created_at', '-created_at', 'amount', '-amount', 'status', '-status',
        }
        if ordering not in allowed:
            ordering = '-created_at'
        return queryset.order_by(ordering, '-id')
