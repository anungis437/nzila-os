"""
Jurisdiction Compliance Loader for Django Backends

Loads and caches jurisdiction policies from @nzila/platform-jurisdiction-compliance.
Can be used by Agrimo, Union Eyes, or any other backend service.

Usage:
    from compliance.jurisdiction_loader import JurisdictionConfig

    policy = JurisdictionConfig.get_policy('KE')
    tax_rate = policy['taxes']['standard']
    min_wage = policy['laborLaw']['minimumWageMonthly']
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class JurisdictionConfig:
    """
    Thread-safe loader for jurisdiction policies.
    Policies are cached after first load.
    """

    _cache: Dict[str, Dict[str, Any]] = {}
    _policies_data: Optional[Dict[str, Any]] = None

    @classmethod
    def _shared_policy_paths(cls) -> list[Path]:
        """Return candidate paths for shared compliance package policy artifacts."""
        cwd = Path.cwd()
        return [
            # Explicit env override for deployment/runtime.
            Path(os.getenv("JURISDICTION_POLICIES_PATH", "")),
            # Monorepo workspace path.
            cwd / "packages" / "platform-jurisdiction-compliance" / "src" / "policies.json",
            cwd / ".." / ".." / "packages" / "platform-jurisdiction-compliance" / "src" / "policies.json",
            # Installed package artifact path (when backend is deployed standalone).
            cwd / "node_modules" / "@nzila" / "platform-jurisdiction-compliance" / "dist" / "policies.json",
            cwd / ".." / "node_modules" / "@nzila" / "platform-jurisdiction-compliance" / "dist" / "policies.json",
        ]

    @classmethod
    def _load_policies_data(cls) -> Dict[str, Any]:
        """Load policy data from JSON file or environment."""
        if cls._policies_data is not None:
            return cls._policies_data

        # Try to load from compiled JS module location (if available)
        policy_paths = [
            *cls._shared_policy_paths(),
            Path(__file__).parent / "policies.json",
            Path(os.getcwd()) / "compliance" / "policies.json",
        ]

        for path in policy_paths:
            if path.exists():
                try:
                    with open(path) as f:
                        cls._policies_data = json.load(f)
                    logger.info(f"Loaded policies from {path}")
                    return cls._policies_data
                except (json.JSONDecodeError, IOError) as e:
                    logger.warning(f"Failed to load from {path}: {e}")
                    continue

        # No policy artifact found. In production/staging this is a P0 drift risk:
        # the embedded _HARDCODED_POLICIES are stale by definition (KE/UG/NG only, no
        # version tracking) and silently using them would mask compliance regressions.
        # Fail loud so deployments cannot run without the canonical policy bundle.
        env = (
            os.getenv("AGRIMO_ENV")
            or os.getenv("NODE_ENV")
            or os.getenv("DJANGO_ENV")
            or "development"
        ).lower()
        if env in ("production", "staging"):
            searched = [str(p) for p in policy_paths if str(p)]
            raise RuntimeError(
                "Jurisdiction policies file not found in "
                f"{env}. Build @nzila/platform-jurisdiction-compliance or set "
                "JURISDICTION_POLICIES_PATH. Refusing to fall back to embedded "
                f"hardcoded policies. Searched: {searched}"
            )
        logger.warning(
            "Using hardcoded policies (compiled JS module not found) \u2014 DEV ONLY"
        )
        cls._policies_data = _HARDCODED_POLICIES
        return cls._policies_data

    @classmethod
    def get_policy(cls, jurisdiction: str) -> Dict[str, Any]:
        """
        Get policy for a jurisdiction.

        Args:
            jurisdiction: Code like 'KE', 'UG', 'NG'

        Returns:
            Policy dict with taxes, laborLaw, pension, examBoards, etc.

        Raises:
            ValueError: If jurisdiction not found
        """
        if jurisdiction in cls._cache:
            return cls._cache[jurisdiction]

        policies = cls._load_policies_data()

        if jurisdiction not in policies:
            raise ValueError(
                f"Policy not found for jurisdiction: {jurisdiction}. "
                f"Supported: {', '.join(policies.keys())}"
            )

        policy = policies[jurisdiction]
        cls._cache[jurisdiction] = policy
        return policy

    @classmethod
    def get_tax_rate(cls, jurisdiction: str, tax_type: str = "standard") -> float:
        """Get tax rate for jurisdiction and type."""
        policy = cls.get_policy(jurisdiction)
        return float(policy["taxes"][tax_type])

    @classmethod
    def get_minimum_wage(cls, jurisdiction: str) -> float:
        """Get minimum monthly wage for jurisdiction."""
        policy = cls.get_policy(jurisdiction)
        return float(policy["laborLaw"]["minimumWageMonthly"])

    @classmethod
    def get_pension_config(cls, jurisdiction: str) -> Dict[str, Any]:
        """Get pension contribution configuration."""
        policy = cls.get_policy(jurisdiction)
        return policy["pension"]

    @classmethod
    def get_labor_law(cls, jurisdiction: str) -> Dict[str, Any]:
        """Get labor law requirements (max hours, min leave, etc.)."""
        policy = cls.get_policy(jurisdiction)
        return policy["laborLaw"]

    @classmethod
    def get_exam_board_policy(
        cls, jurisdiction: str, exam_type: str = None
    ) -> Dict[str, Any]:
        """Get exam board requirements."""
        policy = cls.get_policy(jurisdiction)
        boards = policy.get("examBoards", [])

        if not boards:
            return {}

        # If exam_type specified, find matching board
        if exam_type:
            for board in boards:
                if exam_type in board.get("examTypes", []):
                    return board
            # Return first board as fallback
            return boards[0]

        # Return first board
        return boards[0] if boards else {}

    @classmethod
    def reset_cache(cls) -> None:
        """Clear cached policies (useful for testing)."""
        cls._cache.clear()
        cls._policies_data = None

    @classmethod
    def is_supported(cls, jurisdiction: str) -> bool:
        """Check if jurisdiction is supported."""
        try:
            cls.get_policy(jurisdiction)
            return True
        except ValueError:
            return False

    @classmethod
    def list_supported(cls) -> list:
        """Get list of supported jurisdiction codes."""
        policies = cls._load_policies_data()
        return list(policies.keys())


# ── Hardcoded Policies (Fallback) ───────────────────────────────────────────
# These are embedded here to avoid file I/O if the compiled JS module is unavailable.

_HARDCODED_POLICIES = {
    "KE": {
        "name": "Kenya",
        "taxIdFormat": {
            "prefix": "KE-TAX-",
            "length": 15,
            "regex": "^KE-TAX-\\d{8}$",
        },
        "taxes": {
            "standard": 0.16,
            "reduced": 0.0,
            "corporate": 0.30,
            "personal": 0.32,
        },
        "laborLaw": {
            "minimumWageMonthly": 32264,
            "maximumHoursPerWeek": 48,
            "minimumLeaveDaysPerYear": 21,
            "pensionContributionRequired": True,
            "healthInsuranceRequired": False,
            "workersCompensationRequired": True,
        },
        "pension": {
            "contribution": 0.06,
            "employerContribution": 0.06,
            "vesting": 2,
            "eligibilityAgeYears": 60,
            "annualContributionCap": 720000,
        },
        "examBoards": [
            {
                "name": "NITA",
                "examTypes": ["apprenticeship", "competency", "advanced_craft"],
                "certificateValidityYears": 3,
                "appealDeadlineDays": 30,
            }
        ],
        "currency": "KES",
    },
    "UG": {
        "name": "Uganda",
        "taxIdFormat": {
            "prefix": "UG-TAX-",
            "length": 15,
            "regex": "^UG-TAX-\\d{8}$",
        },
        "taxes": {
            "standard": 0.18,
            "reduced": 0.0,
            "corporate": 0.30,
            "personal": 0.40,
        },
        "laborLaw": {
            "minimumWageMonthly": 12500,
            "maximumHoursPerWeek": 48,
            "minimumLeaveDaysPerYear": 14,
            "pensionContributionRequired": True,
            "healthInsuranceRequired": False,
            "workersCompensationRequired": True,
        },
        "pension": {
            "contribution": 0.05,
            "employerContribution": 0.10,
            "vesting": 3,
            "eligibilityAgeYears": 55,
        },
        "examBoards": [
            {
                "name": "UNEB",
                "examTypes": ["apprenticeship", "competency", "skills_certification"],
                "certificateValidityYears": 5,
                "appealDeadlineDays": 45,
            },
            {
                "name": "NBTVE",
                "examTypes": ["competency", "advanced_craft"],
                "certificateValidityYears": 5,
                "appealDeadlineDays": 45,
            },
        ],
        "currency": "UGX",
    },
    "NG": {
        "name": "Nigeria",
        "taxIdFormat": {
            "prefix": "NG-TAX-",
            "length": 15,
            "regex": "^NG-TAX-\\d{8}$",
        },
        "taxes": {
            "standard": 0.075,
            "reduced": 0.05,
            "corporate": 0.30,
            "personal": 0.21,
        },
        "laborLaw": {
            "minimumWageMonthly": 33000,
            "maximumHoursPerWeek": 40,
            "minimumLeaveDaysPerYear": 6,
            "pensionContributionRequired": True,
            "healthInsuranceRequired": False,
            "workersCompensationRequired": True,
        },
        "pension": {
            "contribution": 0.08,
            "employerContribution": 0.10,
            "vesting": 5,
            "eligibilityAgeYears": 65,
        },
        "examBoards": [
            {
                "name": "NABTEB",
                "examTypes": ["apprenticeship", "national_diploma", "advanced_diploma"],
                "certificateValidityYears": 3,
                "appealDeadlineDays": 14,
            },
            {
                "name": "NBTE",
                "examTypes": ["national_diploma", "advanced_diploma"],
                "certificateValidityYears": 5,
                "appealDeadlineDays": 21,
            },
        ],
        "currency": "NGN",
    },
}
