"""
AITrainingViewSet
Service: ai-training
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
from ai_core.models import TrainingJobs, AutomatedTrainingConfig, ClassificationFeedback
from auth_core.models import AuditLogs

class AITrainingPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class AITrainingViewSet(viewsets.ViewSet):
    """
    ViewSet for ai-training operations.

    Endpoints:
    - POST /api/services/ai-training/start_job/ — Start training job
- GET /api/services/ai-training/job_status/ — Get training job status
- GET /api/services/ai-training/jobs/ — List training jobs
- GET /api/services/ai-training/config/ — Get automated training config
- POST /api/services/ai-training/update_config/ — Update training config
- POST /api/services/ai-training/submit_feedback/ — Submit classification feedback
- GET /api/services/ai-training/feedback/ — Get classification feedback
    """

    permission_classes = [IsAuthenticated]
    pagination_class = AITrainingPagination

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
    def start_job(self, request):
        """
        Start training job
        POST /api/services/ai-training/start_job/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = TrainingJobs.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='start_job',
                    resource_type='TrainingJobs',
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
            logger.error(f'start_job failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'start_job',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def job_status(self, request):
        """
        Get training job status
        GET /api/services/ai-training/job_status/
        """
        try:
            queryset = TrainingJobs.objects.filter(
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
            logger.error(f'job_status failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'job_status',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def jobs(self, request):
        """
        List training jobs
        GET /api/services/ai-training/jobs/
        """
        try:
            queryset = TrainingJobs.objects.filter(
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
                'error': 'An error occurred',
                'action': 'jobs',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def config(self, request):
        """
        Get automated training config
        GET /api/services/ai-training/config/
        """
        try:
            queryset = AutomatedTrainingConfig.objects.filter(
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
            logger.error(f'config failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'config',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_config(self, request):
        """
        Update training config
        POST /api/services/ai-training/update_config/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = AutomatedTrainingConfig.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_config',
                    resource_type='AutomatedTrainingConfig',
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
            logger.error(f'update_config failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'update_config',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def submit_feedback(self, request):
        """
        Submit classification feedback
        POST /api/services/ai-training/submit_feedback/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = ClassificationFeedback.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='submit_feedback',
                    resource_type='ClassificationFeedback',
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
            logger.error(f'submit_feedback failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'submit_feedback',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def feedback(self, request):
        """
        Get classification feedback
        GET /api/services/ai-training/feedback/
        """
        try:
            queryset = ClassificationFeedback.objects.filter(
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
            logger.error(f'feedback failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'feedback',
            }, status=status.HTTP_400_BAD_REQUEST)

