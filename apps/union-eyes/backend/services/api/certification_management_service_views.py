"""
CertificationManagementService API ViewSet
Manages certification types, staff certifications, continuing education,
license renewals, alerts, compliance reports, and audit logging.
"""

from compliance.models import (
    CertificationAlerts,
    CertificationAuditLog,
    CertificationComplianceReports,
    CertificationTypes,
    ContinuingEducation,
    LicenseRenewals,
    StaffCertifications,
)
from compliance.serializers import (
    CertificationAlertsSerializer,
    CertificationAuditLogSerializer,
    CertificationComplianceReportsSerializer,
    CertificationTypesSerializer,
    ContinuingEducationSerializer,
    LicenseRenewalsSerializer,
    StaffCertificationsSerializer,
)
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class CertificationManagementServiceViewSet(viewsets.ViewSet):
    """
    ViewSet for certification-management-service operations.

    Custom endpoints for managing certification lifecycle, continuing
    education tracking, license renewals, and compliance reporting.
    """

    permission_classes = [IsAuthenticated]

    # ------------------------------------------------------------------
    # Certification Types
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def certification_types(self, request):
        """
        List all certification types.
        GET /api/services/certification-management-service/certification_types/
        """
        qs = CertificationTypes.objects.all().order_by("certification_name")
        serializer = CertificationTypesSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def create_certification_type(self, request):
        """
        Create a new certification type.
        POST /api/services/certification-management-service/create_certification_type/
        """
        try:
            serializer = CertificationTypesSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = serializer.save()
                CertificationAuditLog.objects.create(
                    action_type="certification_type_created",
                )
            return Response(
                CertificationTypesSerializer(instance).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Staff Certifications
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def staff_certifications(self, request):
        """
        List staff certifications, optionally filtered by ?user_id=.
        GET /api/services/certification-management-service/staff_certifications/
        """
        qs = StaffCertifications.objects.all().order_by("-created_at")
        user_id = request.query_params.get("user_id")
        if user_id:
            qs = qs.filter(user_id=user_id)
        serializer = StaffCertificationsSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def assign_certification(self, request):
        """
        Assign a certification to a staff member.
        POST /api/services/certification-management-service/assign_certification/
        """
        try:
            serializer = StaffCertificationsSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = serializer.save()
                CertificationAuditLog.objects.create(
                    action_type="certification_assigned",
                )
            return Response(
                StaffCertificationsSerializer(instance).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Continuing Education
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def continuing_education(self, request):
        """
        List continuing-education records, optionally filtered by ?user_id=.
        GET /api/services/certification-management-service/continuing_education/
        """
        qs = ContinuingEducation.objects.all().order_by("-created_at")
        user_id = request.query_params.get("user_id")
        if user_id:
            qs = qs.filter(user_id=user_id)
        serializer = ContinuingEducationSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def record_education(self, request):
        """
        Record a continuing-education activity.
        POST /api/services/certification-management-service/record_education/
        """
        try:
            serializer = ContinuingEducationSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = serializer.save()
                CertificationAuditLog.objects.create(
                    action_type="continuing_education_recorded",
                )
            return Response(
                ContinuingEducationSerializer(instance).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # License Renewals
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def license_renewals(self, request):
        """
        List license renewals, optionally filtered by ?certification_id=.
        GET /api/services/certification-management-service/license_renewals/
        """
        qs = LicenseRenewals.objects.all().order_by("-created_at")
        cert_id = request.query_params.get("certification_id")
        if cert_id:
            qs = qs.filter(certification_id=cert_id)
        serializer = LicenseRenewalsSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def renew_license(self, request):
        """
        Create a license renewal record.
        POST /api/services/certification-management-service/renew_license/
        """
        try:
            serializer = LicenseRenewalsSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = serializer.save()
                CertificationAuditLog.objects.create(
                    action_type="license_renewed",
                )
            return Response(
                LicenseRenewalsSerializer(instance).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Alerts
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def alerts(self, request):
        """
        List certification alerts, optionally filtered by ?user_id=.
        GET /api/services/certification-management-service/alerts/
        """
        qs = CertificationAlerts.objects.all().order_by("-created_at")
        user_id = request.query_params.get("user_id")
        if user_id:
            qs = qs.filter(user_id=user_id)
        serializer = CertificationAlertsSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # Compliance Reports
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def compliance_reports(self, request):
        """
        List certification compliance reports.
        GET /api/services/certification-management-service/compliance_reports/
        """
        qs = CertificationComplianceReports.objects.all().order_by("-report_date")
        serializer = CertificationComplianceReportsSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def generate_compliance_report(self, request):
        """
        Generate a new compliance report.
        POST /api/services/certification-management-service/generate_compliance_report/
        """
        try:
            serializer = CertificationComplianceReportsSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = serializer.save()
                CertificationAuditLog.objects.create(
                    action_type="compliance_report_generated",
                )
            return Response(
                CertificationComplianceReportsSerializer(instance).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Audit Log
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def audit_log(self, request):
        """
        List certification audit log entries.
        GET /api/services/certification-management-service/audit_log/
        """
        qs = CertificationAuditLog.objects.all().order_by("-created_at")
        serializer = CertificationAuditLogSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)
