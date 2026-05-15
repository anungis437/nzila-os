"""
EmbeddingServiceViewSet
Service: embedding-service
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
from ai_core.models import CaseEmbeddings, CourseEmbeddings, LessonEmbeddings, EmbeddingJobs
from auth_core.models import AuditLogs

class EmbeddingServicePagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class EmbeddingServiceViewSet(viewsets.ViewSet):
    """
    ViewSet for embedding-service operations.

    Endpoints:
    - POST /api/services/embedding-service/generate_embedding/ — Generate embedding for text
- POST /api/services/embedding-service/generate_batch/ — Generate embeddings batch
- POST /api/services/embedding-service/generate_case/ — Generate case embedding
- POST /api/services/embedding-service/generate_course/ — Generate course embedding
- POST /api/services/embedding-service/generate_all_cases/ — Generate all case embeddings
- POST /api/services/embedding-service/generate_all_courses/ — Generate all course embeddings
- POST /api/services/embedding-service/search_cases/ — Search similar cases by text
- POST /api/services/embedding-service/search_courses/ — Search similar courses by text
- GET /api/services/embedding-service/job_status/ — Get embedding job status
- GET /api/services/embedding-service/all_jobs/ — Get all embedding jobs
    """

    permission_classes = [IsAuthenticated]
    pagination_class = EmbeddingServicePagination

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
    def generate_embedding(self, request):
        """
        Generate embedding for text
        POST /api/services/embedding-service/generate_embedding/
        """
        try:
            data = request.data
            org_id = request.user.organization_id
            # TODO(NZ-302): Implement business logic
            return Response({
                'status': 'success',
                'message': 'Generate embedding for text',
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'generate_embedding failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'generate_embedding',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def generate_batch(self, request):
        """
        Generate embeddings batch
        POST /api/services/embedding-service/generate_batch/
        """
        try:
            data = request.data
            org_id = request.user.organization_id
            # TODO(NZ-302): Implement business logic
            return Response({
                'status': 'success',
                'message': 'Generate embeddings batch',
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'generate_batch failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'generate_batch',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def generate_case(self, request):
        """
        Generate case embedding
        POST /api/services/embedding-service/generate_case/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CaseEmbeddings.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='generate_case',
                    resource_type='CaseEmbeddings',
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
            logger.error(f'generate_case failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'generate_case',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def generate_course(self, request):
        """
        Generate course embedding
        POST /api/services/embedding-service/generate_course/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseEmbeddings.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='generate_course',
                    resource_type='CourseEmbeddings',
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
            logger.error(f'generate_course failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'generate_course',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def generate_all_cases(self, request):
        """
        Generate all case embeddings
        POST /api/services/embedding-service/generate_all_cases/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = EmbeddingJobs.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='generate_all_cases',
                    resource_type='EmbeddingJobs',
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
            logger.error(f'generate_all_cases failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'generate_all_cases',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def generate_all_courses(self, request):
        """
        Generate all course embeddings
        POST /api/services/embedding-service/generate_all_courses/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = EmbeddingJobs.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='generate_all_courses',
                    resource_type='EmbeddingJobs',
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
            logger.error(f'generate_all_courses failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'generate_all_courses',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def search_cases(self, request):
        """
        Search similar cases by text
        POST /api/services/embedding-service/search_cases/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CaseEmbeddings.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='search_cases',
                    resource_type='CaseEmbeddings',
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
            logger.error(f'search_cases failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'search_cases',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def search_courses(self, request):
        """
        Search similar courses by text
        POST /api/services/embedding-service/search_courses/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseEmbeddings.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='search_courses',
                    resource_type='CourseEmbeddings',
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
            logger.error(f'search_courses failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'search_courses',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def job_status(self, request):
        """
        Get embedding job status
        GET /api/services/embedding-service/job_status/
        """
        try:
            queryset = EmbeddingJobs.objects.filter(
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
    def all_jobs(self, request):
        """
        Get all embedding jobs
        GET /api/services/embedding-service/all_jobs/
        """
        try:
            queryset = EmbeddingJobs.objects.filter(
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
            logger.error(f'all_jobs failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'all_jobs',
            }, status=status.HTTP_400_BAD_REQUEST)

