"""
TaxSlipService API ViewSet
Manages T4A tax slips, RL-1 tax slips, tax-year-end processing,
and weekly threshold tracking for the union payroll/tax subsystem.
"""

from billing.models import (
    Rl1TaxSlips,
    T4aTaxSlips,
    TaxYearEndProcessing,
    WeeklyThresholdTracking,
)
from billing.serializers import (
    Rl1TaxSlipsSerializer,
    T4aTaxSlipsSerializer,
    TaxYearEndProcessingSerializer,
    WeeklyThresholdTrackingSerializer,
)
from core.models import AuditLogs
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class TaxSlipServiceViewSet(viewsets.ViewSet):
    """
    ViewSet for tax-slip-service operations.

    Custom endpoints for generating and querying T4A / RL-1 slips,
    year-end processing runs, and weekly threshold tracking.
    """

    permission_classes = [IsAuthenticated]

    # ------------------------------------------------------------------
    # T4A Tax Slips
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def t4a_slips(self, request):
        """
        List T4A tax slips, optionally filtered by ?user_id= or ?tax_year=.
        GET /api/services/tax-slip-service/t4a_slips/
        """
        qs = T4aTaxSlips.objects.all().order_by("-created_at")
        user_id = request.query_params.get("user_id")
        if user_id:
            qs = qs.filter(user_id=user_id)
        serializer = T4aTaxSlipsSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def generate_t4a(self, request):
        """
        Generate a T4A tax slip.
        POST /api/services/tax-slip-service/generate_t4a/
        """
        try:
            serializer = T4aTaxSlipsSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = serializer.save()
                AuditLogs.objects.create(
                    action="t4a_tax_slip_generated",
                    actor_id=str(request.user.id),
                    entity_type="t4a_tax_slip",
                    entity_id=str(instance.id),
                )
            return Response(
                T4aTaxSlipsSerializer(instance).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # RL-1 Tax Slips
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def rl1_slips(self, request):
        """
        List RL-1 tax slips, optionally filtered by ?user_id=.
        GET /api/services/tax-slip-service/rl1_slips/
        """
        qs = Rl1TaxSlips.objects.all().order_by("-created_at")
        user_id = request.query_params.get("user_id")
        if user_id:
            qs = qs.filter(user_id=user_id)
        serializer = Rl1TaxSlipsSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def generate_rl1(self, request):
        """
        Generate an RL-1 tax slip.
        POST /api/services/tax-slip-service/generate_rl1/
        """
        try:
            serializer = Rl1TaxSlipsSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = serializer.save()
                AuditLogs.objects.create(
                    action="rl1_tax_slip_generated",
                    actor_id=str(request.user.id),
                    entity_type="rl1_tax_slip",
                    entity_id=str(instance.id),
                )
            return Response(
                Rl1TaxSlipsSerializer(instance).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Tax Year-End Processing
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def year_end_runs(self, request):
        """
        List tax year-end processing runs.
        GET /api/services/tax-slip-service/year_end_runs/
        """
        qs = TaxYearEndProcessing.objects.all().order_by("-created_at")
        serializer = TaxYearEndProcessingSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def start_year_end(self, request):
        """
        Initiate a tax year-end processing run.
        POST /api/services/tax-slip-service/start_year_end/
        """
        try:
            serializer = TaxYearEndProcessingSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = serializer.save()
                AuditLogs.objects.create(
                    action="tax_year_end_started",
                    actor_id=str(request.user.id),
                    entity_type="tax_year_end_processing",
                    entity_id=str(instance.id),
                )
            return Response(
                TaxYearEndProcessingSerializer(instance).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Weekly Threshold Tracking
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def weekly_thresholds(self, request):
        """
        List weekly threshold tracking records, optionally by ?user_id=.
        GET /api/services/tax-slip-service/weekly_thresholds/
        """
        qs = WeeklyThresholdTracking.objects.all().order_by("-created_at")
        user_id = request.query_params.get("user_id")
        if user_id:
            qs = qs.filter(user_id=user_id)
        serializer = WeeklyThresholdTrackingSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)
