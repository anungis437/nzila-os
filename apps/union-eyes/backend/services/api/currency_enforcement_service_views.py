"""
CurrencyEnforcementServiceViewSet
Generated from service: currency-enforcement-service
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
from billing.models import CurrencyEnforcementPolicy, BankOfCanadaRates, TransactionCurrencyConversions, CurrencyEnforcementViolations, FxRateAuditLog, CurrencyEnforcementAudit, ExchangeRates
from core.models import AuditLogs

class CurrencyEnforcementServicePagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class CurrencyEnforcementServiceViewSet(viewsets.ViewSet):
    """
    ViewSet for currency-enforcement-service operations.

    Endpoints:
    - GET /api/services/currency-enforcement-service/get_policy/ — Get currency enforcement policy for org
- POST /api/services/currency-enforcement-service/update_policy/ — Update currency enforcement policy
- POST /api/services/currency-enforcement-service/validate_transaction/ — Validate a transaction against currency policy
- GET /api/services/currency-enforcement-service/violations/ — List currency enforcement violations
- GET /api/services/currency-enforcement-service/exchange_rates/ — Get current exchange rates
- POST /api/services/currency-enforcement-service/refresh_rates/ — Refresh Bank of Canada rates
- GET /api/services/currency-enforcement-service/audit_trail/ — Get FX audit trail
- GET /api/services/currency-enforcement-service/conversion_history/ — Get conversion history
    """

    permission_classes = [IsAuthenticated]
    pagination_class = CurrencyEnforcementServicePagination

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
    def get_policy(self, request):
        """
        Get currency enforcement policy for org
        GET /api/services/currency-enforcement-service/get_policy/
        """
        try:
            queryset = CurrencyEnforcementPolicy.objects.filter(
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
                'action': 'get_policy',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_policy(self, request):
        """
        Update currency enforcement policy
        POST /api/services/currency-enforcement-service/update_policy/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = CurrencyEnforcementPolicy.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_policy',
                    resource_type='CurrencyEnforcementPolicy',
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
                'action': 'update_policy',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def validate_transaction(self, request):
        """
        Validate a transaction against currency policy
        POST /api/services/currency-enforcement-service/validate_transaction/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = TransactionCurrencyConversions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='validate_transaction',
                    resource_type='TransactionCurrencyConversions',
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
                'action': 'validate_transaction',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def violations(self, request):
        """
        List currency enforcement violations
        GET /api/services/currency-enforcement-service/violations/
        """
        try:
            queryset = CurrencyEnforcementViolations.objects.filter(
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
                'action': 'violations',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def exchange_rates(self, request):
        """
        Get current exchange rates
        GET /api/services/currency-enforcement-service/exchange_rates/
        """
        try:
            queryset = ExchangeRates.objects.filter(
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
                'action': 'exchange_rates',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def refresh_rates(self, request):
        """
        Refresh Bank of Canada rates
        POST /api/services/currency-enforcement-service/refresh_rates/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = BankOfCanadaRates.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='refresh_rates',
                    resource_type='BankOfCanadaRates',
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
                'action': 'refresh_rates',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def audit_trail(self, request):
        """
        Get FX audit trail
        GET /api/services/currency-enforcement-service/audit_trail/
        """
        try:
            queryset = FxRateAuditLog.objects.filter(
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
    def conversion_history(self, request):
        """
        Get conversion history
        GET /api/services/currency-enforcement-service/conversion_history/
        """
        try:
            queryset = TransactionCurrencyConversions.objects.filter(
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
                'action': 'conversion_history',
            }, status=status.HTTP_400_BAD_REQUEST)

