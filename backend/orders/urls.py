from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('carts', views.CartViewSet, basename='cart')
router.register('orders', views.OrderViewSet, basename='order')
router.register('custom-requests', views.CustomRequestViewSet, basename='custom-request')
router.register('offers', views.OfferViewSet, basename='offer')

urlpatterns = [
    path('dine-in-orders/', views.DineInOrderView.as_view(), name='dine-in-orders'),
    path('delivery-requests/', views.DeliveryRequestView.as_view(), name='delivery-requests'),
    path('delivery-requests/quote/', views.DeliveryQuoteView.as_view(), name='delivery-quote'),
    path('cancellations/', views.CancellationListView.as_view(), name='cancellations'),
    path('cancellations/reasons/', views.CancellationReasonsView.as_view(), name='cancellation-reasons'),
    path('vendors/me/sales-summary/', views.VendorSalesSummaryView.as_view(), name='vendor-sales-summary'),
    *router.urls,
]
