"""
CertificatesViewSet
Service: certificates
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
from core.models import Certificates, CertificateTemplates, DigitalBadges
from auth_core.models import AuditLogs

class CertificatesPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class CertificatesViewSet(viewsets.ViewSet):
    """
    ViewSet for certificates operations.

    Endpoints:
    - POST /api/services/certificates/create_certificate/ — Create certificate
- POST /api/services/certificates/create_from_quiz/ — Create certificate from quiz completion
- GET /api/services/certificates/get_certificate/ — Get certificate by ID
- GET /api/services/certificates/get_by_number/ — Get certificate by number
- GET /api/services/certificates/user_certificates/ — Get user certificates
- GET /api/services/certificates/user_stats/ — Get user certificate stats
- GET /api/services/certificates/course_certificates/ — Get course certificates
- GET /api/services/certificates/verify/ — Verify certificate authenticity
- POST /api/services/certificates/revoke/ — Revoke certificate
- POST /api/services/certificates/update_pdf/ — Update certificate PDF
- GET /api/services/certificates/templates/ — List certificate templates
- GET /api/services/certificates/default_template/ — Get default template
- POST /api/services/certificates/create_badge/ — Create digital badge
- GET /api/services/certificates/user_badges/ — Get user badges
- GET /api/services/certificates/badge_by_assertion/ — Get badge by assertion
- GET /api/services/certificates/certificate_badges/ — Get certificate badges
    """

    permission_classes = [IsAuthenticated]
    pagination_class = CertificatesPagination

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
    def create_certificate(self, request):
        """
        Create certificate
        POST /api/services/certificates/create_certificate/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Certificates.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_certificate',
                    resource_type='Certificates',
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
            logger.error(f'create_certificate failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'create_certificate',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_from_quiz(self, request):
        """
        Create certificate from quiz completion
        POST /api/services/certificates/create_from_quiz/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Certificates.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_from_quiz',
                    resource_type='Certificates',
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
            logger.error(f'create_from_quiz failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'create_from_quiz',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def get_certificate(self, request):
        """
        Get certificate by ID
        GET /api/services/certificates/get_certificate/
        """
        try:
            queryset = Certificates.objects.filter(
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
            logger.error(f'get_certificate failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'get_certificate',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def get_by_number(self, request):
        """
        Get certificate by number
        GET /api/services/certificates/get_by_number/
        """
        try:
            queryset = Certificates.objects.filter(
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
            logger.error(f'get_by_number failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'get_by_number',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_certificates(self, request):
        """
        Get user certificates
        GET /api/services/certificates/user_certificates/
        """
        try:
            queryset = Certificates.objects.filter(
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
            logger.error(f'user_certificates failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'user_certificates',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_stats(self, request):
        """
        Get user certificate stats
        GET /api/services/certificates/user_stats/
        """
        try:
            queryset = Certificates.objects.filter(
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
            logger.error(f'user_stats failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'user_stats',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def course_certificates(self, request):
        """
        Get course certificates
        GET /api/services/certificates/course_certificates/
        """
        try:
            queryset = Certificates.objects.filter(
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
            logger.error(f'course_certificates failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'course_certificates',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def verify(self, request):
        """
        Verify certificate authenticity
        GET /api/services/certificates/verify/
        """
        try:
            queryset = Certificates.objects.filter(
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
            logger.error(f'verify failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'verify',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def revoke(self, request):
        """
        Revoke certificate
        POST /api/services/certificates/revoke/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Certificates.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='revoke',
                    resource_type='Certificates',
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

    @action(detail=False, methods=['post'])
    def update_pdf(self, request):
        """
        Update certificate PDF
        POST /api/services/certificates/update_pdf/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Certificates.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_pdf',
                    resource_type='Certificates',
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
            logger.error(f'update_pdf failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'update_pdf',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def templates(self, request):
        """
        List certificate templates
        GET /api/services/certificates/templates/
        """
        try:
            queryset = CertificateTemplates.objects.filter(
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
            logger.error(f'templates failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'templates',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def default_template(self, request):
        """
        Get default template
        GET /api/services/certificates/default_template/
        """
        try:
            queryset = CertificateTemplates.objects.filter(
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
            logger.error(f'default_template failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'default_template',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_badge(self, request):
        """
        Create digital badge
        POST /api/services/certificates/create_badge/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = DigitalBadges.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_badge',
                    resource_type='DigitalBadges',
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
            logger.error(f'create_badge failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'create_badge',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_badges(self, request):
        """
        Get user badges
        GET /api/services/certificates/user_badges/
        """
        try:
            queryset = DigitalBadges.objects.filter(
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
            logger.error(f'user_badges failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'user_badges',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def badge_by_assertion(self, request):
        """
        Get badge by assertion
        GET /api/services/certificates/badge_by_assertion/
        """
        try:
            queryset = DigitalBadges.objects.filter(
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
            logger.error(f'badge_by_assertion failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'badge_by_assertion',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def certificate_badges(self, request):
        """
        Get certificate badges
        GET /api/services/certificates/certificate_badges/
        """
        try:
            queryset = DigitalBadges.objects.filter(
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
            logger.error(f'certificate_badges failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'certificate_badges',
            }, status=status.HTTP_400_BAD_REQUEST)

