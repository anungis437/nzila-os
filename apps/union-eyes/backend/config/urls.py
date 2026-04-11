"""
URL configuration for UnionEyes
"""

from django.contrib import admin
from django.urls import include, path
from rest_framework import routers

router = routers.DefaultRouter()

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/ai_core/", include("ai_core.urls")),
    path("api/analytics/", include("analytics.urls")),
    path("api/auth_core/", include("auth_core.urls")),
    path("api/bargaining/", include("bargaining.urls")),
    path("api/billing/", include("billing.urls")),
    path("api/compliance/", include("compliance.urls")),
    path("api/content/", include("content.urls")),
    path("api/core/", include("core.urls")),
    path("api/grievances/", include("grievances.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/unions/", include("unions.urls")),
    path("api/services/", include("services.api.urls")),  # Service API endpoints
    path("api/tasks/", include("services.api.task_urls")),  # Celery task enqueue API
    # Enterprise hardening systems
    path("api/integrations/", include("services.integration_control_plane.urls")),
    path("api/events/", include("services.events.urls")),
    path("api/governance/evidence-pack/", include("services.evidence_pack.urls")),
    path("api/compliance/snapshots/", include("services.compliance_snapshot.urls")),
]

# Observability — Prometheus metrics endpoint (outside /api/ prefix).
from observability.metrics import metrics_view  # noqa: E402

urlpatterns += [
    path("metrics", metrics_view, name="metrics"),
]
