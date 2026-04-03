"""Tests for security package – SecurityAudit & SecurityScanner."""

import json
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from security.scanner import SecurityScanner as ScannerDirect

from security import SecurityAudit, SecurityScanner, run_audit, scan_all_platforms


@pytest.fixture
def clean_dir():
    """Temp directory without 'test' in path (scanner skips test/example/mock dirs)."""
    d = Path(tempfile.mkdtemp(prefix="scan_"))
    yield d
    shutil.rmtree(d, ignore_errors=True)


# ── SecurityAudit ───────────────────────────────────────────────────────────


class TestSecurityAudit:
    def test_audit_authentication(self):
        audit = SecurityAudit()
        result = audit.audit_authentication()
        assert result["component"] == "Authentication"
        assert len(result["checks"]) >= 3

    def test_audit_database(self):
        audit = SecurityAudit()
        result = audit.audit_database()
        assert result["component"] == "Database"
        assert len(result["checks"]) >= 4

    def test_audit_api_security(self):
        audit = SecurityAudit()
        result = audit.audit_api_security()
        assert result["component"] == "API Security"

    def test_audit_infrastructure(self):
        audit = SecurityAudit()
        result = audit.audit_infrastructure()
        assert result["component"] == "Infrastructure"

    def test_audit_code_quality(self):
        audit = SecurityAudit()
        result = audit.audit_code_quality()
        assert result["component"] == "Code Quality"

    def test_run_full_audit(self):
        audit = SecurityAudit()
        result = audit.run_full_audit()
        assert "timestamp" in result
        assert len(result["audits"]) == 5

    def test_get_audit_summary(self):
        audit = SecurityAudit()
        summary = audit.get_audit_summary()
        assert summary["total_checks"] > 0
        assert summary["passed"] >= 0
        assert summary["warnings"] >= 0
        assert summary["failed"] >= 0
        assert 0 <= summary["score"] <= 100

    def test_generate_report(self):
        audit = SecurityAudit()
        report = audit.generate_report()
        assert "# Security Audit Report" in report
        assert "Score:" in report
        assert "Authentication" in report
        assert "Database" in report

    def test_run_audit_convenience(self):
        result = run_audit()
        assert "audits" in result
        assert len(result["audits"]) == 5

    def test_get_audit_summary_with_fail(self):
        """Cover audit.py lines 182-183 (fail branch in get_audit_summary)."""
        audit = SecurityAudit()
        fake_audit = {
            "timestamp": "2026-01-01T00:00:00",
            "audits": [
                {
                    "component": "Test",
                    "checks": [
                        {"name": "c1", "status": "pass"},
                        {"name": "c2", "status": "fail"},
                        {"name": "c3", "status": "warning"},
                    ],
                }
            ],
        }
        with patch.object(audit, "run_full_audit", return_value=fake_audit):
            summary = audit.get_audit_summary()
        assert summary["failed"] == 1
        assert summary["passed"] == 1
        assert summary["warnings"] == 1


# ── SecurityScanner ─────────────────────────────────────────────────────────


class TestSecurityScanner:
    def test_scan_file_clean(self, tmp_path):
        f = tmp_path / "clean.py"
        f.write_text("print('hello world')\n")
        scanner = SecurityScanner(base_path=tmp_path)
        result = scanner.scan_file(f)
        assert result["issue_count"] == 0

    def test_scan_file_detects_aws_key(self, clean_dir):
        f = clean_dir / "secrets.py"
        f.write_text('key = "AKIAIOSFODNN7EXAMPLE"\n')
        scanner = SecurityScanner(base_path=clean_dir)
        result = scanner.scan_file(f)
        assert result["issue_count"] >= 1
        assert any(i["pattern"] == "AWS_KEY" for i in result["issues"])

    def test_scan_file_detects_private_key(self, clean_dir):
        f = clean_dir / "key.pem"
        f.write_text(
            "-----BEGIN RSA PRIVATE KEY-----\ndata\n-----END RSA PRIVATE KEY-----\n"
        )
        scanner = SecurityScanner(base_path=clean_dir)
        result = scanner.scan_file(f)
        assert any(i["pattern"] == "PRIVATE_KEY" for i in result["issues"])

    def test_scan_file_detects_stripe_key(self, clean_dir):
        f = clean_dir / "pay.py"
        # Use pk_test_ (publishable key format) to avoid GitHub push protection
        # while still matching the STRIPE_KEY scanner pattern.
        f.write_text('STRIPE = "pk_test_00000000000000fake00key0"\n')
        scanner = SecurityScanner(base_path=clean_dir)
        result = scanner.scan_file(f)
        assert any(i["pattern"] == "STRIPE_KEY" for i in result["issues"])

    def test_scan_file_detects_debug_mode(self, tmp_path):
        f = tmp_path / "settings.py"
        f.write_text("DEBUG = True\n")
        scanner = SecurityScanner(base_path=tmp_path)
        result = scanner.scan_file(f)
        assert any(i["pattern"] == "DEBUG_MODE" for i in result["issues"])

    def test_scan_file_detects_hardcoded_password(self, tmp_path):
        f = tmp_path / "config.py"
        f.write_text('password = "secret123"\n')
        scanner = SecurityScanner(base_path=tmp_path)
        result = scanner.scan_file(f)
        assert any(i["pattern"] == "HARDCODE_CREDENTIALS" for i in result["issues"])

    def test_scan_file_skips_test_files(self, tmp_path):
        f = tmp_path / "test_example.py"
        f.write_text('key = "AKIAIOSFODNN7EXAMPLE"\n')
        scanner = SecurityScanner(base_path=tmp_path)
        result = scanner.scan_file(f)
        # Secrets in test/example files are skipped
        assert result["issue_count"] == 0

    def test_scan_file_encoding_error(self, tmp_path):
        f = tmp_path / "binary.bin"
        f.write_bytes(b"\x80\x81\x82")
        scanner = SecurityScanner(base_path=tmp_path)
        result = scanner.scan_file(f)
        # Should not crash
        assert isinstance(result["issues"], list)

    def test_scan_directory(self, tmp_path):
        (tmp_path / "app.py").write_text("x = 1\n")
        (tmp_path / "config.py").write_text("DEBUG = True\n")
        scanner = SecurityScanner(base_path=tmp_path)
        result = scanner.scan_directory(tmp_path)
        assert result["files_scanned"] >= 2
        assert result["total_issues"] >= 1

    def test_scan_directory_skips_node_modules(self, tmp_path):
        nm = tmp_path / "node_modules" / "pkg"
        nm.mkdir(parents=True)
        (nm / "index.js").write_text('key = "AKIAIOSFODNN7EXAMPLE"\n')
        scanner = SecurityScanner(base_path=tmp_path)
        result = scanner.scan_directory(tmp_path)
        # node_modules should be skipped
        assert all("node_modules" not in f["file"] for f in result["files"])

    def test_scan_directory_custom_extensions(self, tmp_path):
        (tmp_path / "file.txt").write_text("data")
        (tmp_path / "file.py").write_text("x=1")
        scanner = SecurityScanner(base_path=tmp_path)
        result = scanner.scan_directory(tmp_path, extensions=[".txt"])
        assert result["files_scanned"] == 1

    def test_scan_platform_not_found(self, tmp_path):
        scanner = SecurityScanner(base_path=tmp_path)
        result = scanner.scan_platform("nonexistent")
        assert "error" in result

    def test_scan_platform_found(self, tmp_path):
        plat = tmp_path / "myplatform"
        plat.mkdir()
        (plat / "app.py").write_text("x = 1\n")
        scanner = SecurityScanner(base_path=tmp_path)
        result = scanner.scan_platform("myplatform")
        assert result["files_scanned"] >= 1


# ── scan_all_platforms convenience ─────────────────────────────────────────


class TestScanAllPlatforms:
    def test_no_dirs_exist(self, tmp_path):
        result = scan_all_platforms(base_path=tmp_path)
        assert result["total_issues"] == 0
        assert len(result["scans"]) == 0

    def test_with_website_dir(self, tmp_path):
        website = tmp_path / "nzila-website"
        website.mkdir()
        (website / "index.js").write_text("console.log('hi')\n")
        result = scan_all_platforms(base_path=tmp_path)
        assert len(result["scans"]) >= 1

    def test_with_automation_dir(self, tmp_path):
        auto = tmp_path / "automation"
        auto.mkdir()
        (auto / "run.py").write_text("print('hi')\n")
        result = scan_all_platforms(base_path=tmp_path)
        assert len(result["scans"]) >= 1
