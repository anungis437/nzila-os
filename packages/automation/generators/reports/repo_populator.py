#!/usr/bin/env python3
"""
Repo Populator — Creates production-ready repository structures for
Union Eyes and ABR Insights by combining scaffolds with generated code.

Populates complete repos ready for development and deployment.
"""

import shutil
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

try:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from logging_config import MigrationLogger
    logger = MigrationLogger.get_logger(__name__)
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)


class RepoPopulator:
    """Populate production-ready repository structures"""
    
    def __init__(self, workspace_root: Path):
        self.workspace_root = Path(workspace_root)
        self.scaffold_root = self.workspace_root / "tech-repo-scaffold"
        self.generated_root = self.workspace_root / "packages" / "automation" / "data" / "generated"
        self.output_root = self.workspace_root.parent  # One level up from workspace
        
    def create_repo_structure(self, platform: str, repo_name: str) -> Path:
        """Create complete repo structure for a platform"""
        repo_path = self.output_root / repo_name
        
        if repo_path.exists():
            logger.warning(f"Repository already exists: {repo_path}")
            response = input("Overwrite? (y/N): ")
            if response.lower() != 'y':
                logger.info("Aborted.")
                return repo_path
            shutil.rmtree(repo_path)
        
        logger.info(f"Creating repository: {repo_path}")
        repo_path.mkdir(parents=True, exist_ok=True)
        
        # Copy template structure
        template_dir = self.scaffold_root / "vertical-apps" / "template"
        if template_dir.exists():
            for item in template_dir.iterdir():
                if item.name == "scaffold.py":
                    continue
                if item.is_file():
                    shutil.copy2(item, repo_path / item.name)
                else:
                    shutil.copytree(item, repo_path / item.name, dirs_exist_ok=True)
        
        # Copy generated Django backend code
        self._copy_django_apps(platform, repo_path)
        
        # Create additional files
        self._create_readme(platform, repo_path)
        self._create_env_example(platform, repo_path)
        self._create_gitignore(repo_path)
        
        logger.info(f"✅ Repository created: {repo_path}")
        return repo_path
    
    def _copy_django_apps(self, platform: str, repo_path: Path):
        """Copy generated Django apps to backend/"""
        backend_dir = repo_path / "backend"
        backend_dir.mkdir(parents=True, exist_ok=True)
        
        source_dir = self.generated_root / platform
        if not source_dir.exists():
            logger.warning(f"Generated code not found: {source_dir}")
            return
        
        # Copy all generated apps
        for app_dir in source_dir.iterdir():
            if app_dir.is_dir() and not app_dir.name.startswith('.'):
                dest = backend_dir / app_dir.name
                if dest.exists():
                    shutil.rmtree(dest)
                shutil.copytree(app_dir, dest)
                logger.info(f"  Copied app: {app_dir.name}")
    
    def _create_readme(self, platform: str, repo_path: Path):
        """Create comprehensive README"""
        # Map platform_id to scaffold filename
        scaffold_names = {
            "ue": "union-eyes-scaffold.md",
            "abr": "abr-insights-scaffold.md",
        }
        scaffold_filename = scaffold_names.get(platform, f"{platform}-scaffold.md")
        scaffold_doc = self.scaffold_root / "vertical-apps" / scaffold_filename
        
        if scaffold_doc.exists():
            shutil.copy2(scaffold_doc, repo_path / "README.md")
        else:
            # Create basic README
           (repo_path / "README.md").write_text(f"""# {platform.replace('_', ' ').title()}

Production-ready repository for {platform.replace('_', ' ').title()} platform.

## Quick Start

See documentation in `tech-repo-scaffold/vertical-apps/{platform}-scaffold.md`
""")
    
    def _create_env_example(self, platform: str, repo_path: Path):
        """Create .env.example file"""
        env_content = """# Django
DJANGO_SECRET_KEY=change-me-in-production
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# Database
PGHOST=localhost
PGDATABASE=nzila_platform
PGUSER=postgres
PGPASSWORD=postgres
PGPORT=5432
PGSSLMODE=prefer

# Redis
REDIS_URL=redis://localhost:6379/0

# Clerk
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

# Stripe (via Backbone)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Azure OpenAI (via Backbone)
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-4

# Backbone API
BACKBONE_API_URL=http://localhost:8000
BACKBONE_API_KEY=
"""
        
        if platform == "abr":
            env_content += """
# CanLII API
CANLII_API_KEY=

# i18n
NEXT_PUBLIC_DEFAULT_LOCALE=en
NEXT_PUBLIC_LOCALES=en,fr
"""
        
        (repo_path / ".env.example").write_text(env_content)
    
    def _create_gitignore(self, repo_path: Path):
        """Create .gitignore file"""
        gitignore_content = """# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
.venv/
venv/
ENV/

# Django
*.log
local_settings.py
db.sqlite3
db.sqlite3-journal
media/
staticfiles/

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*
.next/
out/
.turbo/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Testing
.coverage
htmlcov/
.pytest_cache/
.hypothesis/

# Misc
*.bak
*.tmp
"""
        (repo_path / ".gitignore").write_text(gitignore_content)


def main():
    """CLI entry point"""
    import argparse
    parser = argparse.ArgumentParser(description="Repository Populator")
    parser.add_argument("--platform", choices=["ue", "abr", "all"], default="all")
    parser.add_argument("--workspace", type=Path,
                        default=Path(__file__).parent.parent.parent.parent)
    
    args = parser.parse_args()
    
    populator = RepoPopulator(args.workspace)
    
    if args.platform in ("ue", "all"):
        logger.info("=" * 60)
        logger.info("Populating Union Eyes Repository")
        logger.info("=" * 60)
        populator.create_repo_structure("ue", "nzila-union-eyes")
    
    if args.platform in ("abr", "all"):
        logger.info("=" * 60)
        logger.info("Populating ABR Insights Repository")
        logger.info("=" * 60)
        populator.create_repo_structure("abr", "nzila-abr-insights")


if __name__ == "__main__":
    main()
