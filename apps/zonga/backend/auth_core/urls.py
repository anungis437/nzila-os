from django.urls import path

from . import views

app_name = "auth_core"

urlpatterns = [
    path("webhook/auth/", views.auth_webhook, name="auth-webhook"),
    path("webhook/clerk/", views.auth_webhook, name="clerk-webhook"),  # backward compat
    path("me/", views.me, name="me"),
    path("health/", views.health_check, name="health-check"),
]
