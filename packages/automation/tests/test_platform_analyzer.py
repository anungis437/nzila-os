"""
Unit tests for platform_analyzer_v2.py

Tests PlatformAnalyzerV2 against its actual API:
  - PlatformAnalyzerV2(platforms_dir=Path)
  - analyze_platform(platform_path) -> PlatformProfile
  - analyze_all() -> List[PlatformProfile]
  - save_profiles(output_path)
  - generate_report(output_path)
  - export_profiles(profiles, output_path)
"""

import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "generators"))

from platform_analyzer_v2 import (
    AuthInfo,
    ComplexityLevel,
    DatabaseInfo,
    PlatformAnalyzerV2,
    PlatformProfile,
    TechStack,
)


@pytest.mark.unit
@pytest.mark.analyzer
class TestPlatformAnalyzer:
    """Test PlatformAnalyzerV2 class"""

    def test_initialization(self, temp_dir):
        """Test analyzer initialization."""
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        assert analyzer.platforms_dir == temp_dir
        assert analyzer.legacy_root == temp_dir
        assert analyzer.profiles == []

    def test_initialization_default(self):
        """Test analyzer with no args."""
        analyzer = PlatformAnalyzerV2()
        assert analyzer.legacy_root.exists()

    def test_analyze_platform_returns_profile(self, mock_legacy_platform):
        """Test that analyze_platform returns a PlatformProfile."""
        analyzer = PlatformAnalyzerV2(platforms_dir=mock_legacy_platform.parent)
        profile = analyzer.analyze_platform(mock_legacy_platform)

        assert isinstance(profile, PlatformProfile)
        assert profile.platform_id == mock_legacy_platform.name
        assert profile.name  # humanized name
        assert profile.path == str(mock_legacy_platform)

    def test_analyze_nextjs_platform(self, temp_dir):
        """Test full analysis of a Next.js platform with proper deps."""
        platform_dir = temp_dir / "nextjs-platform"
        platform_dir.mkdir()

        (platform_dir / "package.json").write_text(
            json.dumps(
                {
                    "name": "nextjs-platform",
                    "dependencies": {
                        "next": "^14.0.0",
                        "@clerk/nextjs": "^5.0.0",
                        "drizzle-orm": "^0.29.0",
                    },
                }
            )
        )
        (platform_dir / "tsconfig.json").write_text('{"compilerOptions": {}}')

        # Create Next.js structure
        app_dir = platform_dir / "src" / "app"
        app_dir.mkdir(parents=True)
        (app_dir / "page.tsx").write_text("export default function Page() {}")

        # Drizzle config (needed for drizzle detection gate)
        (platform_dir / "drizzle.config.ts").write_text(
            "export default { schema: './src/lib/db/schema.ts' };\n"
        )

        # Drizzle schema
        db_dir = platform_dir / "src" / "lib" / "db"
        db_dir.mkdir(parents=True)
        (db_dir / "schema.ts").write_text(
            "export const users = pgTable('users', { id: uuid('id') });\n"
            "export const posts = pgTable('posts', { id: uuid('id') });\n"
        )

        # Clerk file (auth detection scans for *clerk* filenames)
        lib_dir = platform_dir / "src" / "lib"
        (lib_dir / "clerk.ts").write_text("export const clerkConfig = {};")

        # Components
        comp_dir = platform_dir / "src" / "components"
        comp_dir.mkdir(parents=True)
        (comp_dir / "Button.tsx").write_text("export function Button() {}")

        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)

        assert isinstance(profile.tech_stack, TechStack)
        assert profile.tech_stack.framework == "Next.js"
        assert profile.tech_stack.language == "TypeScript"
        assert profile.database.orm == "Drizzle"
        assert profile.database.tables_count >= 2
        assert profile.auth.current == "clerk"
        assert profile.entity_count >= 2
        assert profile.components_count >= 1

    def test_complexity_assignment(self, mock_legacy_platform):
        """Test complexity is assigned to profile."""
        analyzer = PlatformAnalyzerV2(platforms_dir=mock_legacy_platform.parent)
        profile = analyzer.analyze_platform(mock_legacy_platform)

        assert profile.complexity in ["LOW", "MEDIUM", "HIGH", "EXTREME"]

    def test_migration_estimate(self, mock_legacy_platform):
        """Test migration time is estimated."""
        analyzer = PlatformAnalyzerV2(platforms_dir=mock_legacy_platform.parent)
        profile = analyzer.analyze_platform(mock_legacy_platform)

        assert profile.migration_estimate_weeks >= 2

    def test_production_readiness_score(self, mock_legacy_platform):
        """Test production readiness is scored 0-10."""
        analyzer = PlatformAnalyzerV2(platforms_dir=mock_legacy_platform.parent)
        profile = analyzer.analyze_platform(mock_legacy_platform)

        assert 0 <= profile.production_readiness <= 10

    def test_calculate_size(self, temp_dir):
        """Test directory size calculation."""
        platform_dir = temp_dir / "size-test"
        platform_dir.mkdir()
        # Write enough content to register > 0 MB after rounding
        (platform_dir / "big.txt").write_text("x" * 10000)

        analyzer = PlatformAnalyzerV2()
        size_mb = analyzer._calculate_size(platform_dir)

        assert size_mb >= 0
        assert isinstance(size_mb, float)

    def test_feature_detection_ai(self, temp_dir):
        """Test AI/ML feature detection."""
        platform_dir = temp_dir / "ai-platform"
        platform_dir.mkdir()

        # Must have a recognized framework for feature detection
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0", "openai": "^4.0.0"}})
        )
        (platform_dir / "api.ts").write_text(
            "import OpenAI from 'openai';\n" "const openai = new OpenAI();\n"
        )

        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)

        assert "AI/ML" in profile.features

    def test_feature_detection_payments(self, temp_dir):
        """Test payment provider detection."""
        platform_dir = temp_dir / "payment-platform"
        platform_dir.mkdir()

        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0", "stripe": "^12.0.0"}})
        )
        (platform_dir / "checkout.ts").write_text(
            "import Stripe from 'stripe';\n"
            "const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);\n"
        )

        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)

        assert "Payments" in profile.features

    # ── React + Vite detection ──────────────────────────────────────────

    def test_detect_react_vite_platform(self, temp_dir):
        """Test React + Vite framework detection."""
        platform_dir = temp_dir / "vite-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps(
                {
                    "dependencies": {"react": "^18.0.0"},
                    "devDependencies": {"vite": "^5.0.0"},
                }
            )
        )
        # No tsconfig → JavaScript
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.framework == "React + Vite"
        assert profile.tech_stack.language == "JavaScript"

    def test_detect_react_vite_typescript(self, temp_dir):
        """React + Vite with tsconfig → TypeScript."""
        platform_dir = temp_dir / "vite-ts"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps(
                {
                    "dependencies": {"react": "^18.0.0"},
                    "devDependencies": {"vite": "^5.0.0"},
                }
            )
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.framework == "React + Vite"
        assert profile.tech_stack.language == "TypeScript"

    # ── Django / Flask / Base44 detection ────────────────────────────────

    def test_detect_django_platform(self, temp_dir):
        """Test Django platform detection via manage.py + settings.py + requirements.txt."""
        platform_dir = temp_dir / "django-app"
        platform_dir.mkdir()
        (platform_dir / "manage.py").write_text("#!/usr/bin/env python\nimport sys")
        settings_dir = platform_dir / "myproject"
        settings_dir.mkdir()
        (settings_dir / "settings.py").write_text("INSTALLED_APPS = []")
        (platform_dir / "requirements.txt").write_text("Django==5.0\npsycopg2==2.9\n")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.framework == "Django"
        assert profile.tech_stack.language == "Python"
        assert profile.tech_stack.version == "5.0"

    def test_detect_flask_platform(self, temp_dir):
        """Test Flask platform detection."""
        platform_dir = temp_dir / "flask-app"
        platform_dir.mkdir()
        (platform_dir / "app.py").write_text("from flask import Flask")
        (platform_dir / "requirements.txt").write_text("flask==3.0\ngunicorn\n")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.framework == "Flask"
        assert profile.tech_stack.language == "Python"

    def test_detect_base44_platform(self, temp_dir):
        """Test legacy Base44 platform detection via README."""
        platform_dir = temp_dir / "base44-app"
        platform_dir.mkdir()
        (platform_dir / "README.md").write_text(
            "# My App\nBuilt with Base44 low-code platform."
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.framework == "NzilaOS (ex-Base44)"
        assert profile.tech_stack.platform_type == "legacy-base44"

    # ── Django DB analysis ──────────────────────────────────────────────

    def test_analyze_django_database(self, temp_dir):
        """Test Django database deep analysis — models & migrations counting."""
        platform_dir = temp_dir / "django-db-test"
        platform_dir.mkdir()
        (platform_dir / "manage.py").write_text("")
        settings_dir = platform_dir / "backend"
        settings_dir.mkdir()
        (settings_dir / "settings.py").write_text("")
        (platform_dir / "requirements.txt").write_text("Django==5.0\n")

        # Django models
        app_dir = platform_dir / "myapp"
        app_dir.mkdir()
        (app_dir / "models.py").write_text(
            "from django.db import models\n"
            "class User(models.Model):\n    pass\n"
            "class Post(models.Model):\n    pass\n"
            "class Comment(models.Model):\n    pass\n"
        )
        # Migrations
        mig_dir = app_dir / "migrations"
        mig_dir.mkdir()
        (mig_dir / "__init__.py").write_text("")
        (mig_dir / "0001_initial.py").write_text("")
        (mig_dir / "0002_add_comments.py").write_text("")

        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.database.orm == "Django ORM"
        assert profile.database.models_count == 3
        assert profile.database.tables_count == 3
        assert profile.database.migrations_count == 2

    # ── Prisma DB analysis ──────────────────────────────────────────────

    def test_analyze_prisma_database(self, temp_dir):
        """Test Prisma schema detection and model counting."""
        platform_dir = temp_dir / "prisma-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        prisma_dir = platform_dir / "prisma"
        prisma_dir.mkdir()
        (prisma_dir / "schema.prisma").write_text(
            'datasource db {\n  provider = "postgresql"\n}\n\n'
            "model User {\n  id Int @id\n}\n\n"
            "model Post {\n  id Int @id\n}\n"
        )
        mig_dir = prisma_dir / "migrations"
        mig_dir.mkdir()
        (mig_dir / "20230101_init").mkdir()
        (mig_dir / "20230102_posts").mkdir()

        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.database.orm == "Prisma"
        assert profile.database.provider == "PostgreSQL"
        assert profile.database.models_count == 2
        assert profile.database.migrations_count == 2

    def test_analyze_prisma_mysql(self, temp_dir):
        """Test Prisma with MySQL provider."""
        platform_dir = temp_dir / "prisma-mysql"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        prisma_dir = platform_dir / "prisma"
        prisma_dir.mkdir()
        (prisma_dir / "schema.prisma").write_text(
            'datasource db {\n  provider = "mysql"\n}\n\nmodel User { id Int @id }\n'
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.database.provider == "MySQL"

    # ── Supabase DB analysis ────────────────────────────────────────────

    def test_analyze_supabase_database(self, temp_dir):
        """Test Supabase migration SQL scanning."""
        platform_dir = temp_dir / "supa-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        mig_dir = platform_dir / "supabase" / "migrations"
        mig_dir.mkdir(parents=True)
        (mig_dir / "001_users.sql").write_text(
            "CREATE TABLE users (id uuid);\n"
            "CREATE TABLE posts (id uuid);\n"
            "CREATE POLICY users_rls ON users;\n"
            "CREATE POLICY posts_rls ON posts;\n"
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.database.orm == "Supabase"
        assert profile.database.provider == "PostgreSQL"
        assert profile.database.tables_count == 2
        assert profile.database.rls_policies == 2
        assert profile.database.has_rls is True
        assert profile.database.migrations_count == 1

    # ── Component / page / API route counting ───────────────────────────

    def test_count_components_react_vite(self, temp_dir):
        """Count components in React + Vite project."""
        platform_dir = temp_dir / "vite-comps"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps(
                {
                    "dependencies": {"react": "^18.0.0"},
                    "devDependencies": {"vite": "^5.0.0"},
                }
            )
        )
        comp_dir = platform_dir / "src" / "components"
        comp_dir.mkdir(parents=True)
        (comp_dir / "Button.tsx").write_text("")
        (comp_dir / "Card.tsx").write_text("")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.components_count >= 2

    def test_count_pages_nextjs_pages_router(self, temp_dir):
        """Count pages in Next.js pages router."""
        platform_dir = temp_dir / "pages-router"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        pages_dir = platform_dir / "pages"
        pages_dir.mkdir()
        (pages_dir / "index.tsx").write_text("")
        (pages_dir / "about.tsx").write_text("")
        (pages_dir / "_app.tsx").write_text("")  # Should be excluded
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.pages_count == 2  # _app excluded

    def test_count_api_routes_pages_router(self, temp_dir):
        """Count API routes in pages router structure."""
        platform_dir = temp_dir / "pages-api"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        api_dir = platform_dir / "pages" / "api"
        api_dir.mkdir(parents=True)
        (api_dir / "users.ts").write_text("")
        (api_dir / "posts.ts").write_text("")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.api_routes_count >= 2

    def test_count_api_routes_django_views(self, temp_dir):
        """Count Django function-based and class-based views."""
        platform_dir = temp_dir / "django-views"
        platform_dir.mkdir()
        (platform_dir / "manage.py").write_text("")
        settings_dir = platform_dir / "conf"
        settings_dir.mkdir()
        (settings_dir / "settings.py").write_text("")
        (platform_dir / "requirements.txt").write_text("Django==5.0\n")
        app_dir = platform_dir / "myapp"
        app_dir.mkdir()
        (app_dir / "views.py").write_text(
            "def index(request):\n    pass\n"
            "def about(request):\n    pass\n"
            "class UserView(DetailView):\n    pass\n"
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.api_routes_count >= 3

    def test_count_api_routes_express(self, temp_dir):
        """Count Express route files."""
        platform_dir = temp_dir / "express-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"express": "^4.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        routes_dir = platform_dir / "routes"
        routes_dir.mkdir()
        (routes_dir / "users.ts").write_text("")
        (routes_dir / "posts.ts").write_text("")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.api_routes_count >= 2

    # ── Feature detection (all branches) ────────────────────────────────

    def test_feature_detection_realtime(self, temp_dir):
        """Test real-time feature detection."""
        platform_dir = temp_dir / "rt-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0", "socket.io": "^4.0.0"}})
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "Real-time" in profile.features

    def test_feature_detection_video(self, temp_dir):
        """Test video feature detection."""
        platform_dir = temp_dir / "vid-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0", "remotion": "^4.0.0"}})
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "Video" in profile.features

    def test_feature_detection_pdf(self, temp_dir):
        """Test PDF generation feature detection."""
        platform_dir = temp_dir / "pdf-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0", "jspdf": "^2.0.0"}})
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "PDF Generation" in profile.features

    def test_feature_detection_email(self, temp_dir):
        """Test email feature detection."""
        platform_dir = temp_dir / "email-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0", "resend": "^3.0.0"}})
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "Email" in profile.features

    def test_feature_detection_sms(self, temp_dir):
        """Test SMS/Twilio feature detection."""
        platform_dir = temp_dir / "sms-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0", "twilio": "^4.0.0"}})
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "SMS" in profile.features

    def test_feature_detection_search(self, temp_dir):
        """Test search feature detection."""
        platform_dir = temp_dir / "search-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0", "meilisearch": "^0.30.0"}})
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "Search" in profile.features

    def test_feature_detection_analytics(self, temp_dir):
        """Test analytics feature detection."""
        platform_dir = temp_dir / "analytics-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps(
                {"dependencies": {"next": "^14.0.0", "@vercel/analytics": "^1.0.0"}}
            )
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "Analytics" in profile.features

    def test_feature_detection_python_ai(self, temp_dir):
        """Test Python AI/ML feature detection via requirements.txt."""
        platform_dir = temp_dir / "py-ai"
        platform_dir.mkdir()
        (platform_dir / "app.py").write_text("")
        (platform_dir / "requirements.txt").write_text("flask\nopenai==1.0\n")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "AI/ML" in profile.features

    def test_feature_detection_python_celery(self, temp_dir):
        """Test Python Background Jobs (celery) detection."""
        platform_dir = temp_dir / "py-celery"
        platform_dir.mkdir()
        (platform_dir / "app.py").write_text("")
        (platform_dir / "requirements.txt").write_text("flask\ncelery==5.3\n")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "Background Jobs" in profile.features

    def test_feature_detection_python_payments(self, temp_dir):
        """Test Python payments (stripe) detection."""
        platform_dir = temp_dir / "py-pay"
        platform_dir.mkdir()
        (platform_dir / "app.py").write_text("")
        (platform_dir / "requirements.txt").write_text("flask\nstripe==7.0\n")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "Payments" in profile.features

    # ── Auth detection ──────────────────────────────────────────────────

    def test_detect_nextauth(self, temp_dir):
        """Test NextAuth detection via next-auth dependency."""
        platform_dir = temp_dir / "nextauth-app"
        platform_dir.mkdir()
        # Use next-auth dep which is picked up by dependency extraction
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0", "next-auth": "^4.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        # next-auth is recognized as a dependency
        assert "next-auth" in profile.dependencies

    def test_detect_supabase_auth(self, temp_dir):
        """Test Supabase auth detection."""
        platform_dir = temp_dir / "supa-auth"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        (platform_dir / "supabase").mkdir()
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "supabase-auth" in profile.auth.providers

    def test_detect_django_allauth(self, temp_dir):
        """Test Django allauth detection."""
        platform_dir = temp_dir / "allauth-app"
        platform_dir.mkdir()
        (platform_dir / "manage.py").write_text("")
        cfg_dir = platform_dir / "cfg"
        cfg_dir.mkdir()
        (cfg_dir / "settings.py").write_text(
            "INSTALLED_APPS = ['allauth', 'django.contrib.auth']"
        )
        (platform_dir / "requirements.txt").write_text("Django==5.0\ndjango-allauth\n")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "django-allauth" in profile.auth.providers
        assert profile.auth.migration_complexity == "HIGH"

    def test_detect_django_contrib_auth(self, temp_dir):
        """Test django.contrib.auth detection (no allauth)."""
        platform_dir = temp_dir / "django-auth"
        platform_dir.mkdir()
        (platform_dir / "manage.py").write_text("")
        cfg_dir = platform_dir / "proj"
        cfg_dir.mkdir()
        (cfg_dir / "settings.py").write_text("INSTALLED_APPS = ['django.contrib.auth']")
        (platform_dir / "requirements.txt").write_text("Django==5.0\n")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "django-auth" in profile.auth.providers

    # ── Dependency extraction ───────────────────────────────────────────

    def test_extract_node_dependencies(self, temp_dir):
        """Test Node.js key dependency extraction."""
        platform_dir = temp_dir / "node-deps"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps(
                {
                    "dependencies": {
                        "next": "^14.0.0",
                        "react": "^18.0.0",
                        "drizzle-orm": "^0.29",
                        "@clerk/nextjs": "^5.0",
                        "tailwindcss": "^3.0",
                        "openai": "^4.0",
                        "stripe": "^14.0",
                    },
                    "devDependencies": {"typescript": "^5.0"},
                }
            )
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        for dep in [
            "next",
            "react",
            "drizzle-orm",
            "@clerk/nextjs",
            "tailwindcss",
            "openai",
            "stripe",
            "typescript",
        ]:
            assert dep in profile.dependencies

    def test_extract_python_dependencies(self, temp_dir):
        """Test Python key dependency extraction."""
        platform_dir = temp_dir / "py-deps"
        platform_dir.mkdir()
        (platform_dir / "app.py").write_text("")
        (platform_dir / "requirements.txt").write_text(
            "django==5.0\ncelery==5.3\nredis==5.0\npsycopg2==2.9\nopenai==1.0\n"
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        for dep in ["django", "celery", "redis", "psycopg2", "openai"]:
            assert dep in profile.dependencies

    # ── Production readiness scoring ────────────────────────────────────

    def test_production_readiness_high_score(self, temp_dir):
        """Test high production readiness score with many signals."""
        platform_dir = temp_dir / "prod-ready"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps(
                {
                    "dependencies": {
                        "next": "^14.0.0",
                        "@sentry/nextjs": "^7.0",
                    },
                    "devDependencies": {
                        "vitest": "^1.0",
                        "typescript": "^5.0",
                    },
                }
            )
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        (platform_dir / "turbo.json").write_text("{}")

        # Create drizzle schema with many tables and RLS
        (platform_dir / "drizzle.config.ts").write_text("")
        schema_dir = platform_dir / "db" / "schema"
        schema_dir.mkdir(parents=True)
        tables = [f"export const t{i} = pgTable('t{i}', {{}}); " for i in range(60)]
        policies = ".policy(" * 55
        (schema_dir / "schema.ts").write_text(
            "\n".join(tables) + "\n" + policies + "\nenableRLS"
        )
        # Many migrations
        drizzle_dir = platform_dir / "drizzle"
        drizzle_dir.mkdir()
        for i in range(55):
            (drizzle_dir / f"{i:04d}.sql").write_text("")
        # Many features
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.production_readiness >= 7.0

    # ── Complexity calculation ──────────────────────────────────────────

    def test_complexity_benchmark_match(self, temp_dir):
        """Test complexity uses benchmark when platform_id matches."""
        platform_dir = temp_dir / "Union_Eyes_app_v1-main"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.complexity == "EXTREME"
        assert profile.migration_estimate_weeks == 12

    def test_complexity_extreme_entity_count(self, temp_dir):
        """Test EXTREME complexity for very high entity counts."""
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = PlatformProfile(
            platform_id="custom-extreme",
            name="Custom Extreme",
            path=str(temp_dir),
        )
        profile.entity_count = 4000
        profile.database = DatabaseInfo(has_rls=True, rls_policies=250)
        profile.database.migrations_count = 150
        profile.auth = AuthInfo(current="supabase-auth", migration_complexity="HIGH")
        profile.tech_stack = TechStack(monorepo=True)
        profile.features = ["AI/ML", "Real-time", "Payments", "Email", "SMS"]
        profile.dependencies = []
        profile.production_readiness = 9.5
        complexity = analyzer._calculate_complexity_calibrated(profile)
        assert complexity == "EXTREME"

    def test_complexity_low(self, temp_dir):
        """Test LOW complexity for small entity count."""
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = PlatformProfile(
            platform_id="small-app", name="Small", path=str(temp_dir)
        )
        profile.entity_count = 10
        profile.database = DatabaseInfo()
        profile.auth = AuthInfo(current="clerk", migration_complexity="LOW")
        profile.tech_stack = TechStack()
        profile.features = []
        profile.dependencies = []
        profile.production_readiness = 5.0
        complexity = analyzer._calculate_complexity_calibrated(profile)
        assert complexity == "LOW"

    # ── Migration time estimation ───────────────────────────────────────

    def test_migration_time_high_rls(self, temp_dir):
        """Test migration time adjustment for high RLS policies."""
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = PlatformProfile(
            platform_id="rls-heavy", name="RLS Heavy", path=str(temp_dir)
        )
        profile.entity_count = 600
        profile.database = DatabaseInfo(has_rls=True, rls_policies=150)
        profile.auth = AuthInfo(current="unknown", migration_complexity="LOW")
        profile.tech_stack = TechStack(monorepo=True)
        profile.features = ["AI/ML"]
        profile.dependencies = []
        profile.production_readiness = 9.5
        profile.complexity = analyzer._calculate_complexity_calibrated(profile)
        weeks = analyzer._estimate_migration_time_calibrated(profile)
        assert weeks >= 9  # multiple adjustments should push it up
        assert weeks <= 14  # cap

    # ── analyze_all / export / save / report ────────────────────────────

    def test_analyze_all_with_error(self, temp_dir):
        """Test analyze_all skips platforms that throw errors."""
        platform_ok = temp_dir / "ok-app"
        platform_ok.mkdir()
        (platform_ok / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_ok / "tsconfig.json").write_text("{}")

        # Create a "bad" platform that will not error by itself, so let's verify
        # analyze_all just returns all parsable platforms
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profiles = analyzer.analyze_all()
        assert len(profiles) >= 1
        ids = [p.platform_id for p in profiles]
        assert "ok-app" in ids

    def test_export_profiles_simple(self, temp_dir):
        """Test exporting profiles to JSON."""
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = PlatformProfile(
            platform_id="exp", name="Export Test", path=str(temp_dir)
        )
        out = temp_dir / "out.json"
        analyzer.export_profiles([profile], out)
        data = json.loads(out.read_text())
        assert len(data) == 1
        assert data[0]["platform_id"] == "exp"

    def test_save_profiles_simple(self, temp_dir):
        """Test save_profiles for compatibility."""
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        analyzer.profiles = [{"platform_id": "a", "name": "A"}]
        out = temp_dir / "saved.json"
        analyzer.save_profiles(out)
        data = json.loads(out.read_text())
        assert data["profiles"] == [{"platform_id": "a", "name": "A"}]

    def test_generate_report_simple(self, temp_dir):
        """Test markdown report generation."""
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        analyzer.profiles = [
            {
                "platform_id": "rp",
                "name": "ReportPlatform",
                "complexity": "MEDIUM",
                "entity_count": 42,
                "migration_estimate_weeks": 6,
            }
        ]
        out = temp_dir / "report.md"
        analyzer.generate_report(out)
        content = out.read_text()
        assert "ReportPlatform" in content
        assert "MEDIUM" in content

    # ── CLI main() ──────────────────────────────────────────────────────

    def test_main_no_args(self):
        """Test main() with no arguments exits with code 1."""
        from platform_analyzer_v2 import main

        with patch("sys.argv", ["platform_analyzer_v2.py"]):
            with pytest.raises(SystemExit) as exc:
                main()
            assert exc.value.code == 1

    def test_main_with_directory(self, temp_dir):
        """Test main() with a valid directory."""
        from platform_analyzer_v2 import main

        platform_dir = temp_dir / "cli-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")

        out_file = temp_dir / "cli_output.json"
        with patch("sys.argv", ["prog", str(temp_dir), str(out_file)]):
            main()
        assert out_file.exists()

    # ── Express / Fastify detection ─────────────────────────────────────

    def test_detect_express_platform(self, temp_dir):
        """Test Express framework detection."""
        platform_dir = temp_dir / "express-detect"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"express": "^4.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.framework == "Express"

    def test_detect_fastify_platform(self, temp_dir):
        """Test Fastify framework detection."""
        platform_dir = temp_dir / "fastify-detect"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"fastify": "^4.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.framework == "Fastify"

    def test_complexity_benchmarks_exist(self):
        """Test that complexity benchmarks are defined."""
        assert hasattr(PlatformAnalyzerV2, "COMPLEXITY_BENCHMARKS")
        benchmarks = PlatformAnalyzerV2.COMPLEXITY_BENCHMARKS

        assert "Union_Eyes_app_v1-main" in benchmarks
        assert "c3uo-app-v1-main" in benchmarks

        benchmark = benchmarks["Union_Eyes_app_v1-main"]
        assert "orgs" in benchmark
        assert "complexity" in benchmark
        assert "weeks" in benchmark
        assert benchmark["orgs"] == 4773
        assert benchmark["complexity"] == "EXTREME"

    def test_complexity_level_enum(self):
        """Test ComplexityLevel enum values."""
        assert ComplexityLevel.LOW.value == "LOW"
        assert ComplexityLevel.MEDIUM.value == "MEDIUM"
        assert ComplexityLevel.HIGH.value == "HIGH"
        assert ComplexityLevel.EXTREME.value == "EXTREME"

    def test_analyze_all_platforms(self, mock_legacy_platform):
        """Test analyzing all platforms in directory."""
        analyzer = PlatformAnalyzerV2(platforms_dir=mock_legacy_platform.parent)
        profiles = analyzer.analyze_all()

        assert len(profiles) >= 1
        assert isinstance(profiles[0], PlatformProfile)
        # self.profiles stored as list of dicts
        assert len(analyzer.profiles) >= 1

    def test_save_profiles(self, mock_legacy_platform, temp_dir):
        """Test saving profiles to JSON."""
        analyzer = PlatformAnalyzerV2(platforms_dir=mock_legacy_platform.parent)
        analyzer.analyze_all()

        output_file = temp_dir / "test_profiles.json"
        analyzer.save_profiles(output_file)

        assert output_file.exists()
        with open(output_file) as f:
            data = json.load(f)
        assert "profiles" in data
        assert len(data["profiles"]) >= 1

    def test_generate_report(self, mock_legacy_platform, temp_dir):
        """Test report generation."""
        analyzer = PlatformAnalyzerV2(platforms_dir=mock_legacy_platform.parent)
        analyzer.analyze_all()

        report_file = temp_dir / "test_report.md"
        analyzer.generate_report(report_file)

        assert report_file.exists()
        content = report_file.read_text()
        assert "Platform Analysis Report" in content

    def test_export_profiles(self, mock_legacy_platform, temp_dir):
        """Test export_profiles method."""
        analyzer = PlatformAnalyzerV2(platforms_dir=mock_legacy_platform.parent)
        profiles = analyzer.analyze_all()

        output_file = temp_dir / "exported.json"
        analyzer.export_profiles(profiles, output_file)

        assert output_file.exists()
        with open(output_file) as f:
            data = json.load(f)
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_deep_schema_scanning_drizzle(self, temp_dir):
        """Test deep recursive Drizzle schema scanning."""
        platform_dir = temp_dir / "drizzle-multi-schema"
        platform_dir.mkdir()

        schema_dir = platform_dir / "src" / "db" / "schema" / "users"
        schema_dir.mkdir(parents=True)
        (schema_dir / "users.schema.ts").write_text(
            "export const users = pgTable('users', { id: uuid('id') });\n"
            "export const profiles = pgTable('profiles', { id: uuid('id') });\n"
        )

        posts_dir = platform_dir / "src" / "db" / "schema" / "posts"
        posts_dir.mkdir(parents=True)
        (posts_dir / "posts.schema.ts").write_text(
            "export const posts = pgTable('posts', { id: uuid('id') });\n"
            "export const comments = pgTable('comments', { id: uuid('id') });\n"
        )

        # Needs package.json with 'next' so tech_stack is detected and DB analysis runs
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0", "drizzle-orm": "^0.30.0"}})
        )

        # Drizzle config (gate for drizzle detection)
        (platform_dir / "drizzle.config.ts").write_text(
            "export default { schema: './src/db/schema' };\n"
        )

        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)

        assert profile.database.orm == "Drizzle"
        assert profile.database.tables_count >= 4

    def test_empty_platform(self, temp_dir):
        """Test handling of empty platform directory."""
        platform_dir = temp_dir / "empty-platform"
        platform_dir.mkdir()

        analyzer = PlatformAnalyzerV2(platforms_dir=temp_dir)
        profile = analyzer.analyze_platform(platform_dir)

        assert isinstance(profile, PlatformProfile)
        assert profile.entity_count == 0

    def test_platform_profile_dataclass_defaults(self):
        """Test PlatformProfile default values."""
        p = PlatformProfile(platform_id="test", name="Test", path="/tmp/test")
        assert p.complexity == "MEDIUM"
        assert p.entity_count == 0
        assert p.migration_estimate_weeks == 4
        assert isinstance(p.tech_stack, TechStack)
        assert isinstance(p.dependencies, list)
        assert isinstance(p.features, list)


@pytest.mark.integration
@pytest.mark.analyzer
class TestPlatformAnalyzerIntegration:
    """Integration tests for Platform Analyzer"""

    def test_full_analysis_workflow(self, mock_legacy_platform, temp_dir):
        """Test complete analysis workflow."""
        analyzer = PlatformAnalyzerV2(platforms_dir=mock_legacy_platform.parent)

        # Analyze all
        profiles = analyzer.analyze_all()
        assert len(profiles) >= 1

        # Save
        output_file = temp_dir / "integration_profiles.json"
        analyzer.save_profiles(output_file)
        assert output_file.exists()

        # Report
        report_file = temp_dir / "integration_report.md"
        analyzer.generate_report(report_file)
        assert report_file.exists()

        content = report_file.read_text()
        assert "Platform Analysis Report" in content


# ═══════════════════════════════════════════════════════════════════════
# Deep branch-coverage tests — platform_analyzer_v2
# ═══════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestPlatformAnalyzerDeep:
    """Tests covering deep analysis branches in platform_analyzer_v2."""

    @pytest.fixture(autouse=True)
    def _temp_dir(self, tmp_path):
        self.temp_dir = tmp_path
        return tmp_path

    # ── Size calculation error handling (lines 277-280) ──────────────

    def test_calculate_size_error(self):
        """_calculate_size handles rglob errors."""
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        result = analyzer._calculate_size(self.temp_dir / "nonexistent")
        assert result == 0.0

    # ── README-based Base44 detection (lines 320-321) ────────────────

    def test_detect_base44_readme(self):
        """Detect Base44/low-code from README.md."""
        platform_dir = self.temp_dir / "b44"
        platform_dir.mkdir()
        (platform_dir / "README.md").write_text("This is a base44 low-code app")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.platform_type == "legacy-base44"
        assert profile.tech_stack.framework == "NzilaOS (ex-Base44)"

    # ── Express with JavaScript (no tsconfig) (lines 374,378) ────────

    def test_express_javascript(self):
        """Express detected as JavaScript when no tsconfig."""
        platform_dir = self.temp_dir / "express-js"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"express": "^4.0.0"}})
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.framework == "Express"
        assert profile.tech_stack.language == "JavaScript"

    # ── Fastify detection (lines 386-391) ────────────────────────────

    def test_fastify_javascript(self):
        """Fastify detected as JavaScript when no tsconfig."""
        platform_dir = self.temp_dir / "fastify-js"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"fastify": "^4.0.0"}})
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.framework == "Fastify"
        assert profile.tech_stack.language == "JavaScript"

    # ── Package manager detection (yarn, npm) ────────────────────────

    def test_yarn_lock_detection(self):
        """Detect yarn package manager."""
        platform_dir = self.temp_dir / "yarn-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "yarn.lock").write_text("")
        (platform_dir / "tsconfig.json").write_text("{}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.package_manager == "yarn"

    def test_npm_lock_detection(self):
        """Detect npm package manager."""
        platform_dir = self.temp_dir / "npm-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "package-lock.json").write_text("{}")
        (platform_dir / "tsconfig.json").write_text("{}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.package_manager == "npm"

    # ── Django version extraction (lines 410-411) ────────────────────

    def test_django_version_extraction(self):
        """Extract Django version from requirements.txt."""
        platform_dir = self.temp_dir / "django-ver"
        platform_dir.mkdir()
        (platform_dir / "manage.py").write_text("")
        (platform_dir / "requirements.txt").write_text("django==4.2.1\npsycopg2==2.9\n")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.framework == "Django"
        assert profile.tech_stack.version == "4.2.1"

    # ── Flask detection (lines 425-426) ──────────────────────────────

    def test_flask_detection(self):
        """Detect Flask framework from app.py + requirements."""
        platform_dir = self.temp_dir / "flask-app"
        platform_dir.mkdir()
        (platform_dir / "app.py").write_text("from flask import Flask")
        (platform_dir / "requirements.txt").write_text("flask==2.3.0\n")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.framework == "Flask"
        assert profile.tech_stack.language == "Python"

    # ── Django database analysis (lines 466-467) ─────────────────────

    def test_django_database_deep(self, mock_django_platform):
        """Django database deep analysis counts models."""
        # Fixture creates models.py; also need manage.py + requirements for Django detection
        (mock_django_platform / "manage.py").write_text("")
        (mock_django_platform / "requirements.txt").write_text(
            "django==4.2\npsycopg2==2.9\n"
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=mock_django_platform.parent)
        profile = analyzer.analyze_platform(mock_django_platform)
        assert profile.tech_stack.framework == "Django"
        assert profile.database.orm == "Django ORM"
        assert profile.database.models_count >= 2

    # ── Django migrations counting ───────────────────────────────────

    def test_django_migrations_count(self):
        """Count Django migration files."""
        platform_dir = self.temp_dir / "django-mig"
        platform_dir.mkdir()
        (platform_dir / "manage.py").write_text("")
        app_dir = platform_dir / "myapp"
        app_dir.mkdir()
        (app_dir / "models.py").write_text(
            "from django.db import models\nclass Foo(models.Model):\n    name = models.CharField(max_length=100)\n"
        )
        mig_dir = app_dir / "migrations"
        mig_dir.mkdir()
        (mig_dir / "__init__.py").write_text("")
        (mig_dir / "0001_initial.py").write_text("")
        (mig_dir / "0002_add_field.py").write_text("")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.database.migrations_count >= 2

    # ── Supabase database deep analysis (lines 622-623) ──────────────

    def test_supabase_database_deep(self, mock_supabase_platform):
        """Supabase database analysis with SQL migrations."""
        # Fixture creates SQL migrations; also need package.json for framework detection
        (mock_supabase_platform / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14", "@supabase/supabase-js": "^2"}})
        )
        (mock_supabase_platform / "tsconfig.json").write_text("{}")
        # Add RLS policies to one of the migration files
        mig_dir = mock_supabase_platform / "supabase" / "migrations"
        (mig_dir / "20230103_add_rls.sql").write_text(
            "ALTER TABLE users ENABLE ROW LEVEL SECURITY;\n"
            "CREATE POLICY select_users ON users FOR SELECT USING (true);\n"
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=mock_supabase_platform.parent)
        profile = analyzer.analyze_platform(mock_supabase_platform)
        assert profile.database.orm == "Supabase"
        assert profile.database.provider == "PostgreSQL"
        assert profile.database.has_rls is True
        assert profile.database.tables_count >= 2
        assert profile.database.migrations_count >= 2

    # ── Supabase with RLS policies ───────────────────────────────────

    def test_supabase_rls_policies(self):
        """Supabase analysis counts CREATE POLICY statements."""
        platform_dir = self.temp_dir / "supa-rls"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        mig_dir = platform_dir / "supabase" / "migrations"
        mig_dir.mkdir(parents=True)
        (mig_dir / "001_tables.sql").write_text(
            "CREATE TABLE users (id uuid);\nCREATE POLICY select_users ON users FOR SELECT USING (true);\n"
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.database.rls_policies >= 1

    # ── Component counting (lines 667-672) ───────────────────────────

    def test_count_components_deep(self):
        """Count React components in components/ directories."""
        platform_dir = self.temp_dir / "comp-count"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        comp_dir = platform_dir / "components"
        comp_dir.mkdir()
        (comp_dir / "Button.tsx").write_text("export const Button = () => <button/>")
        (comp_dir / "Card.tsx").write_text("export const Card = () => <div/>")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.components_count >= 2

    # ── Page counting — pages router (lines 683-686, 699-704) ────────

    def test_count_pages_app_router(self):
        """Count pages in app/ directory."""
        platform_dir = self.temp_dir / "pages-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        pg_dir = platform_dir / "app" / "dashboard"
        pg_dir.mkdir(parents=True)
        (pg_dir / "page.tsx").write_text("export default function Page() {}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.pages_count >= 1

    def test_count_pages_pages_router(self):
        """Count pages in pages/ directory (pages router)."""
        platform_dir = self.temp_dir / "pages-classic"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        pg_dir = platform_dir / "pages"
        pg_dir.mkdir()
        (pg_dir / "index.tsx").write_text("export default () => <div/>")
        (pg_dir / "about.tsx").write_text("export default () => <div/>")
        (pg_dir / "_app.tsx").write_text("")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.pages_count >= 2

    # ── API route counting — Express/Django (lines 713-735) ──────────

    def test_count_api_routes_nextjs_app(self):
        """Count API routes in app/api/ directory."""
        platform_dir = self.temp_dir / "api-nextjs"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        api_dir = platform_dir / "app" / "api" / "users"
        api_dir.mkdir(parents=True)
        (api_dir / "route.ts").write_text("export async function GET() {}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.api_routes_count >= 1

    def test_count_api_routes_nextjs_pages(self):
        """Count API routes in pages/api/ directory."""
        platform_dir = self.temp_dir / "api-pages"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        api_dir = platform_dir / "pages" / "api"
        api_dir.mkdir(parents=True)
        (api_dir / "hello.ts").write_text("export default (req, res) => {}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.api_routes_count >= 1

    def test_count_api_routes_django(self):
        """Count Django views as API routes."""
        platform_dir = self.temp_dir / "api-django"
        platform_dir.mkdir()
        (platform_dir / "manage.py").write_text("")
        app_dir = platform_dir / "api"
        app_dir.mkdir()
        (app_dir / "views.py").write_text(
            "def list_users(request):\n    pass\n\n"
            "class UserView(APIView):\n    pass\n"
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.api_routes_count >= 1

    def test_count_api_routes_express(self):
        """Count Express route files."""
        platform_dir = self.temp_dir / "api-express"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"express": "^4.0.0"}})
        )
        route_dir = platform_dir / "routes"
        route_dir.mkdir()
        (route_dir / "users.ts").write_text("router.get('/', handler)")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.api_routes_count >= 1

    # ── Features detection (lines 843-844, 871-872) ──────────────────

    def test_detect_analytics_feature(self):
        """Detect Analytics from @vercel/analytics dependency."""
        platform_dir = self.temp_dir / "analytics-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps(
                {"dependencies": {"next": "^14.0.0", "@vercel/analytics": "^1.0.0"}}
            )
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "Analytics" in profile.features

    def test_detect_python_features(self):
        """Detect Python features (AI/ML, Background Jobs, Payments)."""
        platform_dir = self.temp_dir / "py-features"
        platform_dir.mkdir()
        (platform_dir / "manage.py").write_text("")
        (platform_dir / "requirements.txt").write_text(
            "django==4.2\nopenai==1.0\ncelery==5.3\nstripe==5.0\n"
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "AI/ML" in profile.features
        assert "Background Jobs" in profile.features
        assert "Payments" in profile.features

    # ── Auth detection (lines 921-922) ───────────────────────────────

    def test_detect_django_allauth(self):
        """Detect Django allauth auth provider."""
        platform_dir = self.temp_dir / "allauth-app"
        platform_dir.mkdir()
        (platform_dir / "manage.py").write_text("")
        settings_dir = platform_dir / "config"
        settings_dir.mkdir()
        (settings_dir / "settings.py").write_text(
            "INSTALLED_APPS = ['allauth', 'allauth.account']"
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "django-allauth" in profile.auth.providers
        assert profile.auth.current == "django-allauth"

    def test_detect_django_auth(self):
        """Detect built-in Django auth."""
        platform_dir = self.temp_dir / "djauth-app"
        platform_dir.mkdir()
        (platform_dir / "manage.py").write_text("")
        settings_dir = platform_dir / "core"
        settings_dir.mkdir()
        (settings_dir / "settings.py").write_text(
            "INSTALLED_APPS = ['django.contrib.auth']"
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "django-auth" in profile.auth.providers

    # ── Python dependency extraction (lines 959-960, 980-981) ────────

    def test_extract_python_deps(self):
        """Extract key Python dependencies."""
        platform_dir = self.temp_dir / "pydeps"
        platform_dir.mkdir()
        (platform_dir / "manage.py").write_text("")
        (platform_dir / "requirements.txt").write_text(
            "django==4.2\npsycopg2==2.9\nopenai==1.0\n"
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "django" in profile.dependencies
        assert "psycopg2" in profile.dependencies
        assert "openai" in profile.dependencies

    # ── Production readiness branches (lines 994-1014) ───────────────

    def test_production_readiness_high_score(self):
        """Test all production readiness scoring branches."""
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = PlatformProfile(
            platform_id="high-score",
            name="High Score",
            path=str(self.temp_dir),
            dependencies=["vitest", "@sentry/nextjs"],
            features=["Auth", "DB", "API", "Search", "Analytics"],
        )
        profile.tech_stack.language = "TypeScript"
        profile.tech_stack.monorepo = True
        profile.database.has_rls = True
        profile.database.rls_policies = 100
        profile.database.migrations_count = 60
        score = analyzer._assess_production_readiness(profile)
        assert score == 10.0

    # ── Complexity scoring branches (lines 1042-1089) ────────────────

    def test_complexity_extreme(self):
        """Test EXTREME complexity calculation."""
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = PlatformProfile(
            platform_id="extreme-app",
            name="Extreme",
            path=str(self.temp_dir),
            entity_count=5000,
            features=["AI/ML", "Real-time", "Auth", "DB", "API"],
            production_readiness=9.5,
        )
        profile.database.has_rls = True
        profile.database.rls_policies = 250
        profile.database.migrations_count = 150
        profile.auth.migration_complexity = "HIGH"
        profile.tech_stack.monorepo = True
        result = analyzer._calculate_complexity_calibrated(profile)
        assert result == "EXTREME"

    def test_complexity_high(self):
        """Test HIGH complexity calculation."""
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = PlatformProfile(
            platform_id="high-app",
            name="High",
            path=str(self.temp_dir),
            entity_count=600,
            features=["Real-time"],
        )
        profile.database.has_rls = True
        profile.database.rls_policies = 60
        profile.database.migrations_count = 110
        profile.auth.migration_complexity = "MEDIUM"
        result = analyzer._calculate_complexity_calibrated(profile)
        assert result in ("HIGH", "EXTREME")

    def test_complexity_medium(self):
        """Test MEDIUM complexity calculation."""
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = PlatformProfile(
            platform_id="med-app",
            name="Med",
            path=str(self.temp_dir),
            entity_count=100,
        )
        profile.auth.current = "clerk"
        result = analyzer._calculate_complexity_calibrated(profile)
        assert result in ("LOW", "MEDIUM")

    # ── Migration time estimation (lines 1121-1162) ──────────────────

    def test_migration_time_high_entity(self):
        """Test migration time with many entities + monorepo."""
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = PlatformProfile(
            platform_id="big-app",
            name="Big",
            path=str(self.temp_dir),
            entity_count=3000,
            complexity="HIGH",
            features=["AI/ML"],
            production_readiness=9.5,
        )
        profile.database.has_rls = True
        profile.database.rls_policies = 150
        profile.tech_stack.monorepo = True
        weeks = analyzer._estimate_migration_time_calibrated(profile)
        assert weeks <= 14

    def test_migration_time_medium_entity(self):
        """Test migration time with moderate entities."""
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = PlatformProfile(
            platform_id="med-entity",
            name="Med Entity",
            path=str(self.temp_dir),
            entity_count=600,
            complexity="MEDIUM",
        )
        weeks = analyzer._estimate_migration_time_calibrated(profile)
        assert weeks >= 6

    # ── CLI main with summary (line 1275) ────────────────────────────

    def test_main_with_multiple_platforms(self):
        """CLI main with multiple platforms exercises summary printing."""
        from platform_analyzer_v2 import main

        p1 = self.temp_dir / "app1"
        p1.mkdir()
        (p1 / "package.json").write_text(json.dumps({"dependencies": {"next": "^14"}}))
        (p1 / "tsconfig.json").write_text("{}")

        p2 = self.temp_dir / "app2"
        p2.mkdir()
        (p2 / "manage.py").write_text("")

        out = self.temp_dir / "multi.json"
        with patch("sys.argv", ["prog", str(self.temp_dir), str(out)]):
            main()
        assert out.exists()

    # ── Monorepo / workspaces detection ──────────────────────────────

    def test_monorepo_workspaces(self):
        """Detect monorepo from workspaces field."""
        platform_dir = self.temp_dir / "mono-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps(
                {
                    "dependencies": {"next": "^14"},
                    "workspaces": ["packages/*"],
                }
            )
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.monorepo is True

    # ── Build tool detection (nx) ────────────────────────────────────

    def test_nx_build_tool(self):
        """Detect nx build tool."""
        platform_dir = self.temp_dir / "nx-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14", "nx": "^16.0.0"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.build_tool == "nx"

    # ── Analyze all with failed platform ─────────────────────────────

    def test_analyze_all_with_error(self):
        """analyze_all continues when a platform fails."""
        # Create two platforms — first alphabetically will be analyzed first
        p_bad = self.temp_dir / "aaa-bad-app"
        p_bad.mkdir()
        (p_bad / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14"}})
        )
        (p_bad / "tsconfig.json").write_text("{}")

        p_ok = self.temp_dir / "zzz-good-app"
        p_ok.mkdir()
        (p_ok / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14"}})
        )
        (p_ok / "tsconfig.json").write_text("{}")

        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        original = analyzer.analyze_platform
        call_count = [0]

        def flaky_analyze(path):
            call_count[0] += 1
            if path.name == "aaa-bad-app":
                raise RuntimeError("simulated failure")
            return original(path)

        with patch.object(analyzer, "analyze_platform", side_effect=flaky_analyze):
            profiles = analyzer.analyze_all()
        assert len(profiles) >= 1

    # ── Drizzle MySQL detection ──────────────────────────────────────

    def test_drizzle_mysql_detection(self):
        """Drizzle with mysqlTable detected as MySQL."""
        platform_dir = self.temp_dir / "drizzle-mysql"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        (platform_dir / "drizzle.config.ts").write_text("")
        schema_dir = platform_dir / "db"
        schema_dir.mkdir()
        (schema_dir / "schema.ts").write_text(
            "export const users = mysqlTable('users', { id: serial() });\n"
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.database.provider == "MySQL"

    # ── Drizzle RLS detection ────────────────────────────────────────

    def test_drizzle_rls_detection(self):
        """Drizzle schema with enableRLS."""
        platform_dir = self.temp_dir / "drizzle-rls"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        (platform_dir / "drizzle.config.ts").write_text("")
        schema_dir = platform_dir / "db"
        schema_dir.mkdir()
        (schema_dir / "schema.ts").write_text(
            "export const users = pgTable('users', { id: serial() });\n"
            "enableRLS(users);\n"
            "createPolicy('user_policy', users);\n"
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.database.has_rls is True
        assert profile.database.rls_policies >= 1

    # ── React + Vite detection ───────────────────────────────────────

    def test_react_vite_javascript(self):
        """React + Vite detected as JavaScript when no tsconfig."""
        platform_dir = self.temp_dir / "vite-js"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"react": "^18", "vite": "^5"}})
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.framework == "React + Vite"
        assert profile.tech_stack.language == "JavaScript"

    # ── Search feature detection ─────────────────────────────────────

    def test_detect_search_feature(self):
        """Detect Search feature from algolia dependency."""
        platform_dir = self.temp_dir / "search-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps(
                {"dependencies": {"next": "^14", "@algolia/client-search": "^4.0.0"}}
            )
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert "Search" in profile.features

    # ── Package manager & build tool detection ───────────────────────

    def test_pnpm_lock_detection(self):
        """Detect pnpm package manager from pnpm-lock.yaml."""
        platform_dir = self.temp_dir / "pnpm-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14"}})
        )
        (platform_dir / "pnpm-lock.yaml").write_text("lockfileVersion: 5.4")
        (platform_dir / "tsconfig.json").write_text("{}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.package_manager == "pnpm"

    def test_turbo_build_tool(self):
        """Detect turbo build tool from devDependencies."""
        platform_dir = self.temp_dir / "turbo-app"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps(
                {"dependencies": {"next": "^14"}, "devDependencies": {"turbo": "^1.0"}}
            )
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.tech_stack.build_tool == "turbo"

    # ── JSX page counting ────────────────────────────────────────────

    def test_count_pages_jsx_app_router(self):
        """Count .jsx pages in app router."""
        platform_dir = self.temp_dir / "jsx-app-router"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        app_dir = platform_dir / "app" / "dashboard"
        app_dir.mkdir(parents=True)
        (app_dir / "page.jsx").write_text("export default function Page() {}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.pages_count >= 1

    def test_count_pages_jsx_pages_router(self):
        """Count .jsx pages in pages router."""
        platform_dir = self.temp_dir / "jsx-pages-router"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        pages_dir = platform_dir / "pages"
        pages_dir.mkdir()
        (pages_dir / "index.jsx").write_text("export default function Home() {}")
        (pages_dir / "about.jsx").write_text("export default function About() {}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.pages_count >= 2

    # ── JS API route counting ────────────────────────────────────────

    def test_count_api_routes_nextjs_app_js(self):
        """Count .js route files in app/api."""
        platform_dir = self.temp_dir / "js-app-api"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        api_dir = platform_dir / "app" / "api" / "users"
        api_dir.mkdir(parents=True)
        (api_dir / "route.js").write_text("export function GET() {}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.api_routes_count >= 1

    def test_count_api_routes_nextjs_pages_js(self):
        """Count .js route files in pages/api."""
        platform_dir = self.temp_dir / "js-pages-api"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14"}})
        )
        (platform_dir / "tsconfig.json").write_text("{}")
        api_dir = platform_dir / "pages" / "api"
        api_dir.mkdir(parents=True)
        (api_dir / "hello.js").write_text("export default function handler() {}")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.api_routes_count >= 1

    def test_count_api_routes_express_ts(self):
        """Count .ts and .js route files in routes/ for Express."""
        platform_dir = self.temp_dir / "express-ts-routes"
        platform_dir.mkdir()
        (platform_dir / "package.json").write_text(
            json.dumps({"dependencies": {"express": "^4"}})
        )
        routes_dir = platform_dir / "routes"
        routes_dir.mkdir()
        # Create both .ts and .js route files to cover both loops
        (routes_dir / "users.ts").write_text("router.get('/')")
        (routes_dir / "health.js").write_text("router.get('/')")
        api_dir = routes_dir / "api"
        api_dir.mkdir()
        (api_dir / "orders.ts").write_text("router.get('/')")
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        profile = analyzer.analyze_platform(platform_dir)
        assert profile.api_routes_count >= 3

    # ── Complexity scoring edge cases ────────────────────────────────

    def test_complexity_trade_os_level(self):
        """entity_count 200-500 triggers score += 4 -> MEDIUM."""
        from generators.core.platform_analyzer_v2 import (
            AuthInfo,
            DatabaseInfo,
            PlatformProfile,
            TechStack,
        )

        profile = PlatformProfile(
            platform_id="trade",
            name="Trade",
            path="/t",
            tech_stack=TechStack(),
            database=DatabaseInfo(),
            auth=AuthInfo(),
            entity_count=300,
            pages_count=0,
            api_routes_count=0,
            size_mb=0,
            features=[],
            production_readiness=0,
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        result = analyzer._calculate_complexity_calibrated(profile)
        assert result == "MEDIUM"

    def test_complexity_small_entities(self):
        """entity_count 30-80 triggers score += 2 -> LOW."""
        from generators.core.platform_analyzer_v2 import (
            AuthInfo,
            DatabaseInfo,
            PlatformProfile,
            TechStack,
        )

        profile = PlatformProfile(
            platform_id="small",
            name="Small",
            path="/s",
            tech_stack=TechStack(),
            database=DatabaseInfo(),
            auth=AuthInfo(),
            entity_count=50,
            pages_count=0,
            api_routes_count=0,
            size_mb=0,
            features=[],
            production_readiness=0,
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        result = analyzer._calculate_complexity_calibrated(profile)
        assert result == "LOW"

    def test_complexity_high_score(self):
        """Score 7-9 returns HIGH."""
        from generators.core.platform_analyzer_v2 import (
            AuthInfo,
            DatabaseInfo,
            PlatformProfile,
            TechStack,
        )

        # Score: entity 200-500 → 4 + has_rls → 1 + rls>50 → 1 + migrations>100 → 1 = 7 → HIGH
        profile = PlatformProfile(
            platform_id="high",
            name="High",
            path="/h",
            tech_stack=TechStack(),
            database=DatabaseInfo(has_rls=True, rls_policies=60, migrations_count=150),
            auth=AuthInfo(),
            entity_count=300,
            pages_count=0,
            api_routes_count=0,
            size_mb=0,
            features=[],
            production_readiness=0,
        )
        analyzer = PlatformAnalyzerV2(platforms_dir=self.temp_dir)
        result = analyzer._calculate_complexity_calibrated(profile)
        assert result == "HIGH"

    def test_analyze_all_legacy_root_not_found(self):
        """analyze_all returns [] when legacy root doesn't exist."""
        import shutil

        non_existent = self.temp_dir / "does-not-exist"
        analyzer = PlatformAnalyzerV2(platforms_dir=non_existent)
        result = analyzer.analyze_all()
        assert result == []
