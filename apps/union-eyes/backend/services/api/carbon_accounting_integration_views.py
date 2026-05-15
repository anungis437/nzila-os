"""
CarbonAccountingIntegrationViewSet
Generated from service: carbon-accounting-integration
Auto-generated: 2026-02-18 09:08
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
from core.models import IntegrationConfigs, IntegrationSyncLog
from core.models import AuditLogs

class CarbonAccountingIntegrationPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class CarbonAccountingIntegrationViewSet(viewsets.ViewSet):
    """
    ViewSet for carbon-accounting-integration operations.

    Endpoints:
    - POST /api/services/carbon-accounting-integration/sync_provider/ — Sync carbon data from external provider
- GET /api/services/carbon-accounting-integration/provider_status/ — Get integration provider status
- POST /api/services/carbon-accounting-integration/configure_provider/ — Configure carbon data provider
- GET /api/services/carbon-accounting-integration/sync_history/ — Get sync history
    """

    permission_classes = [IsAuthenticated]
    pagination_class = CarbonAccountingIntegrationPagination

    def paginate_queryset(self, queryset):
        paginator = self.pagination_class()
        return paginator.paginate_queryset(queryset, self.request, view=self)

    def get_paginated_response(self, data):
        paginator = self.pagination_class()
        # Reconstruct paginated response
        return Response({
            'count': len(data),
            'results': data,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def sync_provider(self, request):
        """
        Sync carbon data from external provider
        POST /api/services/carbon-accounting-integration/sync_provider/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = IntegrationSyncLog.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='sync_provider',
                    resource_type='IntegrationSyncLog',
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response({
                'id': str(obj.id),
                'created_at': obj.created_at.isoformat(),
                'status': 'success',
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'error': 'An error occurred',
                'action': 'sync_provider',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def provider_status(self, request):
        """
        Get integration provider status
        GET /api/services/carbon-accounting-integration/provider_status/
        """
        try:
            queryset = IntegrationConfigs.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
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
            return Response({
                'error': 'An error occurred',
                'action': 'provider_status',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def configure_provider(self, request):
        """
        Configure carbon data provider
        POST /api/services/carbon-accounting-integration/configure_provider/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = IntegrationConfigs.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='configure_provider',
                    resource_type='IntegrationConfigs',
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response({
                'id': str(obj.id),
                'created_at': obj.created_at.isoformat(),
                'status': 'success',
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'error': 'An error occurred',
                'action': 'configure_provider',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def sync_history(self, request):
        """
        Get sync history
        GET /api/services/carbon-accounting-integration/sync_history/
        """
        try:
            queryset = IntegrationSyncLog.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
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
            return Response({
                'error': 'An error occurred',
                'action': 'sync_history',
            }, status=status.HTTP_400_BAD_REQUEST)

