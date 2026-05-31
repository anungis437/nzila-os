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

# Run migrations on startup, then start gunicorn (WSGI)
# Django's migrate command uses SELECT...FOR UPDATE locking, so concurrent replicas
# are safe — one wins the lock, others wait then find nothing to apply.
# WEB_CONCURRENCY: set via env var per deployment (default 17 = 2×CPUs+1 for E8 SKU).
# --keep-alive 5: reuse HTTP connections from the reverse proxy.
# --max-requests 1000 + jitter: recycle workers to prevent memory leaks.
CMD ["sh", "-c", "if [ \"${DJANGO_SKIP_MIGRATIONS:-false}\" != \"true\" ]; then python manage.py migrate --noinput ${DJANGO_MIGRATE_EXTRA_ARGS:-}; fi && gunicorn --bind 0.0.0.0:8000 --workers ${WEB_CONCURRENCY:-17} --timeout 120 --graceful-timeout 30 --keep-alive 5 --max-requests 1000 --max-requests-jitter 50 config.wsgi:application"]
