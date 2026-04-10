# Django Settings Configuration for Clerk Authentication

## Add to your Django settings.py

```python
# ============================================================================
# CLERK AUTHENTICATION SETTINGS
# ============================================================================

# Clerk API Keys (get from https://dashboard.clerk.com)
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL", "https://YOUR_CLERK_DOMAIN/.well-known/jwks.json")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "sk_live_...")
CLERK_PUBLISHABLE_KEY = os.getenv("CLERK_PUBLISHABLE_KEY", "pk_live_...")
CLERK_WEBHOOK_SECRET = os.getenv("CLERK_WEBHOOK_SECRET", "whsec_...")

# Clerk Frontend Keys (for Next.js)
# Add these to your .env.local in frontend:
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
# CLERK_SECRET_KEY=sk_live_...


# ============================================================================
# REST FRAMEWORK AUTHENTICATION
# ============================================================================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.auth_core.authentication.ClerkAuthentication",         # Primary: Clerk JWT
        "apps.auth_core.authentication.ClerkAPIKeyAuthentication",   # Service accounts
        "rest_framework.authentication.SessionAuthentication",       # Admin panel (optional)
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",  # Require auth by default
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    "EXCEPTION_HANDLER": "apps.core.exceptions.custom_exception_handler",  # Optional
}


# ============================================================================
# MIDDLEWARE
# ============================================================================

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # Static files (production)
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",  # CORS for frontend
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    
    # Clerk auth middleware (add these)
    "apps.auth_core.middleware.ClerkJWTMiddleware",              # Attach Clerk context
    "apps.auth_core.middleware.OrganizationIsolationMiddleware", # Multi-tenant isolation
    "apps.auth_core.middleware.AuditLogMiddleware",              # Auth logging
]


# ============================================================================
# CORS SETTINGS (for Next.js frontend)
# ============================================================================

# Install: pip install django-cors-headers

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",  # Local Next.js dev server
    "http://localhost:3001",  # Alternative port
    "https://your-app.vercel.app",  # Production frontend
    "https://your-custom-domain.com",
]

CORS_ALLOW_CREDENTIALS = True  # Allow cookies/auth headers

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-clerk-secret-key",  # For service-to-service calls
]


# ============================================================================
# CSRF SETTINGS
# ============================================================================

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "https://your-app.vercel.app",
]

# For API-only backends, you can disable CSRF (if using JWT only)
# CSRF_COOKIE_SECURE = True  # Production only


# ============================================================================
# LOGGING
# ============================================================================

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "logs/django.log",
            "maxBytes": 1024 * 1024 * 10,  # 10 MB
            "backupCount": 5,
            "formatter": "verbose",
        },
    },
    "loggers": {
        "apps.auth_core": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "django": {
            "handlers": ["console"],
            "level": "INFO",
        },
    },
}


# ============================================================================
# CACHING (for JWT verification performance)
# ============================================================================

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": os.getenv("REDIS_URL", "redis://127.0.0.1:6379/1"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
        "KEY_PREFIX": "nzila",
        "TIMEOUT": 300,  # 5 minutes default
    }
}

# If Redis not available, use in-memory cache (dev only)
# CACHES = {
#     "default": {
#         "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
#         "LOCATION": "unique-cache",
#     }
# }


# ============================================================================
# CUSTOM USER MODEL (if needed)
# ============================================================================

# AUTH_USER_MODEL = "profiles.User"  # If you have custom User model


# ============================================================================
# SECURITY SETTINGS (production)
# ============================================================================

# SSL/HTTPS
SECURE_SSL_REDIRECT = os.getenv("DJANGO_SECURE_SSL_REDIRECT", "False") == "True"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# HSTS (HTTP Strict Transport Security)
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Cookies
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

# Content Security Policy (add django-csp if needed)
# CSP_DEFAULT_SRC = ("'self'",)
# CSP_SCRIPT_SRC = ("'self'", "https://clerk.your-domain.com")
```

---

## Environment Variables (.env file)

Create a `.env` file in your Django project root:

```bash
# Django
DEBUG=False
SECRET_KEY=your-django-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Clerk Authentication
CLERK_JWKS_URL=https://clerk.your-domain.com/.well-known/jwks.json
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# Redis (for caching)
REDIS_URL=redis://127.0.0.1:6379/1

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend.com

# Security
DJANGO_SECURE_SSL_REDIRECT=True  # Production only
```

---

## Install Dependencies

Add to `requirements.txt`:

```txt
# Core Django
Django>=5.0,<6.0
djangorestframework>=3.14,<4.0
django-cors-headers>=4.3,<5.0
psycopg2-binary>=2.9,<3.0

# Clerk JWT Authentication
PyJWT[crypto]>=2.8,<3.0
cryptography>=42.0,<43.0
requests>=2.31,<3.0

# Caching (optional but recommended)
redis>=5.0,<6.0
django-redis>=5.4,<6.0

# Environment variables
python-dotenv>=1.0,<2.0

# ASGI server (production)
uvicorn[standard]>=0.27,<1.0
gunicorn>=21.2,<22.0

# Monitoring (optional)
sentry-sdk>=1.40,<2.0
```

Install:
```bash
pip install -r requirements.txt
```

---

## URLs Configuration

Add to your main `urls.py`:

```python
from django.contrib import admin
from django.urls import path, include
from apps.auth_core import views as auth_views

urlpatterns = [
    path("admin/", admin.site.urls),
    
    # Health check
    path("healthz/", auth_views.health_check, name="health_check"),
    
    # Auth endpoints
    path("api/auth/me/", auth_views.me, name="auth_me"),
    
    # Clerk webhooks
    path("api/webhooks/clerk/", auth_views.clerk_webhook, name="clerk_webhook"),
    
    # Your app URLs
    path("api/", include("apps.your_app.urls")),
]
```

---

## Testing Authentication Locally

### 1. Start Django server
```bash
python manage.py runserver
```

### 2. Test with curl (get token from Clerk)
```bash
# Get JWT token from Clerk frontend first
TOKEN="your_clerk_jwt_token_here"

# Test /api/auth/me endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/auth/me/
```

### 3. Expected response
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "clerk_user_id": "user_2...",
  "organization": {
    "id": "org_2...",
    "role": "admin"
  }
}
```

---

## Configure Clerk Webhooks

1. Go to [Clerk Dashboard](https://dashboard.clerk.com) → Webhooks
2. Add endpoint: `https://your-api-domain.com/api/webhooks/clerk/`
3. Subscribe to events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
   - `organization.created`
   - `organizationMembership.created`
   - `organizationMembership.deleted`
4. Copy webhook signing secret → Add to `.env` as `CLERK_WEBHOOK_SECRET`

---

## Next Steps

1. **Union Eyes**: Copy these files to UE backend, configure settings, test locally
2. **ABR Insights**: After UE works, set up Clerk account, configure SSO, migrate users
3. **Frontend Integration**: Update Next.js API client to send Clerk JWT
4. **Testing**: Write integration tests for auth flows
5. **Deployment**: Deploy to Azure Container Apps with environment variables

---

**For questions or issues, check**:
- [Clerk Django Quickstart](https://clerk.com/docs/quickstarts/django)
- [PyJWT Documentation](https://pyjwt.readthedocs.io/)
- [Django REST Framework Authentication](https://www.django-rest-framework.org/api-guide/authentication/)
