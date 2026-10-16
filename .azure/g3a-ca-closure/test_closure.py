import hashlib
import json
from pathlib import Path
import socket
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import frozen
import guest_pipeline as guest
import lifecycle

ROOT = Path(__file__).resolve().parent
PACKETS = ROOT.parent
MODULES = frozen.load(PACKETS / "g3a-transaction")


def binding():
    client = "00000000-0000-0000-0000-000000000001"
    shared = {"registry": "nzilag3inputs001.azurecr.io",
              "data_host": "nzilag3inputs001.canadacentral.data.azurecr.io",
              "client_id": client, "manifest_digest": "sha256:" + "a" * 64,
              "payload_bytes": 10}
    source = MODULES["registry"].InputBinding(
        **shared, repository="g3-build-source", payload_sha256="b" * 64,
        artifact_type="application/vnd.nzila.g3.build-source.v1",
        payload_media="application/vnd.nzila.g3.source.tar.v1")
    tooling = MODULES["registry"].InputBinding(
        **shared, repository="g3-build-tooling", payload_sha256="c" * 64,
        artifact_type="application/vnd.nzila.g3.portable-inputs.v1",
        payload_media="application/vnd.nzila.g3.portable-inputs.tar.v1")
    return guest.PipelineBinding(
        (source, tooling), {"c" * 64: {}}, "b" * 64, "c" * 64, client,
        "00000000-0000-0000-0000-000000000002", "nzilag2tzo75uuozprbo.azurecr.io",
        "g3-proof-" + "a" * 12, "10.91.3.0/24", "g3-forbidden-runtime")


class ClosureTests(unittest.TestCase):
    def setUp(self):
        self.network = patch.object(socket, "create_connection",
                                    side_effect=AssertionError("LOCAL_TEST_ATTEMPTED_NETWORK"))
        self.network.start()
        self.addCleanup(self.network.stop)

    def test_roots_and_proof_unchanged(self):
        for path, sha in [
            (PACKETS / "g3a-controller-repair" / "REPAIR_VERIFICATION.json", frozen.CORE_ROOT),
            (PACKETS / "g3a-transaction" / "TRANSACTION_VERIFICATION.json", frozen.TRANSACTION_ROOT),
            (PACKETS / "g3a-ca-live" / "g3a-bootstrap", frozen.PROOF_SHA),
            (PACKETS / "g3a-controller-repair" / "inputs" / "portable-assembler", frozen.CORE_SHA),
        ]:
            frozen.checked(path, sha)

    def test_phase_order_is_exact_frozen_contract(self):
        value = json.loads((PACKETS / "g3a-transaction" / "G3A_CONTROLLER_PHASE_CONTRACT.json").read_text())
        self.assertEqual(list(lifecycle.PHASES), value["phases"])
        self.assertEqual(len(lifecycle.PHASES), 18)

    def test_frozen_modules_all_hash_checked(self):
        self.assertEqual(set(MODULES), set(frozen.SOURCES))
        with self.assertRaisesRegex(RuntimeError, "HASH_MISMATCH"):
            frozen.checked(PACKETS / "g3a-transaction" / "registry.py", "0" * 64)

    def test_marker_proof_never_pipeline_delivery(self):
        with self.assertRaisesRegex(RuntimeError, "MARKER_ONLY"):
            guest.validate_delivery({"bootstrapSha256": frozen.PROOF_SHA, "qualified": True})

    def test_delivery_missing_or_nonhex_binding_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "SEPARATE_GUEST"):
            guest.validate_delivery({})
        with self.assertRaisesRegex(RuntimeError, "HASH_BINDINGS"):
            guest.validate_delivery({"qualified": True, "isolatedBuildQualified": True,
                                     "bootstrapSha256": "z" * 64})

    def test_live_entrypoints_unconditionally_disabled(self):
        for entry in (guest.live_entrypoint, lifecycle.live_entrypoint):
            with self.assertRaises(RuntimeError):
                entry(authorized=True, qualified=True, authority="future", execute=True)

    def test_live_controller_cannot_be_constructed(self):
        ledger = lifecycle.ExactOwnership(set(), set(), "a" * 64)
        with self.assertRaisesRegex(RuntimeError, "LIVE_ADAPTER"):
            lifecycle.Controller(SimpleNamespace(fixture_only=False), ledger)

    def test_identity_and_private_route_mismatch_rejected(self):
        from dataclasses import replace
        valid = binding()
        valid.validate(MODULES["registry"])
        for invalid in [
            replace(valid, push_client_id=valid.reader_client_id),
            replace(valid, private_subnet="10.1.0.0/24"),
            replace(valid, denied_repository="g3-synthetic-runtime"),
            replace(valid, input_bindings=valid.input_bindings[:1]),
            replace(valid, members={}),
        ]:
            with self.assertRaises(RuntimeError):
                invalid.validate(MODULES["registry"])

    def test_unisolated_core_never_executed(self):
        runner = Mock()
        runner.isolated_root = False
        pipeline = guest.GuestPipeline(MODULES, binding(), runner)
        with self.assertRaisesRegex(RuntimeError, "ISOLATED_BUILD"):
            pipeline.build(Path("absent"), Path("absent-work"), Path("absent-output"))
        runner.assert_not_called()

    def test_core_output_oci_path_is_used(self):
        runner = Mock()
        runner.isolated_root = True
        pipeline = guest.GuestPipeline(MODULES, binding(), runner)
        builder = Mock()
        with patch.object(Path, "mkdir"), patch.object(
                MODULES["controller"], "GuestPipeline", return_value=builder), patch.object(
                    MODULES["registry"], "validate_layout") as validate:
            pipeline.build(Path("inputs"), Path("work"), Path("output"))
        builder.build.assert_called_once_with(Path("inputs") / "portable-assembler", Path("inputs"),
                                              Path("work"), Path("output"), frozen.CORE_SHA)
        validate.assert_called_once_with(Path("output") / "oci")

    def test_real_single_use_uploader_is_selected_without_calls(self):
        pipeline = guest.GuestPipeline(MODULES, binding(), Mock())
        session = Mock()
        uploader = Mock()
        with patch.object(MODULES["registry"], "RegistrySession", return_value=session), patch.object(
                MODULES["registry"], "Uploader", return_value=uploader) as create, patch.object(
                    pipeline, "token", return_value="in-memory-test-token"):
            pipeline.push(Path("layout"))
        create.assert_called_once_with(session, binding().target_tag)
        uploader.push.assert_called_once_with(Path("layout"), "in-memory-test-token")
        session.erase.assert_called()

    def test_push_failure_erases_token_session(self):
        pipeline = guest.GuestPipeline(MODULES, binding(), Mock())
        session = Mock()
        uploader = Mock()
        uploader.push.side_effect = RuntimeError("collision")
        with patch.object(MODULES["registry"], "RegistrySession", return_value=session), patch.object(
                MODULES["registry"], "Uploader", return_value=uploader), patch.object(
                    pipeline, "token", return_value="in-memory-test-token"):
            with self.assertRaisesRegex(RuntimeError, "collision"):
                pipeline.push(Path("layout"))
        session.erase.assert_called()

    def test_network_failure_not_negative_authorization_success(self):
        pipeline = guest.GuestPipeline(MODULES, binding(), Mock())
        with patch.object(MODULES["registry"], "RegistrySession"), patch.object(
                MODULES["registry"], "probe", return_value={
                    "classification": "NETWORK_FAILURE_NOT_AUTHORIZATION"}), patch.object(
                        pipeline, "token", return_value="in-memory-test-token"):
            with self.assertRaisesRegex(RuntimeError, "NEGATIVE_ABAC"):
                pipeline.negatives()

    def test_negative_matrix_requires_four_authenticated_denials(self):
        pipeline = guest.GuestPipeline(MODULES, binding(), Mock())
        with patch.object(MODULES["registry"], "RegistrySession"), patch.object(
                MODULES["registry"], "probe", return_value={
                    "classification": "AUTHENTICATED_DENIAL"}) as probe, patch.object(
                        pipeline, "token", return_value="in-memory-test-token"):
            results = pipeline.negatives()
        self.assertEqual(len(results), 4)
        self.assertEqual(probe.call_count, 4)

    def test_pipeline_build_failure_never_pushes(self):
        pipeline = guest.GuestPipeline(MODULES, binding(), Mock())
        with patch.object(pipeline, "retrieve", return_value={"inputs": Path("inputs")}), patch.object(
                pipeline, "build", side_effect=RuntimeError("core failed")), patch.object(
                    pipeline, "push") as push:
            with self.assertRaisesRegex(RuntimeError, "core failed"):
                pipeline.run_candidate(Path("workspace"))
        push.assert_not_called()
        with self.assertRaisesRegex(RuntimeError, "SINGLE_USE"):
            pipeline.run_candidate(Path("workspace"))

    def test_baseline_cannot_be_owned(self):
        with self.assertRaisesRegex(RuntimeError, "BASELINE"):
            lifecycle.ExactOwnership({"/id/"}, {"/ID"}, "a" * 64)

    def test_ambiguous_creation_never_cleanup_owned(self):
        ledger = lifecycle.ExactOwnership({"/baseline"}, {"/planned"}, "a" * 64)
        for receipt in [
            lifecycle.Receipt("/baseline", "vm", "op", "a" * 64, "G3A_TRANSACTION_OWNED"),
            lifecycle.Receipt("/planned", "vm", "", "a" * 64, "G3A_TRANSACTION_OWNED"),
            lifecycle.Receipt("/planned", "delegation", "op", "a" * 64, "G3A_TRANSACTION_OWNED"),
            lifecycle.Receipt("/planned", "vm", "op", "b" * 64, "G3A_TRANSACTION_OWNED"),
        ]:
            with self.assertRaisesRegex(RuntimeError, "OWNERSHIP"):
                ledger.capture(receipt)
        delete = Mock()
        self.assertEqual(ledger.cleanup(delete), [])
        delete.assert_not_called()

    def test_cleanup_child_first_exact_receipts_and_no_retry(self):
        ledger = lifecycle.ExactOwnership({"/baseline"}, {"/owned/vm", "/owned/vm/extensions/cse"}, "a" * 64)
        for rid in ("/owned/vm", "/owned/vm/extensions/cse"):
            ledger.capture(lifecycle.Receipt(rid, "vm", "op", "a" * 64, "G3A_TRANSACTION_OWNED"))
        deleted = []
        def delete(receipt):
            deleted.append(receipt.resource_id)
            raise OSError("ambiguous deletion")
        results = ledger.cleanup(delete)
        self.assertEqual(deleted, ["/owned/vm/extensions/cse", "/owned/vm"])
        self.assertTrue(all(r["status"] == "RECONCILIATION_REQUIRED_NO_RETRY" for r in results))
        self.assertEqual(ledger.cleanup(delete), [])

    def test_all_phase_failures_stop_later_phases(self):
        for failing in lifecycle.PHASES:
            executed = []
            def phase(name, ledger):
                executed.append(name)
                if name == failing:
                    raise RuntimeError("fixture failure")
                return {"phase": name, "verified": True, "evidenceSha256": "a" * 64}
            adapter = SimpleNamespace(fixture_only=True, phase=phase, delete_once=Mock())
            controller = lifecycle.Controller(adapter, lifecycle.ExactOwnership(set(), set(), "a" * 64))
            result = controller.run_local(lifecycle.PARENT_COST_PATH, lifecycle.PARENT_COST_SHA256)
            self.assertEqual(result["failedPhase"], failing)
            self.assertEqual(executed, list(lifecycle.PHASES[:lifecycle.PHASES.index(failing) + 1]))
            self.assertFalse(result["laterPhasesExecuted"])

    def test_fixture_true_without_evidence_cannot_pass(self):
        adapter = SimpleNamespace(fixture_only=True, phase=lambda *_: True, delete_once=Mock())
        controller = lifecycle.Controller(adapter, lifecycle.ExactOwnership(set(), set(), "a" * 64))
        self.assertEqual(controller.run_local(
            lifecycle.PARENT_COST_PATH, lifecycle.PARENT_COST_SHA256)["status"], "FAIL_CLOSED")

    def test_parent_cost_binding_only(self):
        bound = lifecycle.bind_cost(lifecycle.PARENT_COST_PATH, lifecycle.PARENT_COST_SHA256)
        self.assertEqual(bound["expectedCostCAD"], "4.8973042")
        self.assertEqual(bound["ceilingCAD"], "7.35")
        self.assertEqual(bound["runtimePayloadBinding"], "REQUIRED_NOT_PROVEN")
        with self.assertRaisesRegex(RuntimeError, "EXACT_PARENT"):
            lifecycle.bind_cost(Path("unrelated-cost"), lifecycle.PARENT_COST_SHA256)
        with self.assertRaisesRegex(RuntimeError, "EXACT_PARENT"):
            lifecycle.bind_cost(lifecycle.PARENT_COST_PATH, "a" * 64)
        with patch.object(Path, "read_bytes", return_value=b"changed"):
            with self.assertRaisesRegex(RuntimeError, "HASH_MISMATCH"):
                lifecycle.bind_cost(lifecycle.PARENT_COST_PATH, lifecycle.PARENT_COST_SHA256)
        for expected, ceiling in (("NaN", "7.35"), ("4", "5.99"), ("0", "3")):
            value = json.loads(lifecycle.PARENT_COST_PATH.read_bytes())
            value.update(G3A_EXPECTED_COST_CAD=expected, G3A_COST_CEILING_CAD=ceiling)
            raw = json.dumps(value).encode()
            with patch.object(Path, "read_bytes", return_value=raw):
                with patch.object(lifecycle, "PARENT_COST_SHA256", hashlib.sha256(raw).hexdigest()):
                    with self.assertRaisesRegex(RuntimeError, "NOT_PASSING"):
                        lifecycle.bind_cost(lifecycle.PARENT_COST_PATH, lifecycle.PARENT_COST_SHA256)

    def test_cost_precondition_stops_all_phases(self):
        adapter = SimpleNamespace(fixture_only=True, phase=Mock(), delete_once=Mock())
        controller = lifecycle.Controller(adapter, lifecycle.ExactOwnership(set(), set(), "a" * 64))
        result = controller.run_local(lifecycle.PARENT_COST_PATH, "0" * 64)
        self.assertEqual(result["failedPhase"], "cost_binding_precondition")
        adapter.phase.assert_not_called()
        adapter.delete_once.assert_not_called()

    def test_cost_inputs_have_no_silent_defaults(self):
        adapter = SimpleNamespace(fixture_only=True, phase=Mock(), delete_once=Mock())
        controller = lifecycle.Controller(adapter, lifecycle.ExactOwnership(set(), set(), "a" * 64))
        with self.assertRaises(TypeError):
            controller.run_local()
        adapter.phase.assert_not_called()

    def test_no_marker_cse_or_network_updates_in_foundation(self):
        text = (ROOT / "bicep" / "main.bicep").read_text()
        builder = (ROOT / "bicep" / "builder.bicep").read_text()
        self.assertIn("isVersioningEnabled: false", text)
        self.assertIn("roleAssignmentMode: 'AbacRepositoryPermissions'", text)
        self.assertIn("publicNetworkAccess: 'Disabled'", text)
        self.assertNotIn("virtualMachines/extensions@", builder)
        self.assertNotIn("5f82bd226", text + builder)


if __name__ == "__main__":
    unittest.main()
