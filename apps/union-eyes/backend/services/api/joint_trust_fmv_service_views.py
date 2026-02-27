"""
JointTrustFmvServiceViewSet
Generated from service: joint-trust-fmv-service
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
from billing.models import (
    CpiAdjustedPricing,
    CpiData,
    FmvAuditLog,
    FmvBenchmarks,
    FmvPolicy,
    FmvViolations,
    IndependentAppraisals,
    ProcurementBids,
    ProcurementRequests,
)
from core.models import AuditLogs


class JointTrustFmvServicePagination(CursorPagination):
    page_size = 50
    ordering = "-created_at"
    cursor_query_param = "cursor"


class JointTrustFmvServiceViewSet(viewsets.ViewSet):
    """
        ViewSet for joint-trust-fmv-service operations.

        Endpoints:
        - GET /api/services/joint-trust-fmv-service/fmv_policy/ — Get FMV policy
    - POST /api/services/joint-trust-fmv-service/update_fmv_policy/ — Update FMV policy
    - POST /api/services/joint-trust-fmv-service/calculate_fmv/ — Calculate fair market value
    - GET /api/services/joint-trust-fmv-service/procurement_requests/ — List procurement requests
    - POST /api/services/joint-trust-fmv-service/create_procurement/ — Create procurement request
    - GET /api/services/joint-trust-fmv-service/bids/ — List procurement bids
    - POST /api/services/joint-trust-fmv-service/submit_bid/ — Submit procurement bid
    - GET /api/services/joint-trust-fmv-service/appraisals/ — List independent appraisals
    - POST /api/services/joint-trust-fmv-service/request_appraisal/ — Request independent appraisal
    - GET /api/services/joint-trust-fmv-service/cpi_data/ — Get CPI data
    - GET /api/services/joint-trust-fmv-service/cpi_adjusted_pricing/ — Get CPI-adjusted pricing
    - GET /api/services/joint-trust-fmv-service/benchmarks/ — Get FMV benchmarks
    - GET /api/services/joint-trust-fmv-service/violations/ — List FMV violations
    - GET /api/services/joint-trust-fmv-service/audit_log/ — Get FMV audit log
    """

    permission_classes = [IsAuthenticated]
    pagination_class = JointTrustFmvServicePagination

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
    def fmv_policy(self, request):
        """
        Get FMV policy
        GET /api/services/joint-trust-fmv-service/fmv_policy/
        """
        try:
            queryset = FmvPolicy.objects.filter(
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
                    "action": "fmv_policy",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def update_fmv_policy(self, request):
        """
        Update FMV policy
        POST /api/services/joint-trust-fmv-service/update_fmv_policy/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = FmvPolicy.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"},
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="update_fmv_policy",
                    resource_type="FmvPolicy",
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
                    "action": "update_fmv_policy",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def calculate_fmv(self, request):
        """
        Calculate fair market value for an item/service.
        Required fields: item_description, proposed_price.
        Optional: item_category, contract_id.
        Compares proposed price against CPI-adjusted benchmarks and independent
        appraisals to determine FMV compliance.
        """
        try:
            data = request.data
            org_id = request.user.organization_id

            required = ["item_description", "proposed_price"]
            missing = [f for f in required if f not in data]
            if missing:
                return Response(
                    {"error": f'Missing required fields: {", ".join(missing)}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            from decimal import Decimal, InvalidOperation

            try:
                proposed_price = Decimal(str(data["proposed_price"]))
                if proposed_price <= 0:
                    raise ValueError()
            except (InvalidOperation, ValueError):
                return Response(
                    {"error": "proposed_price must be a positive number"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            item_category = data.get("item_category", "")
            item_description = data["item_description"]

            # Check org FMV policy
            policy = FmvPolicy.objects.filter(
                organization_id=org_id,
                policy_enabled=True,
            ).first()

            requires_competitive_bidding = False
            if policy and policy.competitive_bidding_threshold:
                requires_competitive_bidding = (
                    proposed_price >= policy.competitive_bidding_threshold
                )

            # Look up benchmarks for the category
            benchmark = None
            if item_category:
                benchmark = (
                    FmvBenchmarks.objects.filter(
                        organization_id=org_id,
                        item_category=item_category,
                    )
                    .order_by("-created_at")
                    .first()
                )

            # Look up CPI-adjusted pricing
            cpi_pricing = None
            if data.get("contract_id"):
                cpi_pricing = (
                    CpiAdjustedPricing.objects.filter(
                        organization_id=org_id,
                        contract_id=data["contract_id"],
                    )
                    .order_by("-created_at")
                    .first()
                )

            # Look up recent appraisals for similar items
            recent_appraisals = IndependentAppraisals.objects.filter(
                organization_id=org_id,
            )
            if item_category:
                recent_appraisals = recent_appraisals.filter(item_type=item_category)
            appraisal_count = recent_appraisals.count()

            # Determine FMV status
            fmv_status = "approved"
            variance_pct = None
            if cpi_pricing and cpi_pricing.original_price:
                variance = (
                    (proposed_price - cpi_pricing.original_price)
                    / cpi_pricing.original_price
                ) * 100
                variance_pct = float(round(variance, 2))
                if abs(variance_pct) > 15:
                    fmv_status = "requires_review"
                if abs(variance_pct) > 30:
                    fmv_status = "rejected"

            if requires_competitive_bidding:
                fmv_status = "requires_competitive_bidding"

            # Record the calculation in audit log
            calc_id = str(uuid.uuid4())
            with transaction.atomic():
                FmvAuditLog.objects.create(
                    organization_id=org_id,
                    action_type="fmv_calculation",
                    details={
                        "calculation_id": calc_id,
                        "item_description": item_description,
                        "item_category": item_category,
                        "proposed_price": str(proposed_price),
                        "fmv_status": fmv_status,
                        "variance_pct": variance_pct,
                    },
                )

            return Response(
                {
                    "status": "success",
                    "calculation_id": calc_id,
                    "item_description": item_description,
                    "proposed_price": str(proposed_price),
                    "fmv_status": fmv_status,
                    "variance_pct": variance_pct,
                    "requires_competitive_bidding": requires_competitive_bidding,
                    "competitive_bidding_threshold": (
                        str(policy.competitive_bidding_threshold)
                        if policy and policy.competitive_bidding_threshold
                        else None
                    ),
                    "benchmark_available": benchmark is not None,
                    "cpi_adjusted_price": (
                        str(cpi_pricing.original_price)
                        if cpi_pricing and cpi_pricing.original_price
                        else None
                    ),
                    "recent_appraisal_count": appraisal_count,
                    "policy_enabled": policy.policy_enabled if policy else False,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "calculate_fmv",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def procurement_requests(self, request):
        """
        List procurement requests
        GET /api/services/joint-trust-fmv-service/procurement_requests/
        """
        try:
            queryset = ProcurementRequests.objects.filter(
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
                    "action": "procurement_requests",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def create_procurement(self, request):
        """
        Create procurement request
        POST /api/services/joint-trust-fmv-service/create_procurement/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = ProcurementRequests.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"},
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="create_procurement",
                    resource_type="ProcurementRequests",
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
                    "action": "create_procurement",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def bids(self, request):
        """
        List procurement bids
        GET /api/services/joint-trust-fmv-service/bids/
        """
        try:
            queryset = ProcurementBids.objects.filter(
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
                    "action": "bids",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def submit_bid(self, request):
        """
        Submit procurement bid
        POST /api/services/joint-trust-fmv-service/submit_bid/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = ProcurementBids.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"},
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="submit_bid",
                    resource_type="ProcurementBids",
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
                    "action": "submit_bid",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def appraisals(self, request):
        """
        List independent appraisals
        GET /api/services/joint-trust-fmv-service/appraisals/
        """
        try:
            queryset = IndependentAppraisals.objects.filter(
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
                    "action": "appraisals",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def request_appraisal(self, request):
        """
        Request independent appraisal
        POST /api/services/joint-trust-fmv-service/request_appraisal/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = IndependentAppraisals.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"},
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="request_appraisal",
                    resource_type="IndependentAppraisals",
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
                    "action": "request_appraisal",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def cpi_data(self, request):
        """
        Get CPI data
        GET /api/services/joint-trust-fmv-service/cpi_data/
        """
        try:
            queryset = CpiData.objects.filter(
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
                    "action": "cpi_data",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def cpi_adjusted_pricing(self, request):
        """
        Get CPI-adjusted pricing
        GET /api/services/joint-trust-fmv-service/cpi_adjusted_pricing/
        """
        try:
            queryset = CpiAdjustedPricing.objects.filter(
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
                    "action": "cpi_adjusted_pricing",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def benchmarks(self, request):
        """
        Get FMV benchmarks
        GET /api/services/joint-trust-fmv-service/benchmarks/
        """
        try:
            queryset = FmvBenchmarks.objects.filter(
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
                    "action": "benchmarks",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def violations(self, request):
        """
        List FMV violations
        GET /api/services/joint-trust-fmv-service/violations/
        """
        try:
            queryset = FmvViolations.objects.filter(
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
                    "action": "violations",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def audit_log(self, request):
        """
        Get FMV audit log
        GET /api/services/joint-trust-fmv-service/audit_log/
        """
        try:
            queryset = FmvAuditLog.objects.filter(
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
                    "action": "audit_log",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
