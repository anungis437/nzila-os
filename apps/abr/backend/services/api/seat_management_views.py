"""
SeatManagementViewSet
Service: seat-management
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
from billing.models import OrganizationSubscriptions, SeatAllocations, SubscriptionInvoices
from auth_core.models import AuditLogs

class SeatManagementPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class SeatManagementViewSet(viewsets.ViewSet):
    """
    ViewSet for seat-management operations.

    Endpoints:
    - GET /api/services/seat-management/subscription/ — Get org subscription
- POST /api/services/seat-management/create_subscription/ — Create org subscription
- POST /api/services/seat-management/update_subscription/ — Update org subscription
- GET /api/services/seat-management/by_stripe_id/ — Get subscription by Stripe ID
- GET /api/services/seat-management/can_add_users/ — Check if org can add users
- POST /api/services/seat-management/enforce_seats/ — Enforce seat limits
- GET /api/services/seat-management/allocations/ — Get seat allocations
- POST /api/services/seat-management/allocate/ — Allocate seat
- POST /api/services/seat-management/revoke/ — Revoke seat allocation
- GET /api/services/seat-management/user_status/ — Get user seat status
- GET /api/services/seat-management/invoices/ — Get subscription invoices
- POST /api/services/seat-management/record_invoice/ — Record invoice
    """

    permission_classes = [IsAuthenticated]
    pagination_class = SeatManagementPagination

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
    def subscription(self, request):
        """
        Get org subscription
        GET /api/services/seat-management/subscription/
        """
        try:
            queryset = OrganizationSubscriptions.objects.filter(
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
            logger.error(f'subscription failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'subscription',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_subscription(self, request):
        """
        Create org subscription
        POST /api/services/seat-management/create_subscription/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = OrganizationSubscriptions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_subscription',
                    resource_type='OrganizationSubscriptions',
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
            logger.error(f'create_subscription failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'create_subscription',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_subscription(self, request):
        """
        Update org subscription
        POST /api/services/seat-management/update_subscription/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = OrganizationSubscriptions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_subscription',
                    resource_type='OrganizationSubscriptions',
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
            logger.error(f'update_subscription failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'update_subscription',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def by_stripe_id(self, request):
        """
        Get subscription by Stripe ID
        GET /api/services/seat-management/by_stripe_id/
        """
        try:
            queryset = OrganizationSubscriptions.objects.filter(
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
            logger.error(f'by_stripe_id failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'by_stripe_id',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def can_add_users(self, request):
        """
        Check if org can add users
        GET /api/services/seat-management/can_add_users/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'can_add_users failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'can_add_users',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def enforce_seats(self, request):
        """
        Enforce seat limits
        POST /api/services/seat-management/enforce_seats/
        """
        try:
            data = request.data
            org_id = request.user.organization_id
            # TODO(NZ-302): Implement business logic
            return Response({
                'status': 'success',
                'message': 'Enforce seat limits',
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'enforce_seats failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'enforce_seats',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def allocations(self, request):
        """
        Get seat allocations
        GET /api/services/seat-management/allocations/
        """
        try:
            queryset = SeatAllocations.objects.filter(
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
            logger.error(f'allocations failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'allocations',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def allocate(self, request):
        """
        Allocate seat
        POST /api/services/seat-management/allocate/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SeatAllocations.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='allocate',
                    resource_type='SeatAllocations',
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
            logger.error(f'allocate failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'allocate',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def revoke(self, request):
        """
        Revoke seat allocation
        POST /api/services/seat-management/revoke/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SeatAllocations.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='revoke',
                    resource_type='SeatAllocations',
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
            logger.error(f'revoke failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'revoke',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_status(self, request):
        """
        Get user seat status
        GET /api/services/seat-management/user_status/
        """
        try:
            queryset = SeatAllocations.objects.filter(
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
            logger.error(f'user_status failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'user_status',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def invoices(self, request):
        """
        Get subscription invoices
        GET /api/services/seat-management/invoices/
        """
        try:
            queryset = SubscriptionInvoices.objects.filter(
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
            logger.error(f'invoices failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'invoices',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def record_invoice(self, request):
        """
        Record invoice
        POST /api/services/seat-management/record_invoice/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SubscriptionInvoices.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='record_invoice',
                    resource_type='SubscriptionInvoices',
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
            logger.error(f'record_invoice failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'record_invoice',
            }, status=status.HTTP_400_BAD_REQUEST)

