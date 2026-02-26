"""
LmbpImmigrationService API ViewSet
Manages foreign workers, LMBP letters, GSS applications, mentorships,
compliance alerts, and compliance reports for the LMBP immigration program.
"""

from compliance.models import (
    ForeignWorkers,
    GssApplications,
    LmbpComplianceAlerts,
    LmbpComplianceReports,
    LmbpLetters,
    Mentorships,
)
from compliance.serializers import (
    ForeignWorkersSerializer,
    GssApplicationsSerializer,
    LmbpComplianceAlertsSerializer,
    LmbpComplianceReportsSerializer,
    LmbpLettersSerializer,
    MentorshipsSerializer,
)
from core.models import AuditLogs
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class LmbpImmigrationServiceViewSet(viewsets.ViewSet):
    """
    ViewSet for LMBP immigration-service operations.

    Custom endpoints for foreign-worker management, LMBP letter generation,
    GSS application tracking, mentorship programs, and compliance reporting.
    """

    permission_classes = [IsAuthenticated]

    # ------------------------------------------------------------------
    # Foreign Workers
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def foreign_workers(self, request):
        """
        List foreign workers, optionally filtered by ?employer_id= or ?compliance_status=.
        GET /api/services/lmbp-immigration-service/foreign_workers/
        """
        qs = ForeignWorkers.objects.all().order_by("-created_at")
        employer_id = request.query_params.get("employer_id")
        if employer_id:
            qs = qs.filter(employer_id=employer_id)
        compliance_status = request.query_params.get("compliance_status")
        if compliance_status:
            qs = qs.filter(compliance_status=compliance_status)
        serializer = ForeignWorkersSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def register_foreign_worker(self, request):
        """
        Register a new foreign worker.
        POST /api/services/lmbp-immigration-service/register_foreign_worker/
        """
        try:
            serializer = ForeignWorkersSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = serializer.save()
                AuditLogs.objects.create(
                    action="foreign_worker_registered",
                    actor_id=str(request.user.id),
                    entity_type="foreign_worker",
                    entity_id=str(instance.id),
                )
            return Response(
                ForeignWorkersSerializer(instance).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # LMBP Letters
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def lmbp_letters(self, request):
        """
        List LMBP letters, optionally filtered by ?employer_id=.
        GET /api/services/lmbp-immigration-service/lmbp_letters/
        """
        qs = LmbpLetters.objects.all().order_by("-generated_date")
        employer_id = request.query_params.get("employer_id")
        if employer_id:
            qs = qs.filter(employer_id=employer_id)
        serializer = LmbpLettersSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def generate_lmbp_letter(self, request):
        """
        Generate a new LMBP letter.
        POST /api/services/lmbp-immigration-service/generate_lmbp_letter/
        """
        try:
            serializer = LmbpLettersSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = serializer.save()
                AuditLogs.objects.create(
                    action="lmbp_letter_generated",
                    actor_id=str(request.user.id),
                    entity_type="lmbp_letter",
                    entity_id=str(instance.id),
                )
            return Response(
                LmbpLettersSerializer(instance).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # GSS Applications
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def gss_applications(self, request):
        """
        List GSS applications, optionally filtered by ?foreign_worker_id= or ?status=.
        GET /api/services/lmbp-immigration-service/gss_applications/
        """
        qs = GssApplications.objects.all().order_by("-submission_date")
        fw_id = request.query_params.get("foreign_worker_id")
        if fw_id:
            qs = qs.filter(foreign_worker_id=fw_id)
        app_status = request.query_params.get("status")
        if app_status:
            qs = qs.filter(status=app_status)
        serializer = GssApplicationsSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def submit_gss_application(self, request):
        """
        Submit a new GSS application.
        POST /api/services/lmbp-immigration-service/submit_gss_application/
        """
        try:
            serializer = GssApplicationsSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = serializer.save()
                AuditLogs.objects.create(
                    action="gss_application_submitted",
                    actor_id=str(request.user.id),
                    entity_type="gss_application",
                    entity_id=str(instance.id),
                )
            return Response(
                GssApplicationsSerializer(instance).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Mentorships
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def mentorships(self, request):
        """
        List mentorships, optionally filtered by ?mentor_id= or ?mentee_id= or ?status=.
        GET /api/services/lmbp-immigration-service/mentorships/
        """
        qs = Mentorships.objects.all().order_by("-start_date")
        mentor_id = request.query_params.get("mentor_id")
        if mentor_id:
            qs = qs.filter(mentor_id=mentor_id)
        mentee_id = request.query_params.get("mentee_id")
        if mentee_id:
            qs = qs.filter(mentee_id=mentee_id)
        mentorship_status = request.query_params.get("status")
        if mentorship_status:
            qs = qs.filter(status=mentorship_status)
        serializer = MentorshipsSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def create_mentorship(self, request):
        """
        Create a new mentorship program.
        POST /api/services/lmbp-immigration-service/create_mentorship/
        """
        try:
            serializer = MentorshipsSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = serializer.save()
                AuditLogs.objects.create(
                    action="mentorship_created",
                    actor_id=str(request.user.id),
                    entity_type="mentorship",
                    entity_id=str(instance.id),
                )
            return Response(
                MentorshipsSerializer(instance).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Compliance Alerts
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def compliance_alerts(self, request):
        """
        List LMBP compliance alerts, optionally filtered by ?severity= or ?status=.
        GET /api/services/lmbp-immigration-service/compliance_alerts/
        """
        qs = LmbpComplianceAlerts.objects.all().order_by("-created_at")
        severity = request.query_params.get("severity")
        if severity:
            qs = qs.filter(severity=severity)
        alert_status = request.query_params.get("status")
        if alert_status:
            qs = qs.filter(status=alert_status)
        serializer = LmbpComplianceAlertsSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # Compliance Reports
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def compliance_reports(self, request):
        """
        List LMBP compliance reports, optionally filtered by ?employer_id=.
        GET /api/services/lmbp-immigration-service/compliance_reports/
        """
        qs = LmbpComplianceReports.objects.all().order_by("-created_at")
        employer_id = request.query_params.get("employer_id")
        if employer_id:
            qs = qs.filter(employer_id=employer_id)
        serializer = LmbpComplianceReportsSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def generate_compliance_report(self, request):
        """
        Generate a new LMBP compliance report.
        POST /api/services/lmbp-immigration-service/generate_compliance_report/
        """
        try:
            serializer = LmbpComplianceReportsSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = serializer.save()
                AuditLogs.objects.create(
                    action="lmbp_compliance_report_generated",
                    actor_id=str(request.user.id),
                    entity_type="lmbp_compliance_report",
                    entity_id=str(instance.id),
                )
            return Response(
                LmbpComplianceReportsSerializer(instance).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Dashboard
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        """
        LMBP immigration dashboard summary.
        GET /api/services/lmbp-immigration-service/dashboard/
        """
        try:
            total_workers = ForeignWorkers.objects.count()
            pending_workers = ForeignWorkers.objects.filter(
                compliance_status="pending"
            ).count()
            active_mentorships = Mentorships.objects.filter(status="active").count()
            open_alerts = LmbpComplianceAlerts.objects.filter(status="open").count()
            active_letters = LmbpLetters.objects.filter(
                compliance_status="active"
            ).count()
            pending_gss = GssApplications.objects.filter(status="submitted").count()

            return Response(
                {
                    "totalForeignWorkers": total_workers,
                    "pendingCompliance": pending_workers,
                    "activeMentorships": active_mentorships,
                    "openAlerts": open_alerts,
                    "activeLmbpLetters": active_letters,
                    "pendingGssApplications": pending_gss,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
