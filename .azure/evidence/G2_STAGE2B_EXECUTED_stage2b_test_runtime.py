import base64
import contextlib
import hashlib
import json
import pathlib
import types
import unittest
from unittest.mock import Mock, patch

HERE = pathlib.Path(__file__).resolve().parent
STAGE2A = HERE.parent / "stage2a"
ROOT = HERE.parents[3]
PAYLOAD = (ROOT / ".azure" / "evidence" / "G2_SYNTHETIC_PRODUCTION_PAYLOAD.json").read_bytes()
MANIFEST = (ROOT / ".azure" / "evidence" / "G2_CORRECTED_PRODUCTION_LOCAL_RUN1" / "manifest.json").read_bytes()


def load():
    module = types.ModuleType("runtime_contract")
    for path in (
            STAGE2A / "private-import" / "verifier.py", STAGE2A / "blob-readback" / "observer.py",
            STAGE2A / "empty-path" / "validator.py", STAGE2A / "empty-path" / "observer.py",
            STAGE2A / "local-oci-repair" / "validator.py"):
        exec(compile(path.read_bytes(), str(path), "exec"), module.__dict__)
    module.BOUND_PAYLOAD_BASE64 = base64.b64encode(PAYLOAD).decode()
    exec(compile((HERE / "runtime.py").read_bytes(), str(HERE / "runtime.py"), "exec"), module.__dict__)
    return module


def jwt(value):
    encoded = base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")
    return "e30." + encoded + ".signature"


class RuntimeContractTests(unittest.TestCase):
    def setUp(self):
        self.m = load()

    def test_runtime_only_identity(self):
        self.assertEqual(self.m.CLIENT, "ccea7b0f-a4ec-4665-ba9d-ab5071e165aa")
        self.assertEqual(self.m.PRINCIPAL, "b150b19a-645d-493f-9bb4-0aa81cb0c449")
        value = {"oid": self.m.PRINCIPAL, "tid": self.m.TENANT, "appid": self.m.CLIENT,
                 "aud": self.m.RESOURCE, "exp": 4000000000}
        result = {}
        with patch.object(self.m, "request", return_value=(200, json.dumps({"access_token": jwt(value)}).encode(), None)) as imds:
            with patch.object(self.m, "runtime_call", return_value=(200, b'{"refresh_token":"opaque"}', {})):
                self.assertEqual(self.m.runtime_refresh(result), "opaque")
        self.assertIn("client_id=" + self.m.CLIENT, imds.call_args.args[1])
        self.assertEqual(result["identityAssertion"], "PASS")

    def test_wrong_identity_and_expiry_rejected(self):
        value = {"oid": self.m.PRINCIPAL, "tid": self.m.TENANT, "appid": self.m.CLIENT,
                 "aud": self.m.RESOURCE, "exp": 4000000000}
        for field, wrong in (("oid", "builder"), ("tid", "wrong"), ("appid", "wrong"),
                             ("aud", "https://management.azure.com/"), ("exp", 0)):
            with self.subTest(field=field):
                body = json.dumps({"access_token": jwt({**value, field: wrong})}).encode()
                with patch.object(self.m, "request", return_value=(200, body, None)):
                    with patch.object(self.m, "runtime_call") as exchange:
                        with self.assertRaisesRegex(self.m.RuntimeProofFailure, "RUNTIME_IDENTITY_MISMATCH"):
                            self.m.runtime_refresh({})
                        exchange.assert_not_called()

    def test_exact_pull_and_empty_denied_scopes(self):
        for repo, actions, denied, access in (
                ("synthetic-health", ["pull"], False, [{"type": "repository", "name": "synthetic-health", "actions": ["pull"]}]),
                ("synthetic-health", ["push"], True, []),
                ("g2-tooling", ["pull"], True, [{"type": "repository", "name": "g2-tooling", "actions": []}])):
            body = json.dumps({"token": jwt({"exp": 4000000000, "access": access})}).encode()
            with patch.object(self.m, "runtime_call", return_value=(200, body, {})):
                self.m.runtime_scope("opaque", repo, actions, denied=denied)

    def test_unexpected_grant_stops_before_write(self):
        body = json.dumps({"token": jwt({"exp": 4000000000, "access": [
            {"type": "repository", "name": "synthetic-health", "actions": ["push"]}]})}).encode()
        with patch.object(self.m, "runtime_call", return_value=(200, body, {})) as call:
            with self.assertRaisesRegex(self.m.RuntimeProofFailure, "STAGE2B_SECURITY_FAILURE_UNEXPECTED_GRANT"):
                self.m.runtime_write_denial("opaque", "synthetic-health")
            self.assertEqual(call.call_count, 1)
            self.assertEqual(call.call_args.args[1], "/oauth2/token")

    def test_broad_and_expired_grants_rejected(self):
        for access, expiry in (([{"type": "repository", "name": "*", "actions": ["pull"]}], 4000000000),
                               ([], 0), ("invalid", 4000000000)):
            body = json.dumps({"token": jwt({"exp": expiry, "access": access})}).encode()
            with patch.object(self.m, "runtime_call", return_value=(200, body, {})):
                with self.assertRaises(self.m.RuntimeProofFailure):
                    self.m.runtime_scope("opaque", "g2-tooling", ["pull"], denied=True)

    def test_only_exact_allowed_scope_requests(self):
        for repo, actions in (("*", ["pull"]), ("g2-tooling", ["pull", "push"]),
                              ("synthetic-health", ["delete"]), ("other", ["push"])):
            with patch.object(self.m, "runtime_call") as call:
                with self.assertRaisesRegex(self.m.RuntimeProofFailure, "RUNTIME_SCOPE_NOT_AUTHORIZED"):
                    self.m.runtime_scope("opaque", repo, actions)
                call.assert_not_called()

    def test_http_authorization_denial_required(self):
        body = b'{"errors":[{"code":"UNAUTHORIZED","message":"not persisted"}]}'
        for status in (401, 403):
            self.assertEqual(self.m.assert_denial(status, body, "TEST"), "DENIED")
        for status in (404, 429, 500):
            with self.assertRaises(self.m.RuntimeProofFailure):
                self.m.assert_denial(status, body, "TEST")
        for body in (b"bad", b'{"errors":[]}', b'{"errors":[{"code":"NAME_UNKNOWN"}]}'):
            with self.assertRaises(self.m.RuntimeProofFailure):
                self.m.assert_denial(403, body, "TEST")

    def test_unexpected_write_acceptance_is_security_failure(self):
        with patch.object(self.m, "runtime_scope", return_value="opaque"):
            with patch.object(self.m, "runtime_call", return_value=(202, b"", {})) as call:
                with self.assertRaisesRegex(self.m.RuntimeProofFailure, "STAGE2B_SECURITY_FAILURE"):
                    self.m.runtime_write_denial("opaque", "g2-tooling")
                self.assertEqual(call.call_count, 1)
                self.assertEqual(call.call_args.args, ("POST", "/v2/g2-tooling/blobs/uploads/", "opaque", b""))

    def test_no_commit_or_arbitrary_request_allowed(self):
        for method, path, body in (
                ("PUT", "/v2/synthetic-health/manifests/tag", b""),
                ("PATCH", "/v2/synthetic-health/blobs/uploads/session", b""),
                ("DELETE", "/v2/synthetic-health/manifests/digest", None),
                ("GET", "/v2/g2-tooling/blobs/digest", None),
                ("POST", "/v2/other/blobs/uploads/", b""),
                ("POST", "/v2/g2-tooling/blobs/uploads/", b"content")):
            with patch.object(self.m, "ObservedConnection") as connection:
                with self.assertRaises(self.m.RuntimeProofFailure):
                    self.m.runtime_call(method, path, "opaque", body)
                connection.assert_not_called()

    def test_network_errors_are_not_denial(self):
        with patch.object(self.m, "runtime_scope", return_value="opaque"):
            with patch.object(self.m, "runtime_call", side_effect=OSError("unreachable")):
                with self.assertRaises(OSError):
                    self.m.runtime_write_denial("opaque", "g2-tooling")

    def test_exact_tag_digest_payload_roundtrip(self):
        headers = {"digest": self.m.MANIFEST_DIGEST, "contentType": self.m.MANIFEST_TYPE}
        result = {}
        with patch.object(self.m, "runtime_scope", return_value="opaque"):
            with patch.object(self.m, "runtime_call", side_effect=[
                    (200, MANIFEST, headers), (200, MANIFEST, headers), (200, PAYLOAD, {})]) as call:
                self.m.runtime_read("opaque", result)
        self.assertEqual(call.call_count, 3)
        self.assertEqual(result["artifactIntegrity"], "PASS")
        self.assertEqual(result["payloadSize"], 326)
        self.assertEqual(result["payloadSha256"], hashlib.sha256(PAYLOAD).hexdigest())

    def test_redirect_without_registry_credentials(self):
        response = Mock(status=200)
        response.read.return_value = PAYLOAD
        headers = {"digest": self.m.MANIFEST_DIGEST, "contentType": self.m.MANIFEST_TYPE}
        uri = "https://" + self.m.DATA_HOST + "?opaque=signed"
        with patch.object(self.m, "runtime_scope", return_value="opaque"):
            with patch.object(self.m, "runtime_call", side_effect=[
                    (200, MANIFEST, headers), (200, MANIFEST, headers), (307, b"", {"location": uri})]):
                with patch.object(self.m, "download_response", return_value=contextlib.nullcontext(response)) as download:
                    self.m.runtime_read("opaque", {})
                    self.assertEqual(download.call_args.args, (uri, {}))

    def test_manifest_or_payload_mutations_rejected(self):
        headers = {"digest": self.m.MANIFEST_DIGEST, "contentType": self.m.MANIFEST_TYPE}
        for manifest, payload in ((MANIFEST + b"\n", PAYLOAD), (MANIFEST, PAYLOAD + b"x"), (MANIFEST, b"wrong")):
            with patch.object(self.m, "runtime_scope", return_value="opaque"):
                with patch.object(self.m, "runtime_call", side_effect=[
                        (200, manifest, headers), (200, manifest, headers), (200, payload, {})]):
                    with self.assertRaises(ValueError):
                        self.m.runtime_read("opaque", {})

    def test_private_endpoint_checks(self):
        def connection(host, trace, prefix):
            trace.update({"REMOTE_IP": self.m.PRIVATE_ENDPOINTS[host], "TLS": "PASS"})
            return Mock()
        result = {}
        with patch.object(self.m, "ObservedConnection", side_effect=connection):
            self.m.private_connectivity(result)
        self.assertEqual(result["loginEndpoint"]["ip"], "10.90.2.5")
        self.assertEqual(result["dataEndpoint"]["ip"], "10.90.2.4")
        self.assertEqual(result["privateHttps"], "PASS")

    def test_failure_output_sanitized(self):
        output = []
        with patch.object(self.m, "configuration_digest", return_value="same"):
            with patch.object(self.m, "runtime_proof", side_effect=self.m.RuntimeProofFailure("PRECISE_BOUNDARY")):
                with patch("builtins.print", side_effect=lambda value, **kwargs: output.append(value)):
                    self.assertEqual(self.m.runtime_main(), 78)
        value = json.loads(output[0].split("=", 1)[1])
        self.assertEqual(value["failureStage"], "PRECISE_BOUNDARY")
        self.assertTrue(value["configurationUnchanged"])
        self.assertNotIn("opaque", output[0])

    def test_fail_closed_template(self):
        text = (HERE / "runtime.bicep").read_text()
        self.assertIn("PYTHON3_UNAVAILABLE", text)
        self.assertIn("disablePasswordAuthentication: true", text)
        self.assertIn("enableIPForwarding: false", text)
        self.assertIn("package_update: false", text)
        for forbidden in ("latest", "publicIPAddress", "roleAssignments", "apt update", "AcrPush", "forceUpdateTag"):
            self.assertNotIn(forbidden, text)
        self.assertEqual(text.count("resource "), 3)
        self.assertNotIn("builderIdentity", text)


if __name__ == "__main__":
    unittest.main()
