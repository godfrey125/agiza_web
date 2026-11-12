from django.urls import path

from . import views

urlpatterns = [
    path('permissions/', views.MyPermissionsView.as_view(), name='account-permissions'),
    path('appeals/', views.MyAppealsView.as_view(), name='account-appeals'),
    path('appeals/public/', views.PublicAppealView.as_view(), name='account-public-appeal'),
]
