"""
SSOViewSet
Service: sso
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
from core.models import SsoProviders, EnterpriseSessions, IdentityProviderMapping, SsoLoginAttempts
from auth_core.models import AuditLogs

class SSOPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class SSOViewSet(viewsets.ViewSet):
    """
    ViewSet for sso operations.

    Endpoints:
    - GET /api/services/sso/providers/ — Get org SSO providers
- GET /api/services/sso/get_provider/ — Get SSO provider
- POST /api/services/sso/create_provider/ — Create SSO provider
- POST /api/services/sso/update_provider/ — Update SSO provider
- POST /api/services/sso/delete_provider/ — Delete SSO provider
- POST /api/services/sso/update_status/ — Update provider status
- POST /api/services/sso/set_default/ — Set default SSO provider
- POST /api/services/sso/test_connection/ — Test SSO connection
- GET /api/services/sso/active_sessions/ — Get active sessions
- POST /api/services/sso/revoke_session/ — Revoke session
- GET /api/services/sso/login_attempts/ — Get SSO login attempts
    """

    permission_classes = [IsAuthenticated]
    pagination_class = SSOPagination

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
    def providers(self, request):
        """
        Get org SSO providers
        GET /api/services/sso/providers/
        """
        try:
            queryset = SsoProviders.objects.filter(
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
            logger.error(f'providers failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'providers',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def get_provider(self, request):
        """
        Get SSO provider
        GET /api/services/sso/get_provider/
        """
        try:
            queryset = SsoProviders.objects.filter(
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
            logger.error(f'get_provider failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'get_provider',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_provider(self, request):
        """
        Create SSO provider
        POST /api/services/sso/create_provider/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SsoProviders.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_provider',
                    resource_type='SsoProviders',
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
            logger.error(f'create_provider failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'create_provider',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_provider(self, request):
        """
        Update SSO provider
        POST /api/services/sso/update_provider/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SsoProviders.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_provider',
                    resource_type='SsoProviders',
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
            logger.error(f'update_provider failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'update_provider',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def delete_provider(self, request):
        """
        Delete SSO provider
        POST /api/services/sso/delete_provider/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SsoProviders.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='delete_provider',
                    resource_type='SsoProviders',
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
            logger.error(f'delete_provider failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'delete_provider',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_status(self, request):
        """
        Update provider status
        POST /api/services/sso/update_status/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SsoProviders.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_status',
                    resource_type='SsoProviders',
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
            logger.error(f'update_status failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'update_status',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def set_default(self, request):
        """
        Set default SSO provider
        POST /api/services/sso/set_default/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SsoProviders.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='set_default',
                    resource_type='SsoProviders',
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
            logger.error(f'set_default failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'set_default',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def test_connection(self, request):
        """
        Test SSO connection
        POST /api/services/sso/test_connection/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SsoProviders.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='test_connection',
                    resource_type='SsoProviders',
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
            logger.error(f'test_connection failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'test_connection',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def active_sessions(self, request):
        """
        Get active sessions
        GET /api/services/sso/active_sessions/
        """
        try:
            queryset = EnterpriseSessions.objects.filter(
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
            logger.error(f'active_sessions failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'active_sessions',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def revoke_session(self, request):
        """
        Revoke session
        POST /api/services/sso/revoke_session/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = EnterpriseSessions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='revoke_session',
                    resource_type='EnterpriseSessions',
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
            logger.error(f'revoke_session failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'revoke_session',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def login_attempts(self, request):
        """
        Get SSO login attempts
        GET /api/services/sso/login_attempts/
        """
        try:
            queryset = SsoLoginAttempts.objects.filter(
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
            logger.error(f'login_attempts failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'login_attempts',
            }, status=status.HTTP_400_BAD_REQUEST)

