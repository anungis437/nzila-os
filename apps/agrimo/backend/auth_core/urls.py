from django.urls import path

from . import views

app_name = "auth_core"

urlpatterns = [
    path("webhook/clerk/", views.clerk_webhook, name="clerk-webhook"),
    path("me/", views.me, name="me"),
    path("health/", views.health_check, name="health-check"),
]
