from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('vendors/me/menu-items', views.MyMenuItemViewSet, basename='my-menu-item')
router.register('vendors/me/menu-categories', views.MyMenuCategoryViewSet, basename='my-menu-category')
router.register('vendors', views.VendorViewSet, basename='vendor')

urlpatterns = [
    path('vendors/me/', views.MyVendorView.as_view(), name='my-vendor'),
    path('vendors/me/delivery-policy/', views.MyDeliveryPolicyView.as_view(), name='my-delivery-policy'),
    path('vendors/me/online/', views.MyOnlineStatusView.as_view(), name='my-vendor-online'),
    path('vendor-categories/', views.VendorCategoryListView.as_view(), name='vendor-categories'),
    path('menu/search/', views.MenuSearchView.as_view(), name='menu-search'),
    path('map/vendors/', views.MapVendorsView.as_view(), name='map-vendors'),
    *router.urls,
]
