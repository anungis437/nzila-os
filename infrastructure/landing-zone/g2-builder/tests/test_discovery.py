import json
import io
import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import discovery


SENSITIVE_KEYS = {
    "access_token",
    "refresh_token",
    "authorization",
    "password",
    "registry_credential",
    "cloud_init_secret",
    "imds_token_body",
}


def assert_no_sensitive_keys(test_case, value):
    if isinstance(value, dict):
        for key, nested in value.items():
            test_case.assertNotIn(key.lower(), SENSITIVE_KEYS)
            assert_no_sensitive_keys(test_case, nested)
    elif isinstance(value, list):
        for nested in value:
            assert_no_sensitive_keys(test_case, nested)


class DiscoveryTests(unittest.TestCase):
    def test_reads_exact_deb822_and_legacy_apt_source_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            deb822 = Path(directory) / "ubuntu.sources"
            legacy = Path(directory) / "azure.list"
            deb822.write_text(
                "Types: deb\n"
                "URIs: https://archive.ubuntu.example/ubuntu/\n"
                "Suites: noble noble-updates\n"
                "Components: main restricted\n"
                "Signed-By: /usr/share/keyrings/ubuntu.gpg\n",
                encoding="utf-8",
            )
            legacy.write_text(
                "deb [arch=amd64] https://packages.example.invalid/ubuntu noble main\n",
                encoding="utf-8",
            )

            result = discovery.read_apt_sources([deb822, legacy])

        self.assertTrue(result["complete"])
        self.assertEqual(len(result["entries"]), 2)
        self.assertEqual(
            result["entries"][0]["uris"][0]["uri"],
            "https://archive.ubuntu.example/ubuntu/",
        )
        self.assertEqual(result["entries"][0]["suites"], ["noble", "noble-updates"])
        self.assertEqual(result["entries"][0]["components"], ["main", "restricted"])
        self.assertEqual(result["entries"][1]["uris"][0]["host"], "packages.example.invalid")
        self.assertEqual(result["entries"][1]["components"], ["main"])

    def test_redacts_credentials_and_query_values_from_source_uris(self):
        parsed = discovery.apt_uri("https://user:secret@mirror.example/ubuntu?token=hidden")

        self.assertEqual(parsed["uri"], "https://mirror.example/ubuntu")
        self.assertTrue(parsed["credentialsRedacted"])
        self.assertTrue(parsed["queryRedacted"])
        self.assertNotIn("secret", json.dumps(parsed))
        self.assertNotIn("hidden", json.dumps(parsed))

    def test_apt_source_observation_is_offline_and_does_not_mutate_packages(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "ubuntu.list"
            source.write_text(
                "deb https://archive.ubuntu.example/ubuntu noble main\n",
                encoding="utf-8",
            )
            with (
                patch.object(discovery, "http_json", side_effect=AssertionError("network")),
                patch.object(discovery.socket, "getaddrinfo", side_effect=AssertionError("network")),
                patch.object(discovery.socket, "create_connection", side_effect=AssertionError("network")),
                patch.object(discovery.OPENER, "open", side_effect=AssertionError("network")),
                patch("os.system", side_effect=AssertionError("package mutation")),
                patch.object(subprocess, "run", side_effect=AssertionError("package mutation")),
                patch.object(subprocess, "Popen", side_effect=AssertionError("package mutation")),
                patch.object(Path, "write_text", side_effect=AssertionError("file mutation")),
            ):
                result = discovery.read_apt_sources([source])

        self.assertTrue(result["complete"])
        self.assertEqual(result["entries"][0]["uris"][0]["host"], "archive.ubuntu.example")

    def test_imds_requests_documented_acr_resource_and_never_returns_token(self):
        with patch.object(
            discovery,
            "http_json",
            return_value=(200, {"access_token": "aad-secret", "expires_on": "2030-01-01T00:00:00Z"}, None),
        ) as request:
            result, token = discovery.managed_identity_access_token()

        self.assertEqual(token, "aad-secret")
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["requestedResource"], "https://containerregistry.azure.net/")
        query = request.call_args.args[0].split("?", 1)[1]
        self.assertEqual(
            discovery.urllib.parse.parse_qs(query)["resource"],
            ["https://containerregistry.azure.net/"],
        )
        assert_no_sensitive_keys(self, result)
        self.assertNotIn("aad-secret", json.dumps(result))

    def test_acr_token_flow_uses_exchange_then_scoped_token_without_emitting_secrets(self):
        responses = [
            (200, {"refresh_token": "acr-refresh-secret"}, None),
            (200, {"access_token": "repository-secret"}, None),
        ]
        with patch.object(discovery, "REGISTRY", "example.azurecr.io"), patch.object(
            discovery, "BUILDER_CLIENT_ID", "client-id"
        ), patch.object(discovery, "http_json", side_effect=responses) as request:
            result = discovery.acr_token_flow("tenant-id", "aad-secret", private_https=True)

        self.assertEqual(request.call_count, 2)
        self.assertEqual(request.call_args_list[0].args[0], "https://example.azurecr.io/oauth2/exchange")
        exchange = discovery.urllib.parse.parse_qs(request.call_args_list[0].args[1].decode())
        self.assertEqual(exchange["grant_type"], ["access_token"])
        self.assertEqual(exchange["service"], ["example.azurecr.io"])
        self.assertEqual(exchange["tenant"], ["tenant-id"])
        self.assertEqual(exchange["access_token"], ["aad-secret"])
        repository = discovery.urllib.parse.parse_qs(request.call_args_list[1].args[1].decode())
        self.assertEqual(repository["grant_type"], ["refresh_token"])
        self.assertEqual(repository["scope"], ["repository:synthetic-health:pull,push"])
        self.assertEqual(repository["refresh_token"], ["acr-refresh-secret"])
        self.assertIn(
            "https://example.azurecr.io/oauth2/token",
            request.call_args_list[1].args[0],
        )
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["repositoryTokenHttpStatus"], 200)
        self.assertEqual(result["imagePush"], "NOT_ATTEMPTED")
        self.assertFalse(result["tokenValuesEmitted"])
        assert_no_sensitive_keys(self, result)
        serialized = json.dumps(result)
        self.assertNotIn("acr-refresh-secret", serialized)
        self.assertNotIn("repository-secret", serialized)

    def test_optional_acr_exchange_can_be_blocked_without_proving_success_or_failure(self):
        with patch.object(discovery, "http_json", return_value=(None, None, "TimeoutError")):
            result = discovery.acr_token_flow("tenant-id", "aad-secret", private_https=True)

        self.assertEqual(result["status"], "BLOCKED")
        self.assertTrue(result["attempted"])
        self.assertEqual(
            discovery.discovery_status({"apt": True, "identity": True, "registry": True}, True),
            "DISCOVERY_COMPLETE",
        )

    def test_required_component_failure_or_missing_serial_write_prevents_proof(self):
        self.assertEqual(
            discovery.discovery_status({"apt": True, "identity": False, "registry": True}, True),
            "DISCOVERY_INCOMPLETE",
        )
        self.assertEqual(
            discovery.discovery_status({"apt": True, "identity": True}, False),
            "DISCOVERY_INCOMPLETE",
        )

    def test_python_unavailable_fallback_is_incomplete_and_marks_checks_not_run(self):
        cloud_init = (Path(discovery.__file__).parent / "cloud-init.yaml").read_text(encoding="utf-8")
        self.assertIn('"status":"DISCOVERY_INCOMPLETE"', cloud_init)
        for component in (
            "aptSourceObservation",
            "imdsIdentity",
            "imdsAccessToken",
            "privateAcrDns",
            "privateAcrHttps",
            "acrTokenExchange",
        ):
            self.assertIn(f'"{component}":"NOT_RUN"', cloud_init)

    def test_success_marker_and_serial_payload_are_deterministic_with_optional_exchange_blocked(self):
        def capture():
            output = io.StringIO()
            serial = []
            with (
                patch.object(discovery, "image_metadata", return_value={"httpStatus": 200}),
                patch.object(discovery, "read_apt_sources", return_value={"complete": True, "entries": []}),
                patch.object(discovery, "managed_identity", return_value=({"httpStatus": 200, "targetClientIdPresent": True}, "tenant")),
                patch.object(discovery, "managed_identity_access_token", return_value=({"status": "PASS", "requestedResource": "https://containerregistry.azure.net/"}, "aad-secret")),
                patch.object(discovery, "registry_reachability", return_value={
                    "dnsPrivate": True, "tcp443": True, "httpsReachable": True, "httpsStatus": 401,
                }),
                patch.object(discovery, "acr_token_flow", return_value={
                    "status": "BLOCKED", "attempted": True, "tokenValuesEmitted": False,
                    "imagePush": "NOT_ATTEMPTED",
                }),
                patch.object(discovery.os, "O_NONBLOCK", 0, create=True),
                patch.object(discovery.os, "open", return_value=42),
                patch.object(discovery.os, "write", side_effect=lambda _fd, data: serial.append(data) or len(data)),
                patch.object(discovery.os, "close"),
                redirect_stdout(output),
            ):
                discovery.main()
            self.assertEqual(output.getvalue(), "")
            return b"".join(serial).decode()

        first = capture()
        second = capture()
        self.assertEqual(first, second)
        lines = first.splitlines()
        self.assertEqual(lines[0], discovery.START_MARKER)
        self.assertEqual(len(lines), 2)
        self.assertTrue(lines[1].startswith(discovery.RESULT_MARKER))
        result = json.loads(lines[1][len(discovery.RESULT_MARKER):])
        self.assertEqual(result["status"], "DISCOVERY_COMPLETE")
        self.assertEqual(result["componentStatuses"]["acrTokenExchange"], "BLOCKED")
        self.assertTrue(result["serialConsoleWriteAttempted"])
        self.assertEqual(result["imagePush"], "NOT_ATTEMPTED")
        assert_no_sensitive_keys(self, result)
        self.assertNotIn("aad-secret", first)


if __name__ == "__main__":
    unittest.main()
