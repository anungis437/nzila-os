"""Tests for integrations package – GitHub, Azure, Slack, Notion & DI wiring."""

import json
import os
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from integrations.azure import AzureDevOpsIntegration, generate_azure_pipeline
from integrations.github import GitHubIntegration, create_github_workflow
from integrations.notion import NotionIntegration, create_platform_template
from integrations.slack import SlackIntegration, SlackWebhook

# ── AzureDevOpsIntegration ───────────────────────────────────────────────


class TestAzureDevOps:
    def test_init_defaults(self):
        az = AzureDevOpsIntegration()
        assert az.organization == "nzila-ventures"
        assert az.project == "nzila-platform"

    def test_local_mode_pipelines(self):
        az = AzureDevOpsIntegration(token=None)
        result = az._local_mode_response("/pipelines")
        assert result == {"value": []}

    def test_local_mode_workitems(self):
        az = AzureDevOpsIntegration(token=None)
        result = az._local_mode_response("/wit/workitems")
        assert result == {"value": []}

    def test_local_mode_releases(self):
        az = AzureDevOpsIntegration(token=None)
        result = az._local_mode_response("/release/releases")
        assert result == {"value": []}

    def test_local_mode_default(self):
        az = AzureDevOpsIntegration(token=None)
        result = az._local_mode_response("/anything/else")
        assert result == {"value": []}

    def test_list_pipelines_no_token(self):
        az = AzureDevOpsIntegration(token=None)
        assert az.list_pipelines() == []

    def test_get_pipeline_no_token(self):
        az = AzureDevOpsIntegration(token=None)
        result = az.get_pipeline(1)
        assert "value" in result

    def test_run_pipeline_no_token(self):
        az = AzureDevOpsIntegration(token=None)
        result = az.run_pipeline(1, "main", {"var": "val"})
        assert "value" in result

    def test_get_pipeline_runs_no_token(self):
        az = AzureDevOpsIntegration(token=None)
        assert az.get_pipeline_runs(1) == []

    def test_get_pipeline_runs_with_status(self):
        az = AzureDevOpsIntegration(token=None)
        assert az.get_pipeline_runs(1, status="completed") == []

    def test_get_pipeline_run_logs(self):
        az = AzureDevOpsIntegration(token=None)
        result = az.get_pipeline_run_logs(1, 1)
        assert isinstance(result, str)

    def test_create_work_item_no_token(self):
        az = AzureDevOpsIntegration(token=None)
        result = az.create_work_item("Test", assigned_to="me", tags=["tag1"])
        assert "value" in result

    def test_list_work_items_default(self):
        az = AzureDevOpsIntegration(token=None)
        result = az.list_work_items()
        assert isinstance(result, list)

    def test_list_work_items_custom_query(self):
        az = AzureDevOpsIntegration(token=None)
        result = az.list_work_items("SELECT * FROM WorkItems")
        assert isinstance(result, list)

    def test_update_work_item(self):
        az = AzureDevOpsIntegration(token=None)
        result = az.update_work_item(1, {"System.Title": "Updated"})
        assert "value" in result

    def test_link_work_items(self):
        az = AzureDevOpsIntegration(token=None)
        result = az.link_work_items(1, 2)
        assert "value" in result

    def test_list_releases(self):
        az = AzureDevOpsIntegration(token=None)
        assert az.list_releases() == []

    def test_list_releases_with_definition(self):
        az = AzureDevOpsIntegration(token=None)
        assert az.list_releases(definition_id=1) == []

    def test_create_release(self):
        az = AzureDevOpsIntegration(token=None)
        result = az.create_release(1, "1.0.0", {"env": "staging"})
        assert "value" in result

    def test_get_release_status(self):
        az = AzureDevOpsIntegration(token=None)
        result = az.get_release_status(1)
        assert "value" in result

    def test_list_repos(self):
        az = AzureDevOpsIntegration(token=None)
        assert az.list_repos() == []

    def test_get_repo_commits(self):
        az = AzureDevOpsIntegration(token=None)
        assert az.get_repo_commits("repo1") == []

    def test_get_project_info(self):
        az = AzureDevOpsIntegration(token=None)
        result = az.get_project_info()
        assert "value" in result

    def test_list_teams(self):
        az = AzureDevOpsIntegration(token=None)
        assert az.list_teams() == []

    def test_make_request_http_error(self):
        import urllib.error

        az = AzureDevOpsIntegration(token="fake-token")
        with patch(
            "urllib.request.urlopen",
            side_effect=urllib.error.HTTPError("url", 401, "Unauth", {}, None),
        ):
            result = az._make_request("/test")
        assert "error" in result

    def test_make_request_success(self):
        az = AzureDevOpsIntegration(token="fake-token")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"value": [{"id": 1}]}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = az._make_request("/test", "POST", {"key": "val"})
        assert result == {"value": [{"id": 1}]}

    def test_generate_azure_pipeline_node(self):
        yaml = generate_azure_pipeline("myplat", "node")
        assert "myplat" in yaml
        assert "trigger" in yaml

    def test_generate_azure_pipeline_python(self):
        yaml = generate_azure_pipeline("myplat", "python")
        assert "myplat" in yaml or "trigger" in yaml


# ── GitHubIntegration ────────────────────────────────────────────────────


class TestGitHub:
    def test_init_defaults(self):
        gh = GitHubIntegration()
        assert gh.owner == "anungis437"

    def test_list_repos_no_token(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        (tmp_path / "repo1" / ".git").mkdir(parents=True)
        gh = GitHubIntegration(token=None)
        repos = gh.list_repos()
        assert any(r["name"] == "repo1" for r in repos)

    def test_list_repos_with_token_success(self):
        gh = GitHubIntegration(token="ghp_fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'[{"name": "repo1"}]'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            repos = gh.list_repos()
        assert repos == [{"name": "repo1"}]

    def test_list_repos_with_token_error(self):
        import urllib.error

        gh = GitHubIntegration(token="ghp_fake")
        with patch(
            "urllib.request.urlopen",
            side_effect=urllib.error.HTTPError(
                "url", 401, "Unauth", {}, MagicMock(read=lambda: b"{}")
            ),
        ):
            repos = gh.list_repos()
        assert repos == []

    def test_create_pull_request(self):
        gh = GitHubIntegration(token="ghp_fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"number": 42}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = gh.create_pull_request("repo", "title", "body", "feature")
        assert result["number"] == 42

    def test_get_pull_requests_no_token(self):
        gh = GitHubIntegration(token="ghp_fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'[{"id": 1}]'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            prs = gh.get_pull_requests("repo")
        assert len(prs) == 1

    def test_create_issue(self):
        gh = GitHubIntegration(token="ghp_fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"number": 10}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = gh.create_issue("repo", "Bug", "desc", labels=["bug"])
        assert result["number"] == 10

    def test_list_issues(self):
        gh = GitHubIntegration(token="ghp_fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'[{"number": 1}]'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            issues = gh.list_issues("repo")
        assert len(issues) == 1

    def test_create_release(self):
        gh = GitHubIntegration(token="ghp_fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"tag_name": "v1.0"}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = gh.create_release("repo", "v1.0", "Release 1", "Notes")
        assert result["tag_name"] == "v1.0"

    def test_get_latest_release_found(self):
        gh = GitHubIntegration(token="ghp_fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"tag_name": "v2.0"}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = gh.get_latest_release("repo")
        assert result["tag_name"] == "v2.0"

    def test_get_latest_release_not_found(self):
        import urllib.error

        gh = GitHubIntegration(token="ghp_fake")
        with patch(
            "urllib.request.urlopen",
            side_effect=urllib.error.HTTPError(
                "url", 404, "Not Found", {}, MagicMock(read=lambda: b"{}")
            ),
        ):
            result = gh.get_latest_release("repo")
        assert result is None

    def test_setup_branch_protection(self):
        gh = GitHubIntegration(token="ghp_fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"url": "protected"}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = gh.setup_branch_protection("repo")
        assert "url" in result

    def test_sync_with_local_exists(self, tmp_path):
        gh = GitHubIntegration(token=None)
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args=[], returncode=0, stdout="M  file.py\n?? new.py\n"
            )
            result = gh.sync_with_local(tmp_path)
        assert result["status"] in ("ready", "clean")

    def test_sync_with_local_not_found(self):
        gh = GitHubIntegration(token=None)
        result = gh.sync_with_local(Path("/nonexistent"))
        assert "error" in result

    def test_sync_with_local_exception(self, tmp_path):
        gh = GitHubIntegration(token=None)
        with patch("subprocess.run", side_effect=OSError("git not found")):
            result = gh.sync_with_local(tmp_path)
        assert "error" in result

    def test_get_commit_history(self):
        from datetime import datetime

        gh = GitHubIntegration(token="ghp_fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'[{"sha": "abc123"}]'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            commits = gh.get_commit_history(
                "repo", path="src", since=datetime(2026, 1, 1)
            )
        assert commits[0]["sha"] == "abc123"

    def test_create_github_workflow_nextjs(self):
        yaml = create_github_workflow("myplat", "nextjs")
        assert "CI/CD" in yaml

    def test_create_github_workflow_python(self):
        yaml = create_github_workflow("myplat", "python")
        assert "CI/CD" in yaml


# ── SlackIntegration ─────────────────────────────────────────────────────


class TestSlack:
    def test_init_defaults(self):
        slack = SlackIntegration()
        assert slack.default_channel == "#nzila-alerts"

    def test_make_request_no_token(self):
        slack = SlackIntegration(token=None)
        result = slack._make_request("chat.postMessage", {"text": "hi"})
        assert result["ok"] is False
        assert "not configured" in result["error"]

    def test_make_request_success(self):
        slack = SlackIntegration(token="xoxb-fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"ok": true}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = slack._make_request("chat.postMessage", {"text": "hi"})
        assert result["ok"] is True

    def test_make_request_http_error(self):
        import urllib.error

        slack = SlackIntegration(token="xoxb-fake")
        with patch(
            "urllib.request.urlopen",
            side_effect=urllib.error.HTTPError("url", 500, "Error", {}, None),
        ):
            result = slack._make_request("chat.postMessage")
        assert result["ok"] is False

    def test_send_message(self):
        slack = SlackIntegration(token="xoxb-fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"ok": true}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = slack.send_message(
                "#general", "Hello", blocks=[{"type": "section"}]
            )
        assert result["ok"] is True

    def test_send_alert(self):
        slack = SlackIntegration(token="xoxb-fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"ok": true}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = slack.send_alert("Down", "Service outage", "critical")
        assert result["ok"] is True

    def test_send_deployment_notification(self):
        slack = SlackIntegration(token="xoxb-fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"ok": true}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = slack.send_deployment_notification("web", "success", version="1.0")
        assert result["ok"] is True

    def test_send_migration_update(self):
        slack = SlackIntegration(token="xoxb-fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"ok": true}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = slack.send_migration_update(
                "web", "schema", 50, notes="Going well"
            )
        assert result["ok"] is True

    def test_share_report(self):
        slack = SlackIntegration(token="xoxb-fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"ok": true}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = slack.share_report("Q1 Report", "Content here", "financial")
        assert result["ok"] is True

    def test_schedule_daily_summary(self):
        slack = SlackIntegration(token="xoxb-fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"ok": true}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = slack.schedule_daily_summary(["web", "console"])
        assert result["ok"] is True

    def test_create_deployment_buttons(self):
        slack = SlackIntegration(token="xoxb-fake")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"ok": true}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = slack.create_deployment_buttons("web", "1.0")
        assert result["ok"] is True


# ── SlackWebhook (if available) ──────────────────────────────────────────


class TestSlackWebhook:
    def test_send_success(self):
        wh = SlackWebhook("https://hooks.slack.com/services/FAKE")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b"ok"
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = wh.send("Hello!")
        assert result is True

    def test_send_failure(self):
        import urllib.error

        wh = SlackWebhook("https://hooks.slack.com/services/FAKE")
        with patch(
            "urllib.request.urlopen",
            side_effect=urllib.error.HTTPError("url", 400, "Bad", {}, None),
        ):
            result = wh.send("Hello!")
        assert result is False

    def test_send_no_webhook_url(self, capsys):
        """Cover slack.py lines 337-338: send returns False when URL is None."""
        wh = SlackWebhook(webhook_url=None)
        # Ensure env var isn't set either
        with patch.dict("os.environ", {}, clear=True):
            wh.webhook_url = None
        result = wh.send("Hello!")
        assert result is False
        assert "not configured" in capsys.readouterr().out


# ── integrations.__init__ DI wiring ──────────────────────────────────────


class TestIntegrationsDI:
    def test_register_integrations(self):
        from di import Container
        from integrations import register_integrations

        c = Container()
        result = register_integrations(c)
        assert result is c
        # Should be able to resolve all 4
        assert result.resolve(SlackIntegration) is not None
        assert result.resolve(GitHubIntegration) is not None
        assert result.resolve(AzureDevOpsIntegration) is not None

    def test_get_integration_container(self):
        import integrations

        # Reset the module-level singleton
        integrations._integration_container = None
        c = integrations.get_integration_container()
        assert c is not None
        # Second call returns same container
        assert integrations.get_integration_container() is c
        # Cleanup
        integrations._integration_container = None


# ── Azure work-item detail fetch (lines 157-158) ────────────────────────


class TestAzureWorkItemDetails:
    def test_list_work_items_with_ids_returned(self):
        """Cover azure.py lines 157-158 (detail fetch when WIQL returns IDs)."""
        az = AzureDevOpsIntegration(token="fake")
        with patch.object(az, "_make_request") as mock_req:
            mock_req.side_effect = [
                {"workItems": [{"id": 1}, {"id": 2}]},  # WIQL response
                {"value": [{"id": 1, "fields": {}}, {"id": 2, "fields": {}}]},  # detail
            ]
            result = az.list_work_items("SELECT * FROM WorkItems")
        assert len(result) == 2
        assert mock_req.call_count == 2


# ── Slack convenience functions (lines 337+) ─────────────────────────────


class TestSlackConvenience:
    def test_send_critical_alert(self):
        from integrations.slack import send_critical_alert

        with patch.object(
            SlackIntegration, "send_alert", return_value={"status": "sent"}
        ) as mock_send:
            result = send_critical_alert("System Down", "Service unreachable")
        mock_send.assert_called_once_with(
            "System Down", "Service unreachable", "critical"
        )

    def test_send_deployment_success(self):
        from integrations.slack import send_deployment_success

        with patch.object(
            SlackIntegration,
            "send_deployment_notification",
            return_value={"status": "sent"},
        ) as mock_send:
            result = send_deployment_success("web", "v1.2.3")
        mock_send.assert_called_once_with("web", "success", version="v1.2.3")

    def test_send_deployment_failure(self):
        from integrations.slack import send_deployment_failure

        with patch.object(
            SlackIntegration, "send_alert", return_value={"status": "sent"}
        ) as mock_send:
            result = send_deployment_failure("web", "OOM killed")
        mock_send.assert_called_once()


# ── NotionIntegration ────────────────────────────────────────────────────


class TestNotionIntegration:
    def test_init_defaults(self):
        n = NotionIntegration()
        assert n.api_base == "https://api.notion.com/v1"
        assert n.api_version == "2022-06-28"

    def test_init_with_token(self):
        n = NotionIntegration(token="secret_abc")
        assert n.token == "secret_abc"

    def test_make_request_no_token(self):
        n = NotionIntegration(token=None)
        n.token = None
        result = n._make_request("/test")
        assert result["local_mode"] is True

    def test_make_request_success(self):
        n = NotionIntegration(token="secret_abc")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"ok": true}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = n._make_request("/test")
        assert result == {"ok": True}

    def test_make_request_with_data(self):
        n = NotionIntegration(token="secret_abc")
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"id": "page1"}'
        mock_resp.__enter__ = lambda s: mock_resp
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = n._make_request("/pages", "POST", {"title": "Test"})
        assert result["id"] == "page1"

    def test_make_request_http_error(self):
        import urllib.error

        n = NotionIntegration(token="secret_abc")
        err = urllib.error.HTTPError("url", 404, "Not Found", {}, MagicMock())
        err.read = MagicMock(return_value=b"not found")
        with patch("urllib.request.urlopen", side_effect=err):
            result = n._make_request("/pages/bad")
        assert "HTTP 404" in result["error"]

    def test_list_databases(self):
        n = NotionIntegration(token="secret_abc")
        with patch.object(
            n, "_make_request", return_value={"results": [{"id": "db1"}]}
        ):
            dbs = n.list_databases()
        assert len(dbs) == 1

    def test_create_database(self):
        n = NotionIntegration(token="secret_abc")
        with patch.object(n, "_make_request", return_value={"id": "db2"}) as mock:
            result = n.create_database("page1", "My DB", {"Name": {"title": {}}})
        assert result["id"] == "db2"
        mock.assert_called_once()

    def test_query_database_with_filter(self):
        n = NotionIntegration(token="secret_abc")
        with patch.object(
            n, "_make_request", return_value={"results": [{"id": "r1"}]}
        ) as mock:
            results = n.query_database("db1", filter={"property": "Status"})
        assert len(results) == 1
        call_data = mock.call_args[0][2]
        assert "filter" in call_data

    def test_query_database_with_sorts(self):
        n = NotionIntegration(token="secret_abc")
        with patch.object(n, "_make_request", return_value={"results": []}) as mock:
            results = n.query_database("db1", sorts=[{"property": "Created"}])
        call_data = mock.call_args[0][2]
        assert "sorts" in call_data

    def test_query_database_no_filter(self):
        n = NotionIntegration(token="secret_abc")
        with patch.object(n, "_make_request", return_value={"results": []}) as mock:
            results = n.query_database("db1")
        call_data = mock.call_args[0][2]
        assert "page_size" in call_data

    def test_create_page_with_database_parent(self):
        n = NotionIntegration(token="secret_abc")
        with patch.object(n, "_make_request", return_value={"id": "p1"}) as mock:
            result = n.create_page("db1", "Page Title", is_database=True)
        call_data = mock.call_args[0][2]
        assert "database_id" in call_data["parent"]

    def test_create_page_with_page_parent(self):
        n = NotionIntegration(token="secret_abc")
        with patch.object(n, "_make_request", return_value={"id": "p2"}) as mock:
            result = n.create_page("parent1", "Child")
        call_data = mock.call_args[0][2]
        assert "page_id" in call_data["parent"]

    def test_create_page_with_content(self):
        n = NotionIntegration(token="secret_abc")
        blocks = [{"object": "block", "type": "paragraph"}]
        with patch.object(n, "_make_request", return_value={"id": "p3"}) as mock:
            result = n.create_page("parent1", "Title", content=blocks)
        call_data = mock.call_args[0][2]
        assert "children" in call_data

    def test_create_page_with_properties(self):
        n = NotionIntegration(token="secret_abc")
        props = {"Status": {"select": {"name": "Active"}}}
        with patch.object(n, "_make_request", return_value={"id": "p4"}) as mock:
            result = n.create_page("parent1", "Title", properties=props)
        call_data = mock.call_args[0][2]
        assert call_data["properties"] == props

    def test_get_page(self):
        n = NotionIntegration(token="secret_abc")
        with patch.object(n, "_make_request", return_value={"id": "p1"}) as mock:
            result = n.get_page("p1")
        mock.assert_called_once_with("/pages/p1")

    def test_update_page(self):
        n = NotionIntegration(token="secret_abc")
        with patch.object(n, "_make_request", return_value={"id": "p1"}) as mock:
            result = n.update_page(
                "p1", properties={"Status": {"select": {"name": "Done"}}}
            )
        call_data = mock.call_args[0][2]
        assert "properties" in call_data

    def test_update_page_archive(self):
        n = NotionIntegration(token="secret_abc")
        with patch.object(n, "_make_request", return_value={"id": "p1"}) as mock:
            result = n.update_page("p1", archived=True)
        call_data = mock.call_args[0][2]
        assert call_data["archived"] is True

    def test_append_children(self):
        n = NotionIntegration(token="secret_abc")
        children = [{"object": "block", "type": "paragraph"}]
        with patch.object(n, "_make_request", return_value={}) as mock:
            n.append_children("p1", children)
        mock.assert_called_once_with(
            "/blocks/p1/children", "PATCH", {"children": children}
        )

    def test_get_block_children(self):
        n = NotionIntegration(token="secret_abc")
        with patch.object(n, "_make_request", return_value={"results": [{"id": "b1"}]}):
            blocks = n.get_block_children("p1")
        assert len(blocks) == 1

    def test_update_block(self):
        n = NotionIntegration(token="secret_abc")
        with patch.object(n, "_make_request", return_value={}) as mock:
            n.update_block("b1", {"paragraph": {"rich_text": []}})
        mock.assert_called_once()

    def test_delete_block(self):
        n = NotionIntegration(token="secret_abc")
        with patch.object(n, "_make_request", return_value={}) as mock:
            n.delete_block("b1")
        mock.assert_called_once_with("/blocks/b1", "DELETE")

    def test_sync_from_local(self, tmp_path):
        n = NotionIntegration(token="secret_abc")
        (tmp_path / "doc.md").write_text("# Hello\n\nWorld", encoding="utf-8")
        with patch.object(n, "create_page", return_value={"id": "synced1"}):
            result = n.sync_from_local(tmp_path, "parent_page")
        assert result["synced"] == 1
        assert result["skipped"] == 0

    def test_sync_from_local_missing_path(self):
        n = NotionIntegration(token="secret_abc")
        result = n.sync_from_local(Path("/no/such/path"), "parent")
        assert "error" in result

    def test_sync_from_local_error(self, tmp_path):
        n = NotionIntegration(token="secret_abc")
        (tmp_path / "doc.md").write_text("# Hello", encoding="utf-8")
        with patch.object(n, "create_page", side_effect=RuntimeError("API fail")):
            result = n.sync_from_local(tmp_path, "parent_page")
        assert result["skipped"] == 1

    def test_markdown_to_blocks(self):
        n = NotionIntegration()
        md = "# Heading 1\n## Heading 2\n### Heading 3\n- Bullet\n```code\nplain text"
        blocks = n._markdown_to_blocks(md)
        types = [b["type"] for b in blocks]
        assert "heading_1" in types
        assert "heading_2" in types
        assert "heading_3" in types
        assert "bulleted_list_item" in types
        assert "paragraph" in types

    def test_export_to_markdown(self):
        n = NotionIntegration(token="secret_abc")
        page_data = {
            "properties": {
                "Name": {
                    "type": "title",
                    "title": [{"plain_text": "Test Page"}],
                }
            }
        }
        blocks_data = [
            {"type": "heading_1", "heading_1": {"rich_text": [{"plain_text": "H1"}]}},
            {"type": "heading_2", "heading_2": {"rich_text": [{"plain_text": "H2"}]}},
            {"type": "heading_3", "heading_3": {"rich_text": [{"plain_text": "H3"}]}},
            {"type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "Para"}]}},
            {
                "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": [{"plain_text": "Bullet"}]},
            },
            {
                "type": "numbered_list_item",
                "numbered_list_item": {"rich_text": [{"plain_text": "Number"}]},
            },
            {
                "type": "code",
                "code": {"language": "python", "rich_text": [{"plain_text": "x = 1"}]},
            },
        ]
        with patch.object(n, "get_page", return_value=page_data), patch.object(
            n, "get_block_children", return_value=blocks_data
        ):
            md = n.export_to_markdown("page1")
        assert "# Test Page" in md
        assert "## H2" in md
        assert "### H3" in md
        assert "- Bullet" in md
        assert "1. Number" in md
        assert "```python" in md

    def test_get_title_missing(self):
        n = NotionIntegration()
        assert n._get_title({}) == "Untitled"
        assert (
            n._get_title({"properties": {"Name": {"type": "title", "title": []}}})
            == "Untitled"
        )

    def test_get_rich_text_not_list(self):
        n = NotionIntegration()
        assert n._get_rich_text({"rich_text": "just a string"}) == "just a string"

    def test_create_platform_template(self):
        with patch.object(
            NotionIntegration, "_make_request", return_value={"id": "tpl1"}
        ):
            result = create_platform_template(
                "db1",
                {
                    "name": "TestPlat",
                    "status": "Active",
                    "vertical": "Health",
                    "complexity": "High",
                    "production_readiness": 85,
                    "tam": 5000000,
                    "description": "A test platform",
                    "framework": "Next.js",
                },
            )
        assert result["id"] == "tpl1"
