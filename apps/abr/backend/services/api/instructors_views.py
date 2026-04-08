"""
InstructorsViewSet
Service: instructors
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
from core.models import InstructorProfiles, CourseInstructors, InstructorAnalytics, InstructorCommunications, InstructorEarnings
from auth_core.models import AuditLogs

class InstructorsPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class InstructorsViewSet(viewsets.ViewSet):
    """
    ViewSet for instructors operations.

    Endpoints:
    - GET /api/services/instructors/profile/ — Get instructor profile
- POST /api/services/instructors/create_profile/ — Create instructor profile
- POST /api/services/instructors/update_profile/ — Update instructor profile
- POST /api/services/instructors/approve/ — Approve instructor
- GET /api/services/instructors/active_instructors/ — Get active instructors
- GET /api/services/instructors/featured_instructors/ — Get featured instructors
- POST /api/services/instructors/assign_course/ — Assign instructor to course
- POST /api/services/instructors/remove_course/ — Remove instructor from course
- GET /api/services/instructors/course_instructors/ — Get course instructors
- GET /api/services/instructors/instructor_courses/ — Get instructor courses
- GET /api/services/instructors/dashboard/ — Get instructor dashboard summary
- GET /api/services/instructors/analytics/ — Get instructor analytics
- GET /api/services/instructors/analytics_timeseries/ — Get analytics time series
- GET /api/services/instructors/effectiveness/ — Get teaching effectiveness
- POST /api/services/instructors/send_message/ — Send communication
- GET /api/services/instructors/messages/ — Get communications
- GET /api/services/instructors/earnings_summary/ — Get earnings summary
- GET /api/services/instructors/earnings_by_course/ — Get earnings by course
    """

    permission_classes = [IsAuthenticated]
    pagination_class = InstructorsPagination

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
    def profile(self, request):
        """
        Get instructor profile
        GET /api/services/instructors/profile/
        """
        try:
            queryset = InstructorProfiles.objects.filter(
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
            logger.error(f'profile failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'profile',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_profile(self, request):
        """
        Create instructor profile
        POST /api/services/instructors/create_profile/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = InstructorProfiles.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_profile',
                    resource_type='InstructorProfiles',
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
            logger.error(f'create_profile failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'create_profile',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_profile(self, request):
        """
        Update instructor profile
        POST /api/services/instructors/update_profile/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = InstructorProfiles.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_profile',
                    resource_type='InstructorProfiles',
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
            logger.error(f'update_profile failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'update_profile',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def approve(self, request):
        """
        Approve instructor
        POST /api/services/instructors/approve/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = InstructorProfiles.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='approve',
                    resource_type='InstructorProfiles',
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
            logger.error(f'approve failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'approve',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def active_instructors(self, request):
        """
        Get active instructors
        GET /api/services/instructors/active_instructors/
        """
        try:
            queryset = InstructorProfiles.objects.filter(
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
            logger.error(f'active_instructors failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'active_instructors',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def featured_instructors(self, request):
        """
        Get featured instructors
        GET /api/services/instructors/featured_instructors/
        """
        try:
            queryset = InstructorProfiles.objects.filter(
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
            logger.error(f'featured_instructors failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'featured_instructors',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def assign_course(self, request):
        """
        Assign instructor to course
        POST /api/services/instructors/assign_course/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseInstructors.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='assign_course',
                    resource_type='CourseInstructors',
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
            logger.error(f'assign_course failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'assign_course',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def remove_course(self, request):
        """
        Remove instructor from course
        POST /api/services/instructors/remove_course/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseInstructors.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='remove_course',
                    resource_type='CourseInstructors',
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
            logger.error(f'remove_course failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'remove_course',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def course_instructors(self, request):
        """
        Get course instructors
        GET /api/services/instructors/course_instructors/
        """
        try:
            queryset = CourseInstructors.objects.filter(
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
            logger.error(f'course_instructors failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'course_instructors',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def instructor_courses(self, request):
        """
        Get instructor courses
        GET /api/services/instructors/instructor_courses/
        """
        try:
            queryset = CourseInstructors.objects.filter(
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
            logger.error(f'instructor_courses failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'instructor_courses',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """
        Get instructor dashboard summary
        GET /api/services/instructors/dashboard/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'dashboard failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'dashboard',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """
        Get instructor analytics
        GET /api/services/instructors/analytics/
        """
        try:
            queryset = InstructorAnalytics.objects.filter(
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
            logger.error(f'analytics failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'analytics',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def analytics_timeseries(self, request):
        """
        Get analytics time series
        GET /api/services/instructors/analytics_timeseries/
        """
        try:
            queryset = InstructorAnalytics.objects.filter(
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
            logger.error(f'analytics_timeseries failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'analytics_timeseries',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def effectiveness(self, request):
        """
        Get teaching effectiveness
        GET /api/services/instructors/effectiveness/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'effectiveness failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'effectiveness',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def send_message(self, request):
        """
        Send communication
        POST /api/services/instructors/send_message/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = InstructorCommunications.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='send_message',
                    resource_type='InstructorCommunications',
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
            logger.error(f'send_message failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'send_message',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def messages(self, request):
        """
        Get communications
        GET /api/services/instructors/messages/
        """
        try:
            queryset = InstructorCommunications.objects.filter(
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
            logger.error(f'messages failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'messages',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def earnings_summary(self, request):
        """
        Get earnings summary
        GET /api/services/instructors/earnings_summary/
        """
        try:
            queryset = InstructorEarnings.objects.filter(
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
            logger.error(f'earnings_summary failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'earnings_summary',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def earnings_by_course(self, request):
        """
        Get earnings by course
        GET /api/services/instructors/earnings_by_course/
        """
        try:
            queryset = InstructorEarnings.objects.filter(
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
            logger.error(f'earnings_by_course failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'earnings_by_course',
            }, status=status.HTTP_400_BAD_REQUEST)

