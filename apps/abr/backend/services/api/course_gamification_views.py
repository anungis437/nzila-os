"""
CourseGamificationViewSet
Service: course-gamification
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
from core.models import AchievementCategories, AchievementProgress, UserStreaks, Leaderboards, LeaderboardEntries
from content.models import Achievements, UserAchievements, UserPoints
from auth_core.models import AuditLogs

class CourseGamificationPagination(CursorPagination):
    page_size = 50
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class CourseGamificationViewSet(viewsets.ViewSet):
    """
    ViewSet for course-gamification operations.

    Endpoints:
    - GET /api/services/course-gamification/achievement_categories/ — Get achievement categories
- GET /api/services/course-gamification/achievements/ — List achievements
- GET /api/services/course-gamification/user_achievements/ — Get user course achievements
- GET /api/services/course-gamification/achievement_progress/ — Get achievement progress
- POST /api/services/course-gamification/check_achievements/ — Check and award achievements
- POST /api/services/course-gamification/feature_achievement/ — Feature an achievement
- GET /api/services/course-gamification/user_points/ — Get user course points
- POST /api/services/course-gamification/award_points/ — Award course points
- GET /api/services/course-gamification/points_transactions/ — Get points transactions
- GET /api/services/course-gamification/streaks/ — Get course streaks
- POST /api/services/course-gamification/update_streak/ — Update streak
- GET /api/services/course-gamification/best_streak/ — Get user best streak
- GET /api/services/course-gamification/leaderboards/ — Get leaderboards
- GET /api/services/course-gamification/leaderboard_entries/ — Get leaderboard entries
- GET /api/services/course-gamification/user_rank/ — Get user leaderboard rank
- POST /api/services/course-gamification/calculate_leaderboard/ — Calculate leaderboard rankings
- GET /api/services/course-gamification/summary/ — Get gamification summary
    """

    permission_classes = [IsAuthenticated]
    pagination_class = CourseGamificationPagination

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
        GET /api/services/course-gamification/achievement_categories/
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
                'error': str(e),
                'action': 'achievement_categories',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def achievements(self, request):
        """
        List achievements
        GET /api/services/course-gamification/achievements/
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
                'error': str(e),
                'action': 'achievements',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_achievements(self, request):
        """
        Get user course achievements
        GET /api/services/course-gamification/user_achievements/
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
                'error': str(e),
                'action': 'user_achievements',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def achievement_progress(self, request):
        """
        Get achievement progress
        GET /api/services/course-gamification/achievement_progress/
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
                'error': str(e),
                'action': 'achievement_progress',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def check_achievements(self, request):
        """
        Check and award achievements
        POST /api/services/course-gamification/check_achievements/
        """
        try:
            data = request.data
            org_id = request.user.organization_id
            # TODO(NZ-302): Implement business logic
            return Response({
                'status': 'success',
                'message': 'Check and award achievements',
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'check_achievements failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'check_achievements',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def feature_achievement(self, request):
        """
        Feature an achievement
        POST /api/services/course-gamification/feature_achievement/
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
                    action='feature_achievement',
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
            logger.error(f'feature_achievement failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'feature_achievement',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_points(self, request):
        """
        Get user course points
        GET /api/services/course-gamification/user_points/
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
                'error': str(e),
                'action': 'user_points',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def award_points(self, request):
        """
        Award course points
        POST /api/services/course-gamification/award_points/
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
                'error': str(e),
                'action': 'award_points',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def points_transactions(self, request):
        """
        Get points transactions
        GET /api/services/course-gamification/points_transactions/
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
                'error': str(e),
                'action': 'points_transactions',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def streaks(self, request):
        """
        Get course streaks
        GET /api/services/course-gamification/streaks/
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
                'error': str(e),
                'action': 'streaks',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def update_streak(self, request):
        """
        Update streak
        POST /api/services/course-gamification/update_streak/
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
                'error': str(e),
                'action': 'update_streak',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def best_streak(self, request):
        """
        Get user best streak
        GET /api/services/course-gamification/best_streak/
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
            logger.error(f'best_streak failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'best_streak',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def leaderboards(self, request):
        """
        Get leaderboards
        GET /api/services/course-gamification/leaderboards/
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
                'error': str(e),
                'action': 'leaderboards',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def leaderboard_entries(self, request):
        """
        Get leaderboard entries
        GET /api/services/course-gamification/leaderboard_entries/
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
                'error': str(e),
                'action': 'leaderboard_entries',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def user_rank(self, request):
        """
        Get user leaderboard rank
        GET /api/services/course-gamification/user_rank/
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
            logger.error(f'user_rank failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'user_rank',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def calculate_leaderboard(self, request):
        """
        Calculate leaderboard rankings
        POST /api/services/course-gamification/calculate_leaderboard/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = Leaderboards.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != 'organization_id'}
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action='calculate_leaderboard',
                    resource_type='Leaderboards',
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
            logger.error(f'calculate_leaderboard failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'calculate_leaderboard',
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Get gamification summary
        GET /api/services/course-gamification/summary/
        """
        try:
            org_id = request.user.organization_id
            return Response({
                'status': 'success',
                'organizationId': str(org_id),
                'data': {},
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f'summary failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
                'action': 'summary',
            }, status=status.HTTP_400_BAD_REQUEST)

