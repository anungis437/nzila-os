"""
WhiplashPreventionServiceViewSet
Generated from service: whiplash-prevention-service
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
    AccountBalanceReconciliation,
    PaymentClassificationPolicy,
    PaymentRoutingRules,
    SeparatedPaymentTransactions,
    StrikeFundPaymentAudit,
    WhiplashPreventionAudit,
    WhiplashViolations,
)
from core.models import AuditLogs


class WhiplashPreventionServicePagination(CursorPagination):
    page_size = 50
    ordering = "-created_at"
    cursor_query_param = "cursor"


class WhiplashPreventionServiceViewSet(viewsets.ViewSet):
    """
        ViewSet for whiplash-prevention-service operations.

        Endpoints:
        - GET /api/services/whiplash-prevention-service/monitor/ — Monitor whiplash indicators for agreement
    - GET /api/services/whiplash-prevention-service/violations/ — List whiplash violations
    - POST /api/services/whiplash-prevention-service/flag_violation/ — Flag a whiplash violation
    - POST /api/services/whiplash-prevention-service/resolve_violation/ — Resolve a whiplash violation
    - GET /api/services/whiplash-prevention-service/payment_policy/ — Get payment classification policy
    - POST /api/services/whiplash-prevention-service/update_payment_policy/ — Update payment classification policy
    - GET /api/services/whiplash-prevention-service/routing_rules/ — Get payment routing rules
    - GET /api/services/whiplash-prevention-service/separated_transactions/ — List separated payment transactions
    - GET /api/services/whiplash-prevention-service/reconciliation/ — Get account balance reconciliation
    - GET /api/services/whiplash-prevention-service/strike_fund_audit/ — Get strike fund payment audit
    - GET /api/services/whiplash-prevention-service/prevention_audit/ — Get whiplash prevention audit trail
    """

    permission_classes = [IsAuthenticated]
    pagination_class = WhiplashPreventionServicePagination

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
    def monitor(self, request):
        """
        Monitor whiplash indicators for the organization.
        Returns a dashboard of payment separation compliance metrics.
        """
        try:
            org_id = request.user.organization_id

            # Open violations
            open_violations = WhiplashViolations.objects.filter(
                organization_id=org_id,
                violation_status="open",
            ).count()

            total_violations = WhiplashViolations.objects.filter(
                organization_id=org_id,
            ).count()

            resolved_violations = WhiplashViolations.objects.filter(
                organization_id=org_id,
                violation_status="resolved",
            ).count()

            # Recent transactions
            recent_txns = SeparatedPaymentTransactions.objects.filter(
                organization_id=org_id,
            ).order_by("-created_at")[:100]

            total_txns = recent_txns.count()
            correct_routing = sum(1 for t in recent_txns if t.correct_account_used)
            incorrect_routing = total_txns - correct_routing
            compliance_rate = (
                round((correct_routing / total_txns * 100), 1)
                if total_txns > 0
                else 100.0
            )

            # Active policies
            active_policies = (
                PaymentClassificationPolicy.objects.filter(
                    organization_id=org_id,
                    effective_date__lte=timezone.now(),
                )
                .exclude(
                    expiry_date__lt=timezone.now(),
                )
                .count()
            )

            # Routing rules
            routing_rules_count = PaymentRoutingRules.objects.filter(
                organization_id=org_id,
            ).count()

            # Latest reconciliation
            last_recon = (
                AccountBalanceReconciliation.objects.filter(
                    organization_id=org_id,
                )
                .order_by("-reconciliation_date")
                .first()
            )

            risk_level = "low"
            if open_violations > 5 or compliance_rate < 90:
                risk_level = "high"
            elif open_violations > 0 or compliance_rate < 98:
                risk_level = "medium"

            return Response(
                {
                    "status": "success",
                    "organization_id": str(org_id),
                    "risk_level": risk_level,
                    "violations": {
                        "open": open_violations,
                        "resolved": resolved_violations,
                        "total": total_violations,
                    },
                    "transactions": {
                        "recent_count": total_txns,
                        "correct_routing": correct_routing,
                        "incorrect_routing": incorrect_routing,
                        "compliance_rate_pct": compliance_rate,
                    },
                    "policies": {
                        "active_count": active_policies,
                        "routing_rules_count": routing_rules_count,
                    },
                    "last_reconciliation": {
                        "date": (
                            last_recon.reconciliation_date.isoformat()
                            if last_recon
                            else None
                        ),
                        "status": (
                            last_recon.reconciliation_status if last_recon else None
                        ),
                        "balance_match": (
                            last_recon.balance_match if last_recon else None
                        ),
                    },
                    "monitored_at": timezone.now().isoformat(),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "monitor",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def violations(self, request):
        """
        List whiplash violations
        GET /api/services/whiplash-prevention-service/violations/
        """
        try:
            queryset = WhiplashViolations.objects.filter(
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

    @action(detail=False, methods=["post"])
    def flag_violation(self, request):
        """
        Flag a whiplash violation
        POST /api/services/whiplash-prevention-service/flag_violation/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = WhiplashViolations.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="flag_violation",
                    resource_type="WhiplashViolations",
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
                    "action": "flag_violation",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def resolve_violation(self, request):
        """
        Resolve a whiplash violation.
        Required fields: violation_id.
        Optional: correction_action, resolution_notes.
        """
        try:
            data = request.data
            org_id = request.user.organization_id

            violation_id = data.get("violation_id")
            if not violation_id:
                return Response(
                    {"error": "violation_id is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            with transaction.atomic():
                try:
                    violation = WhiplashViolations.objects.select_for_update().get(
                        id=violation_id,
                        organization_id=org_id,
                    )
                except WhiplashViolations.DoesNotExist:
                    return Response(
                        {"error": "Violation not found"},
                        status=status.HTTP_404_NOT_FOUND,
                    )

                if violation.violation_status == "resolved":
                    return Response(
                        {"error": "Violation is already resolved"},
                        status=status.HTTP_409_CONFLICT,
                    )

                violation.violation_status = "resolved"
                violation.resolved_by = str(request.user.id)
                violation.resolved_at = timezone.now()
                violation.correction_action = data.get("correction_action", "")
                violation.resolution_notes = data.get("resolution_notes", "")
                violation.save(
                    update_fields=[
                        "violation_status",
                        "resolved_by",
                        "resolved_at",
                        "correction_action",
                        "resolution_notes",
                        "updated_at",
                    ]
                )

                AuditLogs.objects.create(
                    organization_id=org_id,
                    action="resolve_violation",
                    resource_type="WhiplashViolations",
                    resource_id=str(violation.id),
                    user_id=str(request.user.id),
                    details={
                        "correction_action": data.get("correction_action", ""),
                        "resolution_notes": data.get("resolution_notes", ""),
                    },
                )

            return Response(
                {
                    "id": str(violation.id),
                    "status": "success",
                    "message": "Violation resolved",
                    "resolved_at": violation.resolved_at.isoformat(),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "resolve_violation",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def payment_policy(self, request):
        """
        Get payment classification policy
        GET /api/services/whiplash-prevention-service/payment_policy/
        """
        try:
            queryset = PaymentClassificationPolicy.objects.filter(
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
                    "action": "payment_policy",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def update_payment_policy(self, request):
        """
        Update payment classification policy
        POST /api/services/whiplash-prevention-service/update_payment_policy/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PaymentClassificationPolicy.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="update_payment_policy",
                    resource_type="PaymentClassificationPolicy",
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
                    "action": "update_payment_policy",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def routing_rules(self, request):
        """
        Get payment routing rules
        GET /api/services/whiplash-prevention-service/routing_rules/
        """
        try:
            queryset = PaymentRoutingRules.objects.filter(
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
                    "action": "routing_rules",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def separated_transactions(self, request):
        """
        List separated payment transactions
        GET /api/services/whiplash-prevention-service/separated_transactions/
        """
        try:
            queryset = SeparatedPaymentTransactions.objects.filter(
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
                    "action": "separated_transactions",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def reconciliation(self, request):
        """
        Get account balance reconciliation
        GET /api/services/whiplash-prevention-service/reconciliation/
        """
        try:
            queryset = AccountBalanceReconciliation.objects.filter(
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
                    "action": "reconciliation",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def strike_fund_audit(self, request):
        """
        Get strike fund payment audit
        GET /api/services/whiplash-prevention-service/strike_fund_audit/
        """
        try:
            queryset = StrikeFundPaymentAudit.objects.filter(
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
                    "action": "strike_fund_audit",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def prevention_audit(self, request):
        """
        Get whiplash prevention audit trail
        GET /api/services/whiplash-prevention-service/prevention_audit/
        """
        try:
            queryset = WhiplashPreventionAudit.objects.filter(
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
                    "action": "prevention_audit",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
