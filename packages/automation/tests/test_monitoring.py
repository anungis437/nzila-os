"""Tests for monitoring package – HealthChecker & AlertManager."""

import ipaddress
import json
import socket
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from monitoring import (
    AlertManager,
    HealthChecker,
    check_all_platforms,
    send_critical_alert,
)
from monitoring.alerting import (
    ThresholdMonitor,
    send_deployment_alert,
    send_migration_alert,
    send_security_alert,
)
from monitoring.health_check import _validate_host, _validate_url

# ── SSRF validation helpers ──────────────────────────────────────────────


class TestValidateUrl:
    def test_valid_https(self):
        with patch(
            "socket.getaddrinfo",
            return_value=[(socket.AF_INET, 0, 0, "", ("93.184.216.34", 0))],
        ):
            _validate_url("https://example.com")  # should not raise

    def test_blocked_scheme(self):
        with pytest.raises(ValueError, match="Blocked URL scheme"):
            _validate_url("ftp://example.com")

    def test_no_hostname(self):
        with pytest.raises(ValueError, match="no hostname"):
            _validate_url("https://")

    def test_private_ip_blocked(self):
        with patch(
            "socket.getaddrinfo",
            return_value=[(socket.AF_INET, 0, 0, "", ("10.0.0.1", 0))],
        ):
            with pytest.raises(ValueError, match="Blocked private"):
                _validate_url("https://internal.corp")

    def test_localhost_blocked(self):
        with patch(
            "socket.getaddrinfo",
            return_value=[(socket.AF_INET, 0, 0, "", ("127.0.0.1", 0))],
        ):
            with pytest.raises(ValueError, match="Blocked private"):
                _validate_url("https://localhost")

    def test_dns_failure_passes(self):
        with patch("socket.getaddrinfo", side_effect=socket.gaierror):
            _validate_url("https://nonexistent.example.com")  # should not raise


class TestValidateHost:
    def test_public_ip(self):
        with patch(
            "socket.getaddrinfo",
            return_value=[(socket.AF_INET, 0, 0, "", ("8.8.8.8", 0))],
        ):
            _validate_host("dns.google")  # should not raise

    def test_private_ip(self):
        with patch(
            "socket.getaddrinfo",
            return_value=[(socket.AF_INET, 0, 0, "", ("192.168.1.1", 0))],
        ):
            with pytest.raises(ValueError, match="Blocked private"):
                _validate_host("router.local")

    def test_dns_failure(self):
        with patch("socket.getaddrinfo", side_effect=socket.gaierror):
            _validate_host("nohost.local")  # should not raise


# ── HealthChecker ────────────────────────────────────────────────────────


class TestHealthChecker:
    def test_load_platforms_no_file(self, tmp_path):
        hc = HealthChecker(data_dir=tmp_path)
        assert hc.platforms == []

    def test_load_platforms_with_file(self, tmp_path):
        data = {"platforms": [{"name": "web", "status": "production"}]}
        (tmp_path / "platform_profiles.json").write_text(json.dumps(data))
        hc = HealthChecker(data_dir=tmp_path)
        assert len(hc.platforms) == 1

    def test_check_endpoint_success(self, tmp_path):
        hc = HealthChecker(data_dir=tmp_path)
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)

        with patch(
            "socket.getaddrinfo",
            return_value=[(socket.AF_INET, 0, 0, "", ("93.184.216.34", 0))],
        ):
            with patch("urllib.request.urlopen", return_value=mock_resp):
                result = hc.check_endpoint("https://example.com/health")
        assert result["status"] == "healthy"
        assert result["status_code"] == 200

    def test_check_endpoint_http_error(self, tmp_path):
        import urllib.error

        hc = HealthChecker(data_dir=tmp_path)
        with patch(
            "socket.getaddrinfo",
            return_value=[(socket.AF_INET, 0, 0, "", ("93.184.216.34", 0))],
        ):
            with patch(
                "urllib.request.urlopen",
                side_effect=urllib.error.HTTPError(
                    "https://x", 503, "Service Unavailable", {}, None
                ),
            ):
                result = hc.check_endpoint("https://example.com")
        assert result["status"] == "unhealthy"
        assert result["status_code"] == 503

    def test_check_endpoint_url_error(self, tmp_path):
        import urllib.error

        hc = HealthChecker(data_dir=tmp_path)
        with patch(
            "socket.getaddrinfo",
            return_value=[(socket.AF_INET, 0, 0, "", ("93.184.216.34", 0))],
        ):
            with patch(
                "urllib.request.urlopen", side_effect=urllib.error.URLError("timeout")
            ):
                result = hc.check_endpoint("https://example.com")
        assert result["status"] == "unreachable"

    def test_check_endpoint_generic_error(self, tmp_path):
        hc = HealthChecker(data_dir=tmp_path)
        with patch(
            "socket.getaddrinfo",
            return_value=[(socket.AF_INET, 0, 0, "", ("93.184.216.34", 0))],
        ):
            with patch("urllib.request.urlopen", side_effect=OSError("conn refused")):
                result = hc.check_endpoint("https://example.com")
        assert result["status"] == "error"

    def test_check_port_open(self, tmp_path):
        hc = HealthChecker(data_dir=tmp_path)
        with patch(
            "socket.getaddrinfo",
            return_value=[(socket.AF_INET, 0, 0, "", ("93.184.216.34", 0))],
        ):
            with patch("socket.socket") as mock_sock:
                inst = mock_sock.return_value
                inst.connect_ex.return_value = 0
                result = hc.check_port("example.com", 443)
        assert result["status"] == "healthy"

    def test_check_port_closed(self, tmp_path):
        hc = HealthChecker(data_dir=tmp_path)
        with patch(
            "socket.getaddrinfo",
            return_value=[(socket.AF_INET, 0, 0, "", ("93.184.216.34", 0))],
        ):
            with patch("socket.socket") as mock_sock:
                inst = mock_sock.return_value
                inst.connect_ex.return_value = 1
                result = hc.check_port("example.com", 9999)
        assert result["status"] == "unhealthy"

    def test_check_port_exception(self, tmp_path):
        hc = HealthChecker(data_dir=tmp_path)
        with patch(
            "socket.getaddrinfo",
            return_value=[(socket.AF_INET, 0, 0, "", ("93.184.216.34", 0))],
        ):
            with patch("socket.socket") as mock_sock:
                inst = mock_sock.return_value
                inst.connect_ex.side_effect = OSError("fail")
                result = hc.check_port("example.com", 80)
        assert result["status"] == "error"

    def test_check_database(self, tmp_path):
        hc = HealthChecker(data_dir=tmp_path)
        result = hc.check_database("postgres://localhost/db")
        assert result["status"] == "unknown"

    def test_check_platform_production(self, tmp_path):
        hc = HealthChecker(data_dir=tmp_path)
        result = hc.check_platform({"name": "web", "status": "production"})
        assert result["status"] == "healthy"
        assert result["production_ready"] is True

    def test_check_platform_beta(self, tmp_path):
        hc = HealthChecker(data_dir=tmp_path)
        result = hc.check_platform({"name": "beta-app", "status": "beta"})
        assert result["status"] == "healthy"
        assert result["production_ready"] is False

    def test_check_platform_development(self, tmp_path):
        hc = HealthChecker(data_dir=tmp_path)
        result = hc.check_platform({"name": "dev-app", "status": "development"})
        assert result["status"] == "not_deployed"

    def test_check_all_empty(self, tmp_path):
        hc = HealthChecker(data_dir=tmp_path)
        result = hc.check_all()
        assert result["total_platforms"] == 0
        assert result["summary"]["overall_health"] == "healthy"

    def test_check_all_mixed(self, tmp_path):
        data = {
            "platforms": [
                {"name": "a", "status": "production"},
                {"name": "b", "status": "development"},
            ]
        }
        (tmp_path / "platform_profiles.json").write_text(json.dumps(data))
        hc = HealthChecker(data_dir=tmp_path)
        result = hc.check_all()
        assert result["total_platforms"] == 2
        # "not_deployed" counts as unhealthy in the summary
        assert result["summary"]["unhealthy"] >= 1

    def test_check_all_with_degraded(self, tmp_path):
        """Cover the degraded branch in check_all (line 205)."""
        hc = HealthChecker(data_dir=tmp_path)
        hc.platforms = [{"name": "x", "status": "production"}]
        with patch.object(
            hc,
            "check_platform",
            return_value={"name": "x", "status": "degraded", "production_ready": True},
        ):
            result = hc.check_all()
        assert result["summary"]["degraded"] == 1

    def test_generate_status_page(self, tmp_path):
        data = {"platforms": [{"name": "web", "status": "production"}]}
        (tmp_path / "platform_profiles.json").write_text(json.dumps(data))
        hc = HealthChecker(data_dir=tmp_path)
        page = hc.generate_status_page()
        assert "# Nzila Platform Status" in page
        assert "web" in page

    def test_check_all_platforms_convenience(self):
        with patch("monitoring.health_check.HealthChecker") as MockHC:
            MockHC.return_value.check_all.return_value = {
                "total_platforms": 0,
                "summary": {"overall_health": "healthy"},
            }
            result = check_all_platforms()
        assert "summary" in result


# ── AlertManager ─────────────────────────────────────────────────────────


class TestAlertManager:
    def test_create_alert_no_slack(self):
        mgr = AlertManager()
        alert = mgr.create_alert("Down", "Service down", "critical", "web")
        assert alert["title"] == "Down"
        assert alert["severity"] == "critical"
        assert alert["platform"] == "web"
        assert alert["status"] == "open"

    def test_create_alert_with_slack(self):
        mgr = AlertManager(slack_token="xoxb-fake")
        with patch.object(mgr, "_send_slack_alert", return_value=True) as mock_send:
            alert = mgr.create_alert("Deploy", "OK", "info")
        mock_send.assert_called_once()

    def test_send_slack_alert_success(self):
        mgr = AlertManager(slack_token="xoxb-fake")
        alert = {"severity": "critical", "title": "X", "message": "Y"}
        mock_module = MagicMock()
        with patch.dict(
            "sys.modules",
            {
                "automation": MagicMock(),
                "automation.integrations": MagicMock(),
                "automation.integrations.slack": mock_module,
            },
        ):
            result = mgr._send_slack_alert(alert)
        assert result is True
        mock_module.SlackIntegration.return_value.send_alert.assert_called_once()

    def test_send_slack_alert_failure(self):
        mgr = AlertManager(slack_token="xoxb-fake")
        alert = {"severity": "error", "title": "X", "message": "Y"}
        mock_module = MagicMock()
        mock_module.SlackIntegration.side_effect = Exception("connection failed")
        with patch.dict(
            "sys.modules",
            {
                "automation": MagicMock(),
                "automation.integrations": MagicMock(),
                "automation.integrations.slack": mock_module,
            },
        ):
            result = mgr._send_slack_alert(alert)
        assert result is False

    def test_acknowledge_alert(self):
        mgr = AlertManager()
        alert = mgr.create_alert("Test", "msg")
        assert mgr.acknowledge_alert(alert["id"], "alice") is True
        assert mgr.alert_history[0]["acknowledged"] is True

    def test_acknowledge_missing(self):
        mgr = AlertManager()
        assert mgr.acknowledge_alert("nope", "alice") is False

    def test_resolve_alert(self):
        mgr = AlertManager()
        alert = mgr.create_alert("Test", "msg")
        assert mgr.resolve_alert(alert["id"], "fixed") is True
        assert mgr.alert_history[0]["status"] == "resolved"

    def test_resolve_missing(self):
        mgr = AlertManager()
        assert mgr.resolve_alert("nope", "fixed") is False

    def test_get_active_alerts(self):
        mgr = AlertManager()
        mgr.create_alert("A", "a")
        a2 = mgr.create_alert("B", "b")
        mgr.resolve_alert(a2["id"], "done")
        assert len(mgr.get_active_alerts()) == 1

    def test_get_alerts_by_severity(self):
        mgr = AlertManager()
        mgr.create_alert("A", "a", "critical")
        mgr.create_alert("B", "b", "info")
        assert len(mgr.get_alerts_by_severity("critical")) == 1

    def test_get_alert_summary(self):
        mgr = AlertManager()
        mgr.create_alert("A", "a", "critical")
        mgr.create_alert("B", "b", "warning")
        summary = mgr.get_alert_summary()
        assert summary["total_alerts"] == 2
        assert summary["active_alerts"] == 2
        assert summary["by_severity"]["critical"] == 1

    def test_get_alert_summary_empty(self):
        mgr = AlertManager()
        summary = mgr.get_alert_summary()
        assert summary["total_alerts"] == 0
        assert summary["last_alert"] is None

    def test_save_alert_history(self, tmp_path):
        mgr = AlertManager()
        mgr.create_alert("X", "x")
        path = mgr.save_alert_history(tmp_path / "alerts.json")
        assert path.exists()
        loaded = json.loads(path.read_text())
        assert len(loaded) == 1

    def test_save_alert_history_default_path(self):
        mgr = AlertManager()
        mgr.create_alert("X", "x")
        path = mgr.save_alert_history()
        assert path.exists()
        path.unlink()  # cleanup


# ── Convenience functions ──────────────────────────────────────────────


class TestAlertConvenience:
    def test_send_critical_alert(self):
        alert = send_critical_alert("Down", "Total outage")
        assert alert["severity"] == "critical"

    def test_send_deployment_alert_success(self):
        alert = send_deployment_alert("web", "success", "1.0")
        assert alert["severity"] == "info"
        assert "web" in alert["title"]
        assert alert["platform"] == "web"

    def test_send_deployment_alert_failed(self):
        alert = send_deployment_alert("api", "failed")
        assert alert["severity"] == "error"

    def test_send_migration_alert(self):
        alert = send_migration_alert("console", "schema", "column missing")
        assert alert["severity"] == "warning"
        assert alert["platform"] == "console"

    def test_send_security_alert(self):
        alert = send_security_alert("brute_force", "50 attempts")
        assert alert["severity"] == "critical"


# ── ThresholdMonitor ─────────────────────────────────────────────────────


class TestThresholdMonitor:
    def test_below_threshold(self):
        mon = ThresholdMonitor()
        assert mon.check_metric("cpu_usage", 50) is None

    def test_warning_threshold(self):
        mon = ThresholdMonitor()
        result = mon.check_metric("cpu_usage", 75)
        assert result["severity"] == "warning"

    def test_critical_threshold(self):
        mon = ThresholdMonitor()
        result = mon.check_metric("cpu_usage", 95)
        assert result["severity"] == "critical"

    def test_unknown_metric(self):
        mon = ThresholdMonitor()
        assert mon.check_metric("unknown_metric", 100) is None

    def test_check_all_metrics(self):
        mon = ThresholdMonitor()
        alerts = mon.check_all_metrics(
            {
                "cpu_usage": 95,
                "memory_usage": 80,
                "disk_usage": 50,
            }
        )
        assert len(alerts) == 2  # cpu critical, memory warning
        severities = {a["severity"] for a in alerts}
        assert "critical" in severities
        assert "warning" in severities
