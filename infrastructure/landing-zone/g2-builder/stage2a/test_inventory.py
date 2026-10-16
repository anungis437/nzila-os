import ast
import importlib.util
import json
import pathlib
import unittest
from unittest import mock

PATH = pathlib.Path(__file__).with_name("inventory.py")
SPEC = importlib.util.spec_from_file_location("inventory", PATH)
inventory = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(inventory)


class InventoryTests(unittest.TestCase):
    def test_absent_builders_are_missing(self):
        self.assertEqual(inventory.classify_toolchain({}), "STAGE2_BUILD_TOOLCHAIN_MISSING")

    def test_binary_presence_does_not_fabricate_build_capability(self):
        self.assertEqual(inventory.classify_toolchain({"docker": {"status": "PRESENT"}}),
                         "STAGE2_BUILD_TOOLCHAIN_UNRESOLVED")

    def test_version_failure_is_unresolved(self):
        with mock.patch.object(inventory.shutil, "which", return_value="/usr/bin/buildah"), \
             mock.patch.object(inventory.subprocess, "run", side_effect=OSError):
            self.assertEqual(inventory.probe_tool("buildah")["status"], "UNRESOLVED")

    def test_subprocess_is_versions_only_and_no_shell(self):
        tree = ast.parse(PATH.read_text())
        calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call)
                 and isinstance(node.func, ast.Attribute) and node.func.attr == "run"]
        self.assertEqual(len(calls), 1)
        self.assertFalse(any(k.arg == "shell" for k in calls[0].keywords))
        with mock.patch.object(inventory.shutil, "which", return_value="/usr/bin/buildah"), \
             mock.patch.object(inventory.subprocess, "run") as run:
            run.return_value = mock.Mock(stdout="buildah version 1.35.0", stderr="", returncode=0)
            self.assertEqual(inventory.probe_tool("buildah")["version"], "1.35.0")
            self.assertEqual(run.call_args.args[0], ["/usr/bin/buildah", "--version"])

    def test_no_network_on_wrong_dns(self):
        with mock.patch.object(inventory, "configuration_digest", return_value="same"), \
             mock.patch.object(inventory, "probe_tool", return_value={"status": "MISSING"}), \
             mock.patch.object(inventory.socket, "getaddrinfo", return_value=[(0, 0, 0, "", ("1.2.3.4", 443))]), \
             mock.patch.object(inventory, "private_request") as request, \
             mock.patch.object(inventory.os, "geteuid", return_value=0, create=True), \
             mock.patch.object(inventory.shutil, "disk_usage", return_value=mock.Mock(free=1024)):
            result = inventory.collect()
        request.assert_not_called()
        self.assertEqual(result["status"], "FAIL")

    def test_result_budget_and_literal(self):
        result = inventory.encode_result({"status": "PASS", "payload": "a" * 5000})
        self.assertLess(len(result.encode()), 3900)
        self.assertEqual(json.loads(result.split("=", 1)[1])["status"], "FAIL")

    def test_token_response_never_emitted(self):
        claims = inventory.base64.urlsafe_b64encode(json.dumps({
            "oid": inventory.PRINCIPAL, "tid": inventory.TENANT, "appid": inventory.CLIENT
        }).encode()).decode().rstrip("=")
        secret = "secret." + claims + ".signature"
        with mock.patch.object(inventory, "request", return_value=(200, json.dumps({"access_token": secret}).encode())), \
             mock.patch.object(inventory, "private_request") as acr_request:
            result = inventory.authentication()
        acr_request.assert_not_called()
        output = inventory.encode_result(result)
        for value in (secret, "REFRESH_SECRET", "ACR_SECRET", "access_token", "refresh_token"):
            self.assertNotIn(value, output)
        self.assertEqual(result["status"], "PASS")

    def test_no_acr_push_authentication_or_write_request(self):
        source = PATH.read_text()
        self.assertNotIn('"/oauth2/', source)
        self.assertNotIn("pull,push", source)
        tree = ast.parse(source)
        self.assertFalse(any(isinstance(node, ast.Constant) and node.value in ("POST", "PUT", "PATCH", "DELETE")
                             for node in ast.walk(tree)))

    def test_targeted_imds_request_contract(self):
        with mock.patch.object(inventory, "request", return_value=(403, b"{}")) as request:
            result = inventory.authentication()
        args = request.call_args.args
        self.assertEqual(args[1], "GET")
        query = inventory.urllib.parse.parse_qs(args[2].split("?", 1)[1])
        self.assertEqual(query["client_id"], [inventory.CLIENT])
        self.assertEqual(query["resource"], [inventory.RESOURCE])
        self.assertEqual(request.call_args.kwargs["headers"], {"Metadata": "true"})
        self.assertEqual(result["status"], "FAIL")

    def test_no_package_or_file_mutation_api(self):
        tree = ast.parse(PATH.read_text())
        forbidden = {"write_text", "write_bytes", "unlink", "mkdir", "remove", "Popen"}
        self.assertFalse(any(isinstance(node, ast.Attribute) and node.attr in forbidden for node in ast.walk(tree)))
        self.assertFalse(any(isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name)
                            and node.value.id == "os" and node.attr == "system" for node in ast.walk(tree)))

    def test_sensitive_keys_rejected(self):
        for key in ("access_token", "refreshToken", "Authorization", "password", "registryCredential"):
            with self.assertRaisesRegex(ValueError, "sensitive-output-key"):
                inventory.encode_result({"nested": {key: "must-not-emit"}})

    def test_handler_contract_is_major_minor_not_package_patch(self):
        source = PATH.with_name("inventory-extension.bicep").read_text()
        version = inventory.re.search(r"typeHandlerVersion:\s*'([^']+)'", source).group(1)
        self.assertRegex(version, r"^\d+\.\d+$")
        self.assertEqual(version, "2.1")
        self.assertIn("autoUpgradeMinorVersion: false", source)
        self.assertIn("enableAutomaticUpgrade: false", source)


if __name__ == "__main__":
    unittest.main()
