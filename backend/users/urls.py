from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('users/me/addresses', views.AddressViewSet, basename='address')

urlpatterns = [
    path('auth/me/', views.MeView.as_view(), name='auth-me'),
    path('users/me/', views.MeView.as_view(), name='users-me'),
    *router.urls,
]
