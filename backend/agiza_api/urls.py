from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

v1 = [
    path('', include('users.urls')),
    path('', include('vendors.urls')),
    path('', include('orders.urls')),
    path('', include('riders.urls')),
    path('', include('payments.urls')),
    path('', include('chat.urls')),
    path('', include('notifications.urls')),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include(v1)),
    # Public website auth contract (phone OTP + SimpleJWT).
    path('api/', include('users.web_urls')),
    # Website analytics and staff dashboard.
    path('api/analytics/', include('analytics.urls')),
    # Centralized administration, governance and audit.
    path('api/admin/', include('administration.urls')),
    path('api/account/', include('administration.account_urls')),
    # Partner (vendor/rider) application submissions and review.
    path('api/partner/', include('partners.urls')),
    path('api/health/', lambda r: JsonResponse({'ok': True})),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
