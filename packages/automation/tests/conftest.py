"""
Pytest configuration and shared fixtures

Path Setup
----------
This conftest centralises sys.path so individual test files don't each need
their own sys.path.insert blocks.  Once the package is installed via
    pip install -e packages/automation
all imports resolve automatically and this block becomes unnecessary.
"""

import sys
import pytest
import json
import tempfile
from pathlib import Path
from typing import Dict, Any
import shutil

# ── Path setup ─────────────────────────────────────────────────────────────
_automation_root = Path(__file__).parent.parent   # packages/automation/
_generators_root = _automation_root / "generators"

for _p in (_automation_root, _generators_root):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))
# ───────────────────────────────────────────────────────────────────────────



@pytest.fixture
def temp_dir():
    """Create temporary directory for test files"""
    temp = tempfile.mkdtemp()
    yield Path(temp)
    shutil.rmtree(temp, ignore_errors=True)


@pytest.fixture
def mock_legacy_platform(temp_dir: Path):
    """Create mock legacy platform structure"""
    platform_dir = temp_dir / "mock-platform"
    platform_dir.mkdir()
    
    # Create mock files
    (platform_dir / "package.json").write_text(json.dumps({
        "name": "mock-platform",
        "dependencies": {
            "@clerk/nextjs": "^5.0.0",
            "drizzle-orm": "^0.29.0"
        }
    }))
    
    # Create Next.js structure
    app_dir = platform_dir / "src" / "app"
    app_dir.mkdir(parents=True)
    (app_dir / "page.tsx").write_text("export default function Page() {}")
    
    # Create Drizzle schema
    db_dir = platform_dir / "src" / "lib" / "db"
    db_dir.mkdir(parents=True)
    (db_dir / "schema.ts").write_text("""
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull()
});

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull()
});
""")
    
    # Create components
    components_dir = platform_dir / "src" / "components"
    components_dir.mkdir(parents=True)
    (components_dir / "Button.tsx").write_text("export function Button() {}")
    
    return platform_dir


@pytest.fixture
def mock_supabase_platform(temp_dir: Path):
    """Create mock Supabase platform structure"""
    platform_dir = temp_dir / "supabase-platform"
    platform_dir.mkdir()
    
    # Create SQL migrations
    migrations_dir = platform_dir / "supabase" / "migrations"
    migrations_dir.mkdir(parents=True)
    
    (migrations_dir / "20230101_create_users.sql").write_text("""
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL
);
""")
    
    (migrations_dir / "20230102_create_posts.sql").write_text("""
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  user_id UUID REFERENCES users(id)
);
""")
    
    return platform_dir


@pytest.fixture
def mock_django_platform(temp_dir: Path):
    """Create mock Django platform structure"""
    platform_dir = temp_dir / "django-platform"
    platform_dir.mkdir()
    
    # Create Django models
    app_dir = platform_dir / "myapp"
    app_dir.mkdir(parents=True)
    
    (app_dir / "models.py").write_text("""
from django.db import models

class User(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField()

class Post(models.Model):
    title = models.CharField(max_length=200)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
""")
    
    return platform_dir


@pytest.fixture
def mock_manifest():
    """Return mock manifest data"""
    return {
        "name": "Mock Platform",
        "profile": "nextjs-app-router",
        "modules": [
            {"name": "clerk-auth", "enabled": True},
            {"name": "drizzle-orm", "enabled": True},
            {"name": "azure-deploy", "enabled": True}
        ],
        "database": {
            "type": "postgresql",
            "provider": "azure-postgres"
        },
        "authentication": {
            "provider": "clerk",
            "configuration": {}
        }
    }


@pytest.fixture
def mock_platform_profile():
    """Return mock platform profile"""
    return {
        "id": "mock-platform",
        "name": "Mock Platform",
        "path": "/path/to/mock-platform",
        "framework": "nextjs",
        "framework_version": "14.0.0",
        "database": {
            "type": "postgresql",
            "orm": "drizzle",
            "entities_count": 2,
            "supabase_detected": False
        },
        "authentication": {
            "provider": "clerk",
            "detected": True
        },
        "pages_count": 1,
        "components_count": 1,
        "api_routes_count": 0,
        "size_mb": 1.5,
        "complexity_score": 3.5,
        "complexity_level": "MEDIUM",
        "estimated_migration_weeks": 6,
        "features": [],
        "production_readiness": 7
    }


@pytest.fixture
def mock_calibration_data():
    """Return mock calibration benchmark"""
    return {
        "union-eyes": {
            "entities": 4773,
            "complexity": "EXTREME",
            "actual_weeks": 12,
            "description": "Union management platform"
        }
    }
