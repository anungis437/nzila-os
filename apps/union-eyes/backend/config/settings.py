"""
Django settings for UnionEyes
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env.local first (gitignored secrets), then .env (committed defaults).
# python-dotenv override=False means the first file to set a var wins.
load_dotenv(BASE_DIR / ".env.local")
load_dotenv(BASE_DIR / ".env")

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "django-insecure-CHANGE-ME-IN-PRODUCTION"
)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get("DJANGO_DEBUG", "False").lower() in ("true", "1", "yes")

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party apps
    "rest_framework",
    "corsheaders",
    "django_filters",
    # Celery result / beat storage
    "django_celery_beat",
    "django_celery_results",
    # Local apps
    "apps",
    "ai_core",
    "analytics",
    "auth_core",
    "bargaining",
    "billing",
    "compliance",
    "content",
    "core",
    "exit_interviews",
    "grievances",
    "notifications",
    "unions",
    "services",  # API endpoints for frontend migration
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "auth_core.middleware.OIDCJWTMiddleware",
    "auth_core.middleware.OrganizationIsolationMiddleware",
    "auth_core.middleware.AuditLogMiddleware",
    # Enterprise hardening middleware
    "middleware.rate_limiter.RateLimitMiddleware",
    "middleware.request_signing.RequestSigningMiddleware",
    "observability.middleware.ObservabilityMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("PGDATABASE", "nzila_union_eyes"),
        "USER": os.environ.get("PGUSER", "postgres"),
        "PASSWORD": os.environ.get("PGPASSWORD", "postgres"),
        "HOST": os.environ.get("PGHOST", "localhost"),
        "PORT": os.environ.get("PGPORT", "5432"),
        # Persistent connections — reuse for 10 min instead of per-request open/close.
        # PgBouncer on Azure Flexible Server handles the real pool (5000 client conns).
        "CONN_MAX_AGE": int(os.environ.get("CONN_MAX_AGE", "600")),
        "CONN_HEALTH_CHECKS": True,
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Authentication — OIDC (Entra External ID / Clerk)
AUTH_JWKS_URL = os.environ.get("AUTH_JWKS_URL") or os.environ.get("CLERK_JWKS_URL")
AUTH_SECRET = os.environ.get("AUTH_SECRET") or os.environ.get("CLERK_SECRET_KEY")
AUTH_WEBHOOK_SECRET = os.environ.get("AUTH_WEBHOOK_SECRET") or os.environ.get(
    "CLERK_WEBHOOK_SECRET"
)

# Legacy env var names (backward compat)
CLERK_JWKS_URL = AUTH_JWKS_URL
CLERK_SECRET_KEY = AUTH_SECRET
CLERK_PUBLISHABLE_KEY = os.environ.get("CLERK_PUBLISHABLE_KEY")
CLERK_WEBHOOK_SECRET = AUTH_WEBHOOK_SECRET

REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/1")

# Upstash REST credentials (optional, parallel path to native RESP). When
# both are set, the deep health check pings Upstash over HTTPS as an
# independent verification of the REST token — useful during token
# rotation where the native URL is rebuilt from the same token.
UPSTASH_REDIS_REST_URL = os.environ.get("UPSTASH_REDIS_REST_URL", "")
UPSTASH_REDIS_REST_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")


def _redis_db(url: str, db: int) -> str:
    """Return url with the database number replaced (handles ip addresses safely)."""
    import re

    return re.sub(r"/(\d+)$", f"/{db}", url)


# Redis Cache — uses django-redis for full feature set (TTL, delete by pattern, etc.)
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SOCKET_CONNECT_TIMEOUT": 5,
            "SOCKET_TIMEOUT": 5,
            "CONNECTION_POOL_KWARGS": {"max_connections": 50},
            "IGNORE_EXCEPTIONS": True,  # Degrade gracefully if Redis unreachable
        },
        "KEY_PREFIX": "ue",
        "TIMEOUT": 3600,  # 1 hour default
    }
}

# Sessions — store in Redis so they survive worker restarts
SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"

# REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "auth_core.authentication.OIDCAuthentication",
        "auth_core.authentication.APIKeyAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}

# ---------------------------------------------------------------------------
# Celery — Redis broker + result backend
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", _redis_db(REDIS_URL, 0))
# Results stored in Django DB via django-celery-results; override with env var for Redis.
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "django-db")
CELERY_CACHE_BACKEND = "default"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 min hard limit
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 min soft limit
CELERY_WORKER_PREFETCH_MULTIPLIER = 1  # Fair scheduling
CELERY_TASK_ACKS_LATE = True  # Re-queue on worker crash
CELERY_TASK_REJECT_ON_WORKER_LOST = True  # Prevent duplicate execution on crash
CELERY_BROKER_TRANSPORT_OPTIONS = {"visibility_timeout": 3600}

# ---------------------------------------------------------------------------
# Queue routing — mirrors the 6 BullMQ queues
# ---------------------------------------------------------------------------
from kombu import Queue  # noqa: E402

CELERY_TASK_QUEUES = (
    Queue("email"),
    Queue("sms"),
    Queue("notifications"),
    Queue("reports"),
    Queue("cleanup"),
    Queue("billing"),
    # Enterprise hardening queues
    Queue("integration_queue"),
    Queue("integration_retry_queue"),
    Queue("integration_dead_letter_queue"),
)
CELERY_TASK_DEFAULT_QUEUE = "notifications"
CELERY_TASK_ROUTES = {
    "notifications.tasks.send_email_task": {"queue": "email"},
    "notifications.tasks.send_email_digest_task": {"queue": "email"},
    "notifications.tasks.send_sms_task": {"queue": "sms"},
    "notifications.tasks.send_notification_task": {"queue": "notifications"},
    "analytics.tasks.generate_report_task": {"queue": "reports"},
    "core.tasks.cleanup_task": {"queue": "cleanup"},
    "billing.tasks.run_billing_scheduler_task": {"queue": "billing"},
    "billing.tasks.send_dues_reminders_task": {"queue": "billing"},
    "billing.tasks.retry_failed_payments_task": {"queue": "billing"},
    # Integration control plane
    "services.integration_control_plane.tasks.dispatch_integration": {
        "queue": "integration_queue"
    },
    "services.integration_control_plane.tasks.retry_integration": {
        "queue": "integration_retry_queue"
    },
    "services.integration_control_plane.tasks.send_to_dead_letter": {
        "queue": "integration_dead_letter_queue"
    },
    # Audit logging
    "auth_core.tasks.log_audit_event": {"queue": "notifications"},
    # Event bus
    "services.events.tasks.process_event_task": {"queue": "notifications"},
    # Compliance snapshots
    "compliance_snapshot.capture_daily": {"queue": "reports"},
    "compliance_snapshot.capture_monthly": {"queue": "reports"},
    "compliance_snapshot.capture_quarterly": {"queue": "reports"},
    "compliance_snapshot.capture_on_demand": {"queue": "reports"},
}

# ---------------------------------------------------------------------------
# Celery Beat — periodic tasks (replaces BullMQ repeat jobs)
# ---------------------------------------------------------------------------
from celery.schedules import crontab  # noqa: E402

CELERY_BEAT_SCHEDULE = {
    # ---------- email digest (was: scheduleEmailDigest) -------------------
    "daily-email-digest": {
        "task": "notifications.tasks.send_email_digest_task",
        "schedule": crontab(hour=8, minute=0),  # 0 8 * * *
        "args": ("daily",),
    },
    "weekly-email-digest": {
        "task": "notifications.tasks.send_email_digest_task",
        "schedule": crontab(hour=8, minute=0, day_of_week=1),  # 0 8 * * 1
        "args": ("weekly",),
    },
    # ---------- cleanup (was: scheduleCleanupJobs) -------------------------
    "daily-cleanup-logs": {
        "task": "core.tasks.cleanup_task",
        "schedule": crontab(hour=2, minute=0),  # 0 2 * * *
        "kwargs": {"target": "logs", "older_than_days": 30},
    },
    "weekly-cleanup-exports": {
        "task": "core.tasks.cleanup_task",
        "schedule": crontab(hour=3, minute=0, day_of_week=0),  # 0 3 * * 0
        "kwargs": {"target": "exports", "older_than_days": 7},
    },
    "weekly-cleanup-sessions": {
        "task": "core.tasks.cleanup_task",
        "schedule": crontab(hour=3, minute=30, day_of_week=0),
        "kwargs": {"target": "sessions", "older_than_days": 90},
    },
    # ---------- billing scheduler (was: BillingScheduler) ------------------
    "monthly-billing": {
        "task": "billing.tasks.run_billing_scheduler_task",
        "schedule": crontab(hour=0, minute=0, day_of_month=1),  # 0 0 1 * *
        "args": ("monthly",),
    },
    "weekly-billing": {
        "task": "billing.tasks.run_billing_scheduler_task",
        "schedule": crontab(hour=0, minute=0, day_of_week=1),  # 0 0 * * 1
        "args": ("weekly",),
    },
    # ---------- dues reminders (was: DuesReminderScheduler) ----------------
    "daily-dues-reminders": {
        "task": "billing.tasks.send_dues_reminders_task",
        "schedule": crontab(hour=9, minute=0),  # 0 9 * * *
    },
    # ---------- failed payment retry (was: FailedPaymentRetryService) ------
    "daily-failed-payment-retry": {
        "task": "billing.tasks.retry_failed_payments_task",
        "schedule": crontab(hour=6, minute=0),  # 0 6 * * *
    },
    # ---------- compliance snapshots (enterprise hardening) ----------------
    "daily-compliance-snapshot": {
        "task": "compliance_snapshot.capture_daily",
        "schedule": crontab(hour=1, minute=0),  # 0 1 * * *
    },
    "monthly-compliance-snapshot": {
        "task": "compliance_snapshot.capture_monthly",
        "schedule": crontab(hour=1, minute=30, day_of_month=1),  # 30 1 1 * *
    },
    "quarterly-compliance-snapshot": {
        "task": "compliance_snapshot.capture_quarterly",
        "schedule": crontab(hour=2, minute=0, day_of_month=1, month_of_year="1,4,7,10"),
    },
}

# CORS
CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004",
).split(",")
CORS_ALLOW_CREDENTIALS = True

# Logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
        "json": {
            "()": "observability.logging.StructuredJsonFormatter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
        "json_console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "integration_control_plane": {
            "handlers": ["json_console"],
            "level": "INFO",
            "propagate": False,
        },
        "events": {"handlers": ["json_console"], "level": "INFO", "propagate": False},
        "observability": {
            "handlers": ["json_console"],
            "level": "INFO",
            "propagate": False,
        },
        "evidence_pack": {
            "handlers": ["json_console"],
            "level": "INFO",
            "propagate": False,
        },
        "compliance_snapshot": {
            "handlers": ["json_console"],
            "level": "INFO",
            "propagate": False,
        },
        "webhook_verification": {
            "handlers": ["json_console"],
            "level": "WARNING",
            "propagate": False,
        },
        "rate_limiter": {
            "handlers": ["json_console"],
            "level": "WARNING",
            "propagate": False,
        },
        "request_signing": {
            "handlers": ["json_console"],
            "level": "WARNING",
            "propagate": False,
        },
        "break_glass": {
            "handlers": ["json_console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

# Webhook / signing configuration
WEBHOOK_DEFAULT_SECRET = os.environ.get("WEBHOOK_DEFAULT_SECRET", SECRET_KEY)
REQUEST_SIGNING_SECRET = os.environ.get("REQUEST_SIGNING_SECRET", SECRET_KEY)
