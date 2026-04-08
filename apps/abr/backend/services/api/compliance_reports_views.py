"""
ComplianceReportsViewSet
Service: compliance-reports
Auto-generated: 2026-02-18 09:26
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import CursorPagination
from django.db import transaction
from django.utils import timezone
import uuid
import logging

logger = logging.getLogger(__name__)
from core.models import ComplianceReports
from core.models import AuditLogExports
from auth_core.models import AuditLogs

class ComplianceReportsPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class ComplianceReportsViewSet(viewsets.ViewSet):
    """
    ViewSet for compliance-reports operations.

    Endpoints:
    - POST /api/services/compliance-reports/generate/ — Generate compliance report
- GET /api/services/compliance-reports/get_report/ — Get specific compliance report
- GET /api/services/compliance-reports/list_reports/ — List compliance reports
- POST /api/services/compliance-reports/schedule/ — Schedule recurring report
- GET /api/services/compliance-reports/export_csv/ — Export report as CSV
- GET /api/services/compliance-reports/export_pdf/ — Export report as PDF
- GET /api/services/compliance-reports/export_xlsx/ — Export report as XLSX
- POST /api/services/compliance-reports/approve_export/ — Approve report export
    """

    permission_classes = [IsAuthenticated]
    pagination_class = ComplianceReportsPagination

    def paginate_queryset(self, queryset):
        paginator = self.pagination_class()
        return paginator.paginate_queryset(queryset, self.request, view=self)

    def get_paginated_response(self, data):
        paginator = self.pagination_class()
        return Response({
            'count': len(data),
            'results': data,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """
        Generate compliance report
        POST /api/services/compliance-reports/generate/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = ComplianceReports.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='generate',
                    resource_type='ComplianceReports',
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response({
                'id': str(obj.id),
                'createdAt': obj.created_at.isoformat(),
                'status': 'success',
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f'generate failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'generate',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def get_report(self, request):
        """
        Get specific compliance report
        GET /api/services/compliance-reports/get_report/
        """
        try:
            queryset = ComplianceReports.objects.filter(
                organization_id=request.user.organization_id
            )
            for param in ['status', 'type', 'created_after', 'created_before']:
                val = request.query_params.get(param)
                if val:
                    if param == 'created_after':
                        queryset = queryset.filter(created_at__gte=val)
                    elif param == 'created_before':
                        queryset = queryset.filter(created_at__lte=val)
                    else:
                        queryset = queryset.filter(**{param: val})

            page = self.paginate_queryset(queryset.order_by('-created_at'))
            if page is not None:
                data = list(page.values())
                return self.get_paginated_response(data)

            return Response({
                'count': queryset.count(),
                'results': list(queryset.order_by('-created_at').values()[:100]),
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'get_report failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'get_report',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def list_reports(self, request):
        """
        List compliance reports
        GET /api/services/compliance-reports/list_reports/
        """
        try:
            queryset = ComplianceReports.objects.filter(
                organization_id=request.user.organization_id
            )
            for param in ['status', 'type', 'created_after', 'created_before']:
                val = request.query_params.get(param)
                if val:
                    if param == 'created_after':
                        queryset = queryset.filter(created_at__gte=val)
                    elif param == 'created_before':
                        queryset = queryset.filter(created_at__lte=val)
                    else:
                        queryset = queryset.filter(**{param: val})

            page = self.paginate_queryset(queryset.order_by('-created_at'))
            if page is not None:
                data = list(page.values())
                return self.get_paginated_response(data)

            return Response({
                'count': queryset.count(),
                'results': list(queryset.order_by('-created_at').values()[:100]),
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'list_reports failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'list_reports',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def schedule(self, request):
        """
        Schedule recurring report
        POST /api/services/compliance-reports/schedule/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = ComplianceReports.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='schedule',
                    resource_type='ComplianceReports',
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response({
                'id': str(obj.id),
                'createdAt': obj.created_at.isoformat(),
                'status': 'success',
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f'schedule failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'schedule',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """
        Export report as CSV
        GET /api/services/compliance-reports/export_csv/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'export_csv failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'export_csv',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        """
        Export report as PDF
        GET /api/services/compliance-reports/export_pdf/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'export_pdf failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'export_pdf',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def export_xlsx(self, request):
        """
        Export report as XLSX
        GET /api/services/compliance-reports/export_xlsx/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'export_xlsx failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'export_xlsx',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def approve_export(self, request):
        """
        Approve report export
        POST /api/services/compliance-reports/approve_export/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = AuditLogExports.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='approve_export',
                    resource_type='AuditLogExports',
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response({
                'id': str(obj.id),
                'createdAt': obj.created_at.isoformat(),
                'status': 'success',
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f'approve_export failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'approve_export',
            }, status=status.HTTP_400_BAD_REQUEST)

