"""
AuditLoggerViewSet
Service: audit-logger
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
from auth_core.models import AuditLogs
from auth_core.models import AuditLogs

class AuditLoggerPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class AuditLoggerViewSet(viewsets.ViewSet):
    """
    ViewSet for audit-logger operations.

    Endpoints:
    - POST /api/services/audit-logger/log_event/ — Log an audit event
- GET /api/services/audit-logger/search/ — Search audit logs
- GET /api/services/audit-logger/export/ — Export audit logs
    """

    permission_classes = [IsAuthenticated]
    pagination_class = AuditLoggerPagination

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
    def log_event(self, request):
        """
        Log an audit event
        POST /api/services/audit-logger/log_event/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='log_event',
                    resource_type='AuditLogs',
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
            logger.error(f'log_event failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'log_event',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Search audit logs
        GET /api/services/audit-logger/search/
        """
        try:
            queryset = AuditLogs.objects.filter(
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
            logger.error(f'search failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'search',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def export(self, request):
        """
        Export audit logs
        GET /api/services/audit-logger/export/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'export failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'export',
            }, status=status.HTTP_400_BAD_REQUEST)

