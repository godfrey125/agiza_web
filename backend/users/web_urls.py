from django.urls import path

from .supabase_auth import supabase_exchange
from .web_auth import (
    WebMeView,
    WebTokenRefreshView,
    password_login,
    request_otp,
    verify_otp,
)

urlpatterns = [
    path('users/auth/request-otp/', request_otp, name='web-request-otp'),
    path('users/auth/verify-otp/', verify_otp, name='web-verify-otp'),
    path('users/auth/password-login/', password_login, name='web-password-login'),
    path('users/auth/supabase/', supabase_exchange, name='web-supabase-exchange'),
    path('users/auth/token/refresh/', WebTokenRefreshView.as_view(), name='web-token-refresh'),
    path('users/me/', WebMeView.as_view(), name='web-me'),
]
