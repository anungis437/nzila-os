#!/usr/bin/env python3
"""
Django Project Setup — Creates Django project configuration files for
the populated repositories (manage.py, settings.py, urls.py, etc.)
"""

from pathlib import Path
from typing import Dict

try:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from logging_config import MigrationLogger
    logger = MigrationLogger.get_logger(__name__)
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)


class DjangoProjectSetup:
    """Set up Django project configuration in populated repos"""
    
    def __init__(self, repo_path: Path, platform_id: str, platform_name: str):
        self.repo_path = Path(repo_path)
        self.platform_id = platform_id
        self.platform_name = platform_name
        self.backend_dir = self.repo_path / "backend"
        self.config_dir = self.backend_dir / "config"
        
    def setup(self):
        """Create all Django project files"""
        logger.info(f"Setting up Django project for {self.platform_name}")
        
        # Create config directory
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        # Create project files
        self._create_manage_py()
        self._create_config_init()
        self._create_settings()
        self._create_urls()
        self._create_wsgi()
        self._create_asgi()
        self._create_requirements()
        
        logger.info(f"✅ Django project setup complete: {self.repo_path}")
    
    def _create_manage_py(self):
        """Create manage.py"""
        content = '''#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
'''
        (self.backend_dir / "manage.py").write_text(content)
        logger.info("  ✓ manage.py")
    
    def _create_config_init(self):
        """Create config/__init__.py"""
        (self.config_dir / "__init__.py").write_text("")
        logger.info("  ✓ config/__init__.py")
    
    def _create_settings(self):
        """Create config/settings.py"""
        
        # Get list of installed apps
        apps = [d.name for d in self.backend_dir.iterdir() 
                if d.is_dir() and not d.name.startswith('.') 
                and d.name != 'config']
        
        installed_apps = '",\n    "'.join(apps)
        
        content = f'''"""
Django settings for {self.platform_name}
"""

import os
from pathlib import Path

# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-CHANGE-ME-IN-PRODUCTION')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DJANGO_DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party apps
    'rest_framework',
    'corsheaders',
    'django_filters',
    # Local apps
    "{installed_apps}",
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {{
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {{
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        }},
    }},
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
DATABASES = {{
    'default': {{
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('PGDATABASE', 'nzila_platform'),
        'USER': os.environ.get('PGUSER', 'postgres'),
        'PASSWORD': os.environ.get('PGPASSWORD', 'postgres'),
        'HOST': os.environ.get('PGHOST', 'localhost'),
        'PORT': os.environ.get('PGPORT', '5432'),
    }}
}}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {{'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'}},
    {{'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'}},
    {{'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'}},
    {{'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'}},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {{
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}}

# CORS
CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://localhost:3001'
).split(',')

# Logging
LOGGING = {{
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {{
        'verbose': {{
            'format': '{{levelname}} {{asctime}} {{module}} {{message}}',
            'style': '{{',
        }},
    }},
    'handlers': {{
        'console': {{
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        }},
    }},
    'root': {{
        'handlers': ['console'],
        'level': 'INFO',
    }},
}}
'''
        (self.config_dir / "settings.py").write_text(content)
        logger.info("  ✓ config/settings.py")
    
    def _create_urls(self):
        """Create config/urls.py"""
        
        # Get list of apps with urls.py
        apps = [d.name for d in self.backend_dir.iterdir() 
                if d.is_dir() and (d / "urls.py").exists()
                and d.name != 'config']
        
        url_patterns = ""
        for app in apps:
            url_patterns += f'    path("api/{app}/", include("{app}.urls")),\n'
        
        content = f'''"""
URL configuration for {self.platform_name}
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework import routers

router = routers.DefaultRouter()

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
{url_patterns}]
'''
        (self.config_dir / "urls.py").write_text(content)
        logger.info("  ✓ config/urls.py")
    
    def _create_wsgi(self):
        """Create config/wsgi.py"""
        content = f'''"""
WSGI config for {self.platform_name}
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()
'''
        (self.config_dir / "wsgi.py").write_text(content)
        logger.info("  ✓ config/wsgi.py")
    
    def _create_asgi(self):
        """Create config/asgi.py"""
        content = f'''"""
ASGI config for {self.platform_name}
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_asgi_application()
'''
        (self.config_dir / "asgi.py").write_text(content)
        logger.info("  ✓ config/asgi.py")
    
    def _create_requirements(self):
        """Create backend/requirements.txt"""
        content = '''# Django
Django>=5.1.0,<5.2.0
djangorestframework>=3.15.0
django-cors-headers>=4.3.0
django-filter>=23.5
psycopg2-binary>=2.9.9

# Celery (for background tasks)
celery>=5.3.4
redis>=5.0.1

# Azure integrations
azure-identity>=1.15.0
azure-storage-blob>=12.19.0
azure-keyvault-secrets>=4.7.0

# Clerk authentication
pyjwt>=2.8.0
cryptography>=41.0.7

# Utilities
python-dotenv>=1.0.0
requests>=2.31.0

# Development
pytest>=7.4.3
pytest-django>=4.7.0
black>=23.12.1
flake8>=7.0.0
'''
        
        # Add platform-specific dependencies
        if self.platform_id == "ue":
            content += '''
# Union Eyes specific
scikit-learn>=1.4.0
pandas>=2.2.0
numpy>=1.26.3
'''
        elif self.platform_id == "abr":
            content += '''
# ABR Insights specific
beautifulsoup4>=4.12.3
lxml>=5.1.0
'''
        
        (self.backend_dir / "requirements.txt").write_text(content)
        logger.info("  ✓ backend/requirements.txt")


def main():
    """CLI entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Django Project Setup")
    parser.add_argument("--platform", choices=["ue", "abr", "all"], default="all")
    
    args = parser.parse_args()
    
    # Repository paths
    repos = {
        "ue": (Path("D:/APPS/nzila-union-eyes"), "Union Eyes"),
        "abr": (Path("D:/APPS/nzila-abr-insights"), "ABR Insights"),
    }
    
    platforms = ["ue", "abr"] if args.platform == "all" else [args.platform]
    
    for platform_id in platforms:
        repo_path, platform_name = repos[platform_id]
        
        if not repo_path.exists():
            logger.warning(f"Repository not found: {repo_path}")
            continue
        
        setup = DjangoProjectSetup(repo_path, platform_id, platform_name)
        setup.setup()
    
    logger.info("=" * 60)
    logger.info("✅ All Django projects configured")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
