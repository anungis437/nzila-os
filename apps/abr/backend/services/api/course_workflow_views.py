"""
CourseWorkflowViewSet
Service: course-workflow
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
from core.models import CourseWorkflowReviews, CourseWorkflowHistory, ContentQualityChecklists, CourseVersions
from content.models import Courses
from auth_core.models import AuditLogs

class CourseWorkflowPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class CourseWorkflowViewSet(viewsets.ViewSet):
    """
    ViewSet for course-workflow operations.

    Endpoints:
    - POST /api/services/course-workflow/submit_review/ — Submit course for review
- POST /api/services/course-workflow/approve/ — Approve course
- POST /api/services/course-workflow/reject/ — Reject course
- POST /api/services/course-workflow/publish/ — Publish course
- GET /api/services/course-workflow/workflow_history/ — Get workflow history
- POST /api/services/course-workflow/create_version/ — Create course version
- GET /api/services/course-workflow/versions/ — Get course versions
- GET /api/services/course-workflow/version/ — Get specific version
- POST /api/services/course-workflow/create_review/ — Create review
- POST /api/services/course-workflow/complete_review/ — Complete review
- GET /api/services/course-workflow/reviews/ — Get reviews
- GET /api/services/course-workflow/pending_reviews/ — Get pending reviews
- GET /api/services/course-workflow/quality_checklist/ — Get quality checklist
- POST /api/services/course-workflow/update_checklist/ — Update quality checklist
- GET /api/services/course-workflow/pending_courses/ — Get courses pending review
- GET /api/services/course-workflow/workflow_summary/ — Get workflow summary statistics
- GET /api/services/course-workflow/courses_by_status/ — Get courses by workflow status
    """

    permission_classes = [IsAuthenticated]
    pagination_class = CourseWorkflowPagination

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
    def submit_review(self, request):
        """
        Submit course for review
        POST /api/services/course-workflow/submit_review/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseWorkflowHistory.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='submit_review',
                    resource_type='CourseWorkflowHistory',
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
            logger.error(f'submit_review failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'submit_review',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def approve(self, request):
        """
        Approve course
        POST /api/services/course-workflow/approve/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseWorkflowHistory.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='approve',
                    resource_type='CourseWorkflowHistory',
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
                'error': 'An error occurred',
                'action': 'approve',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def reject(self, request):
        """
        Reject course
        POST /api/services/course-workflow/reject/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseWorkflowHistory.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='reject',
                    resource_type='CourseWorkflowHistory',
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
            logger.error(f'reject failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'reject',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def publish(self, request):
        """
        Publish course
        POST /api/services/course-workflow/publish/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseWorkflowHistory.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='publish',
                    resource_type='CourseWorkflowHistory',
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
            logger.error(f'publish failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'publish',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def workflow_history(self, request):
        """
        Get workflow history
        GET /api/services/course-workflow/workflow_history/
        """
        try:
            queryset = CourseWorkflowHistory.objects.filter(
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
            logger.error(f'workflow_history failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'workflow_history',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_version(self, request):
        """
        Create course version
        POST /api/services/course-workflow/create_version/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseVersions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_version',
                    resource_type='CourseVersions',
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
            logger.error(f'create_version failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'create_version',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def versions(self, request):
        """
        Get course versions
        GET /api/services/course-workflow/versions/
        """
        try:
            queryset = CourseVersions.objects.filter(
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
            logger.error(f'versions failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'versions',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def version(self, request):
        """
        Get specific version
        GET /api/services/course-workflow/version/
        """
        try:
            queryset = CourseVersions.objects.filter(
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
            logger.error(f'version failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'version',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_review(self, request):
        """
        Create review
        POST /api/services/course-workflow/create_review/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseWorkflowReviews.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_review',
                    resource_type='CourseWorkflowReviews',
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
            logger.error(f'create_review failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'create_review',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def complete_review(self, request):
        """
        Complete review
        POST /api/services/course-workflow/complete_review/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CourseWorkflowReviews.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='complete_review',
                    resource_type='CourseWorkflowReviews',
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
            logger.error(f'complete_review failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'complete_review',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def reviews(self, request):
        """
        Get reviews
        GET /api/services/course-workflow/reviews/
        """
        try:
            queryset = CourseWorkflowReviews.objects.filter(
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
            logger.error(f'reviews failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'reviews',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def pending_reviews(self, request):
        """
        Get pending reviews
        GET /api/services/course-workflow/pending_reviews/
        """
        try:
            queryset = CourseWorkflowReviews.objects.filter(
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
            logger.error(f'pending_reviews failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'pending_reviews',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def quality_checklist(self, request):
        """
        Get quality checklist
        GET /api/services/course-workflow/quality_checklist/
        """
        try:
            queryset = ContentQualityChecklists.objects.filter(
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
            logger.error(f'quality_checklist failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'quality_checklist',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_checklist(self, request):
        """
        Update quality checklist
        POST /api/services/course-workflow/update_checklist/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = ContentQualityChecklists.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_checklist',
                    resource_type='ContentQualityChecklists',
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
            logger.error(f'update_checklist failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'update_checklist',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def pending_courses(self, request):
        """
        Get courses pending review
        GET /api/services/course-workflow/pending_courses/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'pending_courses failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'pending_courses',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def workflow_summary(self, request):
        """
        Get workflow summary statistics
        GET /api/services/course-workflow/workflow_summary/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'workflow_summary failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'workflow_summary',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def courses_by_status(self, request):
        """
        Get courses by workflow status
        GET /api/services/course-workflow/courses_by_status/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'courses_by_status failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'courses_by_status',
            }, status=status.HTTP_400_BAD_REQUEST)

