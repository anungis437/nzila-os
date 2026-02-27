"""
CarbonAccountingServiceViewSet
Generated from service: carbon-accounting-service
Auto-generated: 2026-02-18 09:08

Data store: Uses AuditLogs with resource_type 'CarbonEmission', 'CarbonTarget',
'CarbonOffset' until dedicated carbon models are created.
"""

import logging
import uuid
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import CursorPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)
from core.models import AuditLogs

# Resource types used as lightweight data store in AuditLogs.details
EMISSION_RESOURCE = "CarbonEmission"
TARGET_RESOURCE = "CarbonTarget"
OFFSET_RESOURCE = "CarbonOffset"

VALID_EMISSION_SCOPES = ["scope_1", "scope_2", "scope_3"]


class CarbonAccountingServicePagination(CursorPagination):
    page_size = 50
    ordering = "-created_at"
    cursor_query_param = "cursor"


class CarbonAccountingServiceViewSet(viewsets.ViewSet):
    """
    ViewSet for carbon-accounting-service operations.

    Endpoints:
    - POST /api/services/carbon-accounting-service/record_emission/ — Record a carbon emission entry
    - GET /api/services/carbon-accounting-service/emission_report/ — Get emissions report for org
    - GET /api/services/carbon-accounting-service/carbon_summary/ — Get carbon footprint summary
    - POST /api/services/carbon-accounting-service/set_target/ — Set carbon reduction target
    - POST /api/services/carbon-accounting-service/offset_purchase/ — Record carbon offset purchase
    - GET /api/services/carbon-accounting-service/compliance_check/ — Check carbon reporting compliance
    """

    permission_classes = [IsAuthenticated]
    pagination_class = CarbonAccountingServicePagination

    def paginate_queryset(self, queryset):
        paginator = self.pagination_class()
        return paginator.paginate_queryset(queryset, self.request, view=self)

    def get_paginated_response(self, data):
        paginator = self.pagination_class()
        return Response(
            {
                "count": len(data),
                "results": data,
            },
            status=status.HTTP_200_OK,
        )

    # ── helpers ──────────────────────────────────────────────────────────

    def _emission_queryset(self, org_id):
        return AuditLogs.objects.filter(
            organization_id=org_id,
            resource_type=EMISSION_RESOURCE,
        )

    # ── endpoints ────────────────────────────────────────────────────────

    @action(detail=False, methods=["post"])
    def record_emission(self, request):
        """
        Record a carbon emission entry.
        Required fields: source, scope (scope_1|scope_2|scope_3), amount_kg, emission_date.
        Optional: category, description.
        """
        try:
            data = request.data
            org_id = request.user.organization_id

            # Validate required fields
            required = ["source", "scope", "amount_kg", "emission_date"]
            missing = [f for f in required if f not in data]
            if missing:
                return Response(
                    {"error": f'Missing required fields: {", ".join(missing)}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            scope = data["scope"]
            if scope not in VALID_EMISSION_SCOPES:
                return Response(
                    {
                        "error": f'Invalid scope. Must be one of: {", ".join(VALID_EMISSION_SCOPES)}'
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                amount_kg = Decimal(str(data["amount_kg"]))
                if amount_kg <= 0:
                    raise ValueError()
            except (InvalidOperation, ValueError):
                return Response(
                    {"error": "amount_kg must be a positive number"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            emission_id = str(uuid.uuid4())
            with transaction.atomic():
                AuditLogs.objects.create(
                    organization_id=org_id,
                    action="record_emission",
                    resource_type=EMISSION_RESOURCE,
                    resource_id=emission_id,
                    user_id=str(request.user.id),
                    details={
                        "source": data["source"],
                        "scope": scope,
                        "amount_kg": str(amount_kg),
                        "emission_date": data["emission_date"],
                        "category": data.get("category", ""),
                        "description": data.get("description", ""),
                    },
                )
            return Response(
                {
                    "id": emission_id,
                    "status": "success",
                    "message": "Emission recorded",
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            logger.exception("record_emission failed")
            return Response(
                {"error": str(e), "action": "record_emission"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def emission_report(self, request):
        """
        Get emissions report for org — broken down by scope and month.
        Query params: year (default: current year).
        """
        try:
            org_id = request.user.organization_id
            year = request.query_params.get("year", str(timezone.now().year))

            entries = (
                self._emission_queryset(org_id)
                .filter(
                    action="record_emission",
                    created_at__year=int(year),
                )
                .values_list("details", flat=True)
            )

            # Aggregate by scope
            by_scope = {s: Decimal("0") for s in VALID_EMISSION_SCOPES}
            total_entries = 0
            for detail in entries:
                if not detail:
                    continue
                scope = detail.get("scope", "")
                amount = detail.get("amount_kg", "0")
                if scope in by_scope:
                    by_scope[scope] += Decimal(str(amount))
                    total_entries += 1

            total_kg = sum(by_scope.values())

            return Response(
                {
                    "status": "success",
                    "organization_id": str(org_id),
                    "year": year,
                    "total_entries": total_entries,
                    "total_emissions_kg": str(total_kg),
                    "by_scope": {k: str(v) for k, v in by_scope.items()},
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.exception("emission_report failed")
            return Response(
                {"error": str(e), "action": "emission_report"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def carbon_summary(self, request):
        """
        Get carbon footprint summary — total emissions, offsets, and net position.
        """
        try:
            org_id = request.user.organization_id

            # Total emissions
            emission_entries = (
                self._emission_queryset(org_id)
                .filter(
                    action="record_emission",
                )
                .values_list("details", flat=True)
            )

            total_emissions = Decimal("0")
            for detail in emission_entries:
                if detail and detail.get("amount_kg"):
                    total_emissions += Decimal(str(detail["amount_kg"]))

            # Total offsets
            offset_entries = AuditLogs.objects.filter(
                organization_id=org_id,
                resource_type=OFFSET_RESOURCE,
                action="offset_purchase",
            ).values_list("details", flat=True)

            total_offsets = Decimal("0")
            for detail in offset_entries:
                if detail and detail.get("offset_kg"):
                    total_offsets += Decimal(str(detail["offset_kg"]))

            # Current target
            target = (
                AuditLogs.objects.filter(
                    organization_id=org_id,
                    resource_type=TARGET_RESOURCE,
                    action="set_target",
                )
                .order_by("-created_at")
                .values_list("details", flat=True)
                .first()
            )

            net_emissions = total_emissions - total_offsets
            target_kg = Decimal(str(target.get("target_kg", "0"))) if target else None

            return Response(
                {
                    "status": "success",
                    "organization_id": str(org_id),
                    "total_emissions_kg": str(total_emissions),
                    "total_offsets_kg": str(total_offsets),
                    "net_emissions_kg": str(net_emissions),
                    "current_target_kg": str(target_kg) if target_kg else None,
                    "on_track": net_emissions <= target_kg if target_kg else None,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.exception("carbon_summary failed")
            return Response(
                {"error": str(e), "action": "carbon_summary"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def set_target(self, request):
        """
        Set carbon reduction target for the organization.
        Required fields: target_kg, target_year.
        Optional: baseline_year, baseline_kg, reduction_percentage.
        """
        try:
            data = request.data
            org_id = request.user.organization_id

            required = ["target_kg", "target_year"]
            missing = [f for f in required if f not in data]
            if missing:
                return Response(
                    {"error": f'Missing required fields: {", ".join(missing)}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                target_kg = Decimal(str(data["target_kg"]))
                if target_kg < 0:
                    raise ValueError()
            except (InvalidOperation, ValueError):
                return Response(
                    {"error": "target_kg must be a non-negative number"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            target_id = str(uuid.uuid4())
            with transaction.atomic():
                AuditLogs.objects.create(
                    organization_id=org_id,
                    action="set_target",
                    resource_type=TARGET_RESOURCE,
                    resource_id=target_id,
                    user_id=str(request.user.id),
                    details={
                        "target_kg": str(target_kg),
                        "target_year": str(data["target_year"]),
                        "baseline_year": data.get("baseline_year", ""),
                        "baseline_kg": (
                            str(data["baseline_kg"]) if "baseline_kg" in data else ""
                        ),
                        "reduction_percentage": str(
                            data.get("reduction_percentage", "")
                        ),
                    },
                )
            return Response(
                {
                    "id": target_id,
                    "status": "success",
                    "message": "Carbon reduction target set",
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            logger.exception("set_target failed")
            return Response(
                {"error": str(e), "action": "set_target"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def offset_purchase(self, request):
        """
        Record carbon offset purchase.
        Required fields: offset_kg, provider, cost_cad.
        Optional: certificate_id, offset_type, description.
        """
        try:
            data = request.data
            org_id = request.user.organization_id

            required = ["offset_kg", "provider", "cost_cad"]
            missing = [f for f in required if f not in data]
            if missing:
                return Response(
                    {"error": f'Missing required fields: {", ".join(missing)}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                offset_kg = Decimal(str(data["offset_kg"]))
                cost_cad = Decimal(str(data["cost_cad"]))
                if offset_kg <= 0 or cost_cad < 0:
                    raise ValueError()
            except (InvalidOperation, ValueError):
                return Response(
                    {
                        "error": "offset_kg must be positive, cost_cad must be non-negative"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            offset_id = str(uuid.uuid4())
            with transaction.atomic():
                AuditLogs.objects.create(
                    organization_id=org_id,
                    action="offset_purchase",
                    resource_type=OFFSET_RESOURCE,
                    resource_id=offset_id,
                    user_id=str(request.user.id),
                    details={
                        "offset_kg": str(offset_kg),
                        "provider": data["provider"],
                        "cost_cad": str(cost_cad),
                        "certificate_id": data.get("certificate_id", ""),
                        "offset_type": data.get("offset_type", ""),
                        "description": data.get("description", ""),
                    },
                )
            return Response(
                {
                    "id": offset_id,
                    "status": "success",
                    "message": "Carbon offset recorded",
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            logger.exception("offset_purchase failed")
            return Response(
                {"error": str(e), "action": "offset_purchase"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def compliance_check(self, request):
        """
        Check carbon reporting compliance for the organization.
        Verifies: emissions recorded this year, target set, offset documentation.
        """
        try:
            org_id = request.user.organization_id
            current_year = timezone.now().year

            # Check for emissions recorded this year
            emission_count = (
                self._emission_queryset(org_id)
                .filter(
                    action="record_emission",
                    created_at__year=current_year,
                )
                .count()
            )

            # Check for active target
            has_target = AuditLogs.objects.filter(
                organization_id=org_id,
                resource_type=TARGET_RESOURCE,
                action="set_target",
            ).exists()

            # Check for offsets this year
            offset_count = AuditLogs.objects.filter(
                organization_id=org_id,
                resource_type=OFFSET_RESOURCE,
                action="offset_purchase",
                created_at__year=current_year,
            ).count()

            checks = {
                "emissions_recorded": emission_count > 0,
                "emission_entry_count": emission_count,
                "target_set": has_target,
                "offsets_documented": offset_count > 0,
                "offset_count": offset_count,
            }
            all_compliant = checks["emissions_recorded"] and checks["target_set"]

            return Response(
                {
                    "status": "success",
                    "organization_id": str(org_id),
                    "year": current_year,
                    "compliant": all_compliant,
                    "checks": checks,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.exception("compliance_check failed")
            return Response(
                {"error": str(e), "action": "compliance_check"},
                status=status.HTTP_400_BAD_REQUEST,
            )
