"""Tests for deployment package – DeploymentManager, EnvironmentManager, EnvironmentConfig."""

import pytest
from deployment import (
    DeploymentManager,
    EnvironmentManager,
    deploy_platform,
    get_environment_config,
    rollback_platform,
)
from deployment.deploy import EnvironmentConfig
from deployment.environment import EnvironmentManager as EnvMgr

# ── DeploymentManager ──────────────────────────────────────────────────────


class TestDeploymentManager:
    def test_deploy_staging(self, tmp_path):
        mgr = DeploymentManager(base_path=tmp_path)
        result = mgr.deploy("CongoWave", "staging", "v1.0.0")
        assert result["status"] == "success"
        assert result["platform"] == "CongoWave"
        assert result["environment"] == "staging"
        assert result["version"] == "v1.0.0"
        assert len(result["steps"]) == 5

    def test_deploy_default_version(self):
        mgr = DeploymentManager()
        result = mgr.deploy("Web", "staging")
        assert result["version"] == "latest"

    def test_deploy_invalid_env(self):
        mgr = DeploymentManager()
        result = mgr.deploy("Web", "invalid_env")
        assert "error" in result

    def test_deploy_production(self):
        mgr = DeploymentManager()
        result = mgr.deploy("Web", "production", "v2.0")
        assert result["status"] == "success"
        assert result["environment"] == "production"

    def test_deploy_development(self):
        mgr = DeploymentManager()
        result = mgr.deploy("Web", "development")
        assert result["status"] == "success"

    def test_rollback_no_history(self):
        mgr = DeploymentManager()
        result = mgr.rollback("Web", "production")
        assert result["status"] == "success"
        assert result["rolled_back_to"] == "initial"

    def test_rollback_with_history(self):
        mgr = DeploymentManager()
        mgr.deploy("Web", "production", "v1.0")
        result = mgr.rollback("Web", "production")
        assert result["status"] == "success"
        assert result["rolled_back_to"] == "v1.0"

    def test_rollback_target_version(self):
        mgr = DeploymentManager()
        result = mgr.rollback("Web", "production", target_version="v0.9")
        assert result["target_version"] == "v0.9"

    def test_get_deployment_status_found(self):
        mgr = DeploymentManager()
        deploy = mgr.deploy("Web", "staging")
        found = mgr.get_deployment_status(deploy["id"])
        assert found is not None
        assert found["id"] == deploy["id"]

    def test_get_deployment_status_not_found(self):
        mgr = DeploymentManager()
        assert mgr.get_deployment_status("nonexistent") is None

    def test_get_deployment_history_all(self):
        mgr = DeploymentManager()
        mgr.deploy("A", "staging")
        mgr.deploy("B", "production")
        assert len(mgr.get_deployment_history()) == 2

    def test_get_deployment_history_by_platform(self):
        mgr = DeploymentManager()
        mgr.deploy("A", "staging")
        mgr.deploy("B", "production")
        assert len(mgr.get_deployment_history(platform="A")) == 1

    def test_get_deployment_history_by_environment(self):
        mgr = DeploymentManager()
        mgr.deploy("A", "staging")
        mgr.deploy("A", "production")
        assert len(mgr.get_deployment_history(environment="staging")) == 1

    def test_deploy_azure(self):
        mgr = DeploymentManager()
        result = mgr.deploy_azure("Web", "nzila-rg", "nzila-app")
        assert result["status"] == "simulated"
        assert "Azure" in result["target"]

    def test_deploy_vercel(self):
        mgr = DeploymentManager()
        result = mgr.deploy_vercel("Web", "nzila-web")
        assert result["status"] == "simulated"
        assert "Vercel" in result["target"]


# ── EnvironmentConfig ──────────────────────────────────────────────────────


class TestEnvironmentConfig:
    def test_get_development(self):
        cfg = EnvironmentConfig.get("development")
        assert cfg["name"] == "development"
        assert cfg["features"]["debug"] is True

    def test_get_staging(self):
        cfg = EnvironmentConfig.get("staging")
        assert cfg["name"] == "staging"
        assert cfg["features"]["debug"] is False

    def test_get_production(self):
        cfg = EnvironmentConfig.get("production")
        assert cfg["name"] == "production"
        assert cfg["features"].get("cdn") is True

    def test_get_unknown_falls_back_to_dev(self):
        cfg = EnvironmentConfig.get("unknown")
        assert cfg["name"] == "development"


# ── EnvironmentManager ─────────────────────────────────────────────────────


class TestEnvironmentManager:
    def test_get_config_development(self):
        mgr = EnvironmentManager()
        cfg = mgr.get_config("development")
        assert cfg["debug"] is True
        assert cfg["log_level"] == "DEBUG"

    def test_get_config_staging(self):
        mgr = EnvironmentManager()
        cfg = mgr.get_config("staging")
        assert cfg["debug"] is False

    def test_get_config_production(self):
        mgr = EnvironmentManager()
        cfg = mgr.get_config("production")
        assert cfg["log_level"] == "WARNING"

    def test_get_config_unknown(self):
        mgr = EnvironmentManager()
        cfg = mgr.get_config("bogus")
        assert cfg["name"] == "development"  # fallback

    def test_validate_environment_production(self):
        mgr = EnvironmentManager()
        result = mgr.validate_environment("production")
        assert result["valid"] is True
        assert len(result["checks"]) >= 2

    def test_validate_environment_development(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgres://localhost")
        monkeypatch.setenv("API_KEY", "key123")
        mgr = EnvironmentManager()
        result = mgr.validate_environment("development")
        assert result["valid"] is True
        for check in result["checks"]:
            assert check["status"] == "pass"

    def test_generate_env_file(self):
        mgr = EnvironmentManager()
        content = mgr.generate_env_file("development")
        assert "DEBUG=true" in content
        assert "LOG_LEVEL=DEBUG" in content
        assert "DATABASE_URL=" in content

    def test_generate_env_file_production(self):
        mgr = EnvironmentManager()
        content = mgr.generate_env_file("production")
        assert "DEBUG=false" in content
        assert "LOG_LEVEL=WARNING" in content


# ── Convenience functions ──────────────────────────────────────────────────


class TestConvenience:
    def test_deploy_platform(self):
        result = deploy_platform("Web", "staging", "v1")
        assert result["status"] == "success"

    def test_rollback_platform(self):
        result = rollback_platform("Web")
        assert result["status"] == "success"

    def test_get_environment_config(self):
        cfg = get_environment_config("staging")
        assert cfg["name"] == "staging"

    def test_get_environment_config_default(self):
        cfg = get_environment_config()
        assert cfg["name"] == "development"
