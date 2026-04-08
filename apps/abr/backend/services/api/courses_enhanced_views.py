"""
CoursesEnhancedViewSet
Service: courses-enhanced
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
from core.models import CourseModules, CourseDiscussions
from content.models import Courses, Enrollments, LessonProgress, QuizAttempts, Lessons
from auth_core.models import AuditLogs

class CoursesEnhancedPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class CoursesEnhancedViewSet(viewsets.ViewSet):
    """
    ViewSet for courses-enhanced operations.

    Endpoints:
    - GET /api/services/courses-enhanced/modules/ — Get course modules
- POST /api/services/courses-enhanced/create_module/ — Create course module
- POST /api/services/courses-enhanced/update_module/ — Update course module
- POST /api/services/courses-enhanced/delete_module/ — Delete course module
- POST /api/services/courses-enhanced/reorder_modules/ — Reorder course modules
- POST /api/services/courses-enhanced/enroll/ — Enroll in course
- GET /api/services/courses-enhanced/enrollment/ — Get user enrollment
- GET /api/services/courses-enhanced/enrollments/ — Get user enrollments
- POST /api/services/courses-enhanced/update_enrollment/ — Update enrollment
- POST /api/services/courses-enhanced/update_progress/ — Update enrollment progress
- GET /api/services/courses-enhanced/lesson_progress/ — Get lesson progress
- POST /api/services/courses-enhanced/track_lesson/ — Track lesson progress
- POST /api/services/courses-enhanced/complete_lesson/ — Complete lesson
- GET /api/services/courses-enhanced/calculate_completion/ — Calculate course completion percentage
- GET /api/services/courses-enhanced/discussions/ — Get course discussions
- POST /api/services/courses-enhanced/create_discussion/ — Create discussion
- GET /api/services/courses-enhanced/discussion_replies/ — Get discussion replies
- POST /api/services/courses-enhanced/reply_discussion/ — Reply to discussion
- POST /api/services/courses-enhanced/mark_answered/ — Mark discussion as answered
- GET /api/services/courses-enhanced/quiz_attempts/ — Get quiz attempts
- POST /api/services/courses-enhanced/submit_quiz/ — Submit quiz attempt
- GET /api/services/courses-enhanced/learning_paths/ — Get learning paths
- GET /api/services/courses-enhanced/learning_path/ — Get specific learning path
- POST /api/services/courses-enhanced/enroll_path/ — Enroll in learning path
- GET /api/services/courses-enhanced/path_progress/ — Get learning path progress
    """

    permission_classes = [IsAuthenticated]
    pagination_class = CoursesEnhancedPagination

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
    def modules(self, request):
        """
        Get course modules
        GET /api/services/courses-enhanced/modules/
        """
        try:
            queryset = CourseModules.objects.filter(
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
            logger.error(f'modules failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'modules',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_module(self, request):
        """
        Create course module
        POST /api/services/courses-enhanced/create_module/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseModules.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_module',
                    resource_type='CourseModules',
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
            logger.error(f'create_module failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'create_module',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_module(self, request):
        """
        Update course module
        POST /api/services/courses-enhanced/update_module/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseModules.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_module',
                    resource_type='CourseModules',
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
            logger.error(f'update_module failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'update_module',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def delete_module(self, request):
        """
        Delete course module
        POST /api/services/courses-enhanced/delete_module/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseModules.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='delete_module',
                    resource_type='CourseModules',
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
            logger.error(f'delete_module failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'delete_module',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def reorder_modules(self, request):
        """
        Reorder course modules
        POST /api/services/courses-enhanced/reorder_modules/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseModules.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='reorder_modules',
                    resource_type='CourseModules',
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
            logger.error(f'reorder_modules failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'reorder_modules',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def enroll(self, request):
        """
        Enroll in course
        POST /api/services/courses-enhanced/enroll/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Enrollments.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='enroll',
                    resource_type='Enrollments',
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
            logger.error(f'enroll failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'enroll',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def enrollment(self, request):
        """
        Get user enrollment
        GET /api/services/courses-enhanced/enrollment/
        """
        try:
            queryset = Enrollments.objects.filter(
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
            logger.error(f'enrollment failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'enrollment',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def enrollments(self, request):
        """
        Get user enrollments
        GET /api/services/courses-enhanced/enrollments/
        """
        try:
            queryset = Enrollments.objects.filter(
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
            logger.error(f'enrollments failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'enrollments',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_enrollment(self, request):
        """
        Update enrollment
        POST /api/services/courses-enhanced/update_enrollment/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Enrollments.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_enrollment',
                    resource_type='Enrollments',
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
            logger.error(f'update_enrollment failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'update_enrollment',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_progress(self, request):
        """
        Update enrollment progress
        POST /api/services/courses-enhanced/update_progress/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Enrollments.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_progress',
                    resource_type='Enrollments',
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
            logger.error(f'update_progress failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'update_progress',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def lesson_progress(self, request):
        """
        Get lesson progress
        GET /api/services/courses-enhanced/lesson_progress/
        """
        try:
            queryset = LessonProgress.objects.filter(
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
            logger.error(f'lesson_progress failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'lesson_progress',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def track_lesson(self, request):
        """
        Track lesson progress
        POST /api/services/courses-enhanced/track_lesson/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = LessonProgress.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='track_lesson',
                    resource_type='LessonProgress',
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
            logger.error(f'track_lesson failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'track_lesson',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def complete_lesson(self, request):
        """
        Complete lesson
        POST /api/services/courses-enhanced/complete_lesson/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = LessonProgress.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='complete_lesson',
                    resource_type='LessonProgress',
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
            logger.error(f'complete_lesson failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'complete_lesson',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def calculate_completion(self, request):
        """
        Calculate course completion percentage
        GET /api/services/courses-enhanced/calculate_completion/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'calculate_completion failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'calculate_completion',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def discussions(self, request):
        """
        Get course discussions
        GET /api/services/courses-enhanced/discussions/
        """
        try:
            queryset = CourseDiscussions.objects.filter(
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
            logger.error(f'discussions failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'discussions',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_discussion(self, request):
        """
        Create discussion
        POST /api/services/courses-enhanced/create_discussion/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseDiscussions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_discussion',
                    resource_type='CourseDiscussions',
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
            logger.error(f'create_discussion failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'create_discussion',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def discussion_replies(self, request):
        """
        Get discussion replies
        GET /api/services/courses-enhanced/discussion_replies/
        """
        try:
            queryset = CourseDiscussions.objects.filter(
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
            logger.error(f'discussion_replies failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'discussion_replies',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def reply_discussion(self, request):
        """
        Reply to discussion
        POST /api/services/courses-enhanced/reply_discussion/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseDiscussions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='reply_discussion',
                    resource_type='CourseDiscussions',
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
            logger.error(f'reply_discussion failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'reply_discussion',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def mark_answered(self, request):
        """
        Mark discussion as answered
        POST /api/services/courses-enhanced/mark_answered/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseDiscussions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='mark_answered',
                    resource_type='CourseDiscussions',
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
            logger.error(f'mark_answered failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'mark_answered',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def quiz_attempts(self, request):
        """
        Get quiz attempts
        GET /api/services/courses-enhanced/quiz_attempts/
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
            logger.error(f'quiz_attempts failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'quiz_attempts',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def submit_quiz(self, request):
        """
        Submit quiz attempt
        POST /api/services/courses-enhanced/submit_quiz/
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
                    action='submit_quiz',
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
            logger.error(f'submit_quiz failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'submit_quiz',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def learning_paths(self, request):
        """
        Get learning paths
        GET /api/services/courses-enhanced/learning_paths/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'learning_paths failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'learning_paths',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def learning_path(self, request):
        """
        Get specific learning path
        GET /api/services/courses-enhanced/learning_path/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'learning_path failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'learning_path',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def enroll_path(self, request):
        """
        Enroll in learning path
        POST /api/services/courses-enhanced/enroll_path/
        """
        try:
            data = request.data
            org_id = request.user.organization_id
            # TODO(NZ-302): Implement business logic
            return Response({
                'status': 'success',
                'message': 'Enroll in learning path',
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'enroll_path failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'enroll_path',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def path_progress(self, request):
        """
        Get learning path progress
        GET /api/services/courses-enhanced/path_progress/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'path_progress failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'path_progress',
            }, status=status.HTTP_400_BAD_REQUEST)

