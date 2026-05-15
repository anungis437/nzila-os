"""
SkillsViewSet
Service: skills
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
from core.models import Skills, CourseSkills, LessonSkills, QuestionSkills, UserSkills, SkillValidations, SkillPrerequisites
from auth_core.models import AuditLogs

class SkillsPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class SkillsViewSet(viewsets.ViewSet):
    """
    ViewSet for skills operations.

    Endpoints:
    - GET /api/services/skills/list_skills/ — List skills
- GET /api/services/skills/get_skill/ — Get skill by ID
- GET /api/services/skills/categories/ — Get skill categories
- GET /api/services/skills/user_skills/ — Get user skills
- GET /api/services/skills/user_dashboard/ — Get user skills dashboard
- GET /api/services/skills/skill_progress/ — Get skill progress
- GET /api/services/skills/active_validated/ — Get active validated skills
- GET /api/services/skills/expiring/ — Get expiring skills
- GET /api/services/skills/validation_history/ — Get skill validation history
- POST /api/services/skills/validate_from_quiz/ — Validate skills from quiz
- GET /api/services/skills/recommended_courses/ — Get recommended courses for skill gaps
    """

    permission_classes = [IsAuthenticated]
    pagination_class = SkillsPagination

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
    def list_skills(self, request):
        """
        List skills
        GET /api/services/skills/list_skills/
        """
        try:
            queryset = Skills.objects.filter(
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
            logger.error(f'list_skills failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'list_skills',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def get_skill(self, request):
        """
        Get skill by ID
        GET /api/services/skills/get_skill/
        """
        try:
            queryset = Skills.objects.filter(
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
            logger.error(f'get_skill failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'get_skill',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """
        Get skill categories
        GET /api/services/skills/categories/
        """
        try:
            queryset = Skills.objects.filter(
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
            logger.error(f'categories failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'categories',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_skills(self, request):
        """
        Get user skills
        GET /api/services/skills/user_skills/
        """
        try:
            queryset = UserSkills.objects.filter(
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
            logger.error(f'user_skills failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'user_skills',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_dashboard(self, request):
        """
        Get user skills dashboard
        GET /api/services/skills/user_dashboard/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'user_dashboard failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'user_dashboard',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def skill_progress(self, request):
        """
        Get skill progress
        GET /api/services/skills/skill_progress/
        """
        try:
            queryset = UserSkills.objects.filter(
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
            logger.error(f'skill_progress failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'skill_progress',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def active_validated(self, request):
        """
        Get active validated skills
        GET /api/services/skills/active_validated/
        """
        try:
            queryset = SkillValidations.objects.filter(
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
            logger.error(f'active_validated failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'active_validated',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def expiring(self, request):
        """
        Get expiring skills
        GET /api/services/skills/expiring/
        """
        try:
            queryset = SkillValidations.objects.filter(
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
            logger.error(f'expiring failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'expiring',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def validation_history(self, request):
        """
        Get skill validation history
        GET /api/services/skills/validation_history/
        """
        try:
            queryset = SkillValidations.objects.filter(
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
            logger.error(f'validation_history failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'validation_history',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def validate_from_quiz(self, request):
        """
        Validate skills from quiz
        POST /api/services/skills/validate_from_quiz/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SkillValidations.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='validate_from_quiz',
                    resource_type='SkillValidations',
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
            logger.error(f'validate_from_quiz failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'validate_from_quiz',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def recommended_courses(self, request):
        """
        Get recommended courses for skill gaps
        GET /api/services/skills/recommended_courses/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'recommended_courses failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'recommended_courses',
            }, status=status.HTTP_400_BAD_REQUEST)

