import os
from unittest.mock import patch

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from auth_core.views import health_check, liveness_check, readiness_check
from rest_framework.test import APIRequestFactory

factory = APIRequestFactory()


def response_for(view):
    return view(factory.get("/health/"))


def test_liveness_does_not_probe_dependencies():
    with patch("auth_core.views._dependency_checks") as checks:
        response = response_for(liveness_check)

    assert response.status_code == 200
    assert response.data == {"status": "alive", "checks": {"process": True}}
    checks.assert_not_called()


def test_database_failure_fails_readiness(monkeypatch):
    monkeypatch.setenv("READY_REQUIRE_QUEUE", "false")
    with patch(
        "auth_core.views._dependency_checks", return_value={"db": False}
    ) as checks:
        response = response_for(readiness_check)

    assert response.status_code == 503
    assert response.data["ready"] is False
    checks.assert_called_once_with(include_queue=False)


def test_queue_disabled_keeps_core_ready_and_reports_degradation(monkeypatch):
    monkeypatch.setenv("READY_REQUIRE_QUEUE", "false")
    checks = {
        "db": True,
        "redis": False,
        "celery_broker": False,
        "celery_worker": False,
    }
    with patch("auth_core.views._dependency_checks", return_value=checks):
        response = response_for(health_check)

    assert response.status_code == 200
    assert response.data["ready"] is True
    assert response.data["status"] == "degraded"
    assert response.data["capabilities"]["queue"] == "unavailable"
    assert response.data["checks"]["redis"] is False


def test_queue_required_fails_without_broker(monkeypatch):
    monkeypatch.setenv("READY_REQUIRE_QUEUE", "true")
    checks = {"db": True, "celery_broker": False, "celery_worker": False}
    with patch("auth_core.views._dependency_checks", return_value=checks):
        response = response_for(readiness_check)

    assert response.status_code == 503


def test_queue_required_fails_without_worker(monkeypatch):
    monkeypatch.setenv("READY_REQUIRE_QUEUE", "true")
    checks = {"db": True, "celery_broker": True, "celery_worker": False}
    with patch("auth_core.views._dependency_checks", return_value=checks):
        response = response_for(readiness_check)

    assert response.status_code == 503


def test_queue_required_succeeds_with_broker_and_worker(monkeypatch):
    monkeypatch.setenv("READY_REQUIRE_QUEUE", "true")
    checks = {"db": True, "celery_broker": True, "celery_worker": True}
    with patch("auth_core.views._dependency_checks", return_value=checks):
        response = response_for(readiness_check)

    assert response.status_code == 200
    assert response.data["ready"] is True
