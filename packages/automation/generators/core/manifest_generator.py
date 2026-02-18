#!/usr/bin/env python3
"""
Manifest Generator — Auto-generates scripts-book manifests for legacy platforms

Takes platform analysis profiles and generates optimized scripts-book.manifest.json
files with intelligent defaults based on detected tech stack, database, and auth.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass


@dataclass
class ManifestConfig:
    """Configuration for manifest generation"""
    template_version: str = "1.0.0"
    owner_github: str = "anungis437"
    azure_base_region: str = "canadacentral"
    clerk_enabled: bool = True
    strict_parity: bool = True
    enable_ci: bool = True
    enable_deploy_workflows: bool = True
    enable_ai_ops: bool = False


class ManifestGenerator:
    """Generates scripts-book manifests from platform profiles"""
    
    def __init__(self, config: ManifestConfig = None):
        self.config = config or ManifestConfig()
    
    def generate_manifest(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a scripts-book manifest from a platform profile"""
        
        # Select appropriate profile
        stack_profile = self._select_profile(profile)
        
        # Generate manifest structure
        manifest = {
            "template_version": self.config.template_version,
            "product_name": profile["name"],
            "repo_name": f"{profile['platform_id']}-platform",
            "owner_github": self.config.owner_github,
            "primary_app_path": self._get_app_path(profile, stack_profile),
            "app_port": self._get_app_port(profile, stack_profile),
            "tenant_key": self._infer_tenant_key(profile),
            "image_repo": f"{profile['platform_id']}-app",
            "auth_provider": "clerk" if self.config.clerk_enabled else "custom",
            "db_provider": "azure_postgresql",
            "deploy_provider": "azure_container_apps",
            "environments": self._generate_environments(profile),
            "profile": stack_profile,
            "modules": self._select_modules(profile, stack_profile),
            "options": {
                "enable_ci": self.config.enable_ci,
                "enable_deploy_workflows": self.config.enable_deploy_workflows,
                "enable_ai_ops": self.config.enable_ai_ops,
                "strict_parity": self.config.strict_parity
            },
            "custom_config": self._generate_custom_config(profile),
            "migration": self._generate_migration_config(profile)
        }
        
        return manifest
    
    def _select_profile(self, profile: Dict[str, Any]) -> str:
        """Select appropriate scripts-book profile based on tech stack"""
        framework = profile["tech_stack"]["framework"]
        language = profile["tech_stack"]["language"]
        
        if framework == "Django":
            return "django-aca-azurepg"
        elif framework == "Next.js":
            return "nextjs-aca-azurepg-clerk"
        elif framework in ["Express", "Fastify"] or (framework is None and language == "TypeScript"):
            return "nodeapi-aca-azurepg-clerk"
        elif framework == "React + Vite":
            # Vite apps usually need backend, default to Next.js pattern for now
            return "nextjs-aca-azurepg-clerk"
        else:
            # Default to Node API for unknown
            return "nodeapi-aca-azurepg-clerk"
    
    def _get_app_path(self, profile: Dict[str, Any], stack_profile: str) -> str:
        """Determine primary app path"""
        monorepo = profile["tech_stack"]["monorepo"]
        
        if stack_profile == "django-aca-azurepg":
            return "backend" if monorepo else "src"
        elif stack_profile == "nextjs-aca-azurepg-clerk":
            return "apps/web" if monorepo else "src"
        else:
            return "apps/api" if monorepo else "src"
    
    def _get_app_port(self, profile: Dict[str, Any], stack_profile: str) -> int:
        """Determine application port"""
        if stack_profile == "django-aca-azurepg":
            return 8000
        else:
            return 3000
    
    def _infer_tenant_key(self, profile: Dict[str, Any]) -> str:
        """Infer tenant/isolation key from business vertical"""
        vertical = (profile.get("business_vertical") or "").lower()
        
        tenant_key_mapping = {
            "uniontech": "union_id",
            "fintech": "tenant_id",
            "banking": "institution_id",
            "healthcare": "clinic_id",
            "education": "school_id",
            "legal": "firm_id",
            "agriculture": "farm_id",
            "ecommerce": "merchant_id",
            "entertainment": "label_id",
            "logistics": "warehouse_id"
        }
        
        # Try to find matching vertical
        for key, value in tenant_key_mapping.items():
            if key in vertical:
                return value
        
        # Default
        return "org_id"
    
    def _generate_environments(self, profile: Dict[str, Any]) -> Dict[str, str]:
        """Generate environment URLs"""
        platform_id = profile["platform_id"]
        
        return {
            "staging_url": f"https://{platform_id}-staging.azurecontainerapps.io",
            "production_url": f"https://{platform_id}.azurecontainerapps.io",
            "api_base": "/api/v1"
        }
    
    def _select_modules(self, profile: Dict[str, Any], stack_profile: str) -> List[str]:
        """Select appropriate modules based on platform needs"""
        modules = [
            "core-governance",
            "repo-bootstrap",
            "db-azurepg",
            "deploy-aca-oidc",
            "security-baseline",
            "observability-audit"
        ]
        
        # Add monorepo module for Next.js/Node apps with monorepo
        if stack_profile in ["nextjs-aca-azurepg-clerk", "nodeapi-aca-azurepg-clerk"]:
            if profile["tech_stack"]["monorepo"]:
                modules.insert(2, "monorepo-pnpm-turbo")
            
            # Add Clerk auth module
            if self.config.clerk_enabled:
                modules.insert(3, "auth-clerk")
        
        # Add AI ops if platform has AI dependencies
        dependencies = profile.get("dependencies", [])
        if any(dep in ["openai", "langchain", "@anthropic-ai/sdk"] for dep in dependencies):
            self.config.enable_ai_ops = True
            modules.append("ai-ops")
        
        # Add exports compliance for platforms with international scope
        vertical = (profile.get("business_vertical") or "").lower()
        if any(kw in vertical for kw in ["banking", "fintech", "international", "diaspora"]):
            modules.append("exports-compliance")
        
        return modules
    
    def _generate_custom_config(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """Generate custom configuration section"""
        framework = profile["tech_stack"]["framework"]
        language = profile["tech_stack"]["language"]
        
        config = {}
        
        if framework == "Django":
            config["django_version"] = profile["tech_stack"].get("version", "5.0")
            config["python_version"] = "3.12"
            config["wsgi_server"] = "gunicorn"
            
            # Add Django apps hint (would need deeper analysis to extract actual apps)
            config["django_apps_count"] = max(profile["entity_count"] // 50, 5)
            
        elif framework == "Next.js":
            config["nextjs_version"] = profile["tech_stack"].get("version", "14")
            config["node_version"] = "20"
            config["typescript"] = language == "TypeScript"
            
        elif framework in ["Express", "Fastify"]:
            config["node_version"] = "20"
            config["typescript"] = language == "TypeScript"
            config["framework"] = framework.lower()
        
        # Add database ORM info
        if profile["database"]["orm"]:
            config["orm"] = profile["database"]["orm"]
        
        # Add key dependencies
        config["key_dependencies"] = profile.get("dependencies", [])
        
        # Add feature flags based on analysis
        config["feature_flags"] = self._infer_feature_flags(profile)
        
        return config
    
    def _infer_feature_flags(self, profile: Dict[str, Any]) -> Dict[str, bool]:
        """Infer feature flags from platform analysis"""
        flags = {
            "multi_tenant": True,  # Default to multi-tenant
            "api_gateway": profile["api_routes_count"] > 20,
            "background_jobs": False,  # Would need celery/redis detection
            "real_time": False,  # Would need websocket detection
            "file_storage": False,  # Would need blob storage detection
            "caching": False  # Would need redis detection
        }
        
        # Check dependencies for specific features
        dependencies = profile.get("dependencies", [])
        if "celery" in dependencies or "redis" in dependencies:
            flags["background_jobs"] = True
            flags["caching"] = True
        
        return flags
    
    def _generate_migration_config(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """Generate migration configuration"""
        return {
            "source_framework": profile["tech_stack"]["framework"],
            "source_orm": profile["database"]["orm"],
            "entity_count": profile["entity_count"],
            "models_count": profile["database"]["models_count"],
            "migrations_count": profile["database"]["migrations_count"],
            "has_rls": profile["database"]["has_rls"],
            "estimated_weeks": profile["migration_estimate_weeks"],
            "complexity": profile["complexity"],
            "auth_migration": {
                "from": profile["auth"]["current"],
                "to": "clerk" if self.config.clerk_enabled else "custom",
                "complexity": profile["auth"]["migration_complexity"]
            },
            "priorities": self._generate_migration_priorities(profile)
        }
    
    def _generate_migration_priorities(self, profile: Dict[str, Any]) -> List[str]:
        """Generate migration phase priorities"""
        priorities = [
            "Phase 1: Infrastructure Setup (Azure resources, networking)",
            "Phase 2: Database Migration (schema + data)",
        ]
        
        if self.config.clerk_enabled:
            priorities.append("Phase 3: Auth Migration (Clerk integration + user sync)")
        else:
            priorities.append("Phase 3: Auth Setup (custom auth implementation)")
        
        priorities.extend([
            "Phase 4: Application Code (API routes, business logic)",
            "Phase 5: Frontend Migration (UI components, pages)",
            "Phase 6: Testing & Validation (E2E, integration, performance)",
            "Phase 7: Production Cutover (DNS, monitoring, rollback plan)"
        ])
        
        return priorities
    
    def generate_all_manifests(self, profiles: List[Dict[str, Any]], output_dir: Path):
        """Generate manifests for all platforms"""
        output_dir = Path(output_dir)
        output_dir.mkdir(exist_ok=True, parents=True)
        
        manifests = {}
        
        for profile in profiles:
            manifest = self.generate_manifest(profile)
            platform_id = profile["platform_id"]
            
            # Save individual manifest
            output_file = output_dir / f"{platform_id}.manifest.json"
            with open(output_file, "w") as f:
                json.dump(manifest, f, indent=2)
            
            manifests[platform_id] = manifest
            print(f"✓ Generated manifest: {platform_id}")
        
        # Save combined manifests
        combined_file = output_dir / "all_manifests.json"
        with open(combined_file, "w") as f:
            json.dump(manifests, f, indent=2)
        
        print(f"\nGenerated {len(manifests)} manifests in {output_dir}")
        return manifests
    
    def generate_readme(self, manifests: Dict[str, Any], output_file: Path):
        """Generate README documenting all manifests"""
        content = [
            "# Nzila Platform Manifests\n",
            f"Generated: {Path(__file__).stat().st_mtime}\n",
            f"Total Platforms: {len(manifests)}\n\n",
            "## Profile Distribution\n\n"
        ]
        
        # Count profiles
        profile_counts = {}
        for manifest in manifests.values():
            profile = manifest["profile"]
            profile_counts[profile] = profile_counts.get(profile, 0) + 1
        
        for profile, count in sorted(profile_counts.items()):
            content.append(f"- **{profile}**: {count} platforms\n")
        
        content.append("\n## Platforms\n\n")
        
        # List platforms
        for platform_id, manifest in sorted(manifests.items()):
            content.append(f"### {manifest['product_name']}\n")
            content.append(f"- **ID**: `{platform_id}`\n")
            content.append(f"- **Profile**: `{manifest['profile']}`\n")
            content.append(f"- **Framework**: {manifest['custom_config'].get('orm', 'N/A')}\n")
            content.append(f"- **Migration**: {manifest['migration']['estimated_weeks']} weeks ({manifest['migration']['complexity']})\n")
            content.append(f"- **Entities**: {manifest['migration']['entity_count']}\n\n")
        
        with open(output_file, "w") as f:
            f.write("".join(content))
        
        print(f"Generated README: {output_file}")


def main():
    """Main entry point"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python manifest_generator.py <profiles.json> [output-dir]")
        sys.exit(1)
    
    profiles_file = Path(sys.argv[1])
    output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("manifests")
    
    # Load profiles
    with open(profiles_file) as f:
        profiles = json.load(f)
    
    # Generate manifests
    config = ManifestConfig()
    generator = ManifestGenerator(config)
    manifests = generator.generate_all_manifests(profiles, output_dir)
    
    # Generate README
    generator.generate_readme(manifests, output_dir / "README.md")
    
    print("\n" + "="*60)
    print("MANIFEST GENERATION COMPLETE")
    print("="*60)
    print(f"Manifests: {len(manifests)}")
    print(f"Location: {output_dir}")


if __name__ == "__main__":
    main()
