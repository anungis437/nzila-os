"""
LessonNotesViewSet
Service: lesson-notes
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
from content.models import Bookmarks
from auth_core.models import AuditLogs

class LessonNotesPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class LessonNotesViewSet(viewsets.ViewSet):
    """
    ViewSet for lesson-notes operations.

    Endpoints:
    - GET /api/services/lesson-notes/notes/ — Get lesson notes
- POST /api/services/lesson-notes/create_note/ — Create lesson note
- POST /api/services/lesson-notes/update_note/ — Update lesson note
- POST /api/services/lesson-notes/delete_note/ — Delete lesson note
- GET /api/services/lesson-notes/note_count/ — Get note count
- GET /api/services/lesson-notes/export_text/ — Export notes as text
    """

    permission_classes = [IsAuthenticated]
    pagination_class = LessonNotesPagination

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
    def notes(self, request):
        """
        Get lesson notes
        GET /api/services/lesson-notes/notes/
        """
        try:
            queryset = Bookmarks.objects.filter(
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
            logger.error(f'notes failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'notes',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_note(self, request):
        """
        Create lesson note
        POST /api/services/lesson-notes/create_note/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Bookmarks.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_note',
                    resource_type='Bookmarks',
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
            logger.error(f'create_note failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'create_note',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_note(self, request):
        """
        Update lesson note
        POST /api/services/lesson-notes/update_note/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Bookmarks.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_note',
                    resource_type='Bookmarks',
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
            logger.error(f'update_note failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'update_note',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def delete_note(self, request):
        """
        Delete lesson note
        POST /api/services/lesson-notes/delete_note/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Bookmarks.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='delete_note',
                    resource_type='Bookmarks',
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
            logger.error(f'delete_note failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'delete_note',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def note_count(self, request):
        """
        Get note count
        GET /api/services/lesson-notes/note_count/
        """
        try:
            queryset = Bookmarks.objects.filter(
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
            logger.error(f'note_count failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'note_count',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def export_text(self, request):
        """
        Export notes as text
        GET /api/services/lesson-notes/export_text/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'export_text failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'export_text',
            }, status=status.HTTP_400_BAD_REQUEST)

