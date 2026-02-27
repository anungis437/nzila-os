"""
TransferPricingServiceViewSet
Generated from service: transfer-pricing-service
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
    BankOfCanadaRates,
    CrossBorderTransactions,
    ExchangeRates,
    T106FilingTracking,
    TransferPricingDocumentation,
)
from core.models import AuditLogs


class TransferPricingServicePagination(CursorPagination):
    page_size = 50
    ordering = "-created_at"
    cursor_query_param = "cursor"


class TransferPricingServiceViewSet(viewsets.ViewSet):
    """
        ViewSet for transfer-pricing-service operations.

        Endpoints:
        - GET /api/services/transfer-pricing-service/documentation/ — List transfer pricing documentation
    - POST /api/services/transfer-pricing-service/create_document/ — Create TP document
    - GET /api/services/transfer-pricing-service/t106_filings/ — List T106 filing records
    - POST /api/services/transfer-pricing-service/create_t106/ — Create T106 filing record
    - GET /api/services/transfer-pricing-service/cross_border/ — List cross-border transactions
    - POST /api/services/transfer-pricing-service/record_cross_border/ — Record cross-border transaction
    - POST /api/services/transfer-pricing-service/calculate/ — Calculate transfer pricing
    - GET /api/services/transfer-pricing-service/compliance_report/ — Get TP compliance report
    """

    permission_classes = [IsAuthenticated]
    pagination_class = TransferPricingServicePagination

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
    def documentation(self, request):
        """
        List transfer pricing documentation
        GET /api/services/transfer-pricing-service/documentation/
        """
        try:
            queryset = TransferPricingDocumentation.objects.filter(
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
                    "action": "documentation",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def create_document(self, request):
        """
        Create TP document
        POST /api/services/transfer-pricing-service/create_document/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = TransferPricingDocumentation.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"},
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="create_document",
                    resource_type="TransferPricingDocumentation",
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
                    "action": "create_document",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def t106_filings(self, request):
        """
        List T106 filing records
        GET /api/services/transfer-pricing-service/t106_filings/
        """
        try:
            queryset = T106FilingTracking.objects.filter(
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
                    "action": "t106_filings",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def create_t106(self, request):
        """
        Create T106 filing record
        POST /api/services/transfer-pricing-service/create_t106/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = T106FilingTracking.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"},
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="create_t106",
                    resource_type="T106FilingTracking",
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
                    "action": "create_t106",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def cross_border(self, request):
        """
        List cross-border transactions
        GET /api/services/transfer-pricing-service/cross_border/
        """
        try:
            queryset = CrossBorderTransactions.objects.filter(
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
                    "action": "cross_border",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def record_cross_border(self, request):
        """
        Record cross-border transaction
        POST /api/services/transfer-pricing-service/record_cross_border/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CrossBorderTransactions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"},
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="record_cross_border",
                    resource_type="CrossBorderTransactions",
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
                    "action": "record_cross_border",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def calculate(self, request):
        """
        Calculate transfer pricing for a cross-border transaction.
        Required fields: amount_cents, original_currency.
        Optional: transaction_date (defaults to today).
        Applies the latest Bank of Canada rate for the currency pair.
        """
        try:
            data = request.data
            org_id = request.user.organization_id

            required = ["amount_cents", "original_currency"]
            missing = [f for f in required if f not in data]
            if missing:
                return Response(
                    {"error": f'Missing required fields: {", ".join(missing)}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                amount_cents = int(data["amount_cents"])
                if amount_cents <= 0:
                    raise ValueError()
            except (ValueError, TypeError):
                return Response(
                    {"error": "amount_cents must be a positive integer"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            original_currency = str(data["original_currency"]).upper()
            target_currency = "CAD"

            if original_currency == target_currency:
                # No conversion needed
                return Response(
                    {
                        "status": "success",
                        "amount_cents": amount_cents,
                        "original_currency": original_currency,
                        "converted_amount_cents": amount_cents,
                        "target_currency": target_currency,
                        "exchange_rate": "1.0000",
                        "rate_source": "identity",
                    },
                    status=status.HTTP_200_OK,
                )

            # Find the latest Bank of Canada rate for this currency
            rate_entry = (
                BankOfCanadaRates.objects.filter(
                    organization_id=org_id,
                    currency=original_currency,
                )
                .order_by("-rate_date")
                .first()
            )

            if not rate_entry:
                # Fall back to ExchangeRates table
                rate_entry = (
                    ExchangeRates.objects.filter(
                        organization_id=org_id,
                        from_currency=original_currency,
                    )
                    .order_by("-created_at")
                    .first()
                )

            if not rate_entry:
                return Response(
                    {
                        "error": f"No exchange rate found for {original_currency} → {target_currency}"
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Use the rate — stored as text in rate field
            rate_value = getattr(rate_entry, "rate", None) or getattr(
                rate_entry, "exchange_rate", None
            )
            if rate_value is None:
                return Response(
                    {"error": "Exchange rate record has no rate value"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            from decimal import Decimal

            rate = Decimal(str(rate_value))
            converted_cents = int(Decimal(amount_cents) * rate)

            return Response(
                {
                    "status": "success",
                    "amount_cents": amount_cents,
                    "original_currency": original_currency,
                    "converted_amount_cents": converted_cents,
                    "target_currency": target_currency,
                    "exchange_rate": str(rate),
                    "rate_date": getattr(
                        rate_entry, "rate_date", rate_entry.created_at
                    ).isoformat(),
                    "rate_source": (
                        "bank_of_canada"
                        if isinstance(rate_entry, BankOfCanadaRates)
                        else "exchange_rates"
                    ),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "calculate",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def compliance_report(self, request):
        """
        Get transfer pricing compliance report.
        Aggregates T106 filing status, TP documentation coverage,
        and cross-border transaction summary.
        """
        try:
            org_id = request.user.organization_id
            fiscal_year = request.query_params.get(
                "fiscal_year", str(timezone.now().year)
            )

            # T106 filing stats
            t106_qs = T106FilingTracking.objects.filter(organization_id=org_id)
            if fiscal_year:
                t106_qs = t106_qs.filter(fiscal_year=fiscal_year)
            t106_total = t106_qs.count()
            t106_filed = t106_qs.filter(status="filed").count()

            # TP documentation stats
            tp_docs = TransferPricingDocumentation.objects.filter(
                organization_id=org_id,
            ).count()

            # Cross-border transaction stats
            cb_qs = CrossBorderTransactions.objects.filter(organization_id=org_id)
            cb_total = cb_qs.count()
            cb_total_amount = (
                sum(t.amount_cents for t in cb_qs.only("amount_cents"))
                if cb_total > 0
                else 0
            )

            # Determine compliance status
            t106_compliant = t106_filed == t106_total and t106_total > 0
            documented = tp_docs > 0

            return Response(
                {
                    "status": "success",
                    "organization_id": str(org_id),
                    "fiscal_year": fiscal_year,
                    "t106_filings": {
                        "total": t106_total,
                        "filed": t106_filed,
                        "pending": t106_total - t106_filed,
                        "compliant": t106_compliant,
                    },
                    "documentation": {
                        "total_documents": tp_docs,
                        "documented": documented,
                    },
                    "cross_border_transactions": {
                        "total": cb_total,
                        "total_amount_cents": cb_total_amount,
                    },
                    "overall_compliant": t106_compliant and documented,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "compliance_report",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
