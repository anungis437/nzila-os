"""
ProvincialPrivacyServiceViewSet
Generated from service: provincial-privacy-service
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
from compliance.models import (
    DataSubjectAccessRequests,
    PrivacyBreaches,
    ProvincialConsent,
    ProvincialDataHandling,
    ProvincialPrivacyConfig,
)
from core.models import AuditLogs


class ProvincialPrivacyServicePagination(CursorPagination):
    page_size = 50
    ordering = "-created_at"
    cursor_query_param = "cursor"


class ProvincialPrivacyServiceViewSet(viewsets.ViewSet):
    """
        ViewSet for provincial-privacy-service operations.

        Endpoints:
        - GET /api/services/provincial-privacy-service/config/ — Get provincial privacy config
    - POST /api/services/provincial-privacy-service/update_config/ — Update provincial privacy config
    - GET /api/services/provincial-privacy-service/consent_records/ — List provincial consent records
    - POST /api/services/provincial-privacy-service/record_consent/ — Record provincial consent
    - GET /api/services/provincial-privacy-service/breaches/ — List privacy breaches
    - POST /api/services/provincial-privacy-service/report_breach/ — Report privacy breach
    - GET /api/services/provincial-privacy-service/data_handling/ — Get provincial data handling rules
    - GET /api/services/provincial-privacy-service/dsar_requests/ — List data subject access requests
    - POST /api/services/provincial-privacy-service/submit_dsar/ — Submit a DSAR
    - POST /api/services/provincial-privacy-service/fulfill_dsar/ — Fulfill a DSAR
    - GET /api/services/provincial-privacy-service/compliance_check/ — Check provincial privacy compliance
    """

    permission_classes = [IsAuthenticated]
    pagination_class = ProvincialPrivacyServicePagination

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

    @action(detail=False, methods=["get"])
    def config(self, request):
        """
        Get provincial privacy config
        GET /api/services/provincial-privacy-service/config/
        """
        try:
            queryset = ProvincialPrivacyConfig.objects.filter(
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
                    "action": "config",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def update_config(self, request):
        """
        Update provincial privacy config
        POST /api/services/provincial-privacy-service/update_config/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = ProvincialPrivacyConfig.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="update_config",
                    resource_type="ProvincialPrivacyConfig",
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
                    "action": "update_config",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def consent_records(self, request):
        """
        List provincial consent records
        GET /api/services/provincial-privacy-service/consent_records/
        """
        try:
            queryset = ProvincialConsent.objects.filter(
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
                    "action": "consent_records",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def record_consent(self, request):
        """
        Record provincial consent
        POST /api/services/provincial-privacy-service/record_consent/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = ProvincialConsent.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="record_consent",
                    resource_type="ProvincialConsent",
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
                    "action": "record_consent",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def breaches(self, request):
        """
        List privacy breaches
        GET /api/services/provincial-privacy-service/breaches/
        """
        try:
            queryset = PrivacyBreaches.objects.filter(
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
                    "action": "breaches",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def report_breach(self, request):
        """
        Report privacy breach
        POST /api/services/provincial-privacy-service/report_breach/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PrivacyBreaches.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="report_breach",
                    resource_type="PrivacyBreaches",
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
                    "action": "report_breach",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def data_handling(self, request):
        """
        Get provincial data handling rules
        GET /api/services/provincial-privacy-service/data_handling/
        """
        try:
            queryset = ProvincialDataHandling.objects.filter(
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
                    "action": "data_handling",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def dsar_requests(self, request):
        """
        List data subject access requests
        GET /api/services/provincial-privacy-service/dsar_requests/
        """
        try:
            queryset = DataSubjectAccessRequests.objects.filter(
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
                    "action": "dsar_requests",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def submit_dsar(self, request):
        """
        Submit a DSAR
        POST /api/services/provincial-privacy-service/submit_dsar/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = DataSubjectAccessRequests.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="submit_dsar",
                    resource_type="DataSubjectAccessRequests",
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
                    "action": "submit_dsar",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def fulfill_dsar(self, request):
        """
        Fulfill a data subject access request.
        Required fields: dsar_id.
        Optional: response_data, fulfilled_by.
        """
        try:
            data = request.data
            org_id = request.user.organization_id

            dsar_id = data.get("dsar_id")
            if not dsar_id:
                return Response(
                    {"error": "dsar_id is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            with transaction.atomic():
                try:
                    dsar = DataSubjectAccessRequests.objects.select_for_update().get(
                        id=dsar_id,
                        organization_id=org_id,
                    )
                except DataSubjectAccessRequests.DoesNotExist:
                    return Response(
                        {"error": "DSAR not found"},
                        status=status.HTTP_404_NOT_FOUND,
                    )

                if getattr(dsar, "status", None) == "fulfilled":
                    return Response(
                        {"error": "DSAR is already fulfilled"},
                        status=status.HTTP_409_CONFLICT,
                    )

                dsar.status = "fulfilled"
                dsar.fulfilled_at = timezone.now()
                dsar.fulfilled_by = data.get("fulfilled_by", str(request.user.id))
                update_fields = ["status", "fulfilled_at", "fulfilled_by", "updated_at"]
                if data.get("response_data"):
                    dsar.response_data = data["response_data"]
                    update_fields.append("response_data")
                dsar.save(update_fields=update_fields)

                AuditLogs.objects.create(
                    organization_id=org_id,
                    action="fulfill_dsar",
                    resource_type="DataSubjectAccessRequests",
                    resource_id=str(dsar.id),
                    user_id=str(request.user.id),
                    details={
                        "fulfilled_by": data.get("fulfilled_by", str(request.user.id))
                    },
                )

            return Response(
                {
                    "id": str(dsar.id),
                    "status": "success",
                    "message": "DSAR fulfilled",
                    "fulfilled_at": dsar.fulfilled_at.isoformat(),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "fulfill_dsar",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def compliance_check(self, request):
        """
        Check provincial privacy compliance.
        Verifies: privacy config exists, consent records present, no unresolved
        breaches, DSAR response compliance.
        Query params: province (optional — filter by province).
        """
        try:
            org_id = request.user.organization_id
            province = request.query_params.get("province")

            # Privacy configuration
            config_qs = ProvincialPrivacyConfig.objects.filter(organization_id=org_id)
            if province:
                config_qs = config_qs.filter(province=province)
            has_config = config_qs.exists()
            config_count = config_qs.count()

            # Consent records
            consent_count = ProvincialConsent.objects.filter(
                organization_id=org_id,
            ).count()

            # Breaches
            total_breaches = PrivacyBreaches.objects.filter(
                organization_id=org_id,
            ).count()
            open_breaches = PrivacyBreaches.objects.filter(
                organization_id=org_id,
                status="open",
            ).count()

            # DSARs
            total_dsars = DataSubjectAccessRequests.objects.filter(
                organization_id=org_id,
            ).count()
            fulfilled_dsars = DataSubjectAccessRequests.objects.filter(
                organization_id=org_id,
                status="fulfilled",
            ).count()
            pending_dsars = total_dsars - fulfilled_dsars

            # Data handling rules
            data_handling_count = ProvincialDataHandling.objects.filter(
                organization_id=org_id,
            ).count()

            # Compliance determination
            checks = {
                "privacy_config_exists": has_config,
                "privacy_config_count": config_count,
                "consent_records": consent_count,
                "open_breaches": open_breaches,
                "no_open_breaches": open_breaches == 0,
                "total_dsars": total_dsars,
                "fulfilled_dsars": fulfilled_dsars,
                "pending_dsars": pending_dsars,
                "dsar_compliant": pending_dsars == 0,
                "data_handling_rules": data_handling_count,
            }
            all_compliant = (
                has_config
                and open_breaches == 0
                and pending_dsars == 0
                and data_handling_count > 0
            )

            return Response(
                {
                    "status": "success",
                    "organization_id": str(org_id),
                    "province": province,
                    "compliant": all_compliant,
                    "checks": checks,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "compliance_check",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
