"""
UnionEyes Compliance Module — Jurisdiction-aware employment and member validation

Used for validating member employment records, leave, benefits, pension contributions
against jurisdiction-specific labor law requirements.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class JurisdictionConfig:
    """
    Shared jurisdiction policy loader for UnionEyes backend.
    Mirrors the Agrimo implementation for consistency.
    """

    _cache: Dict[str, Dict[str, Any]] = {}
    _policies_data: Optional[Dict[str, Any]] = None

    @classmethod
    def _load_policies_data(cls) -> Dict[str, Any]:
        """Load policy data (same as Agrimo) — reuses hardcoded fallback."""
        if cls._policies_data is not None:
            return cls._policies_data

        # Try to load from compiled JS module location
        policy_paths = [
            Path(os.getenv("JURISDICTION_POLICIES_PATH", "")),
            Path(__file__).parent / "policies.json",
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

        logger.warning("Using hardcoded policies")
        return _HARDCODED_POLICIES

    @classmethod
    def get_policy(cls, jurisdiction: str) -> Dict[str, Any]:
        """Get policy for jurisdiction (KE, UG, NG)."""
        if jurisdiction in cls._cache:
            return cls._cache[jurisdiction]

        policies = cls._load_policies_data()

        if jurisdiction not in policies:
            raise ValueError(f"Policy not found for jurisdiction: {jurisdiction}")

        policy = policies[jurisdiction]
        cls._cache[jurisdiction] = policy
        return policy

    @classmethod
    def get_labor_law(cls, jurisdiction: str) -> Dict[str, Any]:
        """Get labor law requirements."""
        policy = cls.get_policy(jurisdiction)
        return policy["laborLaw"]

    @classmethod
    def get_pension_config(cls, jurisdiction: str) -> Dict[str, Any]:
        """Get pension contribution configuration."""
        policy = cls.get_policy(jurisdiction)
        return policy["pension"]

    @classmethod
    def reset_cache(cls) -> None:
        """Clear cache for testing."""
        cls._cache.clear()
        cls._policies_data = None


# Hardcoded fallback policies (identical to Agrimo for consistency)
_HARDCODED_POLICIES = {
    "KE": {
        "name": "Kenya",
        "laborLaw": {
            "minimumWageMonthly": 32264,
            "maximumHoursPerWeek": 48,
            "minimumLeaveDaysPerYear": 21,
            "pensionContributionRequired": True,
            "workersCompensationRequired": True,
        },
        "pension": {
            "contribution": 0.06,
            "employerContribution": 0.06,
            "vesting": 2,
            "eligibilityAgeYears": 60,
            "annualContributionCap": 720000,
        },
        "currency": "KES",
    },
    "UG": {
        "name": "Uganda",
        "laborLaw": {
            "minimumWageMonthly": 12500,
            "maximumHoursPerWeek": 48,
            "minimumLeaveDaysPerYear": 14,
            "pensionContributionRequired": True,
            "workersCompensationRequired": True,
        },
        "pension": {
            "contribution": 0.05,
            "employerContribution": 0.10,
            "vesting": 3,
            "eligibilityAgeYears": 55,
        },
        "currency": "UGX",
    },
    "NG": {
        "name": "Nigeria",
        "laborLaw": {
            "minimumWageMonthly": 33000,
            "maximumHoursPerWeek": 40,
            "minimumLeaveDaysPerYear": 6,
            "pensionContributionRequired": True,
            "workersCompensationRequired": True,
        },
        "pension": {
            "contribution": 0.08,
            "employerContribution": 0.10,
            "vesting": 5,
            "eligibilityAgeYears": 65,
        },
        "currency": "NGN",
    },
}
