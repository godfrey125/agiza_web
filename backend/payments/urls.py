from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('payments', views.PaymentViewSet, basename='payment')

urlpatterns = [
    path('payments/orders/<int:order_id>/confirm-cash/', views.ConfirmCashView.as_view(), name='confirm-cash'),
    path('payments/orders/<int:order_id>/mobile-money/', views.InitiateMobileMoneyView.as_view(), name='mobile-money'),
    *router.urls,
]
