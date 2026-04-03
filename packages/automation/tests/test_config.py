"""
Unit tests for config.py

Tests PathConfig, MigrationConstants, get_config, reset_config.
"""

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import MigrationConstants, PathConfig, get_config, reset_config


@pytest.mark.unit
class TestPathConfig:
    """Test PathConfig dataclass and from_env()."""

    def setup_method(self):
        reset_config()

    def teardown_method(self):
        reset_config()

    def test_from_env_defaults(self):
        """Test PathConfig.from_env() uses sensible defaults."""
        env_overrides = {
            k: v
            for k, v in os.environ.items()
            if k
            not in (
                "LEGACY_ROOT",
                "ABR_BACKEND_DIR",
                "ABR_FRONTEND_DIR",
                "UE_BACKEND_DIR",
                "UE_FRONTEND_DIR",
                "DATA_DIR",
                "OUTPUT_DIR",
            )
        }
        with patch.dict(os.environ, env_overrides, clear=True):
            config = PathConfig.from_env()

        assert isinstance(config.legacy_root, Path)
        assert isinstance(config.abr_backend_dir, Path)
        assert isinstance(config.data_dir, Path)
        assert isinstance(config.manifests_dir, Path)
        assert isinstance(config.output_dir, Path)
        # Optional paths default to None
        assert config.abr_frontend_dir is None
        assert config.ue_backend_dir is None
        assert config.ue_frontend_dir is None

    def test_from_env_with_overrides(self, tmp_path):
        """Test PathConfig.from_env() respects environment variables."""
        env = {
            "LEGACY_ROOT": str(tmp_path / "legacy"),
            "ABR_BACKEND_DIR": str(tmp_path / "abr-backend"),
            "ABR_FRONTEND_DIR": str(tmp_path / "abr-frontend"),
            "UE_BACKEND_DIR": str(tmp_path / "ue-backend"),
            "UE_FRONTEND_DIR": str(tmp_path / "ue-frontend"),
            "DATA_DIR": str(tmp_path / "data"),
            "OUTPUT_DIR": str(tmp_path / "output"),
        }
        with patch.dict(os.environ, env):
            config = PathConfig.from_env()

        assert config.legacy_root == tmp_path / "legacy"
        assert config.abr_backend_dir == tmp_path / "abr-backend"
        assert config.abr_frontend_dir == tmp_path / "abr-frontend"
        assert config.ue_backend_dir == tmp_path / "ue-backend"
        assert config.ue_frontend_dir == tmp_path / "ue-frontend"
        assert config.data_dir == tmp_path / "data"
        assert config.output_dir == tmp_path / "output"

    def test_ensure_dirs(self, tmp_path):
        """Test ensure_dirs creates required directories."""
        config = PathConfig(
            legacy_root=tmp_path,
            abr_backend_dir=tmp_path / "abr",
            data_dir=tmp_path / "data",
            manifests_dir=tmp_path / "data" / "manifests",
            output_dir=tmp_path / "output",
        )
        config.ensure_dirs()

        assert config.data_dir.is_dir()
        assert config.manifests_dir.is_dir()
        assert config.output_dir.is_dir()


@pytest.mark.unit
class TestMigrationConstants:
    """Test MigrationConstants values."""

    def test_platform_priority(self):
        assert MigrationConstants.PLATFORM_PRIORITY["union-eyes"] == 1
        assert MigrationConstants.PLATFORM_PRIORITY["c3uo"] == 2
        assert MigrationConstants.PLATFORM_PRIORITY["abr-insights"] == 3

    def test_complexity_scores(self):
        assert MigrationConstants.COMPLEXITY_SCORES["LOW"] == 1
        assert MigrationConstants.COMPLEXITY_SCORES["EXTREME"] == 4

    def test_default_estimates(self):
        assert MigrationConstants.DEFAULT_COMPLEXITY_ESTIMATE["LOW"] == 2
        assert MigrationConstants.DEFAULT_COMPLEXITY_ESTIMATE["EXTREME"] == 12


@pytest.mark.unit
class TestGetConfig:
    """Test get_config singleton."""

    def setup_method(self):
        reset_config()

    def teardown_method(self):
        reset_config()

    def test_get_config_returns_path_config(self):
        config = get_config()
        assert isinstance(config, PathConfig)

    def test_get_config_is_singleton(self):
        c1 = get_config()
        c2 = get_config()
        assert c1 is c2

    def test_reset_config_clears_singleton(self):
        c1 = get_config()
        reset_config()
        c2 = get_config()
        assert c1 is not c2
