"""Tests for validation package – PlatformValidator & SmokeTests."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from validation import PlatformValidator, run_smoke_tests, validate_platform
from validation.smoke_tests import (
    APITest,
    AuthTest,
    DatabaseTest,
    HealthCheckTest,
    SmokeTest,
    generate_test_suite,
)

# ── PlatformValidator ────────────────────────────────────────────────────────


class TestPlatformValidator:
    def test_validate_structure_with_package_json_and_src(self, tmp_path):
        (tmp_path / "package.json").write_text("{}")
        (tmp_path / "src").mkdir()
        v = PlatformValidator(base_path=tmp_path)
        result = v.validate_structure(tmp_path)
        assert result["status"] == "pass"
        assert "package.json" in result["found_files"]
        assert "src/" in result["found_files"]

    def test_validate_structure_with_requirements_and_app(self, tmp_path):
        (tmp_path / "requirements.txt").write_text("flask")
        (tmp_path / "app").mkdir()
        v = PlatformValidator(base_path=tmp_path)
        result = v.validate_structure(tmp_path)
        assert result["status"] == "pass"
        assert "requirements.txt" in result["found_files"]
        assert "app/" in result["found_files"]

    def test_validate_structure_missing_both(self, tmp_path):
        v = PlatformValidator(base_path=tmp_path)
        result = v.validate_structure(tmp_path)
        assert result["status"] == "fail"
        assert len(result["missing_files"]) == 2

    def test_validate_dependencies_clean(self, tmp_path):
        pkg = {"dependencies": {"react": "^18"}, "devDependencies": {"jest": "^29"}}
        (tmp_path / "package.json").write_text(json.dumps(pkg))
        v = PlatformValidator(base_path=tmp_path)
        result = v.validate_dependencies(tmp_path)
        assert result["status"] == "pass"
        assert result["vulnerable_packages"] == []

    def test_validate_dependencies_vulnerable(self, tmp_path):
        pkg = {"dependencies": {"lodash": "^4", "request": "^2"}}
        (tmp_path / "package.json").write_text(json.dumps(pkg))
        v = PlatformValidator(base_path=tmp_path)
        result = v.validate_dependencies(tmp_path)
        assert result["status"] == "warning"
        assert "lodash" in result["vulnerable_packages"]
        assert "request" in result["vulnerable_packages"]

    def test_validate_dependencies_invalid_json(self, tmp_path):
        (tmp_path / "package.json").write_text("{invalid}")
        v = PlatformValidator(base_path=tmp_path)
        result = v.validate_dependencies(tmp_path)
        assert result["status"] == "error"
        assert "error" in result

    def test_validate_dependencies_no_package_json(self, tmp_path):
        v = PlatformValidator(base_path=tmp_path)
        result = v.validate_dependencies(tmp_path)
        assert result["status"] == "pass"

    def test_validate_config_with_env_example(self, tmp_path):
        (tmp_path / ".env.example").write_text("KEY=val")
        v = PlatformValidator(base_path=tmp_path)
        result = v.validate_config(tmp_path)
        assert ".env.example" in result["config_files"]
        assert result["missing_configs"] == []

    def test_validate_config_missing_env_example(self, tmp_path):
        v = PlatformValidator(base_path=tmp_path)
        result = v.validate_config(tmp_path)
        assert ".env.example" in result["missing_configs"]

    def test_validate_tests_with_test_files(self, tmp_path):
        (tmp_path / "test_app.py").write_text("pass")
        pkg = {"devDependencies": {"jest": "^29"}}
        (tmp_path / "package.json").write_text(json.dumps(pkg))
        v = PlatformValidator(base_path=tmp_path)
        result = v.validate_tests(tmp_path)
        assert result["status"] == "pass"
        assert result["test_files"] >= 1
        assert "jest" in result["test_frameworks"]

    def test_validate_tests_no_test_files(self, tmp_path):
        v = PlatformValidator(base_path=tmp_path)
        result = v.validate_tests(tmp_path)
        assert result["status"] == "warning"
        assert result["test_files"] == 0

    def test_validate_platform_full(self, tmp_path):
        plat = tmp_path / "myplat"
        plat.mkdir()
        (plat / "package.json").write_text('{"dependencies":{}}')
        (plat / "src").mkdir()
        v = PlatformValidator(base_path=tmp_path)
        result = v.validate_platform(plat)
        assert result["platform"] == "myplat"
        assert "validated_at" in result
        assert "structure" in result
        assert "dependencies" in result
        assert "config" in result
        assert "tests" in result


# ── validate_platform convenience ─────────────────────────────────────────


class TestValidatePlatformConvenience:
    def test_found(self, tmp_path):
        plat = tmp_path / "myplat"
        plat.mkdir()
        (plat / "package.json").write_text("{}")
        (plat / "src").mkdir()
        result = validate_platform("myplat", base_path=tmp_path)
        assert result["platform"] == "myplat"

    def test_not_found(self, tmp_path):
        result = validate_platform("missing", base_path=tmp_path)
        assert "error" in result


# ── SmokeTest hierarchy ──────────────────────────────────────────────────


class TestSmokeTest:
    def test_base_class_pass(self):
        t = SmokeTest("basic")
        result = t.run()
        assert result["passed"] is True
        assert result["name"] == "basic"
        assert result["error"] is None

    def test_base_class_result(self):
        t = SmokeTest("x")
        r = t.get_result()
        assert r["passed"] is False  # not run yet

    def test_database_test_pass(self):
        t = DatabaseTest("postgres://localhost/db")
        result = t.run()
        assert result["passed"] is True

    def test_database_test_no_connection(self):
        t = DatabaseTest("")
        result = t.run()
        assert result["passed"] is False
        assert "No database" in result["error"]

    def test_auth_test_pass(self):
        t = AuthTest("https://auth.nzila.ventures")
        result = t.run()
        assert result["passed"] is True

    def test_auth_test_no_url(self):
        t = AuthTest("")
        result = t.run()
        assert result["passed"] is False
        assert "No auth" in result["error"]

    def test_health_check_mocked(self):
        t = HealthCheckTest("https://example.com/health")
        with patch("urllib.request.urlopen") as mock_open:
            mock_open.return_value.__enter__ = lambda s: type(
                "R", (), {"status": 200}
            )()
            mock_open.return_value.__exit__ = lambda s, *a: None
            result = t.run()
        assert result["passed"] is True

    def test_health_check_non_200(self):
        t = HealthCheckTest("https://example.com/health")
        with patch("urllib.request.urlopen") as mock_open:
            mock_open.return_value.__enter__ = lambda s: type(
                "R", (), {"status": 503}
            )()
            mock_open.return_value.__exit__ = lambda s, *a: None
            result = t.run()
        assert result["passed"] is False

    def test_api_test_mocked(self):
        t = APITest("https://example.com/api", expected_status=200)
        with patch("urllib.request.urlopen") as mock_open:
            mock_open.return_value.__enter__ = lambda s: type(
                "R", (), {"status": 200}
            )()
            mock_open.return_value.__exit__ = lambda s, *a: None
            result = t.run()
        assert result["passed"] is True


# ── run_smoke_tests / generate_test_suite ────────────────────────────────


class TestRunSmokeTests:
    def test_staging(self):
        with patch("validation.smoke_tests.HealthCheckTest.execute"):
            result = run_smoke_tests("myplat", "staging")
        assert result["platform"] == "myplat"
        assert result["environment"] == "staging"
        assert result["passed"] >= 1

    def test_production(self):
        with patch("validation.smoke_tests.HealthCheckTest.execute"):
            with patch("validation.smoke_tests.APITest.execute"):
                result = run_smoke_tests("myplat", "production")
        assert result["passed"] >= 2

    def test_generate_test_suite(self):
        output = generate_test_suite("MyPlatform")
        assert "MyPlatform" in output
        assert "health endpoint" in output

    def test_staging_failure_path(self):
        """Cover the failed += 1 path in run_smoke_tests."""
        with patch(
            "validation.smoke_tests.HealthCheckTest.execute",
            side_effect=Exception("timeout"),
        ):
            result = run_smoke_tests("myplat", "staging")
        assert result["failed"] >= 1
        assert result["status"] == "failed"

    def test_api_test_execute_success(self):
        """Cover APITest.execute body."""
        test = APITest("https://example.com/api")
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            test.execute()  # should not raise

    def test_api_test_execute_wrong_status(self):
        """Cover the status mismatch branch in APITest.execute."""
        test = APITest("https://example.com/api", expected_status=200)
        mock_resp = MagicMock()
        mock_resp.status = 500
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            with pytest.raises(Exception, match="API test failed"):
                test.execute()


class TestValidatorFrameworkDetection:
    """Cover validator.py lines 135, 137-139 (testing-library, pytest, except)."""

    def test_detect_testing_library(self, tmp_path):
        plat = tmp_path / "myplat"
        plat.mkdir()
        (plat / "package.json").write_text(
            json.dumps({"devDependencies": {"@testing-library": "^13.0.0"}})
        )
        v = PlatformValidator()
        result = v.validate_tests(plat)
        assert "testing-library" in result["test_frameworks"]

    def test_detect_pytest_in_package_json(self, tmp_path):
        plat = tmp_path / "myplat"
        plat.mkdir()
        (plat / "package.json").write_text(
            json.dumps({"dependencies": {"pytest": "^7.0"}})
        )
        v = PlatformValidator()
        result = v.validate_tests(plat)
        assert "pytest" in result["test_frameworks"]

    def test_invalid_package_json(self, tmp_path):
        plat = tmp_path / "myplat"
        plat.mkdir()
        (plat / "package.json").write_text("{broken json!!!")
        v = PlatformValidator()
        result = v.validate_tests(plat)
        # Should not crash — except clause catches JSON error
        assert isinstance(result["test_frameworks"], list)
