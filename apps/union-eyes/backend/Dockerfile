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

# Round 59C: migrations are applied by a dedicated, ephemeral deployment
# job (apply-django-migrations in .github/workflows/deploy-union-eyes.yml)
# that runs this same image with a migration-admin credential injected
# only for that one-off invocation. This container never receives
# migration-admin credentials and never runs `manage.py migrate` itself —
# it only ever starts the application server with the least-privilege
# runtime credential (PGUSER/PGPASSWORD). This also removes the prior
# concurrency hazard of every replica racing `manage.py migrate` on
# startup/scale-out.
#
# Django's migrate command uses SELECT...FOR UPDATE locking, so concurrent replicas
# are safe — one wins the lock, others wait then find nothing to apply.
# WEB_CONCURRENCY: set via env var per deployment (default 17 = 2×CPUs+1 for E8 SKU).
# --keep-alive 5: reuse HTTP connections from the reverse proxy.
# --max-requests 1000 + jitter: recycle workers to prevent memory leaks.
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:8000 --workers ${WEB_CONCURRENCY:-17} --timeout 120 --graceful-timeout 30 --keep-alive 5 --max-requests 1000 --max-requests-jitter 50 config.wsgi:application"]
