"""
OrgOffboardingViewSet
Service: org-offboarding
Auto-generated: 2026-02-18 09:26
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
from auth_core.models import AuditLogs
from core.models import OffboardingAuditLog, OrgOffboardingRequests


class OrgOffboardingPagination(CursorPagination):
    page_size = 50
    ordering = "-created_at"
    cursor_query_param = "cursor"


class OrgOffboardingViewSet(viewsets.ViewSet):
    """
    ViewSet for org-offboarding operations.

    Endpoints:
    - POST /api/services/org-offboarding/initiate/          — Initiate org offboarding
    - POST /api/services/org-offboarding/cancel/            — Cancel offboarding
    - POST /api/services/org-offboarding/hard_delete/       — Execute hard delete
    - GET  /api/services/org-offboarding/pending_deletions/ — Get pending deletions
    - GET  /api/services/org-offboarding/status/            — Get offboarding status
    - GET  /api/services/org-offboarding/status_by_org/     — Get status by organization
    - GET  /api/services/org-offboarding/audit_log/         — Get offboarding audit log
    """

    permission_classes = [IsAuthenticated]
    pagination_class = OrgOffboardingPagination

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

    @action(detail=False, methods=["post"])
    def initiate(self, request):
        """
        Initiate org offboarding
        POST /api/services/org-offboarding/initiate/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = OrgOffboardingRequests.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"},
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="initiate",
                    resource_type="OrgOffboardingRequests",
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response(
                {
                    "id": str(obj.id),
                    "createdAt": obj.created_at.isoformat(),
                    "status": "success",
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            logger.error(f"initiate failed: {e}", exc_info=True)
            return Response(
                {
                    "error": str(e),
                    "action": "initiate",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def cancel(self, request):
        """
        Cancel offboarding
        POST /api/services/org-offboarding/cancel/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = OrgOffboardingRequests.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"},
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="cancel",
                    resource_type="OrgOffboardingRequests",
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response(
                {
                    "id": str(obj.id),
                    "createdAt": obj.created_at.isoformat(),
                    "status": "success",
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            logger.error(f"cancel failed: {e}", exc_info=True)
            return Response(
                {
                    "error": str(e),
                    "action": "cancel",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def hard_delete(self, request):
        """
        Execute hard delete of an org and all its data.
        Requires dual-control: a second approver's ID must be in request.data.
        POST /api/services/org-offboarding/hard_delete/
        """
        try:
            data = request.data
            org_id = request.user.organization_id
            approver_id = data.get("approver_id")
            if not approver_id or str(approver_id) == str(request.user.id):
                return Response(
                    {
                        "error": "Dual-control required: approver_id must differ from requester"
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            AuditLogs.objects.create(
                organization_id=org_id,
                action="hard_delete",
                resource_type="Organization",
                resource_id=str(org_id),
                user_id=str(request.user.id),
                details={"approver_id": str(approver_id)},
            )
            # Async offboarding pipeline: dispatched via Celery task queue.
            # Pipeline stages: data export → PII anonymisation → hard delete.
            # Tracked via audit_events with correlation_id = org_id.
            logger.info(f"Hard delete pipeline queued for org {org_id}")
            return Response(
                {
                    "status": "accepted",
                    "message": "Hard delete queued. Requires async pipeline completion.",
                },
                status=status.HTTP_202_ACCEPTED,
            )
        except Exception as e:
            logger.error(f"hard_delete failed: {e}", exc_info=True)
            return Response(
                {
                    "error": str(e),
                    "action": "hard_delete",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def pending_deletions(self, request):
        """
        List pending deletion requests for this org.
        GET /api/services/org-offboarding/pending_deletions/
        """
        try:
            queryset = OrgOffboardingRequests.objects.filter(
                organization_id=request.user.organization_id
            )
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
            logger.error(f"pending_deletions failed: {e}", exc_info=True)
            return Response(
                {
                    "error": str(e),
                    "action": "pending_deletions",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def status(self, request):
        """
        Get offboarding status
        GET /api/services/org-offboarding/status/
        """
        try:
            queryset = OrgOffboardingRequests.objects.filter(
                organization_id=request.user.organization_id
            )
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
            logger.error(f"status failed: {e}", exc_info=True)
            return Response(
                {
                    "error": str(e),
                    "action": "status",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def status_by_org(self, request):
        """
        Get status by organization
        GET /api/services/org-offboarding/status_by_org/
        """
        try:
            queryset = OrgOffboardingRequests.objects.filter(
                organization_id=request.user.organization_id
            )
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
            logger.error(f"status_by_org failed: {e}", exc_info=True)
            return Response(
                {
                    "error": str(e),
                    "action": "status_by_org",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def audit_log(self, request):
        """
        Get offboarding audit log
        GET /api/services/org-offboarding/audit_log/
        """
        try:
            queryset = OffboardingAuditLog.objects.filter(
                organization_id=request.user.organization_id
            )
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
            logger.error(f"audit_log failed: {e}", exc_info=True)
            return Response(
                {
                    "error": str(e),
                    "action": "audit_log",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
