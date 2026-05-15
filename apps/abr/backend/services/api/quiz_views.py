"""
QuizViewSet
Service: quiz
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
from content.models import Quizzes, QuizAttempts
from core.models import QuizQuestions, QuizResponses
from auth_core.models import AuditLogs

class QuizPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class QuizViewSet(viewsets.ViewSet):
    """
    ViewSet for quiz operations.

    Endpoints:
    - GET /api/services/quiz/list_quizzes/ — List quizzes
- GET /api/services/quiz/get_quiz/ — Get quiz by ID
- POST /api/services/quiz/create_quiz/ — Create quiz
- POST /api/services/quiz/update_quiz/ — Update quiz
- POST /api/services/quiz/delete_quiz/ — Delete quiz
- POST /api/services/quiz/add_question/ — Add question to quiz
- POST /api/services/quiz/remove_question/ — Remove question from quiz
- GET /api/services/quiz/quiz_for_attempt/ — Get quiz formatted for attempt
- POST /api/services/quiz/start_attempt/ — Start quiz attempt
- POST /api/services/quiz/submit_response/ — Submit quiz response
- POST /api/services/quiz/submit_attempt/ — Submit completed quiz attempt
- GET /api/services/quiz/get_attempt/ — Get quiz attempt
- GET /api/services/quiz/user_attempts/ — Get user quiz attempts
    """

    permission_classes = [IsAuthenticated]
    pagination_class = QuizPagination

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
    def list_quizzes(self, request):
        """
        List quizzes
        GET /api/services/quiz/list_quizzes/
        """
        try:
            queryset = Quizzes.objects.filter(
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
            logger.error(f'list_quizzes failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'list_quizzes',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def get_quiz(self, request):
        """
        Get quiz by ID
        GET /api/services/quiz/get_quiz/
        """
        try:
            queryset = Quizzes.objects.filter(
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
            logger.error(f'get_quiz failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'get_quiz',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_quiz(self, request):
        """
        Create quiz
        POST /api/services/quiz/create_quiz/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Quizzes.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_quiz',
                    resource_type='Quizzes',
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
            logger.error(f'create_quiz failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'create_quiz',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_quiz(self, request):
        """
        Update quiz
        POST /api/services/quiz/update_quiz/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Quizzes.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_quiz',
                    resource_type='Quizzes',
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
            logger.error(f'update_quiz failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'update_quiz',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def delete_quiz(self, request):
        """
        Delete quiz
        POST /api/services/quiz/delete_quiz/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Quizzes.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='delete_quiz',
                    resource_type='Quizzes',
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
            logger.error(f'delete_quiz failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'delete_quiz',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def add_question(self, request):
        """
        Add question to quiz
        POST /api/services/quiz/add_question/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = QuizQuestions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='add_question',
                    resource_type='QuizQuestions',
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
            logger.error(f'add_question failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'add_question',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def remove_question(self, request):
        """
        Remove question from quiz
        POST /api/services/quiz/remove_question/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = QuizQuestions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='remove_question',
                    resource_type='QuizQuestions',
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
            logger.error(f'remove_question failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'remove_question',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def quiz_for_attempt(self, request):
        """
        Get quiz formatted for attempt
        GET /api/services/quiz/quiz_for_attempt/
        """
        try:
            queryset = Quizzes.objects.filter(
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
            logger.error(f'quiz_for_attempt failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'quiz_for_attempt',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def start_attempt(self, request):
        """
        Start quiz attempt
        POST /api/services/quiz/start_attempt/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = QuizAttempts.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='start_attempt',
                    resource_type='QuizAttempts',
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
            logger.error(f'start_attempt failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'start_attempt',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def submit_response(self, request):
        """
        Submit quiz response
        POST /api/services/quiz/submit_response/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = QuizResponses.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='submit_response',
                    resource_type='QuizResponses',
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
            logger.error(f'submit_response failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'submit_response',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def submit_attempt(self, request):
        """
        Submit completed quiz attempt
        POST /api/services/quiz/submit_attempt/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = QuizAttempts.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='submit_attempt',
                    resource_type='QuizAttempts',
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
            logger.error(f'submit_attempt failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'submit_attempt',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def get_attempt(self, request):
        """
        Get quiz attempt
        GET /api/services/quiz/get_attempt/
        """
        try:
            queryset = QuizAttempts.objects.filter(
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
            logger.error(f'get_attempt failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'get_attempt',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_attempts(self, request):
        """
        Get user quiz attempts
        GET /api/services/quiz/user_attempts/
        """
        try:
            queryset = QuizAttempts.objects.filter(
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
            logger.error(f'user_attempts failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'user_attempts',
            }, status=status.HTTP_400_BAD_REQUEST)

