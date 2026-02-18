#!/usr/bin/env python3
"""
Scaffold Populator — Generates production-ready project structures
for the Nzila Backbone and vertical app repos.

Populates:
- tech-repo-scaffold/django-backbone/
- tech-repo-scaffold/ci-cd/
- tech-repo-scaffold/infra-as-code/
- tech-repo-scaffold/vertical-apps/
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime

try:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from logging_config import MigrationLogger
    logger = MigrationLogger.get_logger(__name__)
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)


@dataclass
class ScaffoldConfig:
    """Configuration for scaffold generation"""
    product_name: str
    repo_name: str
    owner: str = "anungis437"
    azure_region: str = "canadacentral"
    auth_provider: str = "clerk"
    db_provider: str = "azure-postgresql"
    python_version: str = "3.12"
    node_version: str = "20"
    next_version: str = "15"
    django_version: str = "5.1"


class ScaffoldPopulator:
    """Generates production-ready scaffold structures"""

    def __init__(self, scaffold_root: Path):
        self.scaffold_root = Path(scaffold_root)
        self.generated_files: List[str] = []

    # ──────────────────────────────────────────────
    # Django Backbone Scaffold
    # ──────────────────────────────────────────────

    def populate_django_backbone(self, config: ScaffoldConfig) -> List[str]:
        """Generate the Django backbone project scaffold"""
        base = self.scaffold_root / "django-backbone"
        base.mkdir(parents=True, exist_ok=True)

        files = {}

        # manage.py
        files["manage.py"] = '''#!/usr/bin/env python
"""Django management script."""
import os
import sys

def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)

if __name__ == "__main__":
    main()
'''

        # pyproject.toml
        files["pyproject.toml"] = f'''[project]
name = "{config.repo_name}"
version = "0.1.0"
description = "Nzila Backbone Platform — Multi-tenant SaaS infrastructure"
requires-python = ">={config.python_version}"

[tool.pytest.ini_options]
DJANGO_SETTINGS_MODULE = "config.settings.test"
python_files = ["test_*.py"]
addopts = "-v --tb=short --cov=apps --cov-report=html"

[tool.black]
line-length = 100
target-version = ["py312"]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.mypy]
python_version = "{config.python_version}"
strict = true
plugins = ["mypy_django_plugin.main"]

[tool.django-stubs]
django_settings_module = "config.settings.development"
'''

        # Settings
        files["config/__init__.py"] = ""
        files["config/settings/__init__.py"] = ""

        files["config/settings/base.py"] = f'''"""
Base Django settings for Nzila Backbone Platform.
Shared across all environments.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "change-me-in-production")

INSTALLED_APPS = [
    # Django core
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
    "drf_spectacular",
    "django_extensions",
    "health_check",
    "health_check.db",
    "health_check.cache",
    # Backbone apps
    "apps.auth_core",
    "apps.billing",
    "apps.ai_core",
    "apps.analytics",
    "apps.compliance",
    "apps.notifications",
    "apps.integrations",
    "apps.content",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.auth_core.middleware.ClerkJWTMiddleware",
    "apps.compliance.middleware.AuditMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Database — Azure PostgreSQL
DATABASES = {{
    "default": {{
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("PGDATABASE", "nzila_platform"),
        "USER": os.environ.get("PGUSER", "nzilaadmin"),
        "PASSWORD": os.environ.get("PGPASSWORD", ""),
        "HOST": os.environ.get("PGHOST", "localhost"),
        "PORT": os.environ.get("PGPORT", "5432"),
        "OPTIONS": {{
            "sslmode": os.environ.get("PGSSLMODE", "prefer"),
        }},
    }}
}}

# Cache — Azure Redis
CACHES = {{
    "default": {{
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
        "OPTIONS": {{
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }},
    }}
}}

# REST Framework
REST_FRAMEWORK = {{
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.auth_core.authentication.ClerkAuthentication",
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
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {{
        "anon": "100/hour",
        "user": "1000/hour",
    }},
}}

# OpenAPI / Swagger
SPECTACULAR_SETTINGS = {{
    "TITLE": "Nzila Backbone API",
    "DESCRIPTION": "Multi-tenant SaaS platform API for Nzila verticals",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}}

# Auth — Clerk
CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY", "")
CLERK_PUBLISHABLE_KEY = os.environ.get("CLERK_PUBLISHABLE_KEY", "")
CLERK_JWKS_URL = os.environ.get("CLERK_JWKS_URL", "")

# Static files
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/Toronto"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
'''

        files["config/settings/development.py"] = '''"""Development settings."""
from .base import *  # noqa: F401, F403

DEBUG = True
ALLOWED_HOSTS = ["*"]
CORS_ALLOW_ALL_ORIGINS = True

# Debug toolbar
INSTALLED_APPS += ["debug_toolbar"]  # noqa: F405
MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")  # noqa: F405
INTERNAL_IPS = ["127.0.0.1"]
'''

        files["config/settings/staging.py"] = '''"""Staging settings."""
from .base import *  # noqa: F401, F403
import os

DEBUG = False
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "").split(",")
CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ORIGINS", "").split(",")

# Security
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 3600
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
'''

        files["config/settings/production.py"] = '''"""Production settings."""
from .base import *  # noqa: F401, F403
import os
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

DEBUG = False
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "").split(",")
CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ORIGINS", "").split(",")

# Sentry
sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN", ""),
    integrations=[DjangoIntegration()],
    traces_sample_rate=0.1,
    profiles_sample_rate=0.1,
    send_default_pii=False,
)

# Security
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
'''

        files["config/settings/test.py"] = '''"""Test settings."""
from .base import *  # noqa: F401, F403

DEBUG = False
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "test_nzila_platform",
        "USER": "postgres",
        "PASSWORD": "postgres",
        "HOST": "localhost",
        "PORT": "5432",
    }
}
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
'''

        files["config/urls.py"] = '''"""URL configuration for Nzila Backbone Platform."""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    # Admin
    path("admin/", admin.site.urls),
    # API v1
    path("api/v1/auth/", include("apps.auth_core.urls")),
    path("api/v1/billing/", include("apps.billing.urls")),
    path("api/v1/ai/", include("apps.ai_core.urls")),
    path("api/v1/analytics/", include("apps.analytics.urls")),
    path("api/v1/compliance/", include("apps.compliance.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/integrations/", include("apps.integrations.urls")),
    path("api/v1/content/", include("apps.content.urls")),
    # Health checks
    path("healthz/", include("health_check.urls")),
    # OpenAPI
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
'''

        files["config/wsgi.py"] = '''"""WSGI config."""
import os
from django.core.wsgi import get_wsgi_application
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
application = get_wsgi_application()
'''

        files["config/asgi.py"] = '''"""ASGI config."""
import os
from django.core.asgi import get_asgi_application
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
application = get_asgi_application()
'''

        # Requirements
        files["requirements/base.txt"] = f"""# Nzila Backbone — Core Dependencies
Django>={config.django_version},<5.2
djangorestframework>=3.15
django-cors-headers>=4.3
django-filter>=24.0
django-extensions>=3.2
django-redis>=5.4
django-health-check>=3.18
drf-spectacular>=0.27
psycopg[binary]>=3.1
redis>=5.0
gunicorn>=22.0
uvicorn[standard]>=0.30
# Auth
PyJWT>=2.8
cryptography>=42.0
jwcrypto>=1.5
# AI
openai>=1.30
pgvector>=0.3
# Billing
stripe>=9.0
# Email
resend>=2.0
# Observability
sentry-sdk[django]>=2.0
opentelemetry-api>=1.24
opentelemetry-sdk>=1.24
opentelemetry-instrumentation-django>=0.45
# Utilities
python-dotenv>=1.0
celery[redis]>=5.3
pydantic>=2.7
"""

        files["requirements/development.txt"] = """# Development
-r base.txt
django-debug-toolbar>=4.3
ipython>=8.24
django-stubs>=5.0
"""

        files["requirements/test.txt"] = """# Testing
-r base.txt
pytest>=8.2
pytest-django>=4.8
pytest-cov>=5.0
pytest-asyncio>=0.23
factory-boy>=3.3
faker>=25.0
httpx>=0.27
"""

        files["requirements/production.txt"] = """# Production
-r base.txt
whitenoise>=6.6
"""

        # Backbone apps — __init__.py and apps.py for each
        backbone_apps = [
            "auth_core", "billing", "ai_core", "analytics",
            "compliance", "notifications", "integrations", "content"
        ]
        for app_name in backbone_apps:
            files[f"apps/{app_name}/__init__.py"] = ""
            files[f"apps/{app_name}/apps.py"] = f'''from django.apps import AppConfig

class {app_name.title().replace("_", "")}Config(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.{app_name}"
    verbose_name = "{app_name.replace("_", " ").title()}"
'''
            files[f"apps/{app_name}/models.py"] = f'"""Models for {app_name} backbone app."""\n'
            files[f"apps/{app_name}/views.py"] = f'"""Views for {app_name} backbone app."""\n'
            files[f"apps/{app_name}/serializers.py"] = f'"""Serializers for {app_name} backbone app."""\n'
            files[f"apps/{app_name}/urls.py"] = f'''from django.urls import path

app_name = "{app_name}"

urlpatterns = [
    # TODO: Add {app_name} API endpoints
]
'''
            files[f"apps/{app_name}/admin.py"] = f'"""Admin for {app_name}."""\nfrom django.contrib import admin  # noqa: F401\n'
            files[f"apps/{app_name}/tests/__init__.py"] = ""
            files[f"apps/{app_name}/tests/test_models.py"] = f'"""Tests for {app_name} models."""\n'
            files[f"apps/{app_name}/tests/test_views.py"] = f'"""Tests for {app_name} views."""\n'

        # Auth core specifics
        files["apps/auth_core/authentication.py"] = '''"""Clerk JWT authentication backend for Django REST Framework."""
import jwt
import requests
from django.conf import settings
from rest_framework import authentication, exceptions


class ClerkAuthentication(authentication.BaseAuthentication):
    """Authenticates requests using Clerk JWT tokens."""

    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return None

        token = auth_header[7:]
        try:
            # Fetch JWKS from Clerk
            jwks_url = settings.CLERK_JWKS_URL
            jwks_client = jwt.PyJWKClient(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)

            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                options={"verify_aud": False},
            )

            user = self._get_or_create_user(payload)
            return (user, payload)

        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed("Token expired")
        except jwt.InvalidTokenError as e:
            raise exceptions.AuthenticationFailed(f"Invalid token: {e}")

    def _get_or_create_user(self, payload):
        """Get or create Django user from Clerk JWT payload."""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        clerk_user_id = payload.get("sub", "")
        email = payload.get("email", "")

        user, _ = User.objects.get_or_create(
            username=clerk_user_id,
            defaults={"email": email, "is_active": True},
        )
        return user
'''

        files["apps/auth_core/middleware.py"] = '''"""Clerk JWT middleware for Django."""
from django.http import JsonResponse


class ClerkJWTMiddleware:
    """Middleware to attach Clerk user context to requests."""

    EXEMPT_PATHS = ["/healthz/", "/api/schema/", "/api/docs/", "/admin/"]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Skip auth for exempt paths
        if any(request.path.startswith(p) for p in self.EXEMPT_PATHS):
            return self.get_response(request)

        return self.get_response(request)
'''

        # Dockerfile
        files["Dockerfile"] = f'''FROM python:{config.python_version}-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    libpq-dev gcc && \\
    rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements/production.txt requirements/production.txt
COPY requirements/base.txt requirements/base.txt
RUN pip install --no-cache-dir -r requirements/production.txt

# Application code
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput || true

# Run with gunicorn
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "120"]
'''

        # docker-compose.yml
        files["docker-compose.yml"] = '''version: "3.8"

services:
  web:
    build: .
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - .:/app

  db:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_DB: nzila_platform
      POSTGRES_USER: nzilaadmin
      POSTGRES_PASSWORD: ${PGPASSWORD:-localdev123}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nzilaadmin -d nzila_platform"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 5

  celery:
    build: .
    command: celery -A config worker -l info
    env_file: .env
    depends_on:
      - db
      - redis

volumes:
  pgdata:
'''

        # .env.example
        files[".env.example"] = """# Django
DJANGO_SECRET_KEY=change-me-in-production
DJANGO_SETTINGS_MODULE=config.settings.development

# Database (Azure PostgreSQL)
PGDATABASE=nzila_platform
PGUSER=nzilaadmin
PGPASSWORD=
PGHOST=localhost
PGPORT=5432
PGSSLMODE=prefer

# Redis (Azure Redis Cache)
REDIS_URL=redis://localhost:6379/0

# Clerk Auth
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
CLERK_JWKS_URL=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=

# Azure OpenAI
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_DEPLOYMENT=

# Sentry
SENTRY_DSN=

# Resend (Email)
RESEND_API_KEY=
"""

        files["README.md"] = f"""# {config.product_name}

Django Backbone Platform — Multi-tenant SaaS infrastructure for Nzila verticals.

## Quick Start

```bash
# Clone and setup
cp .env.example .env
docker compose up -d

# Run migrations
docker compose exec web python manage.py migrate

# Create superuser
docker compose exec web python manage.py createsuperuser

# Access
# API: http://localhost:8000/api/docs/
# Admin: http://localhost:8000/admin/
# Health: http://localhost:8000/healthz/
```

## Architecture

- **Django {config.django_version}** with DRF for API
- **Azure PostgreSQL** with pgvector for AI embeddings
- **Azure Redis** for caching and Celery broker
- **Clerk** for authentication (JWT verification)
- **Stripe** for billing and subscriptions
- **Azure OpenAI** for AI features
- **Sentry** for error tracking
- **OpenTelemetry** for distributed tracing
"""

        # Write all files
        for filepath, content in files.items():
            full_path = base / filepath
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content, encoding="utf-8")
            self.generated_files.append(str(full_path))

        logger.info(f"Generated {len(files)} files in {base}")
        return list(files.keys())

    # ──────────────────────────────────────────────
    # CI/CD Templates
    # ──────────────────────────────────────────────

    def populate_cicd(self, config: ScaffoldConfig) -> List[str]:
        """Generate CI/CD workflow templates"""
        base = self.scaffold_root / "ci-cd" / "github-actions"
        base.mkdir(parents=True, exist_ok=True)

        files = {}

        files["ci-django.yml"] = f'''name: CI — Django Backend

on:
  push:
    branches: [main, develop]
    paths: ["backend/**"]
  pull_request:
    branches: [main]
    paths: ["backend/**"]

env:
  PYTHON_VERSION: "{config.python_version}"
  DJANGO_SETTINGS_MODULE: "config.settings.test"

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{{{ env.PYTHON_VERSION }}}}
      - run: pip install ruff black mypy
      - run: ruff check backend/
      - run: black --check backend/
      - run: mypy backend/ --ignore-missing-imports

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_DB: test_nzila_platform
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{{{ env.PYTHON_VERSION }}}}
      - run: pip install -r backend/requirements/test.txt
      - run: pytest backend/ --cov --cov-report=xml
        env:
          PGHOST: localhost
          PGUSER: postgres
          PGPASSWORD: postgres
          PGDATABASE: test_nzila_platform

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: backend/
          severity: HIGH,CRITICAL
'''

        files["ci-nextjs.yml"] = f'''name: CI — Next.js Frontend

on:
  push:
    branches: [main, develop]
    paths: ["frontend/**"]
  pull_request:
    branches: [main]
    paths: ["frontend/**"]

env:
  NODE_VERSION: "{config.node_version}"

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: ${{{{ env.NODE_VERSION }}}}
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
        working-directory: frontend
      - run: pnpm lint
        working-directory: frontend
      - run: pnpm typecheck
        working-directory: frontend

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: ${{{{ env.NODE_VERSION }}}}
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
        working-directory: frontend
      - run: pnpm test -- --coverage
        working-directory: frontend

  build:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: ${{{{ env.NODE_VERSION }}}}
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
        working-directory: frontend
      - run: pnpm build
        working-directory: frontend
'''

        files["cd-staging.yml"] = '''name: CD — Deploy to Staging

on:
  push:
    branches: [develop]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      - uses: azure/docker-login@v2
        with:
          login-server: ${{ vars.ACR_LOGIN_SERVER }}
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}
      - run: |
          docker build -t ${{ vars.ACR_LOGIN_SERVER }}/backend:${{ github.sha }} backend/
          docker push ${{ vars.ACR_LOGIN_SERVER }}/backend:${{ github.sha }}
      - name: Deploy to Container Apps
        uses: azure/container-apps-deploy-action@v2
        with:
          containerAppName: ${{ vars.CONTAINER_APP_NAME }}-backend
          resourceGroup: ${{ vars.RESOURCE_GROUP }}
          imageToDeploy: ${{ vars.ACR_LOGIN_SERVER }}/backend:${{ github.sha }}

  deploy-frontend:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      - uses: azure/docker-login@v2
        with:
          login-server: ${{ vars.ACR_LOGIN_SERVER }}
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}
      - run: |
          docker build -t ${{ vars.ACR_LOGIN_SERVER }}/frontend:${{ github.sha }} frontend/
          docker push ${{ vars.ACR_LOGIN_SERVER }}/frontend:${{ github.sha }}
      - name: Deploy to Container Apps
        uses: azure/container-apps-deploy-action@v2
        with:
          containerAppName: ${{ vars.CONTAINER_APP_NAME }}-frontend
          resourceGroup: ${{ vars.RESOURCE_GROUP }}
          imageToDeploy: ${{ vars.ACR_LOGIN_SERVER }}/frontend:${{ github.sha }}
'''

        files["cd-production.yml"] = '''name: CD — Deploy to Production

on:
  push:
    tags: ["v*"]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      - uses: azure/docker-login@v2
        with:
          login-server: ${{ vars.ACR_LOGIN_SERVER }}
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}
      - name: Build and push backend
        run: |
          docker build -t ${{ vars.ACR_LOGIN_SERVER }}/backend:${{ github.ref_name }} backend/
          docker push ${{ vars.ACR_LOGIN_SERVER }}/backend:${{ github.ref_name }}
      - name: Build and push frontend
        run: |
          docker build -t ${{ vars.ACR_LOGIN_SERVER }}/frontend:${{ github.ref_name }} frontend/
          docker push ${{ vars.ACR_LOGIN_SERVER }}/frontend:${{ github.ref_name }}
      - name: Deploy backend
        uses: azure/container-apps-deploy-action@v2
        with:
          containerAppName: ${{ vars.CONTAINER_APP_NAME }}-backend
          resourceGroup: ${{ vars.RESOURCE_GROUP }}
          imageToDeploy: ${{ vars.ACR_LOGIN_SERVER }}/backend:${{ github.ref_name }}
      - name: Deploy frontend
        uses: azure/container-apps-deploy-action@v2
        with:
          containerAppName: ${{ vars.CONTAINER_APP_NAME }}-frontend
          resourceGroup: ${{ vars.RESOURCE_GROUP }}
          imageToDeploy: ${{ vars.ACR_LOGIN_SERVER }}/frontend:${{ github.ref_name }}
'''

        files["security-scan.yml"] = '''name: Security Scan

on:
  schedule:
    - cron: "0 6 * * 1"  # Weekly Monday 6am UTC
  pull_request:
    branches: [main]

jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Trivy filesystem scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          severity: HIGH,CRITICAL
          exit-code: 1

  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
'''

        for filepath, content in files.items():
            full_path = base / filepath
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content, encoding="utf-8")
            self.generated_files.append(str(full_path))

        logger.info(f"Generated {len(files)} CI/CD templates in {base}")
        return list(files.keys())

    # ──────────────────────────────────────────────
    # Infrastructure as Code
    # ──────────────────────────────────────────────

    def populate_iac(self, config: ScaffoldConfig) -> List[str]:
        """Generate Azure Bicep IaC templates"""
        base = self.scaffold_root / "infra-as-code" / "bicep"
        base.mkdir(parents=True, exist_ok=True)

        files = {}

        files["main.bicep"] = f'''// Nzila Platform — Azure Infrastructure
// Orchestrates all resource deployments

targetScope = 'resourceGroup'

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Azure region')
param location string = '{config.azure_region}'

@description('Product name for resource naming')
param productName string

// ── Container Registry ──
module acr 'modules/container-registry.bicep' = {{
  name: 'acr-${{productName}}'
  params: {{
    name: 'acr${{productName}}${{environment}}'
    location: location
  }}
}}

// ── PostgreSQL ──
module postgres 'modules/postgres.bicep' = {{
  name: 'pg-${{productName}}'
  params: {{
    name: '${{productName}}-db-${{environment}}'
    location: location
    administratorLogin: 'nzilaadmin'
    administratorPassword: '' // Set via Key Vault
  }}
}}

// ── Redis Cache ──
module redis 'modules/redis.bicep' = {{
  name: 'redis-${{productName}}'
  params: {{
    name: '${{productName}}-cache-${{environment}}'
    location: location
  }}
}}

// ── Container Apps Environment ──
module containerEnv 'modules/container-app.bicep' = {{
  name: 'cae-${{productName}}'
  params: {{
    name: '${{productName}}-env-${{environment}}'
    location: location
    acrLoginServer: acr.outputs.loginServer
  }}
}}

// ── Key Vault ──
module keyVault 'modules/key-vault.bicep' = {{
  name: 'kv-${{productName}}'
  params: {{
    name: 'kv-${{productName}}-${{environment}}'
    location: location
  }}
}}

// ── Monitoring ──
module monitoring 'modules/monitoring.bicep' = {{
  name: 'mon-${{productName}}'
  params: {{
    name: '${{productName}}-insights-${{environment}}'
    location: location
  }}
}}
'''

        files["modules/postgres.bicep"] = '''// Azure PostgreSQL Flexible Server with pgvector
param name string
param location string
param administratorLogin string
@secure()
param administratorPassword string
param skuName string = 'Standard_B2s'
param tier string = 'Burstable'
param storageSizeGB int = 128
param version string = '15'

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: name
  location: location
  sku: {
    name: skuName
    tier: tier
  }
  properties: {
    version: version
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: {
      storageSizeGB: storageSizeGB
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// Enable required extensions
resource extensions 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-03-01-preview' = {
  parent: postgres
  name: 'azure.extensions'
  properties: {
    value: 'uuid-ossp,pgvector,pg_trgm'
    source: 'user-override'
  }
}

output id string = postgres.id
output fqdn string = postgres.properties.fullyQualifiedDomainName
'''

        files["modules/redis.bicep"] = '''// Azure Redis Cache
param name string
param location string
param skuName string = 'Basic'
param capacity int = 0

resource redis 'Microsoft.Cache/redis@2023-08-01' = {
  name: name
  location: location
  properties: {
    sku: {
      name: skuName
      family: 'C'
      capacity: capacity
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
  }
}

output id string = redis.id
output hostName string = redis.properties.hostName
output port int = redis.properties.sslPort
'''

        files["modules/container-app.bicep"] = '''// Azure Container Apps Environment
param name string
param location string
param acrLoginServer string

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${name}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: name
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

output id string = containerAppEnv.id
output defaultDomain string = containerAppEnv.properties.defaultDomain
'''

        files["modules/container-registry.bicep"] = '''// Azure Container Registry
param name string
param location string
param sku string = 'Basic'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: true
  }
}

output id string = acr.id
output loginServer string = acr.properties.loginServer
'''

        files["modules/key-vault.bicep"] = '''// Azure Key Vault
param name string
param location string

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

output id string = keyVault.id
output uri string = keyVault.properties.vaultUri
'''

        files["modules/monitoring.bicep"] = '''// Azure Application Insights + Log Analytics
param name string
param location string

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${name}-workspace'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: name
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

output instrumentationKey string = appInsights.properties.InstrumentationKey
output connectionString string = appInsights.properties.ConnectionString
'''

        # Parameter files
        params_dir = self.scaffold_root / "infra-as-code" / "bicep" / "parameters"
        params_dir.mkdir(parents=True, exist_ok=True)

        for env in ["dev", "staging", "prod"]:
            files[f"parameters/{env}.bicepparam"] = f'''using '../main.bicep'

param environment = '{env}'
param location = '{config.azure_region}'
param productName = 'nzila'
'''

        for filepath, content in files.items():
            full_path = base / filepath
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content, encoding="utf-8")
            self.generated_files.append(str(full_path))

        logger.info(f"Generated {len(files)} IaC templates in {base}")
        return list(files.keys())

    # ──────────────────────────────────────────────
    # Vertical App Template
    # ──────────────────────────────────────────────

    def populate_vertical_template(self, config: ScaffoldConfig) -> List[str]:
        """Generate a vertical app template structure"""
        base = self.scaffold_root / "vertical-apps" / "template"
        base.mkdir(parents=True, exist_ok=True)

        files = {}

        files["README.md"] = f"""# {{{{ product_name }}}} — Vertical App Template

This template creates a new vertical application repo with:
- **Frontend:** Next.js {config.next_version} (App Router) with Clerk auth
- **Backend:** Django {config.django_version} app connecting to Backbone API
- **Infra:** Azure Bicep modules
- **CI/CD:** GitHub Actions workflows

## Usage

```bash
python scaffold.py \\
  --product-name="My Product" \\
  --repo-name="nzila-my-product" \\
  --vertical="healthtech"
```
"""

        files["scaffold.py"] = '''#!/usr/bin/env python3
"""Vertical app scaffolding script."""
import argparse
import shutil
from pathlib import Path


def scaffold_vertical(product_name: str, repo_name: str, vertical: str):
    """Create a new vertical app from template."""
    target = Path.cwd() / repo_name
    target.mkdir(parents=True, exist_ok=True)

    # Copy frontend template
    # Copy backend template
    # Copy infra template
    # Copy CI/CD workflows

    print(f"Scaffolded {product_name} at {target}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--product-name", required=True)
    parser.add_argument("--repo-name", required=True)
    parser.add_argument("--vertical", required=True)
    args = parser.parse_args()
    scaffold_vertical(args.product_name, args.repo_name, args.vertical)
'''

        files["frontend/.gitkeep"] = ""
        files["backend/.gitkeep"] = ""

        for filepath, content in files.items():
            full_path = base / filepath
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content, encoding="utf-8")
            self.generated_files.append(str(full_path))

        logger.info(f"Generated {len(files)} vertical template files in {base}")
        return list(files.keys())

    # ──────────────────────────────────────────────
    # Full Scaffold Population
    # ──────────────────────────────────────────────

    def populate_all(self, config: ScaffoldConfig) -> Dict[str, List[str]]:
        """Populate all scaffold directories"""
        results = {
            "django_backbone": self.populate_django_backbone(config),
            "cicd": self.populate_cicd(config),
            "iac": self.populate_iac(config),
            "vertical_template": self.populate_vertical_template(config),
        }

        total = sum(len(v) for v in results.values())
        logger.info(f"Total scaffold files generated: {total}")

        return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Populate Nzila tech-repo-scaffold")
    parser.add_argument(
        "--scaffold-root",
        type=Path,
        default=Path(__file__).parent.parent.parent / "tech-repo-scaffold",
        help="Path to tech-repo-scaffold directory",
    )
    parser.add_argument("--product-name", default="Nzila Backbone Platform")
    parser.add_argument("--repo-name", default="nzila-platform")
    args = parser.parse_args()

    config = ScaffoldConfig(
        product_name=args.product_name,
        repo_name=args.repo_name,
    )

    populator = ScaffoldPopulator(args.scaffold_root)
    results = populator.populate_all(config)

    print("\n" + "=" * 60)
    print("SCAFFOLD POPULATION COMPLETE")
    print("=" * 60)
    for section, files in results.items():
        print(f"\n{section}: {len(files)} files")
        for f in files[:5]:
            print(f"  - {f}")
        if len(files) > 5:
            print(f"  ... and {len(files) - 5} more")
