from datetime import timedelta
from urllib.parse import urlparse

from django.contrib.auth import get_user_model
from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from orders.models import TERMINAL_STATUSES, Order
from riders.models import RiderProfile
from vendors.models import VendorProfile

from .models import PageVisit
from .serializers import TrackVisitSerializer
from .user_agents import parse_user_agent

User = get_user_model()


def _is_staff(user):
    return bool(
        user
        and user.is_authenticated
        and (
            user.is_staff
            or getattr(user, 'role', None) in ('ADMIN', 'admin')
        )
    )


def _pct_change(current, previous):
    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 1)


def _range_days(value):
    try:
        days = int(value)
    except (TypeError, ValueError):
        return 7
    return max(1, min(days, 365))


@api_view(['POST'])
@permission_classes([AllowAny])
def track_visit(request):
    serializer = TrackVisitSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    user_agent = request.META.get('HTTP_USER_AGENT', '')[:1000]
    parsed = parse_user_agent(user_agent)

    referrer = (data.get('referrer') or '').strip()
    referrer_host = urlparse(referrer).netloc.lower() if referrer else ''
    if referrer_host.startswith('www.'):
        referrer_host = referrer_host[4:]

    user = request.user if request.user.is_authenticated else None

    _, created = PageVisit.objects.get_or_create(
        visit_id=data['visit_id'],
        defaults={
            'visitor_id': data['visitor_id'],
            'session_id': data['session_id'],
            'path': data['path'],
            'full_path': data.get('full_path', ''),
            'referrer': referrer,
            'referrer_host': referrer_host,
            'user': user,
            'user_agent': user_agent,
            'device_type': parsed['device_type'],
            'browser': parsed['browser'],
            'operating_system': parsed['operating_system'],
            'language': data.get('language', ''),
            'is_bot': parsed['is_bot'],
            'is_staff': _is_staff(user),
        },
    )

    return Response(
        {'ok': True, 'recorded': created},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    if not _is_staff(request.user):
        return Response(
            {'detail': 'Staff access is required to view website analytics.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    days = _range_days(request.query_params.get('days'))
    now = timezone.now()
    start = now - timedelta(days=days)
    previous_start = start - timedelta(days=days)

    public_visits = PageVisit.objects.filter(is_bot=False, is_staff=False)
    range_visits = public_visits.filter(created_at__gte=start)
    previous_visits = public_visits.filter(
        created_at__gte=previous_start,
        created_at__lt=start,
    )

    page_views = range_visits.count()
    previous_page_views = previous_visits.count()
    unique_visitors = range_visits.values('visitor_id').distinct().count()
    previous_unique_visitors = previous_visits.values('visitor_id').distinct().count()
    sessions = range_visits.values('session_id').distinct().count()
    previous_sessions = previous_visits.values('session_id').distinct().count()
    logged_in_visitors = (
        range_visits.filter(user__isnull=False).values('user_id').distinct().count()
    )
    previous_logged_in_visitors = (
        previous_visits.filter(user__isnull=False).values('user_id').distinct().count()
    )

    prior_visitors = set(
        public_visits.filter(created_at__lt=start)
        .values_list('visitor_id', flat=True)
        .distinct()
    )
    visitors_in_range = set(
        range_visits.values_list('visitor_id', flat=True).distinct()
    )
    new_visitors = len(visitors_in_range - prior_visitors)
    returning_visitors = len(visitors_in_range & prior_visitors)

    active_now = (
        public_visits.filter(created_at__gte=now - timedelta(minutes=5))
        .values('visitor_id')
        .distinct()
        .count()
    )

    bot_page_views = PageVisit.objects.filter(
        is_bot=True,
        created_at__gte=start,
    ).count()
    staff_page_views = PageVisit.objects.filter(
        is_staff=True,
        created_at__gte=start,
    ).count()

    start_date = timezone.localtime(start).date()
    end_date = timezone.localdate()
    daily_rows = (
        range_visits.annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(
            views=Count('id'),
            visitors=Count('visitor_id', distinct=True),
        )
        .order_by('day')
    )
    daily_map = {row['day']: row for row in daily_rows}
    daily = []
    cursor = start_date
    while cursor <= end_date:
        row = daily_map.get(cursor)
        daily.append(
            {
                'date': cursor.isoformat(),
                'views': row['views'] if row else 0,
                'visitors': row['visitors'] if row else 0,
            }
        )
        cursor += timedelta(days=1)

    top_pages = list(
        range_visits.values('path')
        .annotate(
            views=Count('id'),
            visitors=Count('visitor_id', distinct=True),
        )
        .order_by('-views', 'path')[:8]
    )

    top_sources = []
    for row in (
        range_visits.values('referrer_host')
        .annotate(
            views=Count('id'),
            visitors=Count('visitor_id', distinct=True),
        )
        .order_by('-views')[:8]
    ):
        top_sources.append(
            {
                'source': row['referrer_host'] or 'Direct',
                'views': row['views'],
                'visitors': row['visitors'],
            }
        )

    devices = [
        {
            'device': row['device_type'],
            'views': row['views'],
            'visitors': row['visitors'],
        }
        for row in (
            range_visits.values('device_type')
            .annotate(
                views=Count('id'),
                visitors=Count('visitor_id', distinct=True),
            )
            .order_by('-views')
        )
    ]
    browsers = list(
        range_visits.values('browser')
        .annotate(
            views=Count('id'),
            visitors=Count('visitor_id', distinct=True),
        )
        .order_by('-views')[:8]
    )

    recent_visits = []
    for visit in (
        range_visits.select_related('user').order_by('-created_at')[:12]
    ):
        recent_visits.append(
            {
                'path': visit.path,
                'visitor': visit.user.name if visit.user else 'Guest',
                'time': visit.created_at.isoformat(),
                'device': visit.device_type,
                'browser': visit.browser or 'Unknown',
                'source': visit.referrer_host or 'Direct',
            }
        )

    orders = Order.objects.all()
    orders_in_range = orders.filter(created_at__gte=start)
    order_value = (
        orders_in_range.aggregate(total=Sum('total'))['total'] or 0
    )

    platform = {
        'total_users': User.objects.count(),
        'new_users': User.objects.filter(date_joined__gte=start).count(),
        'customers': User.objects.filter(role='CUSTOMER').count(),
        'vendors': User.objects.filter(role='VENDOR').count(),
        'riders': User.objects.filter(role='RIDER').count(),
        'admins': User.objects.filter(role='ADMIN').count(),
        'total_orders': orders.count(),
        'orders_in_range': orders_in_range.count(),
        'pending_orders': orders.exclude(
            status__in=list(TERMINAL_STATUSES)
        ).count(),
        'order_value_in_range': str(order_value),
        'vendor_profiles': VendorProfile.objects.count(),
        'rider_profiles': RiderProfile.objects.count(),
    }

    return Response(
        {
            'range_days': days,
            'generated_at': now.isoformat(),
            'range': {
                'start': start.isoformat(),
                'end': now.isoformat(),
            },
            'overview': {
                'page_views': page_views,
                'page_views_change': _pct_change(page_views, previous_page_views),
                'unique_visitors': unique_visitors,
                'unique_visitors_change': _pct_change(
                    unique_visitors,
                    previous_unique_visitors,
                ),
                'sessions': sessions,
                'sessions_change': _pct_change(sessions, previous_sessions),
                'logged_in_visitors': logged_in_visitors,
                'logged_in_visitors_change': _pct_change(
                    logged_in_visitors,
                    previous_logged_in_visitors,
                ),
                'new_visitors': new_visitors,
                'returning_visitors': returning_visitors,
                'active_now': active_now,
                'bot_page_views': bot_page_views,
                'staff_page_views': staff_page_views,
                'all_time_page_views': public_visits.count(),
                'all_time_unique_visitors': public_visits.values('visitor_id')
                .distinct()
                .count(),
            },
            'daily': daily,
            'top_pages': top_pages,
            'top_sources': top_sources,
            'devices': devices,
            'browsers': browsers,
            'recent_visits': recent_visits,
            'platform': platform,
        }
    )
