#!/usr/bin/env python3
"""
Dependency Analyzer — Maps npm/pnpm dependency trees from legacy codebases,
classifies packages as backbone-shared vs product-specific, identifies
migration targets, and generates actionable dependency reports.

Supports:
- npm (package.json / package-lock.json) — ABR
- pnpm (package.json / pnpm-lock.yaml / pnpm-workspace.yaml) — UE
- Turborepo monorepo detection
- Supabase → Django migration dependency classification
- Drizzle → Django migration dependency classification
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Any, Set, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum

try:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from logging_config import MigrationLogger
    logger = MigrationLogger.get_logger(__name__)
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Enums & Data Classes
# ──────────────────────────────────────────────

class DependencyCategory(Enum):
    """Classification category for npm/pnpm packages"""
    BACKBONE_SHARED = "backbone_shared"     # Needed in Django backbone
    PRODUCT_SPECIFIC = "product_specific"   # Vertical-app specific
    FRONTEND_ONLY = "frontend_only"         # React/Next.js, no backend equiv
    REMOVE = "remove"                       # Supabase/Drizzle — replaced by Django
    MIGRATE = "migrate"                     # Has a Python/Django equivalent
    KEEP = "keep"                           # Can still be used alongside Django
    EVALUATE = "evaluate"                   # Needs manual evaluation
    DEV_ONLY = "dev_only"                   # Dev dependency, not for prod


class MigrationTarget(Enum):
    """What the package migrates to in Django"""
    DJANGO_ORM = "django_orm"
    DRF = "django_rest_framework"
    CELERY = "celery"
    DJANGO_CHANNELS = "django_channels"
    DJANGO_FILTER = "django_filter"
    DJANGO_CORS = "django_cors"
    REDIS_PY = "redis_py"
    PILLOW = "pillow"
    PSYCOPG = "psycopg"
    CLERK_BACKEND = "clerk_backend_api"
    STRIPE_PYTHON = "stripe_python"
    SENTRY_SDK = "sentry_sdk"
    NONE = "none"
    MANUAL = "manual_review"


@dataclass
class PackageInfo:
    """Analyzed npm package"""
    name: str
    version: str
    is_dev: bool
    category: DependencyCategory
    migration_target: MigrationTarget = MigrationTarget.NONE
    python_equivalent: Optional[str] = None
    notes: str = ""
    risk_level: str = "low"  # low, medium, high
    usage_count: int = 0     # How many files import it


@dataclass
class DependencyReport:
    """Full dependency analysis report"""
    platform: str
    timestamp: str
    package_manager: str
    total_packages: int
    production_packages: int
    dev_packages: int
    categories: Dict[str, int] = field(default_factory=dict)
    packages: List[Dict[str, Any]] = field(default_factory=list)
    migration_summary: Dict[str, Any] = field(default_factory=dict)
    risk_assessment: Dict[str, Any] = field(default_factory=dict)
    monorepo: bool = False
    workspace_packages: List[str] = field(default_factory=list)


# ──────────────────────────────────────────────
# Known Package Classification Database
# ──────────────────────────────────────────────

# Packages that map to Django/Python equivalents
PACKAGE_MIGRATION_MAP: Dict[str, Tuple[DependencyCategory, MigrationTarget, str]] = {
    # Database / ORM — REMOVE (replaced by Django ORM)
    "drizzle-orm": (DependencyCategory.REMOVE, MigrationTarget.DJANGO_ORM, "django.db.models"),
    "drizzle-kit": (DependencyCategory.REMOVE, MigrationTarget.DJANGO_ORM, "manage.py makemigrations"),
    "@supabase/supabase-js": (DependencyCategory.REMOVE, MigrationTarget.DJANGO_ORM, "django.db.models"),
    "@supabase/auth-helpers-nextjs": (DependencyCategory.REMOVE, MigrationTarget.CLERK_BACKEND, "clerk-backend-api"),
    "@supabase/ssr": (DependencyCategory.REMOVE, MigrationTarget.CLERK_BACKEND, "clerk-backend-api"),
    "@supabase/postgrest-js": (DependencyCategory.REMOVE, MigrationTarget.DJANGO_ORM, "django.db.models"),
    "pg": (DependencyCategory.REMOVE, MigrationTarget.PSYCOPG, "psycopg[binary]"),
    "postgres": (DependencyCategory.REMOVE, MigrationTarget.PSYCOPG, "psycopg[binary]"),
    "@neondatabase/serverless": (DependencyCategory.REMOVE, MigrationTarget.PSYCOPG, "psycopg[binary]"),

    # Auth — MIGRATE
    "@clerk/nextjs": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "stays in Next.js"),
    "@clerk/backend": (DependencyCategory.MIGRATE, MigrationTarget.CLERK_BACKEND, "clerk-backend-api"),
    "@clerk/clerk-sdk-node": (DependencyCategory.MIGRATE, MigrationTarget.CLERK_BACKEND, "clerk-backend-api"),

    # API / REST
    "axios": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "frontend HTTP client"),
    "ky": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "frontend HTTP client"),
    "next": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "stays as frontend"),
    "react": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "stays as frontend"),
    "react-dom": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "stays as frontend"),

    # Queue / Workers
    "bullmq": (DependencyCategory.MIGRATE, MigrationTarget.CELERY, "celery[redis]"),
    "bull": (DependencyCategory.MIGRATE, MigrationTarget.CELERY, "celery[redis]"),
    "ioredis": (DependencyCategory.MIGRATE, MigrationTarget.REDIS_PY, "redis"),
    "redis": (DependencyCategory.MIGRATE, MigrationTarget.REDIS_PY, "redis"),

    # Payment
    "stripe": (DependencyCategory.MIGRATE, MigrationTarget.STRIPE_PYTHON, "stripe"),
    "@stripe/stripe-js": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "frontend Stripe"),
    "@stripe/react-stripe-js": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "frontend Stripe"),

    # Monitoring
    "@sentry/nextjs": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "frontend Sentry"),
    "@sentry/node": (DependencyCategory.MIGRATE, MigrationTarget.SENTRY_SDK, "sentry-sdk"),

    # CORS
    "cors": (DependencyCategory.MIGRATE, MigrationTarget.DJANGO_CORS, "django-cors-headers"),

    # Image Processing
    "sharp": (DependencyCategory.MIGRATE, MigrationTarget.PILLOW, "Pillow"),

    # Validation
    "zod": (DependencyCategory.MIGRATE, MigrationTarget.DRF, "DRF serializers"),
    "yup": (DependencyCategory.MIGRATE, MigrationTarget.DRF, "DRF serializers"),
    "joi": (DependencyCategory.MIGRATE, MigrationTarget.DRF, "DRF serializers"),

    # Email
    "nodemailer": (DependencyCategory.MIGRATE, MigrationTarget.MANUAL, "django.core.mail"),
    "resend": (DependencyCategory.MIGRATE, MigrationTarget.MANUAL, "django.core.mail + resend-python"),
    "@react-email/components": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "email templates"),

    # GraphQL
    "@apollo/client": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "evaluate DRF vs graphene"),
    "graphql": (DependencyCategory.EVALUATE, MigrationTarget.MANUAL, "graphene-django (evaluate)"),
    "@graphql-codegen/cli": (DependencyCategory.DEV_ONLY, MigrationTarget.NONE, "N/A if graphql removed"),

    # AI
    "openai": (DependencyCategory.MIGRATE, MigrationTarget.MANUAL, "openai (python)"),
    "@langchain/core": (DependencyCategory.MIGRATE, MigrationTarget.MANUAL, "langchain (python)"),
    "langchain": (DependencyCategory.MIGRATE, MigrationTarget.MANUAL, "langchain (python)"),
    "ai": (DependencyCategory.EVALUATE, MigrationTarget.MANUAL, "vercel-ai — evaluate"),

    # UI Libraries — FRONTEND ONLY
    "tailwindcss": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "CSS framework"),
    "@radix-ui/react-dialog": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "UI component"),
    "lucide-react": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "icon library"),
    "framer-motion": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "animation"),
    "recharts": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "charts"),
    "cmdk": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "command menu"),
    "sonner": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "toast notifications"),
    "zustand": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "state management"),
    "@tanstack/react-query": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "data fetching"),
    "@tanstack/react-table": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "table component"),
    "next-themes": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "theme switching"),
    "next-intl": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "i18n"),
    "class-variance-authority": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "CSS variants"),
    "clsx": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "CSS util"),
    "tailwind-merge": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "CSS util"),

    # Dev Tools — DEV ONLY
    "typescript": (DependencyCategory.DEV_ONLY, MigrationTarget.NONE, "N/A"),
    "eslint": (DependencyCategory.DEV_ONLY, MigrationTarget.NONE, "ruff/flake8"),
    "prettier": (DependencyCategory.DEV_ONLY, MigrationTarget.NONE, "black/ruff"),
    "jest": (DependencyCategory.DEV_ONLY, MigrationTarget.NONE, "pytest"),
    "vitest": (DependencyCategory.DEV_ONLY, MigrationTarget.NONE, "pytest"),
    "@types/node": (DependencyCategory.DEV_ONLY, MigrationTarget.NONE, "N/A"),
    "@types/react": (DependencyCategory.DEV_ONLY, MigrationTarget.NONE, "N/A"),
    "turbo": (DependencyCategory.DEV_ONLY, MigrationTarget.NONE, "N/A"),

    # File / PDF
    "pdf-lib": (DependencyCategory.MIGRATE, MigrationTarget.MANUAL, "reportlab / pypdf"),
    "@react-pdf/renderer": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "frontend PDF"),
    "jspdf": (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "frontend PDF"),
    "xlsx": (DependencyCategory.MIGRATE, MigrationTarget.MANUAL, "openpyxl"),
    "csv-parser": (DependencyCategory.MIGRATE, MigrationTarget.MANUAL, "csv (stdlib)"),

    # Scheduling
    "node-cron": (DependencyCategory.MIGRATE, MigrationTarget.CELERY, "celery-beat"),
    "cron": (DependencyCategory.MIGRATE, MigrationTarget.CELERY, "celery-beat"),
}


# ──────────────────────────────────────────────
# Dependency Analyzer
# ──────────────────────────────────────────────

class DependencyAnalyzer:
    """
    Analyzes npm/pnpm dependencies from legacy codebases and produces
    classified migration reports.

    Usage:
        analyzer = DependencyAnalyzer(project_root=Path("legacy-codebases/ue/"))
        report = analyzer.analyze()
        analyzer.write_report(Path("automation/data/ue-dependency-report.json"))
    """

    def __init__(self, project_root: Path, platform: str = "unknown"):
        self.project_root = Path(project_root)
        self.platform = platform
        self.packages: Dict[str, PackageInfo] = {}
        self.is_monorepo = False
        self.workspace_packages: List[str] = []

    def analyze(self) -> DependencyReport:
        """Run full dependency analysis"""
        logger.info(f"Analyzing dependencies for {self.platform} @ {self.project_root}")

        # Detect package manager and monorepo
        self._detect_package_manager()

        # Load package.json(s)
        self._load_packages()

        # Count usage across source files
        self._count_usage()

        # Classify all packages
        self._classify_packages()

        # Build report
        return self._build_report()

    def _detect_package_manager(self):
        """Detect npm vs pnpm and monorepo setup"""
        if (self.project_root / "pnpm-lock.yaml").exists():
            self.pkg_manager = "pnpm"
        elif (self.project_root / "pnpm-workspace.yaml").exists():
            self.pkg_manager = "pnpm"
        elif (self.project_root / "yarn.lock").exists():
            self.pkg_manager = "yarn"
        else:
            self.pkg_manager = "npm"

        # Check monorepo
        if (self.project_root / "turbo.json").exists():
            self.is_monorepo = True

        pnpm_ws = self.project_root / "pnpm-workspace.yaml"
        if pnpm_ws.exists():
            self.is_monorepo = True
            try:
                content = pnpm_ws.read_text(encoding="utf-8", errors="ignore")
                # Simple extraction
                for match in re.finditer(r'["\']?([^"\']+)["\']?', content):
                    pkg = match.group(1).strip()
                    if pkg and not pkg.startswith("#"):
                        self.workspace_packages.append(pkg)
            except Exception:
                pass

        logger.info(f"Package manager: {self.pkg_manager}, Monorepo: {self.is_monorepo}")

    def _load_packages(self):
        """Load all package.json files"""
        # Root package.json
        root_pkg = self.project_root / "package.json"
        if root_pkg.exists():
            self._parse_package_json(root_pkg)

        # Monorepo: scan workspace packages
        if self.is_monorepo:
            for pkg_json in self.project_root.rglob("package.json"):
                if "node_modules" in str(pkg_json):
                    continue
                if pkg_json != root_pkg:
                    self._parse_package_json(pkg_json)

    def _parse_package_json(self, pkg_path: Path):
        """Parse a package.json file"""
        try:
            with open(pkg_path, encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"Could not parse {pkg_path}: {e}")
            return

        # Production dependencies
        for name, version in data.get("dependencies", {}).items():
            if name not in self.packages:
                self.packages[name] = PackageInfo(
                    name=name,
                    version=str(version),
                    is_dev=False,
                    category=DependencyCategory.EVALUATE,
                )

        # Dev dependencies
        for name, version in data.get("devDependencies", {}).items():
            if name not in self.packages:
                self.packages[name] = PackageInfo(
                    name=name,
                    version=str(version),
                    is_dev=True,
                    category=DependencyCategory.DEV_ONLY,
                )

    def _count_usage(self):
        """Count how many source files import each package"""
        source_exts = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
        skip_dirs = {"node_modules", ".git", "dist", "build", ".next", ".turbo",
                     "__pycache__", ".cache", "coverage", ".nyc_output", ".vercel"}
        source_files = [
            f for f in self.project_root.rglob("*")
            if f.suffix in source_exts
            and not any(sd in f.parts for sd in skip_dirs)
            and f.stat().st_size < 500_000  # skip files > 500KB
        ]

        for src_file in source_files:
            try:
                content = src_file.read_text(encoding="utf-8", errors="ignore")
            except IOError:
                continue

            for pkg_name in self.packages:
                # Match import/require patterns
                if pkg_name in content:
                    # Verify it's actually an import
                    patterns = [
                        f'from ["\']{ re.escape(pkg_name)}',
                        f'require\\(["\']{ re.escape(pkg_name)}',
                        f'import ["\']{ re.escape(pkg_name)}',
                    ]
                    for pat in patterns:
                        if re.search(pat, content):
                            self.packages[pkg_name].usage_count += 1
                            break

    def _classify_packages(self):
        """Classify each package based on known mappings"""
        for name, pkg in self.packages.items():
            # Check exact match first
            if name in PACKAGE_MIGRATION_MAP:
                cat, target, equiv = PACKAGE_MIGRATION_MAP[name]
                pkg.category = cat
                pkg.migration_target = target
                pkg.python_equivalent = equiv
                continue

            # Check prefix patterns
            classified = False
            for prefix_pattern, (cat, target, equiv) in [
                ("@radix-ui/", (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "UI component")),
                ("@headlessui/", (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "UI component")),
                ("@hookform/", (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "form lib")),
                ("@types/", (DependencyCategory.DEV_ONLY, MigrationTarget.NONE, "N/A")),
                ("eslint-", (DependencyCategory.DEV_ONLY, MigrationTarget.NONE, "ruff")),
                ("@eslint", (DependencyCategory.DEV_ONLY, MigrationTarget.NONE, "ruff")),
                ("@typescript-eslint/", (DependencyCategory.DEV_ONLY, MigrationTarget.NONE, "N/A")),
                ("postcss", (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "CSS tooling")),
                ("autoprefixer", (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "CSS tooling")),
                ("@next/", (DependencyCategory.FRONTEND_ONLY, MigrationTarget.NONE, "Next.js plugin")),
                ("@vercel/", (DependencyCategory.EVALUATE, MigrationTarget.MANUAL, "Vercel service")),
                ("@supabase/", (DependencyCategory.REMOVE, MigrationTarget.DJANGO_ORM, "Django ORM")),
            ]:
                if name.startswith(prefix_pattern):
                    pkg.category = cat
                    pkg.migration_target = target
                    pkg.python_equivalent = equiv
                    classified = True
                    break

            if classified:
                continue

            # Dev deps default to DEV_ONLY
            if pkg.is_dev:
                pkg.category = DependencyCategory.DEV_ONLY
                continue

            # Everything else stays EVALUATE
            pkg.category = DependencyCategory.EVALUATE

        # Assign risk levels
        for pkg in self.packages.values():
            if pkg.category in (DependencyCategory.REMOVE, DependencyCategory.MIGRATE):
                if pkg.usage_count > 20:
                    pkg.risk_level = "high"
                elif pkg.usage_count > 5:
                    pkg.risk_level = "medium"
                else:
                    pkg.risk_level = "low"

    def _build_report(self) -> DependencyReport:
        """Build the final report"""
        prod_count = sum(1 for p in self.packages.values() if not p.is_dev)
        dev_count = sum(1 for p in self.packages.values() if p.is_dev)

        category_counts = {}
        for p in self.packages.values():
            cat = p.category.value
            category_counts[cat] = category_counts.get(cat, 0) + 1

        packages_data = []
        for name in sorted(self.packages.keys()):
            pkg = self.packages[name]
            packages_data.append({
                "name": name,
                "version": pkg.version,
                "is_dev": pkg.is_dev,
                "category": pkg.category.value,
                "migration_target": pkg.migration_target.value,
                "python_equivalent": pkg.python_equivalent,
                "notes": pkg.notes,
                "risk_level": pkg.risk_level,
                "usage_count": pkg.usage_count,
            })

        # Migration summary
        to_remove = [p for p in self.packages.values()
                     if p.category == DependencyCategory.REMOVE]
        to_migrate = [p for p in self.packages.values()
                      if p.category == DependencyCategory.MIGRATE]
        to_evaluate = [p for p in self.packages.values()
                       if p.category == DependencyCategory.EVALUATE]

        migration_summary = {
            "packages_to_remove": len(to_remove),
            "packages_to_migrate": len(to_migrate),
            "packages_to_evaluate": len(to_evaluate),
            "packages_frontend_only": sum(
                1 for p in self.packages.values()
                if p.category == DependencyCategory.FRONTEND_ONLY
            ),
            "python_packages_needed": list(set(
                p.python_equivalent for p in to_migrate
                if p.python_equivalent
            )),
            "high_risk_migrations": [
                {"name": p.name, "usage_count": p.usage_count,
                 "target": p.python_equivalent}
                for p in (to_remove + to_migrate)
                if p.risk_level == "high"
            ],
        }

        risk_assessment = {
            "high_risk_count": sum(1 for p in self.packages.values()
                                   if p.risk_level == "high"),
            "medium_risk_count": sum(1 for p in self.packages.values()
                                     if p.risk_level == "medium"),
            "low_risk_count": sum(1 for p in self.packages.values()
                                  if p.risk_level == "low"),
        }

        return DependencyReport(
            platform=self.platform,
            timestamp=datetime.now().isoformat(),
            package_manager=self.pkg_manager,
            total_packages=len(self.packages),
            production_packages=prod_count,
            dev_packages=dev_count,
            categories=category_counts,
            packages=packages_data,
            migration_summary=migration_summary,
            risk_assessment=risk_assessment,
            monorepo=self.is_monorepo,
            workspace_packages=self.workspace_packages,
        )

    def write_report(self, output_path: Path):
        """Analyze and write report to JSON"""
        report = self.analyze()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(asdict(report), f, indent=2, default=str)
        logger.info(f"Dependency report written: {output_path}")
        return report


# ──────────────────────────────────────────────
# CLI Entry Points
# ──────────────────────────────────────────────

def analyze_abr_dependencies(workspace_root: Path) -> DependencyReport:
    """Analyze ABR Insights dependencies"""
    logger.info("=" * 60)
    logger.info("ABR Insights — Dependency Analysis")
    logger.info("=" * 60)

    # Try D:\APPS first (with nested structure), then fall back to workspace/legacy-codebases
    project_root = Path("D:/APPS/abr-insights-app-main/abr-insights-app-main")
    if not project_root.exists():
        project_root = (
            workspace_root / "legacy-codebases" / "abr-insights-app-main"
            / "abr-insights-app-main"
        )
    
    output_path = workspace_root / "packages" / "automation" / "data" / "abr-dependency-report.json"

    analyzer = DependencyAnalyzer(project_root=project_root, platform="abr-insights")
    return analyzer.write_report(output_path)


def analyze_ue_dependencies(workspace_root: Path) -> DependencyReport:
    """Analyze Union Eyes dependencies"""
    logger.info("=" * 60)
    logger.info("Union Eyes — Dependency Analysis")
    logger.info("=" * 60)

    # Try D:\APPS first (with nested structure), then fall back to workspace/legacy-codebases
    project_root = Path("D:/APPS/Union_Eyes_app_v1-main/Union_Eyes_app_v1-main")
    if not project_root.exists():
        project_root = (
            workspace_root / "legacy-codebases" / "Union_Eyes_app_v1-main"
            / "Union_Eyes_app_v1-main"
        )
    
    output_path = workspace_root / "packages" / "automation" / "data" / "ue-dependency-report.json"

    analyzer = DependencyAnalyzer(project_root=project_root, platform="union-eyes")
    return analyzer.write_report(output_path)


def main():
    """CLI entry point"""
    import argparse
    parser = argparse.ArgumentParser(description="Nzila Dependency Analyzer")
    parser.add_argument("--platform", choices=["abr", "ue", "all"], default="all")
    parser.add_argument("--workspace", type=Path,
                        default=Path(__file__).parent.parent.parent)
    args = parser.parse_args()

    if args.platform in ("abr", "all"):
        report = analyze_abr_dependencies(args.workspace)
        logger.info(f"ABR: {report.total_packages} packages "
                     f"({report.production_packages} prod, {report.dev_packages} dev)")
    if args.platform in ("ue", "all"):
        report = analyze_ue_dependencies(args.workspace)
        logger.info(f"UE: {report.total_packages} packages "
                     f"({report.production_packages} prod, {report.dev_packages} dev)")


if __name__ == "__main__":
    main()
