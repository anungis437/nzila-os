"""
QuizQuestionsViewSet
Service: quiz-questions
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
from core.models import Questions, QuestionOptions, QuestionPools, PoolQuestions
from auth_core.models import AuditLogs

class QuizQuestionsPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class QuizQuestionsViewSet(viewsets.ViewSet):
    """
    ViewSet for quiz-questions operations.

    Endpoints:
    - GET /api/services/quiz-questions/list_questions/ — List questions
- GET /api/services/quiz-questions/get_question/ — Get question by ID
- POST /api/services/quiz-questions/create_question/ — Create question
- POST /api/services/quiz-questions/update_question/ — Update question
- POST /api/services/quiz-questions/delete_question/ — Delete question
- POST /api/services/quiz-questions/add_option/ — Add question option
- POST /api/services/quiz-questions/update_option/ — Update question option
- POST /api/services/quiz-questions/delete_option/ — Delete question option
- GET /api/services/quiz-questions/question_stats/ — Get question statistics
- POST /api/services/quiz-questions/create_pool/ — Create question pool
- POST /api/services/quiz-questions/add_to_pool/ — Add questions to pool
- GET /api/services/quiz-questions/random_from_pool/ — Get random questions from pool
    """

    permission_classes = [IsAuthenticated]
    pagination_class = QuizQuestionsPagination

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
    def list_questions(self, request):
        """
        List questions
        GET /api/services/quiz-questions/list_questions/
        """
        try:
            queryset = Questions.objects.filter(
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
            logger.error(f'list_questions failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'list_questions',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def get_question(self, request):
        """
        Get question by ID
        GET /api/services/quiz-questions/get_question/
        """
        try:
            queryset = Questions.objects.filter(
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
            logger.error(f'get_question failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'get_question',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_question(self, request):
        """
        Create question
        POST /api/services/quiz-questions/create_question/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Questions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_question',
                    resource_type='Questions',
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
            logger.error(f'create_question failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'create_question',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_question(self, request):
        """
        Update question
        POST /api/services/quiz-questions/update_question/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Questions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_question',
                    resource_type='Questions',
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
            logger.error(f'update_question failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'update_question',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def delete_question(self, request):
        """
        Delete question
        POST /api/services/quiz-questions/delete_question/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Questions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='delete_question',
                    resource_type='Questions',
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
            logger.error(f'delete_question failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'delete_question',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def add_option(self, request):
        """
        Add question option
        POST /api/services/quiz-questions/add_option/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = QuestionOptions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='add_option',
                    resource_type='QuestionOptions',
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
            logger.error(f'add_option failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'add_option',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_option(self, request):
        """
        Update question option
        POST /api/services/quiz-questions/update_option/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = QuestionOptions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_option',
                    resource_type='QuestionOptions',
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
            logger.error(f'update_option failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'update_option',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def delete_option(self, request):
        """
        Delete question option
        POST /api/services/quiz-questions/delete_option/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = QuestionOptions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='delete_option',
                    resource_type='QuestionOptions',
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
            logger.error(f'delete_option failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'delete_option',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def question_stats(self, request):
        """
        Get question statistics
        GET /api/services/quiz-questions/question_stats/
        """
        try:
            queryset = Questions.objects.filter(
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
            logger.error(f'question_stats failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'question_stats',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_pool(self, request):
        """
        Create question pool
        POST /api/services/quiz-questions/create_pool/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = QuestionPools.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_pool',
                    resource_type='QuestionPools',
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
            logger.error(f'create_pool failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'create_pool',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def add_to_pool(self, request):
        """
        Add questions to pool
        POST /api/services/quiz-questions/add_to_pool/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PoolQuestions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='add_to_pool',
                    resource_type='PoolQuestions',
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
            logger.error(f'add_to_pool failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'add_to_pool',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def random_from_pool(self, request):
        """
        Get random questions from pool
        GET /api/services/quiz-questions/random_from_pool/
        """
        try:
            queryset = PoolQuestions.objects.filter(
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
            logger.error(f'random_from_pool failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'random_from_pool',
            }, status=status.HTTP_400_BAD_REQUEST)

