# Nzila Backbone Platform

Django Backbone Platform — Multi-org SaaS infrastructure for Nzila verticals.

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

- **Django 5.1** with DRF for API
- **Azure PostgreSQL** with pgvector for AI embeddings
- **Azure Redis** for caching and Celery broker
- **OIDC** for authentication (JWT verification via Microsoft Entra External ID)
- **Stripe** for billing and subscriptions
- **Azure OpenAI** for AI features
- **Sentry** for error tracking
- **OpenTelemetry** for distributed tracing
