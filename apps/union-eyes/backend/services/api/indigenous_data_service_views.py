"""
IndigenousDataServiceViewSet
Generated from service: indigenous-data-service
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
from compliance.models import BandCouncils, BandCouncilConsent, IndigenousMemberData, IndigenousDataAccessLog, IndigenousDataSharingAgreements, TraditionalKnowledgeRegistry
from core.models import AuditLogs

class IndigenousDataServicePagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class IndigenousDataServiceViewSet(viewsets.ViewSet):
    """
    ViewSet for indigenous-data-service operations.

    Endpoints:
    - GET /api/services/indigenous-data-service/band_councils/ — List band councils
- POST /api/services/indigenous-data-service/register_council/ — Register band council
- GET /api/services/indigenous-data-service/consent_records/ — List band council consent records
- POST /api/services/indigenous-data-service/record_consent/ — Record band council consent (OCAP)
- GET /api/services/indigenous-data-service/member_data/ — Get indigenous member data (OCAP-controlled)
- GET /api/services/indigenous-data-service/access_log/ — Get indigenous data access log
- GET /api/services/indigenous-data-service/sharing_agreements/ — List data sharing agreements
- POST /api/services/indigenous-data-service/create_sharing_agreement/ — Create data sharing agreement
- GET /api/services/indigenous-data-service/traditional_knowledge/ — Access traditional knowledge registry
- POST /api/services/indigenous-data-service/register_knowledge/ — Register traditional knowledge entry
- POST /api/services/indigenous-data-service/request_access/ — Request access to indigenous data
- POST /api/services/indigenous-data-service/approve_access/ — Approve indigenous data access request
    """

    permission_classes = [IsAuthenticated]
    pagination_class = IndigenousDataServicePagination

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
    def band_councils(self, request):
        """
        List band councils
        GET /api/services/indigenous-data-service/band_councils/
        """
        try:
            queryset = BandCouncils.objects.filter(
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
                'action': 'band_councils',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def register_council(self, request):
        """
        Register band council
        POST /api/services/indigenous-data-service/register_council/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = BandCouncils.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='register_council',
                    resource_type='BandCouncils',
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
                'action': 'register_council',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def consent_records(self, request):
        """
        List band council consent records
        GET /api/services/indigenous-data-service/consent_records/
        """
        try:
            queryset = BandCouncilConsent.objects.filter(
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
                'action': 'consent_records',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def record_consent(self, request):
        """
        Record band council consent (OCAP)
        POST /api/services/indigenous-data-service/record_consent/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = BandCouncilConsent.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='record_consent',
                    resource_type='BandCouncilConsent',
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
                'action': 'record_consent',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def member_data(self, request):
        """
        Get indigenous member data (OCAP-controlled)
        GET /api/services/indigenous-data-service/member_data/
        """
        try:
            queryset = IndigenousMemberData.objects.filter(
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
                'action': 'member_data',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def access_log(self, request):
        """
        Get indigenous data access log
        GET /api/services/indigenous-data-service/access_log/
        """
        try:
            queryset = IndigenousDataAccessLog.objects.filter(
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
                'action': 'access_log',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def sharing_agreements(self, request):
        """
        List data sharing agreements
        GET /api/services/indigenous-data-service/sharing_agreements/
        """
        try:
            queryset = IndigenousDataSharingAgreements.objects.filter(
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
                'action': 'sharing_agreements',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_sharing_agreement(self, request):
        """
        Create data sharing agreement
        POST /api/services/indigenous-data-service/create_sharing_agreement/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = IndigenousDataSharingAgreements.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_sharing_agreement',
                    resource_type='IndigenousDataSharingAgreements',
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
                'action': 'create_sharing_agreement',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def traditional_knowledge(self, request):
        """
        Access traditional knowledge registry
        GET /api/services/indigenous-data-service/traditional_knowledge/
        """
        try:
            queryset = TraditionalKnowledgeRegistry.objects.filter(
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
                'action': 'traditional_knowledge',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def register_knowledge(self, request):
        """
        Register traditional knowledge entry
        POST /api/services/indigenous-data-service/register_knowledge/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = TraditionalKnowledgeRegistry.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='register_knowledge',
                    resource_type='TraditionalKnowledgeRegistry',
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
                'action': 'register_knowledge',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def request_access(self, request):
        """
        Request access to indigenous data
        POST /api/services/indigenous-data-service/request_access/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = IndigenousDataAccessLog.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='request_access',
                    resource_type='IndigenousDataAccessLog',
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
                'action': 'request_access',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def approve_access(self, request):
        """
        Approve indigenous data access request
        POST /api/services/indigenous-data-service/approve_access/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = IndigenousDataAccessLog.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='approve_access',
                    resource_type='IndigenousDataAccessLog',
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
                'action': 'approve_access',
            }, status=status.HTTP_400_BAD_REQUEST)

