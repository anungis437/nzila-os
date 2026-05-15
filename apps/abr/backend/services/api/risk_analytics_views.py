"""
RiskAnalyticsViewSet
Service: risk-analytics
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
from compliance.models import RiskScoreHistory, OrganizationRiskHistory
from auth_core.models import AuditLogs

class RiskAnalyticsPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class RiskAnalyticsViewSet(viewsets.ViewSet):
    """
    ViewSet for risk-analytics operations.

    Endpoints:
    - GET /api/services/risk-analytics/org_summary/ — Get organization risk summary
- GET /api/services/risk-analytics/department_scores/ — Get department risk scores
- GET /api/services/risk-analytics/department_details/ — Get department user risk details
- GET /api/services/risk-analytics/trends/ — Get risk trends over time
- POST /api/services/risk-analytics/capture_snapshot/ — Capture risk score snapshot
    """

    permission_classes = [IsAuthenticated]
    pagination_class = RiskAnalyticsPagination

    def paginate_queryset(self, queryset):
        paginator = self.pagination_class()
        return paginator.paginate_queryset(queryset, self.request, view=self)

    def get_paginated_response(self, data):
        paginator = self.pagination_class()
        return Response({
            'count': len(data),
            'results': data,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def org_summary(self, request):
        """
        Get organization risk summary
        GET /api/services/risk-analytics/org_summary/
        """
        try:
            queryset = OrganizationRiskHistory.objects.filter(
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
            logger.error(f'org_summary failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'org_summary',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def department_scores(self, request):
        """
        Get department risk scores
        GET /api/services/risk-analytics/department_scores/
        """
        try:
            queryset = RiskScoreHistory.objects.filter(
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
            logger.error(f'department_scores failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'department_scores',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def department_details(self, request):
        """
        Get department user risk details
        GET /api/services/risk-analytics/department_details/
        """
        try:
            queryset = RiskScoreHistory.objects.filter(
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
            logger.error(f'department_details failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'department_details',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def trends(self, request):
        """
        Get risk trends over time
        GET /api/services/risk-analytics/trends/
        """
        try:
            queryset = RiskScoreHistory.objects.filter(
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
            logger.error(f'trends failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'trends',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def capture_snapshot(self, request):
        """
        Capture risk score snapshot
        POST /api/services/risk-analytics/capture_snapshot/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = RiskScoreHistory.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='capture_snapshot',
                    resource_type='RiskScoreHistory',
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
            logger.error(f'capture_snapshot failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'capture_snapshot',
            }, status=status.HTTP_400_BAD_REQUEST)

