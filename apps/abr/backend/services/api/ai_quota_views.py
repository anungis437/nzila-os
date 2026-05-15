"""
AIQuotaViewSet
Service: ai-quota
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
from core.models import AiQuota, AiUsageDaily
from auth_core.models import AuditLogs

class AIQuotaPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class AIQuotaViewSet(viewsets.ViewSet):
    """
    ViewSet for ai-quota operations.

    Endpoints:
    - GET /api/services/ai-quota/check_quota/ — Check current AI quota for user/org
- POST /api/services/ai-quota/record_usage/ — Record AI usage event
- GET /api/services/ai-quota/get_usage/ — Get AI usage stats
- GET /api/services/ai-quota/quota_config/ — Get AI quota configuration
    """

    permission_classes = [IsAuthenticated]
    pagination_class = AIQuotaPagination

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
    def check_quota(self, request):
        """
        Check current AI quota for user/org
        GET /api/services/ai-quota/check_quota/
        """
        try:
            queryset = AiQuota.objects.filter(
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
            logger.error(f'check_quota failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'check_quota',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def record_usage(self, request):
        """
        Record AI usage event
        POST /api/services/ai-quota/record_usage/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = AiUsageDaily.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='record_usage',
                    resource_type='AiUsageDaily',
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
            logger.error(f'record_usage failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'record_usage',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def get_usage(self, request):
        """
        Get AI usage stats
        GET /api/services/ai-quota/get_usage/
        """
        try:
            queryset = AiUsageDaily.objects.filter(
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
            logger.error(f'get_usage failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'get_usage',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def quota_config(self, request):
        """
        Get AI quota configuration
        GET /api/services/ai-quota/quota_config/
        """
        try:
            queryset = AiQuota.objects.filter(
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
            logger.error(f'quota_config failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'quota_config',
            }, status=status.HTTP_400_BAD_REQUEST)

