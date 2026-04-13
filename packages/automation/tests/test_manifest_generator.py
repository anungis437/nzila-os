"""
Unit tests for manifest_generator.py

Tests the ManifestGenerator class against its actual API:
  - ManifestGenerator(config: ManifestConfig = None)
  - generate_manifest(profile: Dict) -> Dict
  - generate_all_manifests(profiles: List[Dict], output_dir: Path)
  - generate_readme(manifests: Dict, output_file: Path)
"""

import json
import sys
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "generators"))

from manifest_generator import ManifestConfig, ManifestGenerator


def _make_profile(**overrides):
    """Helper to build a valid profile dict for ManifestGenerator."""
    base = {
        "name": "Test Platform",
        "platform_id": "test-platform",
        "tech_stack": {
            "framework": "Next.js",
            "language": "TypeScript",
            "monorepo": False,
        },
        "database": {
            "orm": "Drizzle",
            "models_count": 10,
            "migrations_count": 5,
            "has_rls": False,
        },
        "auth": {"current": "clerk", "migration_complexity": "LOW"},
        "entity_count": 30,
        "api_routes_count": 5,
        "migration_estimate_weeks": 6,
        "complexity": "MEDIUM",
        "business_vertical": "fintech",
        "dependencies": [],
    }
    base.update(overrides)
    return base


@pytest.mark.unit
@pytest.mark.generator
class TestManifestGenerator:
    """Test ManifestGenerator class"""

    def test_initialization_defaults(self):
        """Test generator with default config."""
        gen = ManifestGenerator()
        assert gen.config.template_version == "1.0.0"
        assert gen.config.clerk_enabled is True

    def test_initialization_custom_config(self):
        """Test generator with custom config."""
        cfg = ManifestConfig(template_version="2.0.0", azure_base_region="eastus")
        gen = ManifestGenerator(config=cfg)
        assert gen.config.template_version == "2.0.0"
        assert gen.config.azure_base_region == "eastus"

    def test_generate_manifest_nextjs(self):
        """Test manifest generation for Next.js platform."""
        gen = ManifestGenerator()
        profile = _make_profile()
        manifest = gen.generate_manifest(profile)

        assert manifest["product_name"] == "Test Platform"
        assert manifest["profile"] == "nextjs-aca-azurepg-oidc"
        assert manifest["auth_provider"] == "oidc"
        assert manifest["db_provider"] == "azure_postgresql"
        assert "auth-oidc" in manifest["modules"]
        assert "core-governance" in manifest["modules"]

    def test_generate_manifest_django(self):
        """Test manifest generation for Django platform."""
        gen = ManifestGenerator()
        profile = _make_profile(
            tech_stack={"framework": "Django", "language": "Python", "monorepo": False},
            database={
                "orm": "Django ORM",
                "models_count": 20,
                "migrations_count": 15,
                "has_rls": False,
            },
        )
        manifest = gen.generate_manifest(profile)

        assert manifest["profile"] == "django-aca-azurepg"
        assert manifest["app_port"] == 8000

    def test_select_profile_nextjs(self):
        """Test profile selection for Next.js."""
        gen = ManifestGenerator()
        profile = _make_profile()
        result = gen._select_profile(profile)
        assert result == "nextjs-aca-azurepg-oidc"

    def test_select_profile_django(self):
        """Test profile selection for Django."""
        gen = ManifestGenerator()
        profile = _make_profile(
            tech_stack={"framework": "Django", "language": "Python", "monorepo": False}
        )
        result = gen._select_profile(profile)
        assert result == "django-aca-azurepg"

    def test_select_profile_express(self):
        """Test profile selection for Express."""
        gen = ManifestGenerator()
        profile = _make_profile(
            tech_stack={
                "framework": "Express",
                "language": "TypeScript",
                "monorepo": False,
            }
        )
        result = gen._select_profile(profile)
        assert result == "nodeapi-aca-azurepg-oidc"

    def test_select_modules_clerk_enabled(self):
        """Test module selection includes OIDC auth when enabled."""
        gen = ManifestGenerator(ManifestConfig(clerk_enabled=True))
        profile = _make_profile()
        stack_profile = "nextjs-aca-azurepg-oidc"
        modules = gen._select_modules(profile, stack_profile)

        assert "auth-oidc" in modules
        assert "core-governance" in modules

    def test_select_modules_ai_dependency(self):
        """Test AI module added for OpenAI dependency."""
        gen = ManifestGenerator()
        profile = _make_profile(dependencies=["openai"])
        stack_profile = "nextjs-aca-azurepg-clerk"
        modules = gen._select_modules(profile, stack_profile)

        assert "ai-ops" in modules

    def test_generate_all_manifests(self, temp_dir):
        """Test batch manifest generation."""
        gen = ManifestGenerator()
        profiles = [
            _make_profile(name="Platform A", platform_id="platform-a"),
            _make_profile(
                name="Platform B",
                platform_id="platform-b",
                tech_stack={
                    "framework": "Django",
                    "language": "Python",
                    "monorepo": False,
                },
                database={
                    "orm": "Django ORM",
                    "models_count": 5,
                    "migrations_count": 3,
                    "has_rls": False,
                },
            ),
        ]

        manifests = gen.generate_all_manifests(profiles, temp_dir / "manifests")

        assert len(manifests) == 2
        assert "platform-a" in manifests
        assert "platform-b" in manifests
        assert (temp_dir / "manifests" / "platform-a.manifest.json").exists()
        assert (temp_dir / "manifests" / "platform-b.manifest.json").exists()

        # Verify serialised content
        with open(temp_dir / "manifests" / "platform-a.manifest.json") as f:
            data = json.load(f)
        assert data["product_name"] == "Platform A"

    def test_generate_readme(self, temp_dir):
        """Test README generation from manifests dict."""
        gen = ManifestGenerator()
        profile = _make_profile()
        manifest = gen.generate_manifest(profile)
        manifests = {"test-platform": manifest}

        readme_path = temp_dir / "README.md"
        gen.generate_readme(manifests, readme_path)

        assert readme_path.exists()
        content = readme_path.read_text()
        assert "Test Platform" in content


@pytest.mark.integration
@pytest.mark.generator
class TestManifestGeneratorIntegration:
    """Integration tests for Manifest Generator"""

    def test_end_to_end_manifest_generation(self, temp_dir):
        """Test complete manifest generation workflow."""
        profiles = [
            _make_profile(name="Platform One", platform_id="plat1"),
            _make_profile(
                name="Platform Two",
                platform_id="plat2",
                tech_stack={
                    "framework": "Django",
                    "language": "Python",
                    "monorepo": False,
                },
                database={
                    "orm": "Django ORM",
                    "models_count": 8,
                    "migrations_count": 4,
                    "has_rls": False,
                },
            ),
        ]

        gen = ManifestGenerator()
        manifests = gen.generate_all_manifests(profiles, temp_dir / "manifests")

        assert (temp_dir / "manifests" / "plat1.manifest.json").exists()
        assert (temp_dir / "manifests" / "plat2.manifest.json").exists()

        # Verify profile mapping
        assert manifests["plat1"]["profile"] == "nextjs-aca-azurepg-oidc"
        assert manifests["plat2"]["profile"] == "django-aca-azurepg"


@pytest.mark.unit
@pytest.mark.generator
class TestManifestGeneratorExtended:
    """Extended tests for full coverage of manifest_generator."""

    # ── _select_profile branches ────────────────────────────────────────

    def test_select_profile_fastify(self):
        gen = ManifestGenerator()
        profile = _make_profile(
            tech_stack={
                "framework": "Fastify",
                "language": "TypeScript",
                "monorepo": False,
            }
        )
        assert gen._select_profile(profile) == "nodeapi-aca-azurepg-oidc"

    def test_select_profile_react_vite(self):
        gen = ManifestGenerator()
        profile = _make_profile(
            tech_stack={
                "framework": "React + Vite",
                "language": "TypeScript",
                "monorepo": False,
            }
        )
        assert gen._select_profile(profile) == "nextjs-aca-azurepg-oidc"

    def test_select_profile_unknown(self):
        gen = ManifestGenerator()
        profile = _make_profile(
            tech_stack={
                "framework": "Unknown",
                "language": "JavaScript",
                "monorepo": False,
            }
        )
        assert gen._select_profile(profile) == "nodeapi-aca-azurepg-oidc"

    def test_select_profile_null_framework_ts(self):
        gen = ManifestGenerator()
        profile = _make_profile(
            tech_stack={"framework": None, "language": "TypeScript", "monorepo": False}
        )
        assert gen._select_profile(profile) == "nodeapi-aca-azurepg-oidc"

    # ── _get_app_path ────────────────────────────────────────────────────

    def test_get_app_path_django_monorepo(self):
        gen = ManifestGenerator()
        profile = _make_profile(
            tech_stack={"framework": "Django", "language": "Python", "monorepo": True}
        )
        result = gen._get_app_path(profile, "django-aca-azurepg")
        assert result == "backend"

    def test_get_app_path_nextjs_monorepo(self):
        gen = ManifestGenerator()
        profile = _make_profile(
            tech_stack={
                "framework": "Next.js",
                "language": "TypeScript",
                "monorepo": True,
            }
        )
        result = gen._get_app_path(profile, "nextjs-aca-azurepg-clerk")
        assert result == "apps/web"

    def test_get_app_path_node_api_monorepo(self):
        gen = ManifestGenerator()
        profile = _make_profile(
            tech_stack={
                "framework": "Express",
                "language": "TypeScript",
                "monorepo": True,
            }
        )
        result = gen._get_app_path(profile, "nodeapi-aca-azurepg-clerk")
        assert result == "apps/api"

    def test_get_app_path_node_api_no_monorepo(self):
        gen = ManifestGenerator()
        profile = _make_profile(
            tech_stack={
                "framework": "Express",
                "language": "TypeScript",
                "monorepo": False,
            }
        )
        result = gen._get_app_path(profile, "nodeapi-aca-azurepg-clerk")
        assert result == "src"

    # ── _get_app_port ────────────────────────────────────────────────────

    def test_get_app_port_nextjs(self):
        gen = ManifestGenerator()
        profile = _make_profile()
        assert gen._get_app_port(profile, "nextjs-aca-azurepg-clerk") == 3000

    def test_get_app_port_node_api(self):
        gen = ManifestGenerator()
        profile = _make_profile()
        assert gen._get_app_port(profile, "nodeapi-aca-azurepg-clerk") == 3000

    # ── _infer_org_key ───────────────────────────────────────────────────

    def test_infer_org_key_uniontech(self):
        gen = ManifestGenerator()
        profile = _make_profile(business_vertical="uniontech")
        assert gen._infer_org_key(profile) == "union_id"

    def test_infer_org_key_healthcare(self):
        gen = ManifestGenerator()
        profile = _make_profile(business_vertical="healthcare")
        assert gen._infer_org_key(profile) == "clinic_id"

    def test_infer_org_key_agriculture(self):
        gen = ManifestGenerator()
        profile = _make_profile(business_vertical="agriculture")
        assert gen._infer_org_key(profile) == "farm_id"

    def test_infer_org_key_logistics(self):
        gen = ManifestGenerator()
        profile = _make_profile(business_vertical="logistics")
        assert gen._infer_org_key(profile) == "warehouse_id"

    def test_infer_org_key_unknown_defaults(self):
        gen = ManifestGenerator()
        profile = _make_profile(business_vertical="sports")
        assert gen._infer_org_key(profile) == "org_id"

    # ── _select_modules ──────────────────────────────────────────────────

    def test_select_modules_monorepo_turbo(self):
        gen = ManifestGenerator()
        profile = _make_profile(
            tech_stack={
                "framework": "Next.js",
                "language": "TypeScript",
                "monorepo": True,
            }
        )
        modules = gen._select_modules(profile, "nextjs-aca-azurepg-clerk")
        assert "monorepo-pnpm-turbo" in modules

    def test_select_modules_exports_compliance(self):
        gen = ManifestGenerator()
        profile = _make_profile(business_vertical="international banking")
        modules = gen._select_modules(profile, "nextjs-aca-azurepg-clerk")
        assert "exports-compliance" in modules

    # ── _generate_custom_config ──────────────────────────────────────────

    def test_custom_config_express(self):
        gen = ManifestGenerator()
        profile = _make_profile(
            tech_stack={
                "framework": "Express",
                "language": "TypeScript",
                "monorepo": False,
            }
        )
        config = gen._generate_custom_config(profile)
        assert config["framework"] == "express"
        assert config["typescript"] is True

    def test_custom_config_fastify(self):
        gen = ManifestGenerator()
        profile = _make_profile(
            tech_stack={
                "framework": "Fastify",
                "language": "TypeScript",
                "monorepo": False,
            }
        )
        config = gen._generate_custom_config(profile)
        assert config["framework"] == "fastify"

    # ── _infer_feature_flags ─────────────────────────────────────────────

    def test_feature_flags_with_celery(self):
        gen = ManifestGenerator()
        profile = _make_profile(dependencies=["celery"])
        flags = gen._infer_feature_flags(profile)
        assert flags["background_jobs"] is True
        assert flags["caching"] is True

    def test_feature_flags_with_redis(self):
        gen = ManifestGenerator()
        profile = _make_profile(dependencies=["redis"])
        flags = gen._infer_feature_flags(profile)
        assert flags["background_jobs"] is True

    def test_feature_flags_api_gateway(self):
        gen = ManifestGenerator()
        profile = _make_profile(api_routes_count=25)
        flags = gen._infer_feature_flags(profile)
        assert flags["api_gateway"] is True

    def test_feature_flags_no_gateway(self):
        gen = ManifestGenerator()
        profile = _make_profile(api_routes_count=3)
        flags = gen._infer_feature_flags(profile)
        assert flags["api_gateway"] is False

    # ── main() CLI ──────────────────────────────────────────────────────

    def test_main_no_args(self):
        from manifest_generator import main

        with patch("sys.argv", ["manifest_generator.py"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 1

    def test_main_with_profiles(self, temp_dir):
        from manifest_generator import main

        profiles = [_make_profile(name="TestApp", platform_id="testapp")]
        profiles_file = temp_dir / "profiles.json"
        profiles_file.write_text(json.dumps(profiles))

        output_dir = temp_dir / "manifests"

        with patch("sys.argv", ["prog", str(profiles_file), str(output_dir)]):
            main()

        assert (output_dir / "testapp.manifest.json").exists()
        assert (output_dir / "README.md").exists()

    # ── Coverage for line 264: clerk_enabled=False ───────────────────

    def test_priorities_without_clerk(self, temp_dir):
        """When clerk_enabled=False, priorities say 'custom auth' (line 264)."""
        config = ManifestConfig(clerk_enabled=False)
        gen = ManifestGenerator(config)
        profile = _make_profile()
        manifest = gen.generate_manifest(profile)
        priorities = manifest["migration"]["priorities"]
        found = any("custom auth" in str(p).lower() for p in priorities)
        assert found, f"Expected 'custom auth' in priorities, got: {priorities}"
