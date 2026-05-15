"""
GamificationViewSet
Service: gamification
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
from core.models import AchievementCategories, AchievementProgress, UserStreaks, PointsSources, PointsTransactions, RewardsCatalog, UserRewards, Leaderboards, LeaderboardEntries
from content.models import Achievements, UserAchievements, UserPoints
from auth_core.models import AuditLogs

class GamificationPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class GamificationViewSet(viewsets.ViewSet):
    """
    ViewSet for gamification operations.

    Endpoints:
    - GET /api/services/gamification/achievement_categories/ — Get achievement categories
- GET /api/services/gamification/achievements/ — List achievements
- GET /api/services/gamification/user_achievements/ — Get user achievements
- GET /api/services/gamification/achievement_progress/ — Get achievement progress
- POST /api/services/gamification/award_achievement/ — Award achievement to user
- POST /api/services/gamification/update_progress/ — Update achievement progress
- GET /api/services/gamification/achievement_summary/ — Get user achievement summary
- POST /api/services/gamification/toggle_featured/ — Toggle featured achievement
- GET /api/services/gamification/streaks/ — Get user streaks
- POST /api/services/gamification/update_streak/ — Update user streak
- GET /api/services/gamification/points_sources/ — Get points sources
- GET /api/services/gamification/user_points/ — Get user points
- POST /api/services/gamification/award_points/ — Award points
- POST /api/services/gamification/spend_points/ — Spend points
- GET /api/services/gamification/points_transactions/ — Get transactions
- GET /api/services/gamification/points_summary/ — Get points summary
- GET /api/services/gamification/rewards/ — Get rewards catalog
- POST /api/services/gamification/redeem_reward/ — Redeem a reward
- GET /api/services/gamification/user_rewards/ — Get user rewards
- GET /api/services/gamification/leaderboards/ — Get leaderboards
- GET /api/services/gamification/leaderboard_entries/ — Get leaderboard entries
- GET /api/services/gamification/user_leaderboard/ — Get user leaderboard entry
- POST /api/services/gamification/update_leaderboard/ — Update leaderboard entry
- GET /api/services/gamification/user_level/ — Get user level
- POST /api/services/gamification/add_xp/ — Add XP to user
    """

    permission_classes = [IsAuthenticated]
    pagination_class = GamificationPagination

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
    def achievement_categories(self, request):
        """
        Get achievement categories
        GET /api/services/gamification/achievement_categories/
        """
        try:
            queryset = AchievementCategories.objects.filter(
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
            logger.error(f'achievement_categories failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'achievement_categories',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def achievements(self, request):
        """
        List achievements
        GET /api/services/gamification/achievements/
        """
        try:
            queryset = Achievements.objects.filter(
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
            logger.error(f'achievements failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'achievements',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_achievements(self, request):
        """
        Get user achievements
        GET /api/services/gamification/user_achievements/
        """
        try:
            queryset = UserAchievements.objects.filter(
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
            logger.error(f'user_achievements failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'user_achievements',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def achievement_progress(self, request):
        """
        Get achievement progress
        GET /api/services/gamification/achievement_progress/
        """
        try:
            queryset = AchievementProgress.objects.filter(
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
            logger.error(f'achievement_progress failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'achievement_progress',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def award_achievement(self, request):
        """
        Award achievement to user
        POST /api/services/gamification/award_achievement/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = UserAchievements.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='award_achievement',
                    resource_type='UserAchievements',
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
            logger.error(f'award_achievement failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'award_achievement',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_progress(self, request):
        """
        Update achievement progress
        POST /api/services/gamification/update_progress/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = AchievementProgress.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_progress',
                    resource_type='AchievementProgress',
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
            logger.error(f'update_progress failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'update_progress',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def achievement_summary(self, request):
        """
        Get user achievement summary
        GET /api/services/gamification/achievement_summary/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'achievement_summary failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'achievement_summary',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def toggle_featured(self, request):
        """
        Toggle featured achievement
        POST /api/services/gamification/toggle_featured/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = UserAchievements.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='toggle_featured',
                    resource_type='UserAchievements',
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
            logger.error(f'toggle_featured failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'toggle_featured',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def streaks(self, request):
        """
        Get user streaks
        GET /api/services/gamification/streaks/
        """
        try:
            queryset = UserStreaks.objects.filter(
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
            logger.error(f'streaks failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'streaks',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_streak(self, request):
        """
        Update user streak
        POST /api/services/gamification/update_streak/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = UserStreaks.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_streak',
                    resource_type='UserStreaks',
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
            logger.error(f'update_streak failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'update_streak',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def points_sources(self, request):
        """
        Get points sources
        GET /api/services/gamification/points_sources/
        """
        try:
            queryset = PointsSources.objects.filter(
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
            logger.error(f'points_sources failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'points_sources',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_points(self, request):
        """
        Get user points
        GET /api/services/gamification/user_points/
        """
        try:
            queryset = UserPoints.objects.filter(
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
            logger.error(f'user_points failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'user_points',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def award_points(self, request):
        """
        Award points
        POST /api/services/gamification/award_points/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = UserPoints.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='award_points',
                    resource_type='UserPoints',
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
            logger.error(f'award_points failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'award_points',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def spend_points(self, request):
        """
        Spend points
        POST /api/services/gamification/spend_points/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = PointsTransactions.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='spend_points',
                    resource_type='PointsTransactions',
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
            logger.error(f'spend_points failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'spend_points',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def points_transactions(self, request):
        """
        Get transactions
        GET /api/services/gamification/points_transactions/
        """
        try:
            queryset = PointsTransactions.objects.filter(
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
            logger.error(f'points_transactions failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'points_transactions',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def points_summary(self, request):
        """
        Get points summary
        GET /api/services/gamification/points_summary/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'points_summary failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'points_summary',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def rewards(self, request):
        """
        Get rewards catalog
        GET /api/services/gamification/rewards/
        """
        try:
            queryset = RewardsCatalog.objects.filter(
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
            logger.error(f'rewards failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'rewards',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def redeem_reward(self, request):
        """
        Redeem a reward
        POST /api/services/gamification/redeem_reward/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = UserRewards.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='redeem_reward',
                    resource_type='UserRewards',
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
            logger.error(f'redeem_reward failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'redeem_reward',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_rewards(self, request):
        """
        Get user rewards
        GET /api/services/gamification/user_rewards/
        """
        try:
            queryset = UserRewards.objects.filter(
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
            logger.error(f'user_rewards failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'user_rewards',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def leaderboards(self, request):
        """
        Get leaderboards
        GET /api/services/gamification/leaderboards/
        """
        try:
            queryset = Leaderboards.objects.filter(
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
            logger.error(f'leaderboards failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'leaderboards',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def leaderboard_entries(self, request):
        """
        Get leaderboard entries
        GET /api/services/gamification/leaderboard_entries/
        """
        try:
            queryset = LeaderboardEntries.objects.filter(
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
            logger.error(f'leaderboard_entries failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'leaderboard_entries',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_leaderboard(self, request):
        """
        Get user leaderboard entry
        GET /api/services/gamification/user_leaderboard/
        """
        try:
            queryset = LeaderboardEntries.objects.filter(
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
            logger.error(f'user_leaderboard failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'user_leaderboard',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_leaderboard(self, request):
        """
        Update leaderboard entry
        POST /api/services/gamification/update_leaderboard/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = LeaderboardEntries.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='update_leaderboard',
                    resource_type='LeaderboardEntries',
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
            logger.error(f'update_leaderboard failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'update_leaderboard',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_level(self, request):
        """
        Get user level
        GET /api/services/gamification/user_level/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'user_level failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'user_level',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def add_xp(self, request):
        """
        Add XP to user
        POST /api/services/gamification/add_xp/
        """
        try:
            data = request.data
            org_id = request.user.organization_id
            # TODO(NZ-302): Implement business logic
            return Response({
                'status': 'success',
                'message': 'Add XP to user',
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'add_xp failed: {e}', exc_info=True)
            return Response({
                'error': 'An error occurred',
                'action': 'add_xp',
            }, status=status.HTTP_400_BAD_REQUEST)

