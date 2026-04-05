"""URL configuration for auth_core app."""

from django.urls import path

from . import views

app_name = "auth_core"

urlpatterns = [
    # User profile
    path("me/", views.me, name="me"),
    # Health check
    path("health/", views.health_check, name="health"),
    # Auth provider webhooks (no auth required - webhook secret verification)
    path("webhooks/auth/", views.clerk_webhook, name="auth_webhook"),
    path("webhooks/clerk/", views.clerk_webhook, name="clerk_webhook"),  # Legacy path
]
