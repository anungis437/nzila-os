"""
GeofencePrivacyServiceViewSet
Generated from service: geofence-privacy-service
Auto-generated: 2026-02-18 09:08
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
from compliance.models import LocationTracking, Geofences, GeofenceEvents, LocationTrackingAudit, LocationDeletionLog, LocationTrackingConfig
from core.models import AuditLogs

class GeofencePrivacyServicePagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class GeofencePrivacyServiceViewSet(viewsets.ViewSet):
    """
    ViewSet for geofence-privacy-service operations.

    Endpoints:
    - GET /api/services/geofence-privacy-service/zones/ — List geofence zones
- POST /api/services/geofence-privacy-service/create_zone/ — Create geofence zone
- POST /api/services/geofence-privacy-service/update_zone/ — Update geofence zone
- POST /api/services/geofence-privacy-service/delete_zone/ — Delete geofence zone
- POST /api/services/geofence-privacy-service/check_location/ — Check if location is within geofence
- GET /api/services/geofence-privacy-service/events/ — List geofence events
- GET /api/services/geofence-privacy-service/tracking_config/ — Get location tracking config
- POST /api/services/geofence-privacy-service/update_tracking_config/ — Update tracking config
- GET /api/services/geofence-privacy-service/audit_trail/ — Location tracking audit trail
- GET /api/services/geofence-privacy-service/deletion_log/ — Location data deletion log
- POST /api/services/geofence-privacy-service/request_deletion/ — Request location data deletion
    """

    permission_classes = [IsAuthenticated]
    pagination_class = GeofencePrivacyServicePagination

    def paginate_queryset(self, queryset):
        paginator = self.pagination_class()
        return paginator.paginate_queryset(queryset, self.request, view=self)

    def get_paginated_response(self, data):
        paginator = self.pagination_class()
        # Reconstruct paginated response
        return Response({
            'count': len(data),
            'results': data,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def zones(self, request):
        """
        List geofence zones
        GET /api/services/geofence-privacy-service/zones/
        """
        try:
            queryset = Geofences.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
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
            return Response({
                'error': 'An error occurred',
                'action': 'zones',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_zone(self, request):
        """
        Create geofence zone
        POST /api/services/geofence-privacy-service/create_zone/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Geofences.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_zone',
                    resource_type='Geofences',
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response({
                'id': str(obj.id),
                'created_at': obj.created_at.isoformat(),
                'status': 'success',
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'error': 'An error occurred',
                'action': 'create_zone',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_zone(self, request):
        """
        Update geofence zone
        POST /api/services/geofence-privacy-service/update_zone/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Geofences.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_zone',
                    resource_type='Geofences',
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response({
                'id': str(obj.id),
                'created_at': obj.created_at.isoformat(),
                'status': 'success',
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'error': 'An error occurred',
                'action': 'update_zone',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def delete_zone(self, request):
        """
        Delete geofence zone
        POST /api/services/geofence-privacy-service/delete_zone/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Geofences.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='delete_zone',
                    resource_type='Geofences',
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response({
                'id': str(obj.id),
                'created_at': obj.created_at.isoformat(),
                'status': 'success',
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'error': 'An error occurred',
                'action': 'delete_zone',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def check_location(self, request):
        """
        Check if location is within geofence
        POST /api/services/geofence-privacy-service/check_location/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = GeofenceEvents.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='check_location',
                    resource_type='GeofenceEvents',
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response({
                'id': str(obj.id),
                'created_at': obj.created_at.isoformat(),
                'status': 'success',
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'error': 'An error occurred',
                'action': 'check_location',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def events(self, request):
        """
        List geofence events
        GET /api/services/geofence-privacy-service/events/
        """
        try:
            queryset = GeofenceEvents.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
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
            return Response({
                'error': 'An error occurred',
                'action': 'events',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def tracking_config(self, request):
        """
        Get location tracking config
        GET /api/services/geofence-privacy-service/tracking_config/
        """
        try:
            queryset = LocationTrackingConfig.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
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
            return Response({
                'error': 'An error occurred',
                'action': 'tracking_config',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_tracking_config(self, request):
        """
        Update tracking config
        POST /api/services/geofence-privacy-service/update_tracking_config/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = LocationTrackingConfig.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_tracking_config',
                    resource_type='LocationTrackingConfig',
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response({
                'id': str(obj.id),
                'created_at': obj.created_at.isoformat(),
                'status': 'success',
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'error': 'An error occurred',
                'action': 'update_tracking_config',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def audit_trail(self, request):
        """
        Location tracking audit trail
        GET /api/services/geofence-privacy-service/audit_trail/
        """
        try:
            queryset = LocationTrackingAudit.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
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
            return Response({
                'error': 'An error occurred',
                'action': 'audit_trail',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def deletion_log(self, request):
        """
        Location data deletion log
        GET /api/services/geofence-privacy-service/deletion_log/
        """
        try:
            queryset = LocationDeletionLog.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
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
            return Response({
                'error': 'An error occurred',
                'action': 'deletion_log',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def request_deletion(self, request):
        """
        Request location data deletion
        POST /api/services/geofence-privacy-service/request_deletion/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = LocationDeletionLog.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='request_deletion',
                    resource_type='LocationDeletionLog',
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response({
                'id': str(obj.id),
                'created_at': obj.created_at.isoformat(),
                'status': 'success',
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'error': 'An error occurred',
                'action': 'request_deletion',
            }, status=status.HTTP_400_BAD_REQUEST)

