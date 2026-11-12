from django.urls import path

from . import views

urlpatterns = [
    path('track/', views.track_visit, name='track-visit'),
    path('dashboard/', views.admin_dashboard, name='admin-dashboard'),
]
