"""
CaseAlertsViewSet
Service: case-alerts
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
from analytics.models import SavedSearches, CaseAlerts, CaseDigests
from notifications.models import AlertPreferences
from auth_core.models import AuditLogs

class CaseAlertsPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class CaseAlertsViewSet(viewsets.ViewSet):
    """
    ViewSet for case-alerts operations.

    Endpoints:
    - GET /api/services/case-alerts/alerts/ — Get case alerts for user
- POST /api/services/case-alerts/mark_read/ — Mark alert as read
- POST /api/services/case-alerts/mark_all_read/ — Mark all alerts as read
- GET /api/services/case-alerts/saved_searches/ — Get saved searches
- POST /api/services/case-alerts/create_search/ — Create saved search
- POST /api/services/case-alerts/update_search/ — Update saved search
- POST /api/services/case-alerts/delete_search/ — Delete saved search
- GET /api/services/case-alerts/execute_search/ — Execute saved search
- GET /api/services/case-alerts/digest/ — Generate case digest
- GET /api/services/case-alerts/preferences/ — Get alert preferences
- POST /api/services/case-alerts/update_preferences/ — Update alert preferences
    """

    permission_classes = [IsAuthenticated]
    pagination_class = CaseAlertsPagination

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
    def alerts(self, request):
        """
        Get case alerts for user
        GET /api/services/case-alerts/alerts/
        """
        try:
            queryset = CaseAlerts.objects.filter(
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
            logger.error(f'alerts failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'alerts',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def mark_read(self, request):
        """
        Mark alert as read
        POST /api/services/case-alerts/mark_read/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CaseAlerts.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='mark_read',
                    resource_type='CaseAlerts',
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
            logger.error(f'mark_read failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'mark_read',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """
        Mark all alerts as read
        POST /api/services/case-alerts/mark_all_read/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CaseAlerts.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='mark_all_read',
                    resource_type='CaseAlerts',
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
            logger.error(f'mark_all_read failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'mark_all_read',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def saved_searches(self, request):
        """
        Get saved searches
        GET /api/services/case-alerts/saved_searches/
        """
        try:
            queryset = SavedSearches.objects.filter(
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
            logger.error(f'saved_searches failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'saved_searches',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_search(self, request):
        """
        Create saved search
        POST /api/services/case-alerts/create_search/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SavedSearches.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_search',
                    resource_type='SavedSearches',
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
            logger.error(f'create_search failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'create_search',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_search(self, request):
        """
        Update saved search
        POST /api/services/case-alerts/update_search/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SavedSearches.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_search',
                    resource_type='SavedSearches',
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
            logger.error(f'update_search failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'update_search',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def delete_search(self, request):
        """
        Delete saved search
        POST /api/services/case-alerts/delete_search/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SavedSearches.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='delete_search',
                    resource_type='SavedSearches',
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
            logger.error(f'delete_search failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'delete_search',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def execute_search(self, request):
        """
        Execute saved search
        GET /api/services/case-alerts/execute_search/
        """
        try:
            queryset = SavedSearches.objects.filter(
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
            logger.error(f'execute_search failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'execute_search',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def digest(self, request):
        """
        Generate case digest
        GET /api/services/case-alerts/digest/
        """
        try:
            queryset = CaseDigests.objects.filter(
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
            logger.error(f'digest failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'digest',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def preferences(self, request):
        """
        Get alert preferences
        GET /api/services/case-alerts/preferences/
        """
        try:
            queryset = AlertPreferences.objects.filter(
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
            logger.error(f'preferences failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'preferences',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_preferences(self, request):
        """
        Update alert preferences
        POST /api/services/case-alerts/update_preferences/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = AlertPreferences.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_preferences',
                    resource_type='AlertPreferences',
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
            logger.error(f'update_preferences failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'update_preferences',
            }, status=status.HTTP_400_BAD_REQUEST)

