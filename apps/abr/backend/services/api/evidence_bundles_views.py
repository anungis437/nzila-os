"""
EvidenceBundlesViewSet
Service: evidence-bundles
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
from compliance.models import EvidenceBundles, EvidenceBundleComponents, EvidenceBundlePolicyMappings, EvidenceBundleTimeline
from core.models import EvidenceBundlePdfs
from auth_core.models import AuditLogs

class EvidenceBundlesPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class EvidenceBundlesViewSet(viewsets.ViewSet):
    """
    ViewSet for evidence-bundles operations.

    Endpoints:
    - POST /api/services/evidence-bundles/create_bundle/ — Create evidence bundle
- GET /api/services/evidence-bundles/get_bundle/ — Get evidence bundle
- GET /api/services/evidence-bundles/list_bundles/ — List evidence bundles
- POST /api/services/evidence-bundles/add_component/ — Add component to bundle
- POST /api/services/evidence-bundles/add_timeline_event/ — Add timeline event
- GET /api/services/evidence-bundles/build_timeline/ — Build evidence timeline
- GET /api/services/evidence-bundles/policy_mappings/ — Get policy mappings for bundle
- POST /api/services/evidence-bundles/create_policy_mapping/ — Create policy mapping
- POST /api/services/evidence-bundles/generate_mappings/ — Auto-generate policy mappings
- POST /api/services/evidence-bundles/update_status/ — Update bundle status
- GET /api/services/evidence-bundles/export_bundle/ — Export evidence bundle
- POST /api/services/evidence-bundles/upload_bundle/ — Upload evidence bundle
    """

    permission_classes = [IsAuthenticated]
    pagination_class = EvidenceBundlesPagination

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
    def create_bundle(self, request):
        """
        Create evidence bundle
        POST /api/services/evidence-bundles/create_bundle/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = EvidenceBundles.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_bundle',
                    resource_type='EvidenceBundles',
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
            logger.error(f'create_bundle failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'create_bundle',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def get_bundle(self, request):
        """
        Get evidence bundle
        GET /api/services/evidence-bundles/get_bundle/
        """
        try:
            queryset = EvidenceBundles.objects.filter(
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
            logger.error(f'get_bundle failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'get_bundle',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def list_bundles(self, request):
        """
        List evidence bundles
        GET /api/services/evidence-bundles/list_bundles/
        """
        try:
            queryset = EvidenceBundles.objects.filter(
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
            logger.error(f'list_bundles failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'list_bundles',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def add_component(self, request):
        """
        Add component to bundle
        POST /api/services/evidence-bundles/add_component/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = EvidenceBundleComponents.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='add_component',
                    resource_type='EvidenceBundleComponents',
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
            logger.error(f'add_component failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'add_component',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def add_timeline_event(self, request):
        """
        Add timeline event
        POST /api/services/evidence-bundles/add_timeline_event/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = EvidenceBundleTimeline.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='add_timeline_event',
                    resource_type='EvidenceBundleTimeline',
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
            logger.error(f'add_timeline_event failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'add_timeline_event',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def build_timeline(self, request):
        """
        Build evidence timeline
        GET /api/services/evidence-bundles/build_timeline/
        """
        try:
            queryset = EvidenceBundleTimeline.objects.filter(
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
            logger.error(f'build_timeline failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'build_timeline',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def policy_mappings(self, request):
        """
        Get policy mappings for bundle
        GET /api/services/evidence-bundles/policy_mappings/
        """
        try:
            queryset = EvidenceBundlePolicyMappings.objects.filter(
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
            logger.error(f'policy_mappings failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'policy_mappings',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_policy_mapping(self, request):
        """
        Create policy mapping
        POST /api/services/evidence-bundles/create_policy_mapping/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = EvidenceBundlePolicyMappings.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_policy_mapping',
                    resource_type='EvidenceBundlePolicyMappings',
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
            logger.error(f'create_policy_mapping failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'create_policy_mapping',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def generate_mappings(self, request):
        """
        Auto-generate policy mappings
        POST /api/services/evidence-bundles/generate_mappings/
        """
        try:
            data = request.data
            org_id = request.user.organization_id
            # TODO(NZ-302): Implement business logic
            return Response({
                'status': 'success',
                'message': 'Auto-generate policy mappings',
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'generate_mappings failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'generate_mappings',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_status(self, request):
        """
        Update bundle status
        POST /api/services/evidence-bundles/update_status/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = EvidenceBundles.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_status',
                    resource_type='EvidenceBundles',
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

    @action(detail=False, methods=['get'])
    def export_bundle(self, request):
        """
        Export evidence bundle
        GET /api/services/evidence-bundles/export_bundle/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'export_bundle failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'export_bundle',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def upload_bundle(self, request):
        """
        Upload evidence bundle
        POST /api/services/evidence-bundles/upload_bundle/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = EvidenceBundlePdfs.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='upload_bundle',
                    resource_type='EvidenceBundlePdfs',
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
            logger.error(f'upload_bundle failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'upload_bundle',
            }, status=status.HTTP_400_BAD_REQUEST)

