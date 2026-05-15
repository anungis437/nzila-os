"""
EmployerNonInterferenceServiceViewSet
Generated from service: employer-non-interference-service
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
from compliance.models import FirewallAccessRules, EmployerAccessAttempts, AccessJustificationRequests, UnionOnlyDataTags, FirewallViolations, FirewallComplianceAudit
from core.models import AuditLogs

class EmployerNonInterferenceServicePagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class EmployerNonInterferenceServiceViewSet(viewsets.ViewSet):
    """
    ViewSet for employer-non-interference-service operations.

    Endpoints:
    - POST /api/services/employer-non-interference-service/check_access/ — Check if employer access attempt is permitted
- GET /api/services/employer-non-interference-service/access_rules/ — List firewall access rules
- POST /api/services/employer-non-interference-service/create_rule/ — Create firewall access rule
- GET /api/services/employer-non-interference-service/violations/ — List non-interference violations
- POST /api/services/employer-non-interference-service/report_violation/ — Report a non-interference violation
- GET /api/services/employer-non-interference-service/justification_requests/ — List access justification requests
- POST /api/services/employer-non-interference-service/submit_justification/ — Submit access justification
- GET /api/services/employer-non-interference-service/compliance_audit/ — Get compliance audit report
- GET /api/services/employer-non-interference-service/union_data_tags/ — List union-only data tags
- POST /api/services/employer-non-interference-service/tag_data/ — Tag data as union-only
    """

    permission_classes = [IsAuthenticated]
    pagination_class = EmployerNonInterferenceServicePagination

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
    def check_access(self, request):
        """
        Check if employer access attempt is permitted
        POST /api/services/employer-non-interference-service/check_access/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = EmployerAccessAttempts.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='check_access',
                    resource_type='EmployerAccessAttempts',
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
                'action': 'check_access',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def access_rules(self, request):
        """
        List firewall access rules
        GET /api/services/employer-non-interference-service/access_rules/
        """
        try:
            queryset = FirewallAccessRules.objects.filter(
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
                'action': 'access_rules',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_rule(self, request):
        """
        Create firewall access rule
        POST /api/services/employer-non-interference-service/create_rule/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = FirewallAccessRules.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_rule',
                    resource_type='FirewallAccessRules',
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
                'action': 'create_rule',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def violations(self, request):
        """
        List non-interference violations
        GET /api/services/employer-non-interference-service/violations/
        """
        try:
            queryset = FirewallViolations.objects.filter(
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

    @action(detail=False, methods=['post'])
    def report_violation(self, request):
        """
        Report a non-interference violation
        POST /api/services/employer-non-interference-service/report_violation/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = FirewallViolations.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='report_violation',
                    resource_type='FirewallViolations',
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
                'action': 'report_violation',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def justification_requests(self, request):
        """
        List access justification requests
        GET /api/services/employer-non-interference-service/justification_requests/
        """
        try:
            queryset = AccessJustificationRequests.objects.filter(
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
                'action': 'justification_requests',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def submit_justification(self, request):
        """
        Submit access justification
        POST /api/services/employer-non-interference-service/submit_justification/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = AccessJustificationRequests.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='submit_justification',
                    resource_type='AccessJustificationRequests',
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
                'action': 'submit_justification',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def compliance_audit(self, request):
        """
        Get compliance audit report
        GET /api/services/employer-non-interference-service/compliance_audit/
        """
        try:
            queryset = FirewallComplianceAudit.objects.filter(
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
                'action': 'compliance_audit',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def union_data_tags(self, request):
        """
        List union-only data tags
        GET /api/services/employer-non-interference-service/union_data_tags/
        """
        try:
            queryset = UnionOnlyDataTags.objects.filter(
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
                'action': 'union_data_tags',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def tag_data(self, request):
        """
        Tag data as union-only
        POST /api/services/employer-non-interference-service/tag_data/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = UnionOnlyDataTags.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='tag_data',
                    resource_type='UnionOnlyDataTags',
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
                'action': 'tag_data',
            }, status=status.HTTP_400_BAD_REQUEST)

