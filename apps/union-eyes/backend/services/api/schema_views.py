"""
Schema API ViewSet
Provides OpenAPI-style introspection of registered service endpoints,
their models, and URL patterns for the Union Eyes services router.
"""

from django.apps import apps
from django.urls import get_resolver
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class SchemaViewSet(viewsets.ViewSet):
    """
    ViewSet for schema introspection operations.

    Returns available models, URL patterns, and service metadata
    so front-end clients can discover the API surface dynamically.
    """

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        Return a summary of registered Django apps and their model counts.
        GET /api/services/schema/
        """
        app_summaries = []
        for app_config in apps.get_app_configs():
            models = app_config.get_models()
            model_names = [m.__name__ for m in models]
            if model_names:
                app_summaries.append(
                    {
                        "app": app_config.label,
                        "modelCount": len(model_names),
                        "models": model_names,
                    }
                )
        return Response({"data": app_summaries}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"])
    def routes(self, request):
        """
        List all registered URL patterns under /api/services/.
        GET /api/services/schema/routes/
        """
        resolver = get_resolver()
        patterns = []

        def _extract(url_patterns, prefix=""):
            for pattern in url_patterns:
                full = prefix + str(getattr(pattern, "pattern", ""))
                if hasattr(pattern, "url_patterns"):
                    _extract(pattern.url_patterns, full)
                else:
                    name = getattr(pattern, "name", None)
                    patterns.append({"path": "/" + full, "name": name})

        _extract(resolver.url_patterns)
        service_routes = [p for p in patterns if p["path"].startswith("/api/services/")]
        return Response({"data": service_routes}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"])
    def model_detail(self, request):
        """
        Return field-level details for a specific model.
        GET /api/services/schema/model_detail/?app=compliance&model=ForeignWorkers
        """
        app_label = request.query_params.get("app")
        model_name = request.query_params.get("model")
        if not app_label or not model_name:
            return Response(
                {"error": "Both ?app= and ?model= query params are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            model_class = apps.get_model(app_label, model_name)
        except LookupError:
            return Response(
                {"error": f"Model {app_label}.{model_name} not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        fields = []
        for f in model_class._meta.get_fields():
            fields.append(
                {
                    "name": f.name,
                    "type": type(f).__name__,
                    "nullable": getattr(f, "null", None),
                    "primary_key": getattr(f, "primary_key", False),
                }
            )
        return Response(
            {
                "app": app_label,
                "model": model_name,
                "dbTable": model_class._meta.db_table,
                "fields": fields,
            },
            status=status.HTTP_200_OK,
        )
