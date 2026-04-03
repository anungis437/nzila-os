"""
Unit tests for dependency_analyzer.py

Tests DependencyAnalyzer, PackageInfo, DependencyReport, and classification logic.
"""

import json
import sys
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "generators"))
sys.path.insert(0, str(Path(__file__).parent.parent / "generators" / "core"))

from dependency_analyzer import (
    PACKAGE_MIGRATION_MAP,
    DependencyAnalyzer,
    DependencyCategory,
    DependencyReport,
    MigrationTarget,
    PackageInfo,
)


@pytest.mark.unit
class TestDataClasses:
    """Test data classes and enums."""

    def test_dependency_category_values(self):
        assert DependencyCategory.BACKBONE_SHARED.value == "backbone_shared"
        assert DependencyCategory.REMOVE.value == "remove"
        assert DependencyCategory.MIGRATE.value == "migrate"
        assert DependencyCategory.FRONTEND_ONLY.value == "frontend_only"
        assert DependencyCategory.DEV_ONLY.value == "dev_only"
        assert DependencyCategory.EVALUATE.value == "evaluate"

    def test_migration_target_values(self):
        assert MigrationTarget.DJANGO_ORM.value == "django_orm"
        assert MigrationTarget.CELERY.value == "celery"
        assert MigrationTarget.NONE.value == "none"

    def test_package_info_defaults(self):
        pkg = PackageInfo(
            name="test",
            version="1.0.0",
            is_dev=False,
            category=DependencyCategory.EVALUATE,
        )
        assert pkg.migration_target == MigrationTarget.NONE
        assert pkg.python_equivalent is None
        assert pkg.risk_level == "low"
        assert pkg.usage_count == 0

    def test_dependency_report_defaults(self):
        report = DependencyReport(
            platform="test",
            timestamp="2026-01-01",
            package_manager="npm",
            total_packages=0,
            production_packages=0,
            dev_packages=0,
        )
        assert report.categories == {}
        assert report.packages == []
        assert report.monorepo is False


@pytest.mark.unit
class TestPackageMigrationMap:
    """Test the known package classification database."""

    def test_drizzle_classified_as_remove(self):
        cat, target, equiv = PACKAGE_MIGRATION_MAP["drizzle-orm"]
        assert cat == DependencyCategory.REMOVE
        assert target == MigrationTarget.DJANGO_ORM
        assert equiv == "django.db.models"

    def test_clerk_nextjs_classified_as_frontend(self):
        cat, target, _ = PACKAGE_MIGRATION_MAP["@clerk/nextjs"]
        assert cat == DependencyCategory.FRONTEND_ONLY

    def test_stripe_classified_as_migrate(self):
        cat, target, equiv = PACKAGE_MIGRATION_MAP["stripe"]
        assert cat == DependencyCategory.MIGRATE
        assert target == MigrationTarget.STRIPE_PYTHON
        assert equiv == "stripe"

    def test_bullmq_maps_to_celery(self):
        cat, target, _ = PACKAGE_MIGRATION_MAP["bullmq"]
        assert target == MigrationTarget.CELERY

    def test_typescript_classified_as_dev(self):
        cat, _, _ = PACKAGE_MIGRATION_MAP["typescript"]
        assert cat == DependencyCategory.DEV_ONLY


@pytest.mark.unit
class TestDependencyAnalyzer:
    """Test DependencyAnalyzer class."""

    def test_initialization(self, tmp_path):
        analyzer = DependencyAnalyzer(project_root=tmp_path, platform="test")
        assert analyzer.project_root == tmp_path
        assert analyzer.platform == "test"
        assert analyzer.packages == {}
        assert analyzer.is_monorepo is False

    def test_detect_npm(self, tmp_path):
        """Test npm detection (no lock file → defaults to npm)."""
        (tmp_path / "package.json").write_text("{}")
        analyzer = DependencyAnalyzer(project_root=tmp_path, platform="test")
        analyzer._detect_package_manager()
        assert analyzer.pkg_manager == "npm"

    def test_detect_pnpm_lock(self, tmp_path):
        """Test pnpm detection via lock file."""
        (tmp_path / "pnpm-lock.yaml").write_text("")
        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer._detect_package_manager()
        assert analyzer.pkg_manager == "pnpm"

    def test_detect_pnpm_workspace(self, tmp_path):
        """Test pnpm detection via workspace file."""
        (tmp_path / "pnpm-workspace.yaml").write_text(
            "packages:\n  - 'apps/*'\n  - 'packages/*'\n"
        )
        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer._detect_package_manager()
        assert analyzer.pkg_manager == "pnpm"
        assert analyzer.is_monorepo is True

    def test_detect_yarn(self, tmp_path):
        """Test yarn detection."""
        (tmp_path / "yarn.lock").write_text("")
        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer._detect_package_manager()
        assert analyzer.pkg_manager == "yarn"

    def test_detect_monorepo_turbo(self, tmp_path):
        """Test monorepo detection via turbo.json."""
        (tmp_path / "turbo.json").write_text("{}")
        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer._detect_package_manager()
        assert analyzer.is_monorepo is True

    def test_load_packages_production(self, tmp_path):
        """Test loading production dependencies from package.json."""
        (tmp_path / "package.json").write_text(
            json.dumps(
                {
                    "dependencies": {
                        "next": "^14.0.0",
                        "react": "^18.0.0",
                    }
                }
            )
        )
        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer._load_packages()

        assert "next" in analyzer.packages
        assert "react" in analyzer.packages
        assert analyzer.packages["next"].is_dev is False

    def test_load_packages_dev(self, tmp_path):
        """Test loading dev dependencies."""
        (tmp_path / "package.json").write_text(
            json.dumps(
                {
                    "devDependencies": {
                        "typescript": "^5.0.0",
                        "vitest": "^1.0.0",
                    }
                }
            )
        )
        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer._load_packages()

        assert "typescript" in analyzer.packages
        assert analyzer.packages["typescript"].is_dev is True

    def test_load_packages_monorepo(self, tmp_path):
        """Test scanning workspace packages in monorepo."""
        (tmp_path / "package.json").write_text(
            json.dumps({"dependencies": {"turbo": "^1.0.0"}})
        )
        app_dir = tmp_path / "apps" / "web"
        app_dir.mkdir(parents=True)
        (app_dir / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )

        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer.is_monorepo = True
        analyzer._load_packages()

        assert "turbo" in analyzer.packages
        assert "next" in analyzer.packages

    def test_load_invalid_package_json(self, tmp_path):
        """Test handling of invalid package.json."""
        (tmp_path / "package.json").write_text("not valid json {{{")
        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer._load_packages()
        assert len(analyzer.packages) == 0

    def test_classify_known_packages(self, tmp_path):
        """Test classification of known packages."""
        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer.packages = {
            "drizzle-orm": PackageInfo(
                "drizzle-orm", "0.29.0", False, DependencyCategory.EVALUATE
            ),
            "stripe": PackageInfo(
                "stripe", "12.0.0", False, DependencyCategory.EVALUATE
            ),
            "next": PackageInfo("next", "14.0.0", False, DependencyCategory.EVALUATE),
        }
        analyzer._classify_packages()

        assert analyzer.packages["drizzle-orm"].category == DependencyCategory.REMOVE
        assert analyzer.packages["stripe"].category == DependencyCategory.MIGRATE
        assert analyzer.packages["next"].category == DependencyCategory.FRONTEND_ONLY

    def test_classify_prefix_patterns(self, tmp_path):
        """Test classification via prefix matching."""
        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer.packages = {
            "@radix-ui/react-dialog": PackageInfo(
                "@radix-ui/react-dialog", "1.0", False, DependencyCategory.EVALUATE
            ),
            "@types/node": PackageInfo(
                "@types/node", "20.0", True, DependencyCategory.EVALUATE
            ),
            "eslint-plugin-react": PackageInfo(
                "eslint-plugin-react", "7.0", True, DependencyCategory.EVALUATE
            ),
        }
        analyzer._classify_packages()

        assert (
            analyzer.packages["@radix-ui/react-dialog"].category
            == DependencyCategory.FRONTEND_ONLY
        )
        assert analyzer.packages["@types/node"].category == DependencyCategory.DEV_ONLY
        assert (
            analyzer.packages["eslint-plugin-react"].category
            == DependencyCategory.DEV_ONLY
        )

    def test_classify_unknown_dev(self, tmp_path):
        """Test dev deps default to DEV_ONLY."""
        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer.packages = {
            "some-unknown-dev-tool": PackageInfo(
                "some-unknown-dev-tool", "1.0", True, DependencyCategory.EVALUATE
            ),
        }
        analyzer._classify_packages()
        assert (
            analyzer.packages["some-unknown-dev-tool"].category
            == DependencyCategory.DEV_ONLY
        )

    def test_classify_unknown_prod(self, tmp_path):
        """Test unknown prod deps stay as EVALUATE."""
        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer.packages = {
            "some-unknown-lib": PackageInfo(
                "some-unknown-lib", "1.0", False, DependencyCategory.EVALUATE
            ),
        }
        analyzer._classify_packages()
        assert (
            analyzer.packages["some-unknown-lib"].category
            == DependencyCategory.EVALUATE
        )

    def test_risk_assessment(self, tmp_path):
        """Test risk level assignment based on usage count."""
        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer.packages = {
            "drizzle-orm": PackageInfo(
                "drizzle-orm",
                "0.29.0",
                False,
                DependencyCategory.EVALUATE,
                usage_count=25,
            ),
            "stripe": PackageInfo(
                "stripe", "12.0.0", False, DependencyCategory.EVALUATE, usage_count=8
            ),
            "cors": PackageInfo(
                "cors", "2.0.0", False, DependencyCategory.EVALUATE, usage_count=2
            ),
        }
        analyzer._classify_packages()

        assert analyzer.packages["drizzle-orm"].risk_level == "high"
        assert analyzer.packages["stripe"].risk_level == "medium"
        assert analyzer.packages["cors"].risk_level == "low"

    def test_count_usage(self, tmp_path):
        """Test import counting in source files."""
        (tmp_path / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0", "react": "^18.0.0"}})
        )
        src = tmp_path / "src"
        src.mkdir()
        (src / "page.tsx").write_text(
            "import { useState } from 'react';\n" "import Link from 'next/link';\n"
        )
        (src / "layout.tsx").write_text("import React from 'react';\n")

        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer._load_packages()
        analyzer._count_usage()

        assert analyzer.packages["react"].usage_count >= 2
        assert analyzer.packages["next"].usage_count >= 1

    def test_build_report(self, tmp_path):
        """Test full report building."""
        (tmp_path / "package.json").write_text(
            json.dumps(
                {
                    "dependencies": {"next": "^14.0.0", "drizzle-orm": "^0.29.0"},
                    "devDependencies": {"typescript": "^5.0.0"},
                }
            )
        )

        analyzer = DependencyAnalyzer(project_root=tmp_path, platform="test-app")
        analyzer.pkg_manager = "npm"
        analyzer._load_packages()
        analyzer._classify_packages()
        report = analyzer._build_report()

        assert isinstance(report, DependencyReport)
        assert report.platform == "test-app"
        assert report.total_packages == 3
        assert report.production_packages == 2
        assert report.dev_packages == 1
        assert "packages_to_remove" in report.migration_summary

    def test_full_analyze(self, tmp_path):
        """Test the full analyze() workflow."""
        (tmp_path / "package.json").write_text(
            json.dumps(
                {
                    "dependencies": {"next": "^14.0.0", "stripe": "^12.0.0"},
                    "devDependencies": {"vitest": "^1.0.0"},
                }
            )
        )

        analyzer = DependencyAnalyzer(project_root=tmp_path, platform="test")
        report = analyzer.analyze()

        assert isinstance(report, DependencyReport)
        assert report.total_packages == 3

    def test_write_report(self, tmp_path):
        """Test writing report to file."""
        (tmp_path / "package.json").write_text(
            json.dumps(
                {
                    "dependencies": {"react": "^18.0.0"},
                }
            )
        )
        output = tmp_path / "output" / "report.json"

        analyzer = DependencyAnalyzer(project_root=tmp_path, platform="test")
        analyzer.write_report(output)

        assert output.exists()
        with open(output) as f:
            data = json.load(f)
        assert data["platform"] == "test"
        assert data["total_packages"] == 1

    def test_empty_project(self, tmp_path):
        """Test analyzing a project with no package.json."""
        analyzer = DependencyAnalyzer(project_root=tmp_path, platform="empty")
        report = analyzer.analyze()
        assert report.total_packages == 0


@pytest.mark.unit
class TestDependencyAnalyzerExtended:
    """Extended tests for full coverage of dependency_analyzer."""

    # ── workspace-level package edge case ──────────────────────────────

    def test_workspace_packages_as_deps(self, tmp_path):
        """Workspace packages listed in dependencies are kept as-is."""
        (tmp_path / "package.json").write_text(
            json.dumps(
                {"dependencies": {"@nzila/shared": "workspace:*", "react": "^18.0.0"}}
            )
        )
        analyzer = DependencyAnalyzer(project_root=tmp_path, platform="test")
        analyzer._load_packages()
        # workspace: packages should still be loaded
        assert "react" in analyzer.packages

    # ── _load_packages monorepo scanning ───────────────────────────────

    def test_load_packages_monorepo_packages_dir(self, tmp_path):
        """Monorepo scans packages/ subdirectories."""
        (tmp_path / "package.json").write_text(json.dumps({"dependencies": {}}))
        pkg_dir = tmp_path / "packages" / "ui"
        pkg_dir.mkdir(parents=True)
        (pkg_dir / "package.json").write_text(
            json.dumps({"dependencies": {"react": "^18.0.0"}})
        )

        analyzer = DependencyAnalyzer(project_root=tmp_path, platform="test")
        analyzer.is_monorepo = True
        analyzer._load_packages()
        assert "react" in analyzer.packages

    # ── _classify_packages prefix patterns ─────────────────────────────

    def test_classify_radix_prefix(self, tmp_path):
        """@radix-ui/* classified as FRONTEND_ONLY via prefix."""
        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer.packages = {
            "@radix-ui/react-dialog": PackageInfo(
                "@radix-ui/react-dialog", "1.0", False, DependencyCategory.EVALUATE
            ),
        }
        analyzer._classify_packages()
        assert (
            analyzer.packages["@radix-ui/react-dialog"].category
            == DependencyCategory.FRONTEND_ONLY
        )

    def test_classify_eslint_prefix(self, tmp_path):
        """eslint-* classified as DEV_ONLY via prefix."""
        analyzer = DependencyAnalyzer(project_root=tmp_path)
        analyzer.packages = {
            "eslint-plugin-react": PackageInfo(
                "eslint-plugin-react", "1.0", False, DependencyCategory.EVALUATE
            ),
        }
        analyzer._classify_packages()
        assert (
            analyzer.packages["eslint-plugin-react"].category
            == DependencyCategory.DEV_ONLY
        )

    # ── analyze_abr_dependencies & analyze_ue_dependencies ─────────────

    def test_analyze_abr_dependencies(self, tmp_path):
        """analyze_abr_dependencies creates a DependencyReport."""
        from dependency_analyzer import analyze_abr_dependencies

        # Create workspace dirs
        project_root = (
            tmp_path
            / "legacy-codebases"
            / "abr-insights-app-main"
            / "abr-insights-app-main"
        )
        project_root.mkdir(parents=True)
        (project_root / "package.json").write_text(
            json.dumps({"dependencies": {"next": "^14.0.0"}})
        )
        data_dir = tmp_path / "packages" / "automation" / "data"
        data_dir.mkdir(parents=True)

        report = analyze_abr_dependencies(tmp_path)
        assert report.platform == "abr-insights"

    def test_analyze_ue_dependencies(self, tmp_path):
        """analyze_ue_dependencies creates a DependencyReport."""
        from dependency_analyzer import analyze_ue_dependencies

        project_root = (
            tmp_path
            / "legacy-codebases"
            / "Union_Eyes_app_v1-main"
            / "Union_Eyes_app_v1-main"
        )
        project_root.mkdir(parents=True)
        (project_root / "package.json").write_text(
            json.dumps({"dependencies": {"react": "^18.0.0"}})
        )
        data_dir = tmp_path / "packages" / "automation" / "data"
        data_dir.mkdir(parents=True)

        report = analyze_ue_dependencies(tmp_path)
        assert report.platform == "union-eyes"

    # ── main() CLI ──────────────────────────────────────────────────────

    def test_main_abr_only(self, tmp_path):
        from dependency_analyzer import main

        project_root = (
            tmp_path
            / "legacy-codebases"
            / "abr-insights-app-main"
            / "abr-insights-app-main"
        )
        project_root.mkdir(parents=True)
        (project_root / "package.json").write_text(json.dumps({"dependencies": {}}))
        (tmp_path / "packages" / "automation" / "data").mkdir(parents=True)

        with patch(
            "sys.argv", ["prog", "--platform", "abr", "--workspace", str(tmp_path)]
        ):
            main()

    def test_main_all(self, tmp_path):
        from dependency_analyzer import main

        for sub in [
            "legacy-codebases/abr-insights-app-main/abr-insights-app-main",
            "legacy-codebases/Union_Eyes_app_v1-main/Union_Eyes_app_v1-main",
        ]:
            p = tmp_path / sub
            p.mkdir(parents=True)
            (p / "package.json").write_text(json.dumps({"dependencies": {}}))
        (tmp_path / "packages" / "automation" / "data").mkdir(parents=True)

        with patch(
            "sys.argv", ["prog", "--platform", "all", "--workspace", str(tmp_path)]
        ):
            main()
