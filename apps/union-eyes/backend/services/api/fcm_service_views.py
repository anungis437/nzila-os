"""
FcmServiceViewSet
Generated from service: fcm-service
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
from notifications.models import PushDevices, PushNotificationTemplates, PushNotifications, PushDeliveries
from core.models import AuditLogs

class FcmServicePagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class FcmServiceViewSet(viewsets.ViewSet):
    """
    ViewSet for fcm-service operations.

    Endpoints:
    - POST /api/services/fcm-service/register_token/ — Register FCM device token
- POST /api/services/fcm-service/deregister_token/ — Deregister FCM device token
- POST /api/services/fcm-service/send_to_device/ — Send push to specific device
- POST /api/services/fcm-service/send_to_user/ — Send push to all user devices
- POST /api/services/fcm-service/send_to_topic/ — Send push to topic subscribers
- POST /api/services/fcm-service/subscribe_topic/ — Subscribe device to topic
- POST /api/services/fcm-service/unsubscribe_topic/ — Unsubscribe device from topic
- GET /api/services/fcm-service/delivery_status/ — Get delivery status for notification
- POST /api/services/fcm-service/cleanup_invalid/ — Cleanup invalid FCM tokens
- POST /api/services/fcm-service/retry_failed/ — Retry failed deliveries
- GET /api/services/fcm-service/templates/ — List push notification templates
- POST /api/services/fcm-service/create_template/ — Create push notification template
    """

    permission_classes = [IsAuthenticated]
    pagination_class = FcmServicePagination

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

    @action(detail=False, methods=['post'])
    def register_token(self, request):
        """
        Register FCM device token
        POST /api/services/fcm-service/register_token/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PushDevices.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='register_token',
                    resource_type='PushDevices',
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
                'action': 'register_token',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def deregister_token(self, request):
        """
        Deregister FCM device token
        POST /api/services/fcm-service/deregister_token/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PushDevices.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='deregister_token',
                    resource_type='PushDevices',
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
                'action': 'deregister_token',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def send_to_device(self, request):
        """
        Send push to specific device
        POST /api/services/fcm-service/send_to_device/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PushNotifications.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='send_to_device',
                    resource_type='PushNotifications',
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
                'action': 'send_to_device',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def send_to_user(self, request):
        """
        Send push to all user devices
        POST /api/services/fcm-service/send_to_user/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PushNotifications.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='send_to_user',
                    resource_type='PushNotifications',
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
                'action': 'send_to_user',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def send_to_topic(self, request):
        """
        Send push to topic subscribers
        POST /api/services/fcm-service/send_to_topic/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PushNotifications.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='send_to_topic',
                    resource_type='PushNotifications',
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
                'action': 'send_to_topic',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def subscribe_topic(self, request):
        """
        Subscribe device to topic
        POST /api/services/fcm-service/subscribe_topic/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PushDevices.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='subscribe_topic',
                    resource_type='PushDevices',
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
                'action': 'subscribe_topic',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def unsubscribe_topic(self, request):
        """
        Unsubscribe device from topic
        POST /api/services/fcm-service/unsubscribe_topic/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PushDevices.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='unsubscribe_topic',
                    resource_type='PushDevices',
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
                'action': 'unsubscribe_topic',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def delivery_status(self, request):
        """
        Get delivery status for notification
        GET /api/services/fcm-service/delivery_status/
        """
        try:
            queryset = PushDeliveries.objects.filter(
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
                'action': 'delivery_status',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def cleanup_invalid(self, request):
        """
        Cleanup invalid FCM tokens
        POST /api/services/fcm-service/cleanup_invalid/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PushDevices.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='cleanup_invalid',
                    resource_type='PushDevices',
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
                'action': 'cleanup_invalid',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def retry_failed(self, request):
        """
        Retry failed deliveries
        POST /api/services/fcm-service/retry_failed/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PushDeliveries.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='retry_failed',
                    resource_type='PushDeliveries',
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
                'action': 'retry_failed',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def templates(self, request):
        """
        List push notification templates
        GET /api/services/fcm-service/templates/
        """
        try:
            queryset = PushNotificationTemplates.objects.filter(
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
                'action': 'templates',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_template(self, request):
        """
        Create push notification template
        POST /api/services/fcm-service/create_template/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PushNotificationTemplates.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_template',
                    resource_type='PushNotificationTemplates',
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
                'action': 'create_template',
            }, status=status.HTTP_400_BAD_REQUEST)

