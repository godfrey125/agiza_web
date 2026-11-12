from django.urls import path

from .views import (
    AdminApplicationDecisionView,
    AdminApplicationListView,
    ApplicationSubmitView,
    MyApplicationView,
    RequirementListView,
)

app_name = 'partners'

urlpatterns = [
    path('application-requirements/', RequirementListView.as_view(), name='requirements'),
    path(
        'vendor-applications/',
        ApplicationSubmitView.as_view(),
        {'application_type': 'vendor'},
        name='vendor-submit',
    ),
    path(
        'rider-applications/',
        ApplicationSubmitView.as_view(),
        {'application_type': 'rider'},
        name='rider-submit',
    ),
    path(
        'vendor-applications/me/',
        MyApplicationView.as_view(),
        {'application_type': 'vendor'},
        name='vendor-me',
    ),
    path(
        'rider-applications/me/',
        MyApplicationView.as_view(),
        {'application_type': 'rider'},
        name='rider-me',
    ),
    path('admin/applications/', AdminApplicationListView.as_view(), name='admin-applications'),
    path(
        'admin/applications/<int:pk>/decision/',
        AdminApplicationDecisionView.as_view(),
        name='admin-application-decision',
    ),
]
