from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('deliveries', views.DeliveryJobViewSet, basename='delivery')

urlpatterns = [
    path('riders/me/', views.MyRiderView.as_view(), name='my-rider'),
    path('riders/me/online/', views.RiderOnlineView.as_view(), name='rider-online'),
    path('riders/me/location/', views.RiderLocationView.as_view(), name='rider-location'),
    path('riders/me/earnings/', views.RiderEarningsView.as_view(), name='rider-earnings'),
    *router.urls,
]
