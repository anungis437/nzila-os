"""
Django settings for Zonga backend.

Zonga is a music & content platform within the Nzila OS monorepo.
Database is shared with the platform (nzila_automation) — Drizzle owns
platform tables, Django owns domain-specific models.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-zonga-dev-key-change-in-production",
)

DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() in ("true", "1", "yes")

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

# =============================================================================
# Application definition
# =============================================================================

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    "django_filters",
    "django_celery_beat",
    "django_celery_results",
    # Local apps
    "core",
    "auth_core",
    "catalog",
    "creators",
    "events",
    "moderation",
    "payouts",
    "revenue",
    "rights",
    "subscriptions",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
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

# =============================================================================
# Database — shared with platform (Drizzle ORM owns platform tables)
# =============================================================================

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("PGDATABASE", "nzila_automation"),
        "USER": os.environ.get("PGUSER", "nzila"),
        "PASSWORD": os.environ.get("PGPASSWORD", "nzila_dev"),
        "HOST": os.environ.get("PGHOST", "localhost"),
        "PORT": os.environ.get("PGPORT", "5433"),
    }
}

# =============================================================================
# Cache — Redis
# =============================================================================

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.environ.get("REDIS_URL", "redis://localhost:6379/2"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
        "KEY_PREFIX": "zonga",
        "TIMEOUT": 3600,
    }
}

# =============================================================================
# Password validation
# =============================================================================

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# =============================================================================
# Internationalization
# =============================================================================

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# =============================================================================
# Static files
# =============================================================================

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# =============================================================================
# REST Framework
# =============================================================================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "auth_core.authentication.OIDCAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}

# =============================================================================
# CORS
# =============================================================================

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3006",  # Zonga Next.js frontend
    "http://localhost:3000",  # Platform web
]

CORS_ALLOW_CREDENTIALS = True

# =============================================================================
# Authentication — OIDC (Entra External ID / Clerk)
# =============================================================================

AUTH_JWKS_URL = os.environ.get("AUTH_JWKS_URL") or os.environ.get("CLERK_JWKS_URL", "")
AUTH_SECRET = os.environ.get("AUTH_SECRET") or os.environ.get("CLERK_SECRET_KEY", "")
CLERK_PUBLISHABLE_KEY = os.environ.get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "")
AUTH_WEBHOOK_SECRET = os.environ.get("AUTH_WEBHOOK_SECRET") or os.environ.get("CLERK_WEBHOOK_SECRET", "")

# Legacy env var names (backward compat)
CLERK_JWKS_URL = AUTH_JWKS_URL
CLERK_SECRET_KEY = AUTH_SECRET
CLERK_WEBHOOK_SECRET = AUTH_WEBHOOK_SECRET

# =============================================================================
# Celery
# =============================================================================

CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/3")
CELERY_RESULT_BACKEND = "django-db"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"

CELERY_TASK_ROUTES = {
    "payouts.tasks.*": {"queue": "payouts"},
    "revenue.tasks.*": {"queue": "revenue"},
    "catalog.tasks.*": {"queue": "catalog"},
    "moderation.tasks.*": {"queue": "moderation"},
    "notifications.tasks.*": {"queue": "notifications"},
}

# =============================================================================
# Logging
# =============================================================================

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "format": '{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": os.environ.get("DJANGO_LOG_LEVEL", "INFO"),
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "zonga": {"handlers": ["console"], "level": "DEBUG", "propagate": False},
    },
}
