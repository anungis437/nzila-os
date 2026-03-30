"""
URL configuration for Zonga backend.
"""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("auth_core.urls")),
    path("api/catalog/", include("catalog.urls")),
    path("api/creators/", include("creators.urls")),
    path("api/events/", include("events.urls")),
    path("api/moderation/", include("moderation.urls")),
    path("api/payouts/", include("payouts.urls")),
    path("api/revenue/", include("revenue.urls")),
    path("api/rights/", include("rights.urls")),
    path("api/subscriptions/", include("subscriptions.urls")),
]
