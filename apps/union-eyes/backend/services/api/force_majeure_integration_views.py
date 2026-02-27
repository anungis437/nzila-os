"""
ForceMajeureIntegrationViewSet
Generated from service: force-majeure-integration
Auto-generated: 2026-02-18 09:08
"""

import logging
import uuid

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import CursorPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)
from bargaining.models import CbaClauses, CollectiveAgreements
from compliance.models import EmergencyDeclarations
from core.models import AuditLogs


class ForceMajeureIntegrationPagination(CursorPagination):
    page_size = 50
    ordering = "-created_at"
    cursor_query_param = "cursor"


class ForceMajeureIntegrationViewSet(viewsets.ViewSet):
    """
        ViewSet for force-majeure-integration operations.

        Endpoints:
        - POST /api/services/force-majeure-integration/declare/ — Declare force majeure event
    - POST /api/services/force-majeure-integration/lift/ — Lift force majeure declaration
    - GET /api/services/force-majeure-integration/active/ — List active force majeure events
    - GET /api/services/force-majeure-integration/history/ — Force majeure event history
    - GET /api/services/force-majeure-integration/affected_agreements/ — List CBAs affected by force majeure
    - POST /api/services/force-majeure-integration/impact_assessment/ — Run impact assessment on active FM
    """

    permission_classes = [IsAuthenticated]
    pagination_class = ForceMajeureIntegrationPagination

    def paginate_queryset(self, queryset):
        paginator = self.pagination_class()
        return paginator.paginate_queryset(queryset, self.request, view=self)

    def get_paginated_response(self, data):
        paginator = self.pagination_class()
        # Reconstruct paginated response
        return Response(
            {
                "count": len(data),
                "results": data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"])
    def declare(self, request):
        """
        Declare force majeure event
        POST /api/services/force-majeure-integration/declare/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = EmergencyDeclarations.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="declare",
                    resource_type="EmergencyDeclarations",
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response(
                {
                    "id": str(obj.id),
                    "created_at": obj.created_at.isoformat(),
                    "status": "success",
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "declare",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def lift(self, request):
        """
        Lift force majeure declaration.
        Required fields: declaration_id.
        Optional: resolution_notes.
        """
        try:
            data = request.data
            org_id = request.user.organization_id

            declaration_id = data.get("declaration_id")
            if not declaration_id:
                return Response(
                    {"error": "declaration_id is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            with transaction.atomic():
                try:
                    declaration = EmergencyDeclarations.objects.select_for_update().get(
                        id=declaration_id,
                        organization_id=org_id,
                    )
                except EmergencyDeclarations.DoesNotExist:
                    return Response(
                        {"error": "Declaration not found"},
                        status=status.HTTP_404_NOT_FOUND,
                    )

                declaration.status = "lifted"
                declaration.resolved_at = timezone.now()
                declaration.resolution_notes = data.get("resolution_notes", "")
                declaration.save(
                    update_fields=[
                        "status",
                        "resolved_at",
                        "resolution_notes",
                        "updated_at",
                    ]
                )

                AuditLogs.objects.create(
                    organization_id=org_id,
                    action="lift",
                    resource_type="EmergencyDeclarations",
                    resource_id=str(declaration.id),
                    user_id=str(request.user.id),
                    details={"resolution_notes": data.get("resolution_notes", "")},
                )

            return Response(
                {
                    "id": str(declaration.id),
                    "status": "success",
                    "message": "Force majeure declaration lifted",
                    "lifted_at": declaration.resolved_at.isoformat(),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "lift",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def active(self, request):
        """
        List active force majeure events
        GET /api/services/force-majeure-integration/active/
        """
        try:
            queryset = EmergencyDeclarations.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
            for param in ["status", "type", "created_after", "created_before"]:
                val = request.query_params.get(param)
                if val:
                    if param == "created_after":
                        queryset = queryset.filter(created_at__gte=val)
                    elif param == "created_before":
                        queryset = queryset.filter(created_at__lte=val)
                    else:
                        queryset = queryset.filter(**{param: val})

            page = self.paginate_queryset(queryset.order_by("-created_at"))
            if page is not None:
                data = list(page.values())
                return self.get_paginated_response(data)

            return Response(
                {
                    "count": queryset.count(),
                    "results": list(queryset.order_by("-created_at").values()[:100]),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "active",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def history(self, request):
        """
        Force majeure event history
        GET /api/services/force-majeure-integration/history/
        """
        try:
            queryset = EmergencyDeclarations.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
            for param in ["status", "type", "created_after", "created_before"]:
                val = request.query_params.get(param)
                if val:
                    if param == "created_after":
                        queryset = queryset.filter(created_at__gte=val)
                    elif param == "created_before":
                        queryset = queryset.filter(created_at__lte=val)
                    else:
                        queryset = queryset.filter(**{param: val})

            page = self.paginate_queryset(queryset.order_by("-created_at"))
            if page is not None:
                data = list(page.values())
                return self.get_paginated_response(data)

            return Response(
                {
                    "count": queryset.count(),
                    "results": list(queryset.order_by("-created_at").values()[:100]),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "history",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def affected_agreements(self, request):
        """
        List CBAs affected by active force majeure declarations.
        Returns all collective agreements for the org with an indication
        of whether force-majeure clauses exist.
        """
        try:
            org_id = request.user.organization_id

            # Active declarations
            active_declarations = EmergencyDeclarations.objects.filter(
                organization_id=org_id,
                status="active",
            ).values("id", "emergency_type", "created_at")

            if not active_declarations.exists():
                return Response(
                    {
                        "status": "success",
                        "organization_id": str(org_id),
                        "active_declarations": 0,
                        "affected_agreements": [],
                    },
                    status=status.HTTP_200_OK,
                )

            # All CBAs for the org
            agreements = CollectiveAgreements.objects.filter(
                organization_id=org_id,
            ).order_by("-created_at")

            # Check which CBAs have force-majeure-related clauses
            fm_clause_cba_ids = set(
                CbaClauses.objects.filter(
                    organization_id=org_id,
                    clause_type__icontains="force majeure",
                ).values_list("cba_id", flat=True)
            )

            affected = []
            for cba in agreements:
                affected.append(
                    {
                        "id": str(cba.id),
                        "cba_number": cba.cba_number,
                        "has_fm_clause": cba.id in fm_clause_cba_ids,
                        "created_at": cba.created_at.isoformat(),
                    }
                )

            return Response(
                {
                    "status": "success",
                    "organization_id": str(org_id),
                    "active_declarations": active_declarations.count(),
                    "declarations": list(active_declarations),
                    "affected_agreements": affected,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "affected_agreements",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def impact_assessment(self, request):
        """
        Run impact assessment on active force-majeure declarations.
        Optional body: declaration_id (assess one specific declaration).
        """
        try:
            data = request.data
            org_id = request.user.organization_id

            # Scope to specific declaration or all active
            qs = EmergencyDeclarations.objects.filter(organization_id=org_id)
            declaration_id = data.get("declaration_id")
            if declaration_id:
                qs = qs.filter(id=declaration_id)
            else:
                qs = qs.filter(status="active")

            declarations = list(
                qs.values("id", "emergency_type", "status", "created_at")
            )
            if not declarations:
                return Response(
                    {"error": "No active force majeure declarations found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            total_cbas = CollectiveAgreements.objects.filter(
                organization_id=org_id,
            ).count()

            fm_clause_count = (
                CbaClauses.objects.filter(
                    organization_id=org_id,
                    clause_type__icontains="force majeure",
                )
                .values("cba_id")
                .distinct()
                .count()
            )

            assessment_id = str(uuid.uuid4())
            assessment = {
                "assessment_id": assessment_id,
                "declarations_assessed": len(declarations),
                "total_agreements": total_cbas,
                "agreements_with_fm_clause": fm_clause_count,
                "agreements_without_fm_clause": total_cbas - fm_clause_count,
                "coverage_pct": (
                    round((fm_clause_count / total_cbas * 100), 1)
                    if total_cbas > 0
                    else 0
                ),
                "risk_level": (
                    "low"
                    if fm_clause_count == total_cbas
                    else ("medium" if fm_clause_count > 0 else "high")
                ),
                "assessed_at": timezone.now().isoformat(),
            }

            # Persist assessment in audit log
            with transaction.atomic():
                AuditLogs.objects.create(
                    organization_id=org_id,
                    action="impact_assessment",
                    resource_type="ForceMajeureAssessment",
                    resource_id=assessment_id,
                    user_id=str(request.user.id),
                    details=assessment,
                )

            return Response(
                {
                    "status": "success",
                    "assessment": assessment,
                    "declarations": declarations,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "impact_assessment",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
