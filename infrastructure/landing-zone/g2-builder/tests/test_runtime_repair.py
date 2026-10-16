import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import discovery
from test_discovery import assert_no_sensitive_keys


class RuntimeRepairTests(unittest.TestCase):
    def observe(self, text):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.sources"
            path.write_text(text, encoding="utf-8")
            return discovery.read_apt_sources([path])

    def test_ubuntu_comments_stanzas_and_inline_signed_by(self):
        path = Path(__file__).parent / "fixtures" / "ubuntu.sources"
        result = discovery.read_apt_sources([path])
        self.assertTrue(result["complete"])
        self.assertEqual(len(result["entries"]), 2)
        self.assertEqual(result["parseErrors"], [])
        self.assertEqual(result["entries"][0]["suites"], ["noble", "noble-updates", "noble-backports"])
        self.assertNotIn("key-material", json.dumps(result))

    def test_single_stanza_multiple_uris_continuations_and_disabled_sibling(self):
        result = self.observe(
            "Types: deb deb-src\nURIs: https://one.example:443/ubuntu\n https://two.example:8443/ubuntu\n"
            "Suites: noble noble-updates\nComponents: main\n universe\n\n"
            "Enabled: no\nTypes: deb\nURIs: https://disabled.example/\nSuites: noble\nComponents: main\n"
        )
        self.assertTrue(result["complete"])
        self.assertEqual(result["entries"][0]["components"], ["main", "universe"])
        self.assertIsNone(result["entries"][0]["uris"][0]["port"])
        self.assertEqual(result["entries"][0]["uris"][1]["port"], 8443)
        self.assertFalse(result["entries"][1]["enabled"])

    def test_malformed_active_stanza_keeps_sibling_but_unknown_denominator_fails_closed(self):
        result = self.observe(
            "Types: deb\nURIs: https://valid.example/\nSuites: noble\nComponents: main\n\n"
            "Types: deb\nURIs: https://unknown.example/\nbroken line\n"
        )
        self.assertFalse(result["complete"])
        self.assertEqual(len(result["entries"]), 1)
        self.assertTrue(result["parseErrors"])

    def test_disabled_malformed_record_does_not_hide_valid_active_endpoint(self):
        result = self.observe(
            "Types: deb\nURIs: https://valid.example/\nSuites: noble\n\n"
            "Enabled: no\nTypes: deb\nURIs: https://disabled.example/\nbroken disabled line\n"
        )
        self.assertTrue(result["complete"])
        self.assertTrue(result["parseErrors"])

    def test_invalid_port_uri_and_legacy_comments_fail_safely(self):
        self.assertEqual(discovery.apt_uri("https://example:bad/")["parseError"], "invalid-uri")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.list"
            path.write_text("deb https://valid.example/ noble main # ignored\n")
            result = discovery.read_apt_sources([path])
        self.assertTrue(result["complete"])
        self.assertEqual(result["entries"][0]["components"], ["main"])
        self.assertEqual(result["entries"][0]["format"], "legacy-list")

    def test_tenant_only_imds_info_is_not_attachment_assertion(self):
        with patch.object(discovery, "http_json", return_value=(200, {"tenantId": "tenant"}, None)):
            result, tenant = discovery.managed_identity()
        self.assertEqual(tenant, "tenant")
        self.assertNotIn("targetClientIdPresent", result)
        assert_no_sensitive_keys(self, result)

    def test_targeted_selector_and_three_independent_identity_proofs(self):
        with patch.object(discovery, "BUILDER_CLIENT_ID", "builder-client"), patch.object(
            discovery, "http_json", return_value=(200, {"access_token": "secret"}, None)
        ) as request:
            token, _ = discovery.managed_identity_access_token()
        query = discovery.urllib.parse.parse_qs(request.call_args.args[0].split("?", 1)[1])
        self.assertEqual(query["client_id"], ["builder-client"])
        uami = {"id": "/uami/builder", "clientId": "builder-client", "principalId": "principal"}
        vm = {"identity": {"type": "UserAssigned", "userAssignedIdentities": {"/UAMI/BUILDER": uami}}}
        proofs = discovery.identity_proofs(vm, uami, token, {"status": "PASS"})
        self.assertEqual(set(proofs.values()), {"PASS"})
        proofs = discovery.identity_proofs(vm, uami, token, {"status": "BLOCKED"})
        self.assertEqual(proofs["TOKEN_IDENTITY_CORRELATION_PROOF"], "BLOCKED")
        self.assertEqual(proofs["IMDS_TARGETED_TOKEN_REQUEST_PROOF"], "PASS")
        proofs = discovery.identity_proofs({}, uami, token, {"status": "PASS"})
        self.assertEqual(proofs["VM_UAMI_ATTACHMENT_PROOF"], "FAIL")
        token["requestedClientId"] = "runtime-client"
        self.assertEqual(discovery.identity_proofs(vm, uami, token, {"status": "PASS"})["IMDS_TARGETED_TOKEN_REQUEST_PROOF"], "FAIL")
        assert_no_sensitive_keys(self, token)

    def test_start_precedes_observation_single_bounded_atomic_result_no_stdout(self):
        writes = []
        def collect():
            self.assertEqual(writes, [(discovery.START_MARKER + "\n").encode()])
            return {"status": "DISCOVERY_COMPLETE", "requiredChecks": {"apt": True}}
        stdout = io.StringIO()
        with patch.object(discovery.os, "open", return_value=42), patch.object(
            discovery.os, "write", side_effect=lambda _fd, data: writes.append(data) or len(data)
        ), patch.object(discovery.os, "close"), patch.object(discovery, "collect_result", side_effect=collect), redirect_stdout(stdout):
            discovery.main()
        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(len(writes), 2)
        self.assertLessEqual(len(writes[1]), discovery.MAX_RESULT_BYTES)
        self.assertEqual(writes[1].count(b"\n"), 1)
        json.loads(writes[1].decode()[len(discovery.RESULT_MARKER):])

    def test_short_write_is_explicit_failure_and_does_not_retry_or_claim_success(self):
        with patch.object(discovery.os, "open", return_value=42), patch.object(
            discovery.os, "write", return_value=0
        ) as write, patch.object(discovery.os, "close"), patch.object(discovery, "collect_result") as collect:
            with self.assertRaisesRegex(OSError, "short-serial-write"):
                discovery.main()
        self.assertEqual(write.call_count, 1)
        collect.assert_not_called()

    def test_result_budget_and_status_model_fail_closed(self):
        line = discovery.result_line({"observations": "x" * 20000})
        self.assertLessEqual(len(line), discovery.MAX_RESULT_BYTES)
        result = json.loads(line.decode()[len(discovery.RESULT_MARKER):])
        self.assertEqual(result["status"], "DISCOVERY_INCOMPLETE")
        self.assertEqual(discovery.discovery_status({}, True), "DISCOVERY_INCOMPLETE")
        self.assertEqual(discovery.discovery_status({"apt": "BLOCKED"}, True), "DISCOVERY_INCOMPLETE")

    def test_sensitive_serial_keys_and_values_are_rejected(self):
        for key in discovery.SENSITIVE_KEYS:
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "sensitive-output-key"):
                discovery.result_line({"nested": [{key.upper(): "secret"}]})
        with self.assertRaisesRegex(ValueError, "sensitive-output-value"):
            discovery.result_line({"detail": "Bearer secret"})

    def test_external_attachment_not_inferred_and_cannot_override_runtime_failure(self):
        result = {
            "requiredChecks": {"apt": True},
            "serialConsoleWriteAttempted": True,
            "managedIdentityToken": {
                "status": "PASS", "httpStatus": 200, "requestedClientId": "client",
                "requestedResource": "https://containerregistry.azure.net/",
            },
            "acrTokenFlow": {"status": "BLOCKED"},
        }
        uami = {"id": "/builder", "clientId": "client", "principalId": "principal"}
        vm = {"identity": {"type": "UserAssigned", "userAssignedIdentities": {"/builder": uami}}}
        self.assertEqual(discovery.reconcile_identity_evidence(result, {}, uami)["status"], "DISCOVERY_INCOMPLETE")
        self.assertEqual(discovery.reconcile_identity_evidence(result, vm, uami)["status"], "DISCOVERY_INCOMPLETE")
        reconciled = discovery.reconcile_identity_evidence(result, vm, uami, serial_markers_verified=True)
        self.assertEqual(reconciled["status"], "DISCOVERY_COMPLETE")
        self.assertEqual(reconciled["identityProofs"]["TOKEN_IDENTITY_CORRELATION_PROOF"], "BLOCKED")
        result["requiredChecks"]["apt"] = False
        self.assertEqual(discovery.reconcile_identity_evidence(result, vm, uami, serial_markers_verified=True)["status"], "DISCOVERY_INCOMPLETE")

    def test_python_fallback_has_exact_markers_and_no_competing_tee(self):
        cloud_init = (Path(discovery.__file__).parent / "cloud-init.yaml").read_text()
        self.assertEqual(cloud_init.count(discovery.START_MARKER), 1)
        self.assertEqual(cloud_init.count(discovery.RESULT_MARKER), 1)
        self.assertNotIn("tee", cloud_init)
        self.assertIn("exec python3 /opt/nzila-g2/discovery.py", cloud_init)


if __name__ == "__main__":
    unittest.main()
