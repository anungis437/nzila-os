"""
PDFGeneratorViewSet
Service: pdf-generator
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
from core.models import EvidenceBundlePdfs
from auth_core.models import AuditLogs

class PDFGeneratorPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class PDFGeneratorViewSet(viewsets.ViewSet):
    """
    ViewSet for pdf-generator operations.

    Endpoints:
    - POST /api/services/pdf-generator/generate_evidence/ — Generate evidence PDF
- GET /api/services/pdf-generator/status/ — Get PDF generation status
    """

    permission_classes = [IsAuthenticated]
    pagination_class = PDFGeneratorPagination

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
    def generate_evidence(self, request):
        """
        Generate evidence PDF
        POST /api/services/pdf-generator/generate_evidence/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = EvidenceBundlePdfs.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='generate_evidence',
                    resource_type='EvidenceBundlePdfs',
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
            logger.error(f'generate_evidence failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'generate_evidence',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def status(self, request):
        """
        Get PDF generation status
        GET /api/services/pdf-generator/status/
        """
        try:
            queryset = EvidenceBundlePdfs.objects.filter(
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
            logger.error(f'status failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'status',
            }, status=status.HTTP_400_BAD_REQUEST)

