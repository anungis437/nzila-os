"""
SocialViewSet
Service: social
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
from core.models import UserProfilesExtended, UserFollows, StudyBuddies, UserActivityFeed, UserGroups, GroupMembers
from auth_core.models import AuditLogs

class SocialPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class SocialViewSet(viewsets.ViewSet):
    """
    ViewSet for social operations.

    Endpoints:
    - GET /api/services/social/profile/ — Get user social profile
- POST /api/services/social/upsert_profile/ — Create/update social profile
- GET /api/services/social/search_users/ — Search users
- POST /api/services/social/follow/ — Follow user
- POST /api/services/social/unfollow/ — Unfollow user
- GET /api/services/social/followers/ — Get followers
- GET /api/services/social/following/ — Get following
- GET /api/services/social/is_following/ — Check if following user
- GET /api/services/social/study_buddy_matches/ — Find study buddy matches
- POST /api/services/social/send_buddy_request/ — Send study buddy request
- POST /api/services/social/accept_buddy/ — Accept study buddy request
- POST /api/services/social/decline_buddy/ — Decline study buddy request
- GET /api/services/social/buddies/ — Get study buddies
- GET /api/services/social/pending_buddy_requests/ — Get pending requests
- POST /api/services/social/create_post/ — Create activity post
- GET /api/services/social/activity_feed/ — Get activity feed
- GET /api/services/social/user_activity/ — Get user activity
- POST /api/services/social/add_reaction/ — Add reaction to post
- POST /api/services/social/remove_reaction/ — Remove reaction
- POST /api/services/social/add_comment/ — Add comment to activity
- GET /api/services/social/comments/ — Get activity comments
- GET /api/services/social/social_summary/ — Get user social summary
    """

    permission_classes = [IsAuthenticated]
    pagination_class = SocialPagination

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
    def profile(self, request):
        """
        Get user social profile
        GET /api/services/social/profile/
        """
        try:
            queryset = UserProfilesExtended.objects.filter(
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
            logger.error(f'profile failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'profile',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def upsert_profile(self, request):
        """
        Create/update social profile
        POST /api/services/social/upsert_profile/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = UserProfilesExtended.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='upsert_profile',
                    resource_type='UserProfilesExtended',
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
            logger.error(f'upsert_profile failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'upsert_profile',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def search_users(self, request):
        """
        Search users
        GET /api/services/social/search_users/
        """
        try:
            queryset = UserProfilesExtended.objects.filter(
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
            logger.error(f'search_users failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'search_users',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def follow(self, request):
        """
        Follow user
        POST /api/services/social/follow/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = UserFollows.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='follow',
                    resource_type='UserFollows',
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
            logger.error(f'follow failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'follow',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def unfollow(self, request):
        """
        Unfollow user
        POST /api/services/social/unfollow/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = UserFollows.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='unfollow',
                    resource_type='UserFollows',
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
            logger.error(f'unfollow failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'unfollow',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def followers(self, request):
        """
        Get followers
        GET /api/services/social/followers/
        """
        try:
            queryset = UserFollows.objects.filter(
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
            logger.error(f'followers failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'followers',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def following(self, request):
        """
        Get following
        GET /api/services/social/following/
        """
        try:
            queryset = UserFollows.objects.filter(
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
            logger.error(f'following failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'following',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def is_following(self, request):
        """
        Check if following user
        GET /api/services/social/is_following/
        """
        try:
            queryset = UserFollows.objects.filter(
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
            logger.error(f'is_following failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'is_following',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def study_buddy_matches(self, request):
        """
        Find study buddy matches
        GET /api/services/social/study_buddy_matches/
        """
        try:
            queryset = StudyBuddies.objects.filter(
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
            logger.error(f'study_buddy_matches failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'study_buddy_matches',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def send_buddy_request(self, request):
        """
        Send study buddy request
        POST /api/services/social/send_buddy_request/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = StudyBuddies.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='send_buddy_request',
                    resource_type='StudyBuddies',
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
            logger.error(f'send_buddy_request failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'send_buddy_request',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def accept_buddy(self, request):
        """
        Accept study buddy request
        POST /api/services/social/accept_buddy/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = StudyBuddies.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='accept_buddy',
                    resource_type='StudyBuddies',
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
            logger.error(f'accept_buddy failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'accept_buddy',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def decline_buddy(self, request):
        """
        Decline study buddy request
        POST /api/services/social/decline_buddy/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = StudyBuddies.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='decline_buddy',
                    resource_type='StudyBuddies',
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
            logger.error(f'decline_buddy failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'decline_buddy',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def buddies(self, request):
        """
        Get study buddies
        GET /api/services/social/buddies/
        """
        try:
            queryset = StudyBuddies.objects.filter(
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
            logger.error(f'buddies failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'buddies',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def pending_buddy_requests(self, request):
        """
        Get pending requests
        GET /api/services/social/pending_buddy_requests/
        """
        try:
            queryset = StudyBuddies.objects.filter(
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
            logger.error(f'pending_buddy_requests failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'pending_buddy_requests',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_post(self, request):
        """
        Create activity post
        POST /api/services/social/create_post/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = UserActivityFeed.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='create_post',
                    resource_type='UserActivityFeed',
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
            logger.error(f'create_post failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'create_post',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def activity_feed(self, request):
        """
        Get activity feed
        GET /api/services/social/activity_feed/
        """
        try:
            queryset = UserActivityFeed.objects.filter(
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
            logger.error(f'activity_feed failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'activity_feed',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_activity(self, request):
        """
        Get user activity
        GET /api/services/social/user_activity/
        """
        try:
            queryset = UserActivityFeed.objects.filter(
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
            logger.error(f'user_activity failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'user_activity',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def add_reaction(self, request):
        """
        Add reaction to post
        POST /api/services/social/add_reaction/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = UserActivityFeed.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='add_reaction',
                    resource_type='UserActivityFeed',
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
            logger.error(f'add_reaction failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'add_reaction',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def remove_reaction(self, request):
        """
        Remove reaction
        POST /api/services/social/remove_reaction/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = UserActivityFeed.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='remove_reaction',
                    resource_type='UserActivityFeed',
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
            logger.error(f'remove_reaction failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'remove_reaction',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def add_comment(self, request):
        """
        Add comment to activity
        POST /api/services/social/add_comment/
        """
        try:
            data = request.data
            org_id = request.user.organization_id
            # TODO(NZ-302): Implement business logic
            return Response({
                'status': 'success',
                'message': 'Add comment to activity',
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'add_comment failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'add_comment',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def comments(self, request):
        """
        Get activity comments
        GET /api/services/social/comments/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'comments failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'comments',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def social_summary(self, request):
        """
        Get user social summary
        GET /api/services/social/social_summary/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'social_summary failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'social_summary',
            }, status=status.HTTP_400_BAD_REQUEST)

