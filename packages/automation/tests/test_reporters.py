"""Tests for reporters package – Board, Compliance, Executive, Investor."""

import json
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pytest
from reporters import (
    BoardReporter,
    ComplianceReporter,
    ExecutiveDashboard,
    InvestorReporter,
)
from reporters.board_report import generate_board_report
from reporters.compliance_report import generate_compliance_report
from reporters.executive_dashboard import generate_dashboard
from reporters.investor_report import generate_investor_report

# ── BoardReporter ────────────────────────────────────────────────────────


class TestBoardReporter:
    def test_init_creates_output_dir(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        br = BoardReporter(data_dir=data_dir)
        assert br.output_dir.exists()

    def test_load_portfolio_data_no_file(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        br = BoardReporter(data_dir=data_dir)
        assert br.load_portfolio_data() == {}

    def test_load_portfolio_data_with_file(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        profiles = {"portfolio": {"total_platforms": 20}}
        (data_dir / "platform_profiles.json").write_text(json.dumps(profiles))
        br = BoardReporter(data_dir=data_dir)
        assert br.load_portfolio_data()["portfolio"]["total_platforms"] == 20

    def test_get_quarter_q1(self):
        br = BoardReporter()
        assert br.get_quarter(datetime(2026, 2, 15)) == "Q1 2026"

    def test_get_quarter_q4(self):
        br = BoardReporter()
        assert br.get_quarter(datetime(2026, 12, 1)) == "Q4 2026"

    def test_get_quarter_default(self):
        br = BoardReporter()
        q = br.get_quarter()
        assert q.startswith("Q")

    def test_generate_report(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        br = BoardReporter(data_dir=data_dir)
        report = br.generate_report("Q1 2026")
        assert "Quarterly Board Report" in report
        assert "Q1 2026" in report
        assert "Executive Summary" in report
        assert "Financial" in report

    def test_generate_report_default_quarter(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        br = BoardReporter(data_dir=data_dir)
        report = br.generate_report()
        assert "Quarterly Board Report" in report

    def test_calculate_runway_end(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        br = BoardReporter(data_dir=data_dir)
        result = br._calculate_runway_end()
        assert isinstance(result, str)
        assert len(result) > 0

    def test_next_board_meeting(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        br = BoardReporter(data_dir=data_dir)
        result = br._next_board_meeting()
        assert isinstance(result, str)
        assert "," in result or "20" in result

    def test_save_report(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        br = BoardReporter(data_dir=data_dir)
        path = br.save_report("Q1 2026")
        assert path.exists()
        content = path.read_text(encoding="utf-8")
        assert "Q1 2026" in content

    def test_generate_summary_cards(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        br = BoardReporter(data_dir=data_dir)
        cards = br.generate_summary_cards()
        assert len(cards) >= 4
        assert cards[0]["title"] == "Total Platforms"

    def test_generate_board_report_convenience(self):
        with patch("reporters.board_report.BoardReporter") as MockBR:
            MockBR.return_value.generate_report.return_value = (
                "# Quarterly Board Report: Q2 2026"
            )
            report = generate_board_report("Q2 2026")
        assert "Q2 2026" in report


# ── ComplianceReporter ───────────────────────────────────────────────────


class TestComplianceReporter:
    def test_init(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        cr = ComplianceReporter(data_dir=data_dir)
        assert cr.output_dir.exists()

    def test_generate_hipaa(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        cr = ComplianceReporter(data_dir=data_dir)
        report = cr.generate_hipaa_compliance()
        assert "HIPAA" in report
        assert "PHI Protection" in report

    def test_generate_soc2(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        cr = ComplianceReporter(data_dir=data_dir)
        report = cr.generate_soc2_compliance()
        assert "SOC 2" in report
        assert "Security" in report

    def test_generate_data_residency(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        cr = ComplianceReporter(data_dir=data_dir)
        report = cr.generate_data_residency_report()
        assert "Data Residency" in report
        assert "Canada" in report

    def test_generate_security_assessment(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        cr = ComplianceReporter(data_dir=data_dir)
        report = cr.generate_security_assessment()
        assert "Security Assessment" in report
        assert "7.5/10" in report


# ── ExecutiveDashboard ───────────────────────────────────────────────────


class TestExecutiveDashboard:
    def test_init(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        ed = ExecutiveDashboard(data_dir=data_dir)
        assert ed.output_dir.exists()

    def test_load_data_no_file(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        ed = ExecutiveDashboard(data_dir=data_dir)
        assert ed.load_data() == {}

    def test_load_data_with_file(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        (data_dir / "platform_profiles.json").write_text('{"key": "val"}')
        ed = ExecutiveDashboard(data_dir=data_dir)
        assert ed.load_data()["key"] == "val"

    def test_generate_kpi_summary(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        ed = ExecutiveDashboard(data_dir=data_dir)
        kpis = ed.generate_kpi_summary()
        assert kpis["portfolio"]["total_platforms"] == 15
        assert kpis["financial"]["runway_months"] == 24

    def test_generate_dashboard_json(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        ed = ExecutiveDashboard(data_dir=data_dir)
        dj = ed.generate_dashboard_json()
        assert dj["title"] == "Nzila Executive Dashboard"
        assert len(dj["kpis"]) >= 5
        assert len(dj["charts"]) >= 3

    def test_generate_alerts(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        ed = ExecutiveDashboard(data_dir=data_dir)
        alerts = ed.generate_alerts()
        assert len(alerts) == 3
        sev = {a["severity"] for a in alerts}
        assert "warning" in sev

    def test_save_dashboard(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        ed = ExecutiveDashboard(data_dir=data_dir)
        path = ed.save_dashboard()
        assert path.exists()
        loaded = json.loads(path.read_text())
        assert loaded["title"] == "Nzila Executive Dashboard"

    def test_generate_text_summary(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        ed = ExecutiveDashboard(data_dir=data_dir)
        text = ed.generate_text_summary()
        assert "NZILA EXECUTIVE DASHBOARD" in text
        assert "PORTFOLIO" in text

    def test_generate_dashboard_convenience(self):
        dj = generate_dashboard()
        assert "title" in dj


# ── InvestorReporter ─────────────────────────────────────────────────────


class TestInvestorReporter:
    def test_init(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        ir = InvestorReporter(data_dir=data_dir)
        assert ir.output_dir.exists()

    def test_load_data_no_file(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        ir = InvestorReporter(data_dir=data_dir)
        assert ir.load_data() == {}

    def test_generate_investor_update(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        ir = InvestorReporter(data_dir=data_dir)
        report = ir.generate_investor_update("March 2026")
        assert "March 2026" in report
        assert "Investor Update" in report
        assert "Production Platforms" in report

    def test_generate_investor_update_default_month(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        ir = InvestorReporter(data_dir=data_dir)
        report = ir.generate_investor_update()
        assert "Investor Update" in report

    def test_generate_investor_update_with_data(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        profiles = {
            "platforms": [
                {"name": "Web", "status": "production", "vertical": "Fintech"},
                {"name": "App", "status": "beta", "vertical": "EdTech"},
                {"name": "New", "status": "development", "vertical": "Agri"},
            ],
            "financial": {
                "total_raised": 5000000,
                "arr_target": 500000,
                "runway": 18,
                "series_a_target": 5000000,
            },
        }
        (data_dir / "platform_profiles.json").write_text(json.dumps(profiles))
        ir = InvestorReporter(data_dir=data_dir)
        report = ir.generate_investor_update("Jan 2026")
        assert "Web" in report
        assert "App" in report
        assert "New" in report

    def test_generate_cap_table(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        ir = InvestorReporter(data_dir=data_dir)
        table = ir.generate_cap_table()
        assert "Cap Table" in table
        assert "Founders" in table

    def test_generate_deck_summary(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        ir = InvestorReporter(data_dir=data_dir)
        deck = ir.generate_deck_summary()
        assert "Investor One-Pager" in deck
        assert "$100B" in deck

    def test_save_update(self, tmp_path):
        """Cover investor_report.py save_update method."""
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        ir = InvestorReporter(data_dir=data_dir)
        path = ir.save_update("March 2026")
        assert path.exists()
        content = path.read_text(encoding="utf-8")
        assert "March 2026" in content

    def test_generate_investor_report_convenience(self):
        """Cover investor_report.py convenience function."""
        with patch("reporters.investor_report.InvestorReporter") as MockIR:
            MockIR.return_value.generate_investor_update.return_value = (
                "# Investor Update: April 2026"
            )
            report = generate_investor_report("April 2026")
        assert "April 2026" in report


# ── ComplianceReporter extra coverage ────────────────────────────────────


class TestComplianceReporterExtra:
    def test_generate_compliance_dashboard(self, tmp_path):
        """Cover compliance_report.py generate_compliance_dashboard."""
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        cr = ComplianceReporter(data_dir=data_dir)
        dashboard = cr.generate_compliance_dashboard()
        assert len(dashboard["frameworks"]) == 4
        assert dashboard["security_score"] == 7.5
        assert dashboard["vulnerabilities"]["critical"] == 0

    def test_save_compliance_report_hipaa(self, tmp_path):
        """Cover compliance_report.py save_compliance_report."""
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        cr = ComplianceReporter(data_dir=data_dir)
        path = cr.save_compliance_report("hipaa")
        assert path.exists()
        content = path.read_text(encoding="utf-8")
        assert "HIPAA" in content

    def test_save_compliance_report_soc2(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        cr = ComplianceReporter(data_dir=data_dir)
        path = cr.save_compliance_report("soc2")
        assert path.exists()

    def test_save_compliance_report_unknown_type(self, tmp_path):
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        cr = ComplianceReporter(data_dir=data_dir)
        path = cr.save_compliance_report("unknown")
        assert path.exists()  # Falls back to hipaa

    def test_generate_compliance_report_convenience(self):
        """Cover compliance_report.py convenience function."""
        with patch("reporters.compliance_report.ComplianceReporter") as MockCR:
            MockCR.return_value.generate_hipaa_compliance.return_value = (
                "# HIPAA Report"
            )
            report = generate_compliance_report("hipaa")
        assert "HIPAA" in report

    def test_generate_compliance_report_soc2_convenience(self):
        with patch("reporters.compliance_report.ComplianceReporter") as MockCR:
            MockCR.return_value.generate_soc2_compliance.return_value = "# SOC 2 Report"
            report = generate_compliance_report("soc2")
        assert "SOC 2" in report


# ── BoardReporter Q4 branch ──────────────────────────────────────────────


class TestBoardReporterQ4:
    def test_next_board_meeting_q4(self, tmp_path):
        """Cover board_report.py lines 223-224 (Q4 → Q1 next year)."""
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        br = BoardReporter(data_dir=data_dir)
        with patch("reporters.board_report.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 11, 15)
            mock_dt.side_effect = lambda *a, **k: datetime(*a, **k)
            result = br._next_board_meeting()
        assert "2027" in result
