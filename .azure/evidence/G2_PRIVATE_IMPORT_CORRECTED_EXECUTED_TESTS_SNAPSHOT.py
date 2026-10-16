import ast
import base64
import hashlib
import importlib.util
import json
import pathlib
import time
import unittest
from unittest.mock import Mock, patch

ROOT = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("verifier", ROOT / "verifier.py")
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)


def jwt(value):
    return "header." + base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=") + ".signature"


class VerifierTests(unittest.TestCase):
    def test_read_grant_exact(self):
        v.verify_pull_grant(jwt({"access": [{"type": "repository", "name": "g2-tooling", "actions": ["pull"]}], "exp": int(time.time()) + 60}))

    def test_write_or_missing_grant_rejected(self):
        for actions in ([], ["pull", "push"], ["push"]):
            with self.assertRaises(ValueError):
                v.verify_pull_grant(jwt({"access": [{"type": "repository", "name": "g2-tooling", "actions": actions}], "exp": int(time.time()) + 60}))

    def test_absence_requires_semantic_404(self):
        self.assertEqual(v.classify_collision(404, b'{"errors":[{"code":"MANIFEST_UNKNOWN"}]}'), "TARGET_TOOLING_TAG_ABSENT")
        for status in (401, 403, 500):
            self.assertEqual(v.classify_collision(status, b"{}"), "TARGET_COLLISION_CHECK_UNRESOLVED")
        self.assertEqual(v.classify_collision(404, b'{"errors":[{"code":"DENIED"}]}'), "TARGET_COLLISION_CHECK_UNRESOLVED")

    def test_no_write_requests(self):
        for method, path in (("PUT", "/v2/g2-tooling/manifests/x"), ("DELETE", "/v2/g2-tooling/manifests/x"),
                             ("POST", "/v2/g2-tooling/blobs/uploads/"), ("GET", "/v2/synthetic-health/manifests/x")):
            with self.assertRaises(ValueError):
                v.request(method, path)

    def test_auth_construction_targeted_pull(self):
        identity = jwt({"oid": v.PRINCIPAL, "tid": v.TENANT, "appid": v.CLIENT})
        scoped = jwt({"access": [{"type": "repository", "name": "g2-tooling", "actions": ["pull"]}], "exp": int(time.time()) + 60})
        with patch.object(v, "request", side_effect=[
            (200, json.dumps({"access_token": identity}).encode(), None),
            (200, b'{"refresh_token":"opaque"}', None),
            (200, json.dumps({"access_token": scoped}).encode(), None)]) as request:
            self.assertEqual(v.authenticate(), scoped)
            first = request.call_args_list[0]
            self.assertIn("resource=https%3A%2F%2Fcontainerregistry.azure.net%2F", first.args[1])
            self.assertIn("client_id=" + v.CLIENT, first.args[1])
            self.assertIn("scope=repository%3Ag2-tooling%3Apull", request.call_args_list[2].args[2])

    def test_sensitive_output_rejected(self):
        for value in ({"access_token": "x"}, {"nested": {"Authorization": "x"}}, {"message": "Bearer x"},
                      {"message": "eyJabcdef.abc.sig"}):
            with self.assertRaises(ValueError):
                v.encode_result(value)

    def test_source_contract_no_install_or_execution(self):
        text = (ROOT / "verifier.py").read_text()
        tree = ast.parse(text)
        self.assertFalse(any(isinstance(n, ast.Import) and any(a.name == "subprocess" for a in n.names) for n in ast.walk(tree)))
        for forbidden in ("apt update", "extractall", "os.system", "push/write", "shell=True"):
            self.assertNotIn(forbidden, text)

    def test_manifest_strong_equivalence(self):
        raw = json.dumps({"schemaVersion": 2, "mediaType": v.MANIFEST_TYPE, "artifactType": v.ARTIFACT_TYPE,
                          "layers": [{"mediaType": "application/gzip", "digest": "sha256:" + v.ARCHIVE_SHA, "size": 100}]}).encode()
        expected = "sha256:" + hashlib.sha256(raw).hexdigest()
        self.assertEqual(v.check_manifest(raw, expected, expected)["size"], 100)
        with self.assertRaises(ValueError):
            v.check_manifest(raw + b" ", expected, expected)

    def test_collision_before_staging(self):
        with patch.object(v, "authenticate", return_value="in-memory"), patch.object(v, "manifest", return_value=(404, b'{"errors":[{"code":"NAME_UNKNOWN"}]}', None)):
            result = v.collect("pre", "")
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["collision"], "TARGET_TOOLING_TAG_ABSENT")
        self.assertEqual(result["equivalence"], "NOT_RUN")

    def test_present_not_success(self):
        with patch.object(v, "authenticate", return_value="in-memory"), patch.object(v, "manifest", return_value=(200, b"{}", None)):
            self.assertEqual(v.collect("pre", "")["status"], "FAIL")

    def test_cse_contract(self):
        source = (ROOT / "verifier-extension.bicep").read_text()
        for required in ("typeHandlerVersion: '2.1'", "skipDos2Unix: true", "suppressFailures: false",
                         "autoUpgradeMinorVersion: false", "enableAutomaticUpgrade: false"):
            self.assertIn(required, source)
        self.assertNotIn("protectedSettings", source)
        self.assertNotIn("fileUris", source)

    def test_reader_contract(self):
        source = (ROOT / "reader.bicep").read_text()
        self.assertIn("StringEqualsIgnoreCase", source)
        self.assertIn("g2-tooling", source)
        self.assertNotIn("content/write", source)
        self.assertNotIn("catalog/read", source)

    def test_each_private_host_uses_its_own_ip(self):
        for host, expected in ((v.REGISTRY, "10.90.2.5"), (v.DATA_HOST, "10.90.2.4")):
            context = Mock()
            context.wrap_socket.return_value.getpeername.return_value = (expected, 443)
            with patch.object(v.socket, "getaddrinfo", return_value=[(None, None, None, None, (expected, 443))]), patch.object(v.socket, "create_connection") as connection:
                private = v.PrivateConnection(host, context=context)
                private.connect()
                self.assertEqual(connection.call_args.args[0], (expected, 443))
                self.assertEqual(context.wrap_socket.call_args.kwargs["server_hostname"], host)

    def test_data_host_wrong_ip_rejected(self):
        with patch.object(v.socket, "getaddrinfo", return_value=[(None, None, None, None, ("10.90.2.5", 443))]):
            with self.assertRaisesRegex(ValueError, "private-dns-mismatch"):
                v.PrivateConnection(v.DATA_HOST).connect()


if __name__ == "__main__":
    unittest.main()
