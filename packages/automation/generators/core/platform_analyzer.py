#!/usr/bin/env python3
"""
Platform Analyzer — Scans legacy codebases and extracts comprehensive metadata

This analyzer performs deep inspection of legacy platforms to extract:
- Framework and language detection
- Database schema analysis (Django, Drizzle, Prisma, Supabase)
- Authentication patterns
- API structure
- Entity counts and complexity metrics
- Dependencies and package managers
"""

import json
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict


@dataclass
class TechStack:
    """Technology stack information"""
    framework: Optional[str] = None
    version: Optional[str] = None
    language: Optional[str] = None
    package_manager: Optional[str] = None
    monorepo: bool = False
    build_tool: Optional[str] = None


@dataclass
class DatabaseInfo:
    """Database configuration and schema information"""
    orm: Optional[str] = None
    provider: Optional[str] = None
    migrations_count: int = 0
    models_count: int = 0
    has_rls: bool = False
    rls_policies: int = 0


@dataclass
class AuthInfo:
    """Authentication configuration"""
    current: str = "unknown"
    providers: List[str] = None
    migration_complexity: str = "MEDIUM"
    
    def __post_init__(self):
        if self.providers is None:
            self.providers = []


@dataclass
class PlatformProfile:
    """Complete platform analysis profile"""
    platform_id: str
    name: str
    path: str
    business_vertical: Optional[str] = None
    size_mb: float = 0.0
    entity_count: int = 0
    complexity: str = "MEDIUM"
    tech_stack: TechStack = None
    database: DatabaseInfo = None
    auth: AuthInfo = None
    migration_estimate_weeks: int = 4
    components_count: int = 0
    api_routes_count: int = 0
    dependencies: List[str] = None
    
    def __post_init__(self):
        if self.tech_stack is None:
            self.tech_stack = TechStack()
        if self.database is None:
            self.database = DatabaseInfo()
        if self.auth is None:
            self.auth = AuthInfo()
        if self.dependencies is None:
            self.dependencies = []


class PlatformAnalyzer:
    """Analyzes legacy platform codebases"""
    
    def __init__(self, legacy_root: Path):
        self.legacy_root = Path(legacy_root)
        
    def analyze_platform(self, platform_path: Path) -> PlatformProfile:
        """Analyze a single platform"""
        platform_id = platform_path.name
        profile = PlatformProfile(
            platform_id=platform_id,
            name=self._humanize_name(platform_id),
            path=str(platform_path)
        )
        
        # Calculate directory size
        profile.size_mb = self._calculate_size(platform_path)
        
        # Detect tech stack
        profile.tech_stack = self._detect_tech_stack(platform_path)
        
        # Analyze database
        profile.database = self._analyze_database(platform_path, profile.tech_stack)
        
        # Detect authentication
        profile.auth = self._detect_auth(platform_path, profile.tech_stack)
        
        # Count components and routes
        profile.components_count = self._count_components(platform_path, profile.tech_stack)
        profile.api_routes_count = self._count_api_routes(platform_path, profile.tech_stack)
        
        # Extract dependencies
        profile.dependencies = self._extract_dependencies(platform_path, profile.tech_stack)
        
        # Calculate entity count and complexity
        profile.entity_count = profile.database.models_count + profile.components_count
        profile.complexity = self._calculate_complexity(profile)
        
        # Estimate migration time
        profile.migration_estimate_weeks = self._estimate_migration_time(profile)
        
        return profile
    
    def _humanize_name(self, platform_id: str) -> str:
        """Convert platform ID to human-readable name"""
        return platform_id.replace("-", " ").replace("_", " ").title()
    
    def _calculate_size(self, path: Path) -> float:
        """Calculate directory size in MB"""
        total_size = 0
        try:
            for item in path.rglob("*"):
                if item.is_file() and not self._is_ignored(item):
                    total_size += item.stat().st_size
        except (PermissionError, OSError):
            pass
        return round(total_size / (1024 * 1024), 2)
    
    def _is_ignored(self, path: Path) -> bool:
        """Check if path should be ignored"""
        ignore_patterns = [
            "node_modules", "__pycache__", ".git", "dist", "build",
            ".next", ".turbo", "venv", "env", ".venv"
        ]
        return any(pattern in str(path) for pattern in ignore_patterns)
    
    def _detect_tech_stack(self, path: Path) -> TechStack:
        """Detect framework and tech stack"""
        stack = TechStack()
        
        # Check for package.json (Node.js ecosystem)
        package_json = path / "package.json"
        if package_json.exists():
            try:
                with open(package_json) as f:
                    pkg = json.load(f)
                    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
                    
                    # Detect framework
                    if "next" in deps:
                        stack.framework = "Next.js"
                        stack.version = deps.get("next", "").replace("^", "").replace("~", "")
                        stack.language = "TypeScript" if (path / "tsconfig.json").exists() else "JavaScript"
                    elif "react" in deps and "vite" in deps:
                        stack.framework = "React + Vite"
                        stack.language = "TypeScript" if (path / "tsconfig.json").exists() else "JavaScript"
                    elif "express" in deps:
                        stack.framework = "Express"
                        stack.language = "TypeScript" if (path / "tsconfig.json").exists() else "JavaScript"
                    elif "fastify" in deps:
                        stack.framework = "Fastify"
                        stack.language = "TypeScript" if (path / "tsconfig.json").exists() else "JavaScript"
                    
                    # Detect package manager
                    if (path / "pnpm-lock.yaml").exists():
                        stack.package_manager = "pnpm"
                    elif (path / "yarn.lock").exists():
                        stack.package_manager = "yarn"
                    elif (path / "package-lock.json").exists():
                        stack.package_manager = "npm"
                    
                    # Detect monorepo
                    if (path / "pnpm-workspace.yaml").exists() or pkg.get("workspaces"):
                        stack.monorepo = True
                    
                    # Detect build tool
                    if "turbo" in deps:
                        stack.build_tool = "turbo"
                    elif "nx" in deps:
                        stack.build_tool = "nx"
                    
            except (json.JSONDecodeError, IOError):
                pass
        
        # Check for Django (Python ecosystem)
        if (path / "manage.py").exists() or any(path.glob("**/settings.py")):
            stack.framework = "Django"
            stack.language = "Python"
            
            # Try to detect Django version from requirements
            requirements = path / "requirements.txt"
            if requirements.exists():
                with open(requirements) as f:
                    for line in f:
                        if line.startswith("django==") or line.startswith("Django=="):
                            stack.version = line.split("==")[1].strip()
                            break
        
        # Check for Flask
        if any(path.glob("**/app.py")) or any(path.glob("**/application.py")):
            requirements = path / "requirements.txt"
            if requirements.exists():
                with open(requirements) as f:
                    if "flask" in f.read().lower():
                        stack.framework = "Flask"
                        stack.language = "Python"
        
        return stack
    
    def _analyze_database(self, path: Path, stack: TechStack) -> DatabaseInfo:
        """Analyze database configuration and schema"""
        db = DatabaseInfo()
        
        if stack.framework == "Django":
            # Count Django models
            models_count = 0
            migrations_count = 0
            
            for models_file in path.rglob("models.py"):
                if "migrations" not in str(models_file):
                    try:
                        content = models_file.read_text()
                        # Count class definitions that inherit from models.Model
                        models_count += len(re.findall(r'class\s+\w+\(.*models\.Model.*\):', content))
                    except (IOError, UnicodeDecodeError):
                        pass
            
            # Count migrations
            for migration_file in path.rglob("migrations/*.py"):
                if migration_file.name != "__init__.py":
                    migrations_count += 1
            
            db.orm = "Django ORM"
            db.provider = "PostgreSQL"  # Assuming PostgreSQL
            db.models_count = models_count
            db.migrations_count = migrations_count
        
        elif stack.framework in ["Next.js", "React + Vite"]:
            # Check for Drizzle
            if (path / "drizzle.config.ts").exists() or any(path.glob("**/drizzle/**")):
                db.orm = "Drizzle"
                db.provider = "PostgreSQL"
                
                # Count schema files
                for schema_file in path.rglob("**/schema.ts"):
                    try:
                        content = schema_file.read_text()
                        # Count pgTable definitions
                        db.models_count += len(re.findall(r'export\s+const\s+\w+\s*=\s*pgTable', content))
                    except (IOError, UnicodeDecodeError):
                        pass
                
                # Count migrations
                migrations_dir = path / "drizzle"
                if migrations_dir.exists():
                    db.migrations_count = len(list(migrations_dir.glob("*.sql")))
                
                # Check for RLS policies
                for schema_file in path.rglob("**/schema.ts"):
                    try:
                        content = schema_file.read_text()
                        if "enableRLS" in content or ".withRLS(" in content:
                            db.has_rls = True
                            # Count RLS policies (rough estimate)
                            db.rls_policies += content.count("createPolicy")
                    except (IOError, UnicodeDecodeError):
                        pass
            
            # Check for Prisma
            elif (path / "prisma/schema.prisma").exists():
                db.orm = "Prisma"
                schema_file = path / "prisma/schema.prisma"
                try:
                    content = schema_file.read_text()
                    # Count model definitions
                    db.models_count = len(re.findall(r'^model\s+\w+', content, re.MULTILINE))
                    # Detect provider
                    if "postgresql" in content:
                        db.provider = "PostgreSQL"
                    elif "mysql" in content:
                        db.provider = "MySQL"
                except (IOError, UnicodeDecodeError):
                    pass
                
                # Count migrations
                migrations_dir = path / "prisma/migrations"
                if migrations_dir.exists():
                    db.migrations_count = len([d for d in migrations_dir.iterdir() if d.is_dir()])
            
            # Check for Supabase
            elif (path / "supabase").exists():
                db.orm = "Supabase"
                db.provider = "PostgreSQL"
                db.has_rls = True  # Supabase uses RLS by default
                
                # Count migrations
                migrations_dir = path / "supabase/migrations"
                if migrations_dir.exists():
                    db.migrations_count = len(list(migrations_dir.glob("*.sql")))
                
                # Try to count tables from migrations
                for migration in migrations_dir.glob("*.sql") if migrations_dir.exists() else []:
                    try:
                        content = migration.read_text()
                        db.models_count += len(re.findall(r'CREATE TABLE', content, re.IGNORECASE))
                        # Count RLS policies
                        db.rls_policies += len(re.findall(r'CREATE POLICY', content, re.IGNORECASE))
                    except (IOError, UnicodeDecodeError):
                        pass
        
        return db
    
    def _detect_auth(self, path: Path, stack: TechStack) -> AuthInfo:
        """Detect authentication configuration"""
        auth = AuthInfo()
        providers = []
        
        # Check for Clerk
        if any(path.glob("**/*clerk*")):
            providers.append("clerk")
            auth.current = "clerk"
        
        # Check for NextAuth
        if any(path.glob("**/[...nextauth].ts")) or any(path.glob("**/[...nextauth].js")):
            providers.append("nextauth")
            auth.current = "nextauth"
        
        # Check for Supabase Auth
        if (path / "supabase").exists():
            providers.append("supabase-auth")
            auth.current = "supabase-auth"
        
        # Check for Django allauth
        if stack.framework == "Django":
            for settings_file in path.rglob("settings.py"):
                try:
                    content = settings_file.read_text()
                    if "allauth" in content:
                        providers.append("django-allauth")
                        auth.current = "django-allauth"
                    elif "rest_framework" in content and "authentication" in content:
                        providers.append("drf-auth")
                        auth.current = "drf-auth"
                except (IOError, UnicodeDecodeError):
                    pass
        
        # If no auth detected, mark as custom
        if not providers:
            auth.current = "custom"
            providers.append("custom")
        
        auth.providers = providers
        
        # Estimate migration complexity
        if auth.current == "clerk":
            auth.migration_complexity = "LOW"  # Already using Clerk
        elif auth.current in ["nextauth", "supabase-auth"]:
            auth.migration_complexity = "MEDIUM"  # Similar OAuth patterns
        else:
            auth.migration_complexity = "HIGH"  # Custom or complex auth
        
        return auth
    
    def _count_components(self, path: Path, stack: TechStack) -> int:
        """Count UI components"""
        count = 0
        
        if stack.language in ["TypeScript", "JavaScript"]:
            # Count React components
            for component_file in path.rglob("*.tsx"):
                if "node_modules" not in str(component_file):
                    try:
                        content = component_file.read_text()
                        # Count export default or export function
                        count += len(re.findall(r'export\s+(default\s+)?(function|const)\s+\w+', content))
                    except (IOError, UnicodeDecodeError):
                        pass
            
            for component_file in path.rglob("*.jsx"):
                if "node_modules" not in str(component_file):
                    try:
                        content = component_file.read_text()
                        count += len(re.findall(r'export\s+(default\s+)?(function|const)\s+\w+', content))
                    except (IOError, UnicodeDecodeError):
                        pass
        
        return count
    
    def _count_api_routes(self, path: Path, stack: TechStack) -> int:
        """Count API routes"""
        count = 0
        
        if stack.framework == "Next.js":
            # Count Next.js API routes
            api_dir = path / "app/api" if (path / "app").exists() else path / "pages/api"
            if api_dir.exists():
                count = len([f for f in api_dir.rglob("*.ts") if f.is_file()])
                count += len([f for f in api_dir.rglob("*.js") if f.is_file()])
        
        elif stack.framework == "Django":
            # Count Django URL patterns
            for urls_file in path.rglob("urls.py"):
                try:
                    content = urls_file.read_text()
                    # Count path() and re_path() calls
                    count += len(re.findall(r'path\(|re_path\(', content))
                except (IOError, UnicodeDecodeError):
                    pass
        
        elif stack.framework in ["Express", "Fastify"]:
            # Count route definitions
            for route_file in path.rglob("*.ts"):
                if "routes" in str(route_file) or "api" in str(route_file):
                    try:
                        content = route_file.read_text()
                        # Count common route methods
                        count += len(re.findall(r'\.(get|post|put|delete|patch)\(', content))
                    except (IOError, UnicodeDecodeError):
                        pass
        
        return count
    
    def _extract_dependencies(self, path: Path, stack: TechStack) -> List[str]:
        """Extract key dependencies"""
        dependencies = []
        
        # Node.js dependencies
        package_json = path / "package.json"
        if package_json.exists():
            try:
                with open(package_json) as f:
                    pkg = json.load(f)
                    all_deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
                    # Extract key dependencies
                    key_deps = [
                        "next", "react", "express", "fastify", "drizzle-orm", "prisma",
                        "@clerk/nextjs", "next-auth", "@supabase/supabase-js",
                        "turbo", "typescript", "tailwindcss"
                    ]
                    dependencies = [dep for dep in key_deps if dep in all_deps]
            except (json.JSONDecodeError, IOError):
                pass
        
        # Python dependencies
        requirements = path / "requirements.txt"
        if requirements.exists():
            try:
                with open(requirements) as f:
                    content = f.read().lower()
                    key_deps = [
                        "django", "flask", "fastapi", "djangorestframework",
                        "celery", "redis", "psycopg2", "sqlalchemy"
                    ]
                    dependencies = [dep for dep in key_deps if dep in content]
            except IOError:
                pass
        
        return dependencies
    
    def _calculate_complexity(self, profile: PlatformProfile) -> str:
        """Calculate migration complexity"""
        score = 0
        
        # Entity count scoring
        if profile.entity_count > 1000:
            score += 4
        elif profile.entity_count > 500:
            score += 3
        elif profile.entity_count > 100:
            score += 2
        else:
            score += 1
        
        # Database complexity
        if profile.database.has_rls:
            score += 2
        if profile.database.migrations_count > 100:
            score += 2
        
        # Auth complexity
        if profile.auth.migration_complexity == "HIGH":
            score += 2
        elif profile.auth.migration_complexity == "MEDIUM":
            score += 1
        
        # Monorepo complexity
        if profile.tech_stack.monorepo:
            score += 1
        
        # Complexity mapping
        if score >= 9:
            return "EXTREME"
        elif score >= 6:
            return "HIGH"
        elif score >= 3:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _estimate_migration_time(self, profile: PlatformProfile) -> int:
        """Estimate migration time in weeks"""
        base_weeks = {
            "LOW": 2,
            "MEDIUM": 4,
            "HIGH": 8,
            "EXTREME": 12
        }
        
        weeks = base_weeks.get(profile.complexity, 4)
        
        # Adjust for specific factors
        if profile.database.has_rls and profile.database.rls_policies > 100:
            weeks += 2
        
        if profile.entity_count > 2000:
            weeks += 2
        
        if profile.tech_stack.monorepo:
            weeks += 1
        
        return weeks
    
    def analyze_all(self) -> List[PlatformProfile]:
        """Analyze all platforms in legacy root"""
        profiles = []
        
        if not self.legacy_root.exists():
            print(f"Warning: Legacy root not found: {self.legacy_root}")
            return profiles
        
        for platform_dir in self.legacy_root.iterdir():
            if platform_dir.is_dir() and not platform_dir.name.startswith("."):
                try:
                    profile = self.analyze_platform(platform_dir)
                    profiles.append(profile)
                    print(f"✓ Analyzed: {profile.name} ({profile.complexity})")
                except Exception as e:
                    print(f"✗ Failed to analyze {platform_dir.name}: {e}")
        
        return profiles
    
    def export_profiles(self, profiles: List[PlatformProfile], output_path: Path):
        """Export profiles to JSON"""
        data = [asdict(p) for p in profiles]
        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Exported {len(profiles)} profiles to {output_path}")


def main():
    """Main entry point"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python platform_analyzer.py <legacy-root-path> [output.json]")
        sys.exit(1)
    
    legacy_root = Path(sys.argv[1])
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("platform_profiles.json")
    
    analyzer = PlatformAnalyzer(legacy_root)
    profiles = analyzer.analyze_all()
    
    if profiles:
        analyzer.export_profiles(profiles, output_path)
        
        # Print summary
        print("\n" + "="*60)
        print("ANALYSIS SUMMARY")
        print("="*60)
        print(f"Total Platforms: {len(profiles)}")
        print(f"Total Entities: {sum(p.entity_count for p in profiles)}")
        print(f"Total Migration Weeks (Sequential): {sum(p.migration_estimate_weeks for p in profiles)}")
        print(f"\nComplexity Distribution:")
        for complexity in ["LOW", "MEDIUM", "HIGH", "EXTREME"]:
            count = len([p for p in profiles if p.complexity == complexity])
            print(f"  {complexity}: {count}")


if __name__ == "__main__":
    main()
