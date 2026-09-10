# Nzila Vertical App - Backend Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/usr/local/bin:$PATH"

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput || true

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Run migrations on startup (using the migration-admin credential, in a
# subshell so it never leaks into the gunicorn process env), then start
# gunicorn (WSGI) with the normal least-privilege runtime credential.
#
# ROUND 59B: migrations require DDL/table-owner privileges that the
# runtime DB role (PGUSER/PGPASSWORD, RLS-bound, least-privilege) must
# NOT have. PGADMIN_USER/PGADMIN_PASSWORD (migration-admin) are used only
# for this transient startup step; the subshell's env overrides are
# discarded once it exits, so gunicorn and all ongoing app traffic still
# connect as PGUSER (never as the admin role).
#
# Django's migrate command uses SELECT...FOR UPDATE locking, so concurrent replicas
# are safe — one wins the lock, others wait then find nothing to apply.
# WEB_CONCURRENCY: set via env var per deployment (default 17 = 2×CPUs+1 for E8 SKU).
# --keep-alive 5: reuse HTTP connections from the reverse proxy.
# --max-requests 1000 + jitter: recycle workers to prevent memory leaks.
CMD ["sh", "-c", "if [ \"${DJANGO_SKIP_MIGRATIONS:-false}\" != \"true\" ]; then (: \"${PGADMIN_USER:?PGADMIN_USER required to run migrations with the migration-admin role}\"; : \"${PGADMIN_PASSWORD:?PGADMIN_PASSWORD required to run migrations with the migration-admin role}\"; export PGUSER=\"$PGADMIN_USER\" PGPASSWORD=\"$PGADMIN_PASSWORD\"; python manage.py migrate --noinput ${DJANGO_MIGRATE_EXTRA_ARGS:-}); fi && gunicorn --bind 0.0.0.0:8000 --workers ${WEB_CONCURRENCY:-17} --timeout 120 --graceful-timeout 30 --keep-alive 5 --max-requests 1000 --max-requests-jitter 50 config.wsgi:application"]
