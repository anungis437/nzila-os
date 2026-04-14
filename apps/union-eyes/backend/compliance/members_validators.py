"""
Union Eyes Member & Employment Validators

Validates member records, employment terms, benefits, and pension contributions
against jurisdiction-specific labor law requirements.
"""

from decimal import Decimal
from typing import Any, Dict, List, Tuple

from .jurisdiction_config import JurisdictionConfig


class MemberEmploymentValidator:
    """
    Validate member employment records for compliance with jurisdiction labor law.
    Used when creating or updating member employment records.
    """

    @staticmethod
    def validate_wage(
        wage: float, hours_per_week: float, jurisdiction: str
    ) -> Tuple[bool, str]:
        """
        Validate that wage meets jurisdiction minimum wage requirement.
        Accounts for part-time work (assumes 40-hour week baseline).

        Returns:
            (is_valid, error_message)
        """
        try:
            policy = JurisdictionConfig.get_policy(jurisdiction)
            labor_law = policy["laborLaw"]

            # Get minimum wage (assumed for full-time 40h/week)
            min_wage = labor_law["minimumWageMonthly"]

            # For part-time, calculate proportional minimum wage
            # Assume 40 hours/week is "full time" baseline
            full_time_hours = 40
            wage_adjustment_factor = (
                min(hours_per_week, full_time_hours) / full_time_hours
            )
            proportional_min_wage = min_wage * wage_adjustment_factor

            if wage < proportional_min_wage:
                currency = policy.get("currency", "local")
                return (
                    False,
                    f"Wage must be at least {proportional_min_wage:,.0f} {currency} "
                    f"for {hours_per_week}h/week ({min_wage:,.0f} for 40h/week)",
                )

            return True, ""
        except ValueError as e:
            return False, str(e)

    @staticmethod
    def validate_working_hours(
        hours_per_week: float, jurisdiction: str
    ) -> Tuple[bool, str]:
        """Validate working hours comply with jurisdiction maximum."""
        try:
            policy = JurisdictionConfig.get_policy(jurisdiction)
            max_hours = policy["laborLaw"]["maximumHoursPerWeek"]

            if hours_per_week < 0:
                return False, "Working hours cannot be negative"

            if hours_per_week > max_hours:
                return (
                    False,
                    f"Maximum {max_hours} hours per week allowed (jurisdiction limit)",
                )

            return True, ""
        except ValueError as e:
            return False, str(e)

    @staticmethod
    def validate_leave_entitlement(
        leave_days_annual: float, jurisdiction: str
    ) -> Tuple[bool, str]:
        """Validate annual leave meets or exceeds jurisdiction minimum."""
        try:
            policy = JurisdictionConfig.get_policy(jurisdiction)
            min_leave = policy["laborLaw"]["minimumLeaveDaysPerYear"]

            if leave_days_annual < 0:
                return False, "Leave days cannot be negative"

            if leave_days_annual < min_leave:
                return False, f"Minimum {min_leave} leave days per year required"

            if leave_days_annual > 365:
                return False, "Leave days cannot exceed 365"

            return True, ""
        except ValueError as e:
            return False, str(e)

    @staticmethod
    def validate_pension_contribution(
        employer_contribution_rate: float, jurisdiction: str
    ) -> Tuple[bool, str]:
        """
        Validate that employer pension contribution meets jurisdiction requirements.
        """
        try:
            policy = JurisdictionConfig.get_policy(jurisdiction)
            pension = policy["pension"]

            # Employer contribution should be at least the defined rate
            required_rate = pension["employerContribution"]

            if employer_contribution_rate < 0:
                return False, "Contribution rate cannot be negative"

            if employer_contribution_rate < required_rate:
                return (
                    False,
                    f"Employer pension contribution must be at least {required_rate*100:.1f}% "
                    f"for {policy['name']}",
                )

            return True, ""
        except ValueError as e:
            return False, str(e)

    @staticmethod
    def validate_employment_record(
        wage: float,
        hours_per_week: float,
        leave_days_annual: float,
        employer_pension_rate: float,
        jurisdiction: str,
    ) -> Tuple[bool, List[str]]:
        """
        Comprehensive validation of all employment terms.

        Returns:
            (is_compliant, list_of_errors)
        """
        errors = []

        valid, error = MemberEmploymentValidator.validate_wage(
            wage, hours_per_week, jurisdiction
        )
        if not valid:
            errors.append(f"Wage: {error}")

        valid, error = MemberEmploymentValidator.validate_working_hours(
            hours_per_week, jurisdiction
        )
        if not valid:
            errors.append(f"Hours: {error}")

        valid, error = MemberEmploymentValidator.validate_leave_entitlement(
            leave_days_annual, jurisdiction
        )
        if not valid:
            errors.append(f"Leave: {error}")

        valid, error = MemberEmploymentValidator.validate_pension_contribution(
            employer_pension_rate, jurisdiction
        )
        if not valid:
            errors.append(f"Pension: {error}")

        return len(errors) == 0, errors


class MemberComplianceStatus:
    """Track compliance status of a member's employment record."""

    def __init__(self, member_id: str, jurisdiction: str):
        self.member_id = member_id
        self.jurisdiction = jurisdiction
        self.issues: List[Dict[str, Any]] = []
        self.last_checked: str = None

    def check_compliance(
        self,
        wage: float,
        hours_per_week: float,
        leave_days_annual: float,
        employer_pension_rate: float,
    ) -> bool:
        """
        Check member employment compliance.

        Returns:
            True if fully compliant, False if any issues found
        """
        self.issues.clear()

        is_compliant, errors = MemberEmploymentValidator.validate_employment_record(
            wage=wage,
            hours_per_week=hours_per_week,
            leave_days_annual=leave_days_annual,
            employer_pension_rate=employer_pension_rate,
            jurisdiction=self.jurisdiction,
        )

        for error in errors:
            self.issues.append(
                {"type": "compliance_violation", "message": error, "severity": "high"}
            )

        return is_compliant

    def get_compliance_report(self) -> Dict[str, Any]:
        """Generate compliance report for member."""
        return {
            "member_id": self.member_id,
            "jurisdiction": self.jurisdiction,
            "compliant": len(self.issues) == 0,
            "issue_count": len(self.issues),
            "issues": self.issues,
            "last_checked": self.last_checked,
        }
