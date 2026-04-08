"""
Django Test Settings — ABR Insights

Inherits all production settings and overrides:
  - SQLite in-memory database (no postgres needed)
  - Dummy cache (no Redis needed)
  - Disabled authentication middleware (for test requests)
  - All migrations disabled (tables created from current model state)

Usage (pytest.ini / conftest.py sets this automatically):
  DJANGO_SETTINGS_MODULE=config.settings.test pytest backend/ -x -q
"""

from config.settings import *  # noqa: F401, F403

# ── Database: SQLite in-memory ────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# ── Cache: dummy (no Redis) ───────────────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache",
    }
}

# ── Auth: relax middleware for testing ────────────────────────────────────────
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

# ── Passwords: fast hashing in tests ─────────────────────────────────────────
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# ── Installed apps: minimal set for ABR compliance tests ─────────────────────
# auth_core has models with postgres-specific ArrayField / VectorField; we
# include it in INSTALLED_APPS so model imports work, but point its migrations
# at an empty stub so no ArrayField tables are ever created in SQLite.
INSTALLED_APPS = [
    # Django built-ins (needed for DRF, sessions, content types)
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    # Third-party
    "rest_framework",
    "corsheaders",
    "django_filters",
    # App dependencies imported by compliance tests
    "auth_core",
    # Our app under test
    "compliance",
]

# ── Migrations: skip all non-ABR migrations ───────────────────────────────────
# compliance uses a dedicated test_migrations package that creates ONLY the 6
# SQLite-safe ABR tables (no EvidenceBundles, no auth_core FK chains).
# auth_core uses an empty stub — no tables created, no ArrayField SQL generated.
# Standard Django apps run their own SQLite-compatible built-in migrations.
MIGRATION_MODULES = {
    "compliance": "compliance.test_migrations",
    "auth_core": "auth_core.test_migrations",
}

# ── Logging: quiet in tests ───────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": True,
    "handlers": {
        "null": {
            "class": "logging.NullHandler",
        },
    },
    "root": {
        "handlers": ["null"],
        "level": "CRITICAL",
    },
}

# ── REST Framework: use session auth for tests ────────────────────────────────
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # type: ignore[name-defined]  # noqa: F405
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}
