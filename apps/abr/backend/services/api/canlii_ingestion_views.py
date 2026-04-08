"""
CanLIIIngestionViewSet
Service: canlii-ingestion
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
from core.models import CanliiIngestionRuns, CanliiApiRequests, CanliiDailyQuotas, TribunalCasesRaw, IngestionJobs, IngestionErrors
from auth_core.models import AuditLogs

class CanLIIIngestionPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class CanLIIIngestionViewSet(viewsets.ViewSet):
    """
    ViewSet for canlii-ingestion operations.

    Endpoints:
    - POST /api/services/canlii-ingestion/start/ — Start CanLII ingestion run
- GET /api/services/canlii-ingestion/stats/ — Get ingestion statistics
- GET /api/services/canlii-ingestion/daily_quota/ — Get daily API quota status
- GET /api/services/canlii-ingestion/jobs/ — List ingestion jobs
- GET /api/services/canlii-ingestion/errors/ — List ingestion errors
    """

    permission_classes = [IsAuthenticated]
    pagination_class = CanLIIIngestionPagination

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
    def start(self, request):
        """
        Start CanLII ingestion run
        POST /api/services/canlii-ingestion/start/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CanliiIngestionRuns.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='start',
                    resource_type='CanliiIngestionRuns',
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
            logger.error(f'start failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'start',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Get ingestion statistics
        GET /api/services/canlii-ingestion/stats/
        """
        try:
            queryset = CanliiIngestionRuns.objects.filter(
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
            logger.error(f'stats failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'stats',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def daily_quota(self, request):
        """
        Get daily API quota status
        GET /api/services/canlii-ingestion/daily_quota/
        """
        try:
            queryset = CanliiDailyQuotas.objects.filter(
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
            logger.error(f'daily_quota failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'daily_quota',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def jobs(self, request):
        """
        List ingestion jobs
        GET /api/services/canlii-ingestion/jobs/
        """
        try:
            queryset = IngestionJobs.objects.filter(
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
            logger.error(f'jobs failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'jobs',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def errors(self, request):
        """
        List ingestion errors
        GET /api/services/canlii-ingestion/errors/
        """
        try:
            queryset = IngestionErrors.objects.filter(
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
            logger.error(f'errors failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'errors',
            }, status=status.HTTP_400_BAD_REQUEST)

