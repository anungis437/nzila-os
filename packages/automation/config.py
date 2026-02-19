"""
Central configuration module for Nzila Automation.

Provides environment-based configuration with sensible defaults.
All paths should be configured via environment variables in production.
"""

import os
from pathlib import Path
from typing import Optional
from dataclasses import dataclass


@dataclass
class PathConfig:
    """Configuration for paths used across the automation system."""
    
    # Required paths
    legacy_root: Path
    abr_backend_dir: Path
    data_dir: Path
    manifests_dir: Path
    output_dir: Path
    
    # Optional paths
    abr_frontend_dir: Optional[Path] = None
    ue_backend_dir: Optional[Path] = None
    ue_frontend_dir: Optional[Path] = None
    
    @classmethod
    def from_env(cls) -> "PathConfig":
        """Create PathConfig from environment variables."""
        workspace = Path.cwd()
        
        # Legacy root - where all legacy codebases are stored
        legacy_root = Path(os.environ.get("LEGACY_ROOT", workspace / "legacy-codebases"))
        
        # ABR Insights
        abr_backend = Path(os.environ.get("ABR_BACKEND_DIR", r"D:\APPS\nzila-abr-insights\backend"))
        abr_frontend_env = os.environ.get("ABR_FRONTEND_DIR")
        abr_frontend = Path(abr_frontend_env) if abr_frontend_env else None
        
        # Union Eyes
        ue_backend_env = os.environ.get("UE_BACKEND_DIR")
        ue_backend = Path(ue_backend_env) if ue_backend_env else None
        ue_frontend_env = os.environ.get("UE_FRONTEND_DIR")
        ue_frontend = Path(ue_frontend_env) if ue_frontend_env else None
        
        # Output directories
        automation_root = workspace / "packages" / "automation"
        data_dir = Path(os.environ.get("DATA_DIR", automation_root / "data"))
        manifests_dir = data_dir / "manifests"
        output_dir = Path(os.environ.get("OUTPUT_DIR", workspace / "output"))
        
        return cls(
            legacy_root=legacy_root,
            abr_backend_dir=abr_backend,
            abr_frontend_dir=abr_frontend,
            ue_backend_dir=ue_backend,
            ue_frontend_dir=ue_frontend,
            data_dir=data_dir,
            manifests_dir=manifests_dir,
            output_dir=output_dir,
        )
    
    def ensure_dirs(self):
        """Ensure all required directories exist."""
        for dir_path in [self.data_dir, self.manifests_dir, self.output_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)


# ──────────────────────────────────────────────────────────────────
# Migration Strategy Constants
# ──────────────────────────────────────────────────────────────────

class MigrationConstants:
    """Constants for migration strategies and priorities."""
    
    # Platform migration priorities (lower = higher priority)
    PLATFORM_PRIORITY = {
        "union-eyes": 1,
        "c3uo": 2,
        "abr-insights": 3,
    }
    
    # Complexity scores
    COMPLEXITY_SCORES = {
        "LOW": 1,
        "MEDIUM": 2,
        "HIGH": 3,
        "EXTREME": 4,
    }
    
    # Default estimates (in weeks)
    DEFAULT_COMPLEXITY_ESTIMATE = {
        "LOW": 2,
        "MEDIUM": 4,
        "HIGH": 8,
        "EXTREME": 12,
    }


# ──────────────────────────────────────────────────────────────────
# Singleton config instance
# ──────────────────────────────────────────────────────────────────

_config: Optional[PathConfig] = None


def get_config() -> PathConfig:
    """Get the global configuration instance (singleton)."""
    global _config
    if _config is None:
        _config = PathConfig.from_env()
    return _config


def reset_config():
    """Reset the configuration (useful for testing)."""
    global _config
    _config = None
