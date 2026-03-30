from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("auth_core.urls")),
    path("api/production/", include("production.urls")),
    path("api/harvests/", include("harvests.urls")),
    path("api/warehousing/", include("warehousing.urls")),
    path("api/logistics/", include("logistics.urls")),
    path("api/payments/", include("payments.urls")),
    path("api/certifications/", include("certifications.urls")),
    path("api/intelligence/", include("intelligence.urls")),
]
