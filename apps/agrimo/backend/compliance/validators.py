"""
Agrimo-Specific Validators using Jurisdiction Policies

Validators for cooperative registration, harvest data, farmer records, etc.
"""

from decimal import Decimal
from typing import Any, Dict, List, Tuple

from .jurisdiction_loader import JurisdictionConfig


class CooperativeValidator:
    """Validate cooperative registration and compliance with jurisdiction rules."""

    @staticmethod
    def validate_tax_id(tax_id: str, jurisdiction: str) -> Tuple[bool, str]:
        """
        Validate tax ID format against jurisdiction rules.

        Returns:
            (is_valid, error_message)
        """
        if not tax_id:
            return False, "Tax ID is required"

        try:
            policy = JurisdictionConfig.get_policy(jurisdiction)
            tax_id_format = policy["taxIdFormat"]
            expected_prefix = tax_id_format["prefix"]
            expected_length = tax_id_format["length"]

            if not tax_id.startswith(expected_prefix):
                return (
                    False,
                    f"Tax ID must start with {expected_prefix} for {jurisdiction}",
                )

            if len(tax_id) != expected_length:
                return (
                    False,
                    f"Tax ID must be exactly {expected_length} characters",
                )

            return True, ""
        except (ValueError, KeyError) as e:
            return False, f"Validation error: {str(e)}"

    @staticmethod
    def validate_registration_number(
        registration_number: str, jurisdiction: str
    ) -> Tuple[bool, str]:
        """Validate cooperative registration number format."""
        if not registration_number:
            return False, "Registration number is required"

        try:
            policy = JurisdictionConfig.get_policy(jurisdiction)
            reg_format = policy.get("registrationFormat", {})
            pattern = reg_format.get("pattern", "")

            if not pattern:
                # No pattern defined, just check length
                if len(registration_number) < 5:
                    return False, "Registration number too short"
                return True, ""

            # Pattern check would go here (import re for regex matching)
            return True, ""
        except (ValueError, KeyError) as e:
            return False, f"Validation error: {str(e)}"


class FarmerValidator:
    """Validate farmer records and employment compliance."""

    @staticmethod
    def validate_wage(wage: float, jurisdiction: str) -> Tuple[bool, str]:
        """Check wage meets jurisdiction minimum wage requirement."""
        try:
            min_wage = JurisdictionConfig.get_minimum_wage(jurisdiction)
            if wage < min_wage:
                policy = JurisdictionConfig.get_policy(jurisdiction)
                currency = policy.get("currency", "local")
                return (
                    False,
                    f"Wage must be at least {min_wage:,.0f} {currency} "
                    f"(jurisdiction minimum)",
                )
            return True, ""
        except ValueError as e:
            return False, str(e)

    @staticmethod
    def validate_working_hours(
        hours_per_week: float, jurisdiction: str
    ) -> Tuple[bool, str]:
        """Check working hours comply with jurisdiction labor law."""
        try:
            policy = JurisdictionConfig.get_policy(jurisdiction)
            max_hours = policy["laborLaw"]["maximumHoursPerWeek"]

            if hours_per_week > max_hours:
                return False, f"Maximum {max_hours} hours per week allowed"

            if hours_per_week < 0:
                return False, "Working hours cannot be negative"

            return True, ""
        except (ValueError, KeyError) as e:
            return False, str(e)

    @staticmethod
    def validate_leave_days(leave_days: float, jurisdiction: str) -> Tuple[bool, str]:
        """Check leave days meet jurisdiction minimum."""
        try:
            policy = JurisdictionConfig.get_policy(jurisdiction)
            min_leave = policy["laborLaw"]["minimumLeaveDaysPerYear"]

            if leave_days < min_leave:
                return (
                    False,
                    f"Minimum {min_leave} leave days per year required",
                )

            if leave_days > 365:
                return False, "Leave days cannot exceed 365"

            return True, ""
        except (ValueError, KeyError) as e:
            return False, str(e)


class HarvestValidator:
    """Validate harvest data for tax and certification compliance."""

    @staticmethod
    def calculate_sale_tax(
        gross_amount: float, jurisdiction: str, is_agricultural: bool = True
    ) -> Tuple[float, str]:
        """
        Calculate tax on harvest sale.

        Returns:
            (tax_amount, currency_code)
        """
        try:
            policy = JurisdictionConfig.get_policy(jurisdiction)

            # Agricultural products may have reduced tax
            tax_type = "reduced" if is_agricultural else "standard"
            tax_rate = policy["taxes"].get(tax_type, policy["taxes"]["standard"])

            tax_amount = gross_amount * tax_rate
            currency = policy.get("currency", "")

            return tax_amount, currency
        except ValueError as e:
            return 0.0, f"Error: {str(e)}"

    @staticmethod
    def validate_certification_valid(
        certification_type: str, jurisdiction: str
    ) -> Tuple[bool, str]:
        """Check if crop certification type is supported in jurisdiction."""
        # Agrimo-specific: different certifications per jurisdiction
        supported_by_region = {
            "KE": ["ISO-9001", "Fairtrade", "Organic-KE"],
            "UG": ["Fairtrade", "Organic-UG", "RainForest-Alliance"],
            "NG": ["ISO-9001", "Organic-NG"],
        }

        if jurisdiction not in supported_by_region:
            return False, f"Unknown jurisdiction: {jurisdiction}"

        allowed = supported_by_region[jurisdiction]
        if certification_type not in allowed:
            return (
                False,
                f"Certification '{certification_type}' not supported in {jurisdiction}. "
                f"Allowed: {', '.join(allowed)}",
            )

        return True, ""


class ComplianceRecord:
    """Comprehensive compliance record for a cooperative or farmer."""

    def __init__(self, jurisdiction: str):
        self.jurisdiction = jurisdiction
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.compliant = True

    def add_error(self, error: str) -> None:
        """Add a compliance error."""
        self.errors.append(error)
        self.compliant = False

    def add_warning(self, warning: str) -> None:
        """Add a compliance warning (non-blocking)."""
        self.warnings.append(warning)

    def validate_cooperative(
        self,
        tax_id: str,
        registration_number: str,
        cooperative_name: str,
    ) -> bool:
        """Validate cooperative for compliance. Returns True if all checks pass."""
        valid, error = CooperativeValidator.validate_tax_id(tax_id, self.jurisdiction)
        if not valid:
            self.add_error(f"Tax ID: {error}")

        valid, error = CooperativeValidator.validate_registration_number(
            registration_number, self.jurisdiction
        )
        if not valid:
            self.add_error(f"Registration: {error}")

        if len(cooperative_name) < 3:
            self.add_error("Cooperative name too short")

        return self.compliant

    def validate_farmer(
        self,
        name: str,
        wage_monthly: float,
        hours_per_week: float,
        leave_days_annual: float,
    ) -> bool:
        """Validate farmer employment record. Returns True if all checks pass."""
        if len(name) < 2:
            self.add_error("Farmer name too short")

        valid, error = FarmerValidator.validate_wage(wage_monthly, self.jurisdiction)
        if not valid:
            self.add_error(f"Wage: {error}")

        valid, error = FarmerValidator.validate_working_hours(
            hours_per_week, self.jurisdiction
        )
        if not valid:
            self.add_error(f"Hours: {error}")

        valid, error = FarmerValidator.validate_leave_days(
            leave_days_annual, self.jurisdiction
        )
        if not valid:
            self.add_error(f"Leave: {error}")

        return self.compliant

    def get_summary(self) -> Dict[str, Any]:
        """Get compliance summary."""
        return {
            "jurisdiction": self.jurisdiction,
            "compliant": self.compliant,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "errors": self.errors,
            "warnings": self.warnings,
        }
