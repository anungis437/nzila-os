"""
CanLIIRateLimiterViewSet
Service: canlii-rate-limiter
Auto-generated: 2026-02-18 10:15
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.cache import cache
from django.utils import timezone
from django.db.models import Sum, Count, Max, Avg, F, Q
from django.db.models.functions import TruncDate
import logging
import time
import math

logger = logging.getLogger(__name__)
from core.models import CanliiApiRequests, CanliiDailyQuotas, CanliiIngestionRuns
from auth_core.models import AuditLogs


# ==============================================================
# Configuration - mirrors frontend RATE_LIMITS
# ==============================================================

RATE_LIMITS = {
    'REQUESTS_PER_SECOND': 2,
    'MAX_CONCURRENT': 1,
    'DAILY_LIMIT': 5000,
    'REDIS_KEY_TOKENS': 'canlii:tokens',
    'REDIS_KEY_CONCURRENT': 'canlii:concurrent',
    'REDIS_KEY_DAILY_COUNT': 'canlii:daily_count',
    'REDIS_KEY_DAILY_RESET': 'canlii:daily_reset',
    'REFILL_RATE': 2,
    'MAX_TOKENS': 2,
}


class CanLIIRateLimiterViewSet(viewsets.ViewSet):
    """
    ViewSet for canlii-rate-limiter operations.

    Server-side rate limiting for CanLII API compliance using Django cache (Redis).
    - Token bucket algorithm: 2 req/s burst
    - 1 concurrent request max
    - 5000 requests/day hard cap
    - FAIL CLOSED: blocks when limits exceeded

    Endpoints:
    - GET  /api/services/canlii-rate-limiter/config/         -- Current rate-limit config
    - GET  /api/services/canlii-rate-limiter/stats/           -- Live stats
    - POST /api/services/canlii-rate-limiter/check/           -- Check if allowed
    - POST /api/services/canlii-rate-limiter/acquire/         -- Acquire slot
    - POST /api/services/canlii-rate-limiter/release/         -- Release concurrent slot
    - POST /api/services/canlii-rate-limiter/reset_daily/     -- Admin reset
    - GET  /api/services/canlii-rate-limiter/daily_quotas/    -- Historical quotas
    - GET  /api/services/canlii-rate-limiter/request_log/     -- Recent request log
    """

    permission_classes = [IsAuthenticated]

    # ----------------------------------------------------------
    # helpers
    # ----------------------------------------------------------

    def _refill_tokens(self):
        """Refill token bucket based on elapsed time."""
        now = time.time()
        last_refill = cache.get('canlii:last_refill', now)
        tokens = cache.get(RATE_LIMITS['REDIS_KEY_TOKENS'], float(RATE_LIMITS['MAX_TOKENS']))
        elapsed = now - last_refill
        tokens = min(RATE_LIMITS['MAX_TOKENS'], tokens + elapsed * RATE_LIMITS['REFILL_RATE'])
        cache.set(RATE_LIMITS['REDIS_KEY_TOKENS'], tokens, timeout=None)
        cache.set('canlii:last_refill', now, timeout=None)
        return tokens

    def _get_daily_used(self):
        return cache.get(RATE_LIMITS['REDIS_KEY_DAILY_COUNT'], 0)

    def _get_concurrent(self):
        return cache.get(RATE_LIMITS['REDIS_KEY_CONCURRENT'], 0)

    def _check_all_limits(self):
        """Run all three limit checks. Returns (allowed, result_dict)."""
        tokens = self._refill_tokens()
        daily_used = self._get_daily_used()
        concurrent = self._get_concurrent()

        # Daily check
        if daily_used >= RATE_LIMITS['DAILY_LIMIT']:
            reset_ts = cache.get(RATE_LIMITS['REDIS_KEY_DAILY_RESET'])
            retry = 86400
            if reset_ts:
                retry = max(1, int(reset_ts - time.time()))
            return False, {
                'allowed': False,
                'reason': f"Daily limit exceeded ({RATE_LIMITS['DAILY_LIMIT']} requests/day)",
                'retryAfter': retry,
                'dailyUsed': daily_used,
                'dailyLimit': RATE_LIMITS['DAILY_LIMIT'],
            }

        # Concurrent check
        if concurrent >= RATE_LIMITS['MAX_CONCURRENT']:
            return False, {
                'allowed': False,
                'reason': f"Concurrent limit exceeded (max {RATE_LIMITS['MAX_CONCURRENT']})",
                'retryAfter': 1,
            }

        # Token bucket check
        if tokens < 1:
            retry = math.ceil((1 - tokens) / RATE_LIMITS['REFILL_RATE'])
            return False, {
                'allowed': False,
                'reason': f"Rate limit exceeded ({RATE_LIMITS['REQUESTS_PER_SECOND']} requests/second)",
                'retryAfter': retry,
                'currentTokens': round(tokens, 3),
            }

        return True, {
            'allowed': True,
            'currentTokens': round(tokens, 3),
            'dailyUsed': daily_used,
            'dailyLimit': RATE_LIMITS['DAILY_LIMIT'],
            'concurrent': concurrent,
        }

    # ----------------------------------------------------------
    # endpoints
    # ----------------------------------------------------------

    @action(detail=False, methods=['get'])
    def config(self, request):
        """
        Current rate-limit configuration.
        GET /api/services/canlii-rate-limiter/config/
        """
        return Response({
            'requestsPerSecond': RATE_LIMITS['REQUESTS_PER_SECOND'],
            'maxConcurrent': RATE_LIMITS['MAX_CONCURRENT'],
            'dailyLimit': RATE_LIMITS['DAILY_LIMIT'],
            'refillRate': RATE_LIMITS['REFILL_RATE'],
            'maxTokens': RATE_LIMITS['MAX_TOKENS'],
        })

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Live rate-limit stats.
        GET /api/services/canlii-rate-limiter/stats/
        """
        tokens = self._refill_tokens()
        daily_used = self._get_daily_used()
        concurrent = self._get_concurrent()
        reset_ts = cache.get(RATE_LIMITS['REDIS_KEY_DAILY_RESET'])
        return Response({
            'currentTokens': round(tokens, 3),
            'concurrentRequests': concurrent,
            'dailyUsed': daily_used,
            'dailyLimit': RATE_LIMITS['DAILY_LIMIT'],
            'dailyResetAt': timezone.datetime.fromtimestamp(reset_ts).isoformat() if reset_ts else None,
        })

    @action(detail=False, methods=['post'])
    def check(self, request):
        """
        Check if a request is allowed (does NOT consume tokens).
        POST /api/services/canlii-rate-limiter/check/
        """
        allowed, result = self._check_all_limits()
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def acquire(self, request):
        """
        Acquire rate-limit slot: consume token, incr concurrent and daily.
        POST /api/services/canlii-rate-limiter/acquire/
        """
        try:
            allowed, result = self._check_all_limits()
            if not allowed:
                return Response(result, status=status.HTTP_429_TOO_MANY_REQUESTS)

            # Consume token
            tokens = cache.get(RATE_LIMITS['REDIS_KEY_TOKENS'], float(RATE_LIMITS['MAX_TOKENS']))
            cache.set(RATE_LIMITS['REDIS_KEY_TOKENS'], max(0, tokens - 1), timeout=None)

            # Increment concurrent
            new_concurrent = (cache.get(RATE_LIMITS['REDIS_KEY_CONCURRENT'], 0) or 0) + 1
            cache.set(RATE_LIMITS['REDIS_KEY_CONCURRENT'], new_concurrent, timeout=None)

            # Increment daily
            daily = (cache.get(RATE_LIMITS['REDIS_KEY_DAILY_COUNT'], 0) or 0) + 1
            cache.set(RATE_LIMITS['REDIS_KEY_DAILY_COUNT'], daily, timeout=None)

            # Set daily reset if first request
            if daily == 1:
                tomorrow = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0) + timezone.timedelta(days=1)
                cache.set(RATE_LIMITS['REDIS_KEY_DAILY_RESET'], tomorrow.timestamp(), timeout=None)

            # Record in DB
            CanliiApiRequests.objects.create(
                organization_id=getattr(request.user, 'organization_id', None),
                ingestion_run_id=request.data.get('ingestionRunId'),
                response_time_ms=0,
                success=True,
                rate_limited=False,
            )

            logger.info('CanLII rate limit acquired', extra={
                'daily_used': daily,
                'daily_limit': RATE_LIMITS['DAILY_LIMIT'],
            })

            return Response({
                'allowed': True,
                'dailyUsed': daily,
                'dailyLimit': RATE_LIMITS['DAILY_LIMIT'],
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f'acquire failed: {e}', exc_info=True)
            return Response({
                'allowed': False,
                'reason': 'Failed to acquire limit',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def release(self, request):
        """
        Release concurrent slot after request completes.
        POST /api/services/canlii-rate-limiter/release/
        """
        try:
            current = cache.get(RATE_LIMITS['REDIS_KEY_CONCURRENT'], 0) or 0
            cache.set(RATE_LIMITS['REDIS_KEY_CONCURRENT'], max(0, current - 1), timeout=None)

            logger.info('CanLII rate limit released')

            return Response({'status': 'released'}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f'release failed: {e}', exc_info=True)
            return Response({
                'error': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def reset_daily(self, request):
        """
        Admin: reset daily counter. Requires staff/superuser.
        POST /api/services/canlii-rate-limiter/reset_daily/
        """
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

        try:
            cache.set(RATE_LIMITS['REDIS_KEY_DAILY_COUNT'], 0, timeout=None)
            cache.delete(RATE_LIMITS['REDIS_KEY_DAILY_RESET'])

            # Snapshot to DB
            today = timezone.now().date()
            CanliiDailyQuotas.objects.update_or_create(
                date=today,
                defaults={
                    'successful_requests': 0,
                    'failed_requests': 0,
                    'rate_limited_requests': 0,
                    'limit_exceeded': False,
                    'peak_requests_per_second': 0,
                    'successful_runs': 0,
                    'failed_runs': 0,
                    'organization_id': getattr(request.user, 'organization_id', None),
                },
            )

            AuditLogs.objects.create(
                organization_id=getattr(request.user, 'organization_id', None),
                action='reset_daily',
                resource_type='CanLIIRateLimiter',
                resource_id='daily_counter',
                user_id=str(request.user.id),
                details={'reset_at': timezone.now().isoformat()},
            )

            return Response({
                'status': 'daily_counter_reset',
                'resetAt': timezone.now().isoformat(),
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f'reset_daily failed: {e}', exc_info=True)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def daily_quotas(self, request):
        """
        Historical daily quota records.
        GET /api/services/canlii-rate-limiter/daily_quotas/
        """
        try:
            days = int(request.query_params.get('days', 30))
            cutoff = timezone.now() - timezone.timedelta(days=days)
            qs = CanliiDailyQuotas.objects.filter(
                created_at__gte=cutoff,
            ).order_by('-date')[:days]

            results = []
            for q in qs:
                results.append({
                    'id': str(q.id),
                    'date': q.date.isoformat() if q.date else None,
                    'successfulRequests': q.successful_requests,
                    'failedRequests': q.failed_requests,
                    'rateLimitedRequests': q.rate_limited_requests,
                    'limitExceeded': q.limit_exceeded,
                    'limitExceededAt': q.limit_exceeded_at.isoformat() if q.limit_exceeded_at else None,
                    'peakRequestsPerSecond': float(q.peak_requests_per_second) if q.peak_requests_per_second else 0,
                    'successfulRuns': q.successful_runs,
                    'failedRuns': q.failed_runs,
                    'createdAt': q.created_at.isoformat() if q.created_at else None,
                })

            return Response({
                'count': len(results),
                'results': results,
            })

        except Exception as e:
            logger.error(f'daily_quotas failed: {e}', exc_info=True)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def request_log(self, request):
        """
        Recent CanLII API request log.
        GET /api/services/canlii-rate-limiter/request_log/
        """
        try:
            limit = int(request.query_params.get('limit', 100))
            qs = CanliiApiRequests.objects.order_by('-created_at')[:limit]

            results = []
            for r in qs:
                results.append({
                    'id': str(r.id),
                    'ingestionRunId': str(r.ingestion_run_id) if r.ingestion_run_id else None,
                    'responseTimeMs': r.response_time_ms,
                    'success': r.success,
                    'rateLimited': r.rate_limited,
                    'retryAfterSeconds': r.retry_after_seconds,
                    'createdAt': r.created_at.isoformat() if r.created_at else None,
                })

            return Response({
                'count': len(results),
                'results': results,
            })

        except Exception as e:
            logger.error(f'request_log failed: {e}', exc_info=True)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
