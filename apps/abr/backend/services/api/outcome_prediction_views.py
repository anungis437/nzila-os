"""
OutcomePredictionViewSet
Service: outcome-prediction
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
from core.models import CaseOutcomes, OutcomePredictions, PredictionModels
from auth_core.models import AuditLogs

class OutcomePredictionPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class OutcomePredictionViewSet(viewsets.ViewSet):
    """
    ViewSet for outcome-prediction operations.

    Endpoints:
    - POST /api/services/outcome-prediction/predict/ — Predict case outcome
- GET /api/services/outcome-prediction/get_prediction/ — Get prediction by ID
- POST /api/services/outcome-prediction/evaluate_model/ — Evaluate prediction model
- GET /api/services/outcome-prediction/case_outcomes/ — Get case outcomes
    """

    permission_classes = [IsAuthenticated]
    pagination_class = OutcomePredictionPagination

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
    def predict(self, request):
        """
        Predict case outcome
        POST /api/services/outcome-prediction/predict/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = OutcomePredictions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='predict',
                    resource_type='OutcomePredictions',
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
            logger.error(f'predict failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'predict',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def get_prediction(self, request):
        """
        Get prediction by ID
        GET /api/services/outcome-prediction/get_prediction/
        """
        try:
            queryset = OutcomePredictions.objects.filter(
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
            logger.error(f'get_prediction failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'get_prediction',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def evaluate_model(self, request):
        """
        Evaluate prediction model
        POST /api/services/outcome-prediction/evaluate_model/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PredictionModels.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='evaluate_model',
                    resource_type='PredictionModels',
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
            logger.error(f'evaluate_model failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'evaluate_model',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def case_outcomes(self, request):
        """
        Get case outcomes
        GET /api/services/outcome-prediction/case_outcomes/
        """
        try:
            queryset = CaseOutcomes.objects.filter(
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
            logger.error(f'case_outcomes failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'case_outcomes',
            }, status=status.HTTP_400_BAD_REQUEST)

