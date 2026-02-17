"""
Dashboard Tests
Validate dashboard JSON files and generator outputs.
"""

import json
import os
import pytest
from pathlib import Path


DASHBOARDS_PATH = Path(__file__).parent.parent / "dashboards"

EXPECTED_DASHBOARDS = [
    "EXECUTIVE_SUMMARY.json",
    "PORTFOLIO_HEALTH.json",
    "PLATFORM_PERFORMANCE.json",
    "FINANCIAL_FORECAST.json",
    "MIGRATION_TRACKER.json",
    "RISK_DASHBOARD.json",
]

REQUIRED_FIELDS = ["dashboard_id", "name", "description", "version", "last_updated"]


class TestDashboardFiles:
    """Test dashboard JSON file validity."""

    def test_all_dashboard_files_exist(self):
        """All expected dashboard files should exist."""
        for filename in EXPECTED_DASHBOARDS:
            path = DASHBOARDS_PATH / filename
            assert path.exists(), f"Missing dashboard file: {filename}"

    @pytest.mark.parametrize("filename", EXPECTED_DASHBOARDS)
    def test_dashboard_is_valid_json(self, filename):
        """Each dashboard file should be valid JSON."""
        path = DASHBOARDS_PATH / filename
        if not path.exists():
            pytest.skip(f"{filename} not found")
        with open(path) as f:
            data = json.load(f)
        assert isinstance(data, dict)

    @pytest.mark.parametrize("filename", EXPECTED_DASHBOARDS)
    def test_dashboard_has_required_fields(self, filename):
        """Each dashboard should have required metadata fields."""
        path = DASHBOARDS_PATH / filename
        if not path.exists():
            pytest.skip(f"{filename} not found")
        with open(path) as f:
            data = json.load(f)
        for field in REQUIRED_FIELDS:
            assert field in data, f"{filename} missing required field: {field}"

    @pytest.mark.parametrize("filename", EXPECTED_DASHBOARDS)
    def test_dashboard_has_sections_or_platforms(self, filename):
        """Each dashboard should have sections or platforms for content."""
        path = DASHBOARDS_PATH / filename
        if not path.exists():
            pytest.skip(f"{filename} not found")
        with open(path) as f:
            data = json.load(f)
        has_content = "sections" in data or "platforms" in data
        assert has_content, f"{filename} has no 'sections' or 'platforms'"

    def test_executive_summary_has_financial_section(self):
        """Executive summary should contain financial health data."""
        path = DASHBOARDS_PATH / "EXECUTIVE_SUMMARY.json"
        with open(path) as f:
            data = json.load(f)
        section_ids = [s["section_id"] for s in data.get("sections", [])]
        assert "financial_health" in section_ids

    def test_migration_tracker_has_phases(self):
        """Migration tracker should include backbone phases."""
        path = DASHBOARDS_PATH / "MIGRATION_TRACKER.json"
        with open(path) as f:
            data = json.load(f)
        section_ids = [s["section_id"] for s in data.get("sections", [])]
        assert "backbone_progress" in section_ids


class TestDashboardGenerator:
    """Test the dashboard generator module."""

    def test_generator_import(self):
        """DashboardGenerator should be importable."""
        from analytics.generators.dashboard_generator import DashboardGenerator
        gen = DashboardGenerator()
        assert gen is not None

    def test_generate_executive_summary(self):
        """Should generate executive summary dashboard data."""
        from analytics.generators.dashboard_generator import DashboardGenerator
        gen = DashboardGenerator()
        result = gen.generate_executive_summary()
        assert "dashboard_id" in result
        assert result["dashboard_id"] == "executive_summary"
        assert "portfolio_metrics" in result
        assert "financial_metrics" in result

    def test_generate_portfolio_health(self):
        """Should generate portfolio health dashboard data."""
        from analytics.generators.dashboard_generator import DashboardGenerator
        gen = DashboardGenerator()
        result = gen.generate_portfolio_health()
        assert result["dashboard_id"] == "portfolio_health"
        assert "vertical_distribution" in result

    def test_generate_platform_performance(self):
        """Should generate platform performance data."""
        from analytics.generators.dashboard_generator import DashboardGenerator
        gen = DashboardGenerator()
        result = gen.generate_platform_performance()
        assert result["dashboard_id"] == "platform_performance"
