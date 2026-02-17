"""
Export Tests
Validate export files and export manager functionality.
"""

import json
import pytest
from pathlib import Path


EXPORTS_PATH = Path(__file__).parent.parent / "exports"

EXPECTED_EXPORTS = [
    "BOARD_REPORT.md",
    "INVESTOR_DASHBOARD.json",
    "REGULATORY_COMPLIANCE.json",
]


class TestExportFiles:
    """Test export file validity."""

    def test_all_export_files_exist(self):
        """All expected export files should exist."""
        for filename in EXPECTED_EXPORTS:
            path = EXPORTS_PATH / filename
            assert path.exists(), f"Missing export file: {filename}"

    def test_board_report_is_markdown(self):
        """Board report should be valid Markdown content."""
        path = EXPORTS_PATH / "BOARD_REPORT.md"
        content = path.read_text(encoding="utf-8")
        assert len(content) > 0
        # Should contain markdown headings
        assert "#" in content

    def test_investor_dashboard_is_valid_json(self):
        """Investor dashboard should be valid JSON."""
        path = EXPORTS_PATH / "INVESTOR_DASHBOARD.json"
        with open(path) as f:
            data = json.load(f)
        assert isinstance(data, dict)
        assert "dashboard_id" in data
        assert data["dashboard_id"] == "investor_dashboard"

    def test_investor_dashboard_has_sections(self):
        """Investor dashboard should contain key sections."""
        path = EXPORTS_PATH / "INVESTOR_DASHBOARD.json"
        with open(path) as f:
            data = json.load(f)
        section_ids = [s["section_id"] for s in data.get("sections", [])]
        assert "revenue_growth" in section_ids
        assert "unit_economics" in section_ids

    def test_regulatory_compliance_is_valid_json(self):
        """Regulatory compliance report should be valid JSON."""
        path = EXPORTS_PATH / "REGULATORY_COMPLIANCE.json"
        with open(path) as f:
            data = json.load(f)
        assert isinstance(data, dict)
        assert "compliance_frameworks" in data

    def test_regulatory_compliance_has_frameworks(self):
        """Compliance report should list regulatory frameworks."""
        path = EXPORTS_PATH / "REGULATORY_COMPLIANCE.json"
        with open(path) as f:
            data = json.load(f)
        frameworks = data["compliance_frameworks"]
        assert len(frameworks) > 0
        framework_names = [f["framework"] for f in frameworks]
        assert "SOC 2 Type II" in framework_names
        assert "PIPEDA" in framework_names

    def test_regulatory_compliance_has_platform_data(self):
        """Compliance report should include per-platform compliance data."""
        path = EXPORTS_PATH / "REGULATORY_COMPLIANCE.json"
        with open(path) as f:
            data = json.load(f)
        assert "platform_compliance" in data
        assert len(data["platform_compliance"]) > 0


class TestExportManager:
    """Test the export manager module."""

    def test_import(self):
        """ExportManager should be importable."""
        from analytics.generators.export_manager import ExportManager
        em = ExportManager()
        assert em is not None

    def test_export_to_json(self, tmp_path):
        """Should export data to JSON file."""
        from analytics.generators.export_manager import ExportManager
        em = ExportManager(base_path=str(tmp_path))
        test_data = {"test": True, "value": 42}
        output = em.export_to_json(test_data, "test_export.json")
        assert Path(output).exists()
        with open(output) as f:
            loaded = json.load(f)
        assert loaded == test_data

    def test_export_to_markdown(self, tmp_path):
        """Should export content to Markdown file."""
        from analytics.generators.export_manager import ExportManager
        em = ExportManager(base_path=str(tmp_path))
        content = "# Test Report\n\nThis is a test."
        output = em.export_to_markdown(content, "test_report.md")
        assert Path(output).exists()
        assert Path(output).read_text(encoding="utf-8") == content

    def test_export_to_csv(self, tmp_path):
        """Should export data to CSV file."""
        from analytics.generators.export_manager import ExportManager
        em = ExportManager(base_path=str(tmp_path))
        data = [
            {"name": "Platform A", "value": 100},
            {"name": "Platform B", "value": 200},
        ]
        output = em.export_to_csv(data, "test_export.csv")
        assert Path(output).exists()
        content = Path(output).read_text(encoding="utf-8")
        assert "Platform A" in content
        assert "Platform B" in content

    def test_list_exports(self, tmp_path):
        """Should list available exports."""
        from analytics.generators.export_manager import ExportManager
        em = ExportManager(base_path=str(tmp_path))
        em.export_to_json({"a": 1}, "file1.json")
        em.export_to_markdown("# Hello", "file2.md")
        exports = em.list_exports()
        assert len(exports) >= 2
