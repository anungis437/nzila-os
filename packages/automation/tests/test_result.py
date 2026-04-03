"""Tests for result.py – Result/Ok/Err pattern."""

import pytest
from result import (
    Err,
    NotionResult,
    Ok,
    ResultState,
    err,
    from_optional,
    ok,
    safe_execute,
)

# ── Ok tests ────────────────────────────────────────────────────────────────


class TestOk:
    def test_is_ok(self):
        assert Ok(42).is_ok() is True

    def test_is_err(self):
        assert Ok(42).is_err() is False

    def test_state(self):
        assert Ok(42).state == ResultState.OK

    def test_unwrap(self):
        assert Ok("hello").unwrap() == "hello"

    def test_unwrap_or_returns_value(self):
        assert Ok(10).unwrap_or(99) == 10

    def test_unwrap_err_returns_none(self):
        assert Ok(1).unwrap_err() is None

    def test_map(self):
        result = Ok(5).map(lambda x: x * 2)
        assert isinstance(result, Ok)
        assert result.unwrap() == 10

    def test_flat_map(self):
        result = Ok(3).flat_map(lambda x: Ok(x + 1))
        assert isinstance(result, Ok)
        assert result.unwrap() == 4

    def test_flat_map_to_err(self):
        result = Ok(3).flat_map(lambda _: Err("nope"))
        assert isinstance(result, Err)


# ── Err tests ───────────────────────────────────────────────────────────────


class TestErr:
    def test_is_ok(self):
        assert Err("x").is_ok() is False

    def test_is_err(self):
        assert Err("x").is_err() is True

    def test_state(self):
        assert Err("x").state == ResultState.ERROR

    def test_unwrap_raises(self):
        with pytest.raises(ValueError, match="Cannot unwrap Err"):
            Err("bad").unwrap()

    def test_unwrap_or_returns_default(self):
        assert Err("bad").unwrap_or(42) == 42

    def test_unwrap_err(self):
        assert Err("oops").unwrap_err() == "oops"

    def test_map_returns_self(self):
        e = Err("x")
        assert e.map(lambda x: x) is e

    def test_flat_map_returns_self(self):
        e = Err("x")
        assert e.flat_map(lambda x: Ok(x)) is e


# ── Helper functions ────────────────────────────────────────────────────────


class TestHelpers:
    def test_ok_helper(self):
        r = ok(99)
        assert isinstance(r, Ok)
        assert r.unwrap() == 99

    def test_err_helper(self):
        r = err("fail")
        assert isinstance(r, Err)
        assert r.unwrap_err() == "fail"

    def test_from_optional_with_value(self):
        r = from_optional("hello")
        assert r.is_ok()
        assert r.unwrap() == "hello"

    def test_from_optional_with_none(self):
        r = from_optional(None)
        assert r.is_err()
        assert "None" in r.unwrap_err()

    def test_from_optional_custom_msg(self):
        r = from_optional(None, "custom error")
        assert r.unwrap_err() == "custom error"

    def test_safe_execute_success(self):
        r = safe_execute(lambda: 42)
        assert r.is_ok()
        assert r.unwrap() == 42

    def test_safe_execute_failure(self):
        r = safe_execute(lambda: 1 / 0, "divide")
        assert r.is_err()
        assert "divide" in r.unwrap_err()
        assert "ZeroDivisionError" in r.unwrap_err()


# ── NotionResult ────────────────────────────────────────────────────────────


class TestNotionResult:
    def test_make_request_no_token(self):
        nr = NotionResult()
        nr.token = None
        nr.api_base = "https://api.notion.com/v1"
        nr.api_version = "2022-06-28"
        result = nr._make_request("/databases")
        assert result.is_err()
        assert "not configured" in result.unwrap_err()

    def test_make_request_success(self, monkeypatch):
        import io
        import urllib.request

        class FakeResponse:
            def read(self):
                return b'{"results": [{"id": "db1"}]}'

            def __enter__(self):
                return self

            def __exit__(self, *a):
                pass

        monkeypatch.setattr(urllib.request, "urlopen", lambda req, **kw: FakeResponse())

        nr = NotionResult()
        nr.token = "fake-token"
        nr.api_base = "https://api.notion.com/v1"
        nr.api_version = "2022-06-28"
        result = nr._make_request("/databases")
        assert result.is_ok()
        assert result.unwrap()["results"][0]["id"] == "db1"

    def test_make_request_http_error(self, monkeypatch):
        import urllib.error
        import urllib.request

        def raise_http_error(req, **kw):
            raise urllib.error.HTTPError(
                "https://api.notion.com", 401, "Unauthorized", {}, io.BytesIO(b"bad")
            )

        import io

        monkeypatch.setattr(urllib.request, "urlopen", raise_http_error)

        nr = NotionResult()
        nr.token = "fake"
        nr.api_base = "https://api.notion.com/v1"
        nr.api_version = "2022-06-28"
        result = nr._make_request("/databases")
        assert result.is_err()
        assert "401" in result.unwrap_err() or "HTTP" in result.unwrap_err()

    def test_make_request_url_error(self, monkeypatch):
        import urllib.error
        import urllib.request

        def raise_url_error(req, **kw):
            raise urllib.error.URLError("No host")

        monkeypatch.setattr(urllib.request, "urlopen", raise_url_error)

        nr = NotionResult()
        nr.token = "fake"
        nr.api_base = "https://api.notion.com/v1"
        nr.api_version = "2022-06-28"
        result = nr._make_request("/databases")
        assert result.is_err()

    def test_make_request_with_data(self, monkeypatch):
        import urllib.request

        class FakeResponse:
            def read(self):
                return b'{"ok": true}'

            def __enter__(self):
                return self

            def __exit__(self, *a):
                pass

        monkeypatch.setattr(urllib.request, "urlopen", lambda req, **kw: FakeResponse())

        nr = NotionResult()
        nr.token = "fake"
        nr.api_base = "https://api.notion.com/v1"
        nr.api_version = "2022-06-28"
        result = nr._make_request("/databases", method="POST", data={"title": "test"})
        assert result.is_ok()

    def test_list_databases_success(self, monkeypatch):
        import urllib.request

        class FakeResponse:
            def read(self):
                return b'{"results": [{"id": "db1"}, {"id": "db2"}]}'

            def __enter__(self):
                return self

            def __exit__(self, *a):
                pass

        monkeypatch.setattr(urllib.request, "urlopen", lambda req, **kw: FakeResponse())

        nr = NotionResult()
        nr.token = "fake"
        nr.api_base = "https://api.notion.com/v1"
        nr.api_version = "2022-06-28"
        result = nr.list_databases()
        assert result.is_ok()
        assert len(result.unwrap()) == 2

    def test_list_databases_error(self):
        nr = NotionResult()
        nr.token = None
        nr.api_base = "https://api.notion.com/v1"
        nr.api_version = "2022-06-28"
        result = nr.list_databases()
        assert result.is_err()


# ── ResultState enum ────────────────────────────────────────────────────────


class TestResultState:
    def test_ok_value(self):
        assert ResultState.OK.value == "ok"

    def test_error_value(self):
        assert ResultState.ERROR.value == "error"
