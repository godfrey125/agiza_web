from django.urls import path

from . import views

urlpatterns = [
    path('summary/', views.AdminSummaryView.as_view(), name='admin-summary'),
    path('users/', views.AdminUserListView.as_view(), name='admin-users'),
    path('users/export/', views.AdminUserExportView.as_view(), name='admin-users-export'),
    path('users/<int:pk>/', views.AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('users/<int:pk>/actions/', views.AdminUserActionView.as_view(), name='admin-user-action'),
    path('users/<int:pk>/history/', views.AdminUserActionsView.as_view(), name='admin-user-history'),
    path('staff/', views.AdminStaffListView.as_view(), name='admin-staff'),
    path('staff/<int:pk>/role/', views.AdminStaffRoleView.as_view(), name='admin-staff-role'),
    path('audit/', views.AdminAuditListView.as_view(), name='admin-audit'),
    path('appeals/', views.AdminAppealListView.as_view(), name='admin-appeals'),
    path('appeals/<int:pk>/decide/', views.AdminAppealDecideView.as_view(), name='admin-appeal-decide'),
    path('platform/overview/', views.AdminPlatformOverviewView.as_view(), name='admin-platform-overview'),
    path('platform/orders/', views.AdminOrderListView.as_view(), name='admin-platform-orders'),
    path('platform/orders/<int:pk>/', views.AdminOrderDetailView.as_view(), name='admin-platform-order-detail'),
    path('platform/riders/', views.AdminRiderListView.as_view(), name='admin-platform-riders'),
    path('platform/deliveries/', views.AdminDeliveryListView.as_view(), name='admin-platform-deliveries'),
    path('platform/vendors/', views.AdminVendorListView.as_view(), name='admin-platform-vendors'),
    path('platform/menu-items/', views.AdminMenuItemListView.as_view(), name='admin-platform-menu-items'),
    path('platform/reviews/', views.AdminReviewListView.as_view(), name='admin-platform-reviews'),
    path('platform/payments/', views.AdminPaymentListView.as_view(), name='admin-platform-payments'),
]
