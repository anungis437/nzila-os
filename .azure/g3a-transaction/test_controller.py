from decimal import Decimal
import hashlib
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import Mock

from controller import (
    FixtureController, GuestPipeline, MUTATING_PHASES, OwnershipLedger, PHASES,
    SingleAuthority, bootstrap_size_guard, cost_ceiling, safe_extract, verify_lockdown,
)
from registry import InputBinding, ReaderFailure, digest
from test_registry import CLIENT, DATA, INPUT, MEDIA, Fixture, Response, auth_response


class ControllerTests(unittest.TestCase):
    def authority(self, folder):
        return SingleAuthority(Path(folder) / "authority-consumed.json", "NZ-20261008-INFRA-001", "a" * 64)

    def test_single_authority_exclusive_persistent_consumption(self):
        with tempfile.TemporaryDirectory() as folder:
            authority = self.authority(folder)
            authority.consume_before_first_mutation()
            with self.assertRaises(FileExistsError):
                self.authority(folder).consume_before_first_mutation()

    def test_cleanup_cannot_delete_baseline_foreign_bootstrap_or_uncaptured_resources(self):
        ledger = OwnershipLedger(["owned-vm", "owned-role"], ["g2-target", "bootstrap-grant"])
        for value in ("g2-target", "bootstrap-grant", "foreign"):
            with self.assertRaises(ReaderFailure):
                ledger.capture_created(value, "G3A_TRANSACTION_OWNED", {"id": value, "created": True})
        with self.assertRaises(ReaderFailure):
            ledger.capture_created("owned-role", "CONTROL_PLANE_BOOTSTRAP_OWNED", {"id": "owned-role", "created": True})
        for value in ("owned-role", "owned-vm"):
            ledger.capture_created(value, "G3A_TRANSACTION_OWNED", {"id": value, "created": True})
        deleted = []
        ledger.cleanup(deleted.append)
        self.assertEqual(deleted, ["owned-vm", "owned-role"])

    def test_cleanup_failure_preserves_explicit_reconciliation_no_retry(self):
        ledger = OwnershipLedger(["owned"], [])
        ledger.capture_created("owned", "G3A_TRANSACTION_OWNED", {"id": "owned", "created": True})
        calls = []
        def fail(value):
            calls.append(value)
            raise TimeoutError("fixture")
        evidence = ledger.cleanup(fail)
        self.assertEqual(calls, ["owned"])
        self.assertEqual(evidence[0]["result"], "FAILED_NO_RETRY_RECONCILIATION_REQUIRED")

    def test_phase_failures_stop_every_later_phase_and_cleanup_only_owned(self):
        for failing in PHASES:
            with tempfile.TemporaryDirectory() as folder:
                calls, deleted = [], []
                ledger = OwnershipLedger(["owned-vm"], ["g2"])
                class Adapter:
                    fixture_only = True
                    def phase(self, phase, ledger):
                        calls.append(phase)
                        if phase == "builder_creation":
                            ledger.capture_created("owned-vm", "G3A_TRANSACTION_OWNED", {"id": "owned-vm", "created": True})
                        if phase == failing:
                            raise RuntimeError("FIXTURE_FAILURE_NO_SECRET_PERSISTENCE")
                        return True
                    def delete_once(self, value):
                        deleted.append(value)
                result = FixtureController(self.authority(folder), ledger, Adapter()).run()
                self.assertEqual(result["firstFailingPhase"], failing)
                self.assertEqual(calls, list(PHASES[:PHASES.index(failing) + 1]))
                self.assertTrue(all(value == "owned-vm" for value in deleted))
                self.assertFalse(result["laterPhasesExecuted"])

    def test_fixture_success_has_all_phases_live_adapter_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            class Adapter:
                fixture_only = True
                def phase(self, phase, ledger):
                    return True
                def delete_once(self, value):
                    raise AssertionError("no owned resources")
            result = FixtureController(self.authority(folder), OwnershipLedger([], []), Adapter()).run()
            self.assertEqual(len(result["events"]), len(PHASES))
            self.assertEqual(result["result"], "FIXTURE_PASS_NOT_LIVE_COMPLETE")
            Adapter.fixture_only = False
            with self.assertRaises(ReaderFailure):
                FixtureController(self.authority(folder), OwnershipLedger([], []), Adapter())

    def test_lockdown_requires_full_state_and_producer_writer_revocation(self):
        value = {"publicNetworkAccess": "Disabled", "networkRuleBypassOptions": "None",
                 "adminUserEnabled": False, "anonymousPullEnabled": False,
                 "roleAssignmentMode": "AbacRepositoryPermissions",
                 "networkRuleSet": {"defaultAction": "Deny", "ipRules": []},
                 "producerWriterRevoked": True, "privateEndpointApproved": True}
        verify_lockdown(value)
        for key in value:
            damaged = {**value}
            damaged.pop(key)
            with self.assertRaises(ReaderFailure):
                verify_lockdown(damaged)

    def test_bootstrap_size_guard_exact_boundary(self):
        self.assertEqual(bootstrap_size_guard(b"x" * 128000)["bytes"], 128000)
        for payload in (b"", b"x" * 128001):
            with self.assertRaises(ReaderFailure):
                bootstrap_size_guard(payload)

    def test_cost_arithmetic_ceiling_at_least_150_percent(self):
        result = cost_ceiling([Decimal("2.36"), Decimal("0.42")], Decimal("1.5"))
        self.assertEqual(result, {"expected": "2.78", "ceiling": "5"})
        for values, multiplier in (([Decimal("-1")], Decimal("1.5")), ([Decimal("NaN")], Decimal("1.5")),
                                   ([Decimal("1")], Decimal("1.49"))):
            with self.assertRaises(ReaderFailure):
                cost_ceiling(values, multiplier)

    def archive(self, kind=tarfile.REGTYPE, name="file", duplicate=False):
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode="w", format=tarfile.USTAR_FORMAT) as archive:
            for _ in range(2 if duplicate else 1):
                member = tarfile.TarInfo(name)
                member.mode, member.type = 0o644, kind
                member.size = 3 if kind == tarfile.REGTYPE else 0
                member.linkname = "/foreign" if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE) else ""
                archive.addfile(member, io.BytesIO(b"abc") if member.size else None)
        return stream.getvalue()

    def test_safe_extraction_full_census_and_invalid_types(self):
        contract = {"file": {"bytes": 3, "mode": 0o644, "sha256": hashlib.sha256(b"abc").hexdigest()}}
        for name, kind, duplicate in (("../file", tarfile.REGTYPE, False), ("/file", tarfile.REGTYPE, False),
                                     ("file", tarfile.SYMTYPE, False), ("file", tarfile.LNKTYPE, False),
                                     ("file", tarfile.CHRTYPE, False), ("file", tarfile.REGTYPE, True)):
            with tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / "archive.tar"
                path.write_bytes(self.archive(kind, name, duplicate))
                with self.assertRaises(ReaderFailure):
                    safe_extract(path, Path(folder) / "out", contract)
                self.assertFalse((Path(folder) / "out").exists())
        with tempfile.TemporaryDirectory() as folder:
            path, out = Path(folder) / "archive.tar", Path(folder) / "out"
            path.write_bytes(self.archive())
            safe_extract(path, out, contract)
            self.assertEqual((out / "file").read_bytes(), b"abc")
            with self.assertRaises(ReaderFailure):
                safe_extract(path, out, contract)

    def test_guest_private_reader_imds_to_safe_extraction_integration(self):
        import json
        payload = self.archive()
        payload_sha = hashlib.sha256(payload).hexdigest()
        artifact, media = "application/vnd.nzila.g3.portable-inputs.v1", "application/vnd.nzila.g3.portable-inputs.tar.v1"
        raw = json.dumps({"schemaVersion": 2, "mediaType": MEDIA, "artifactType": artifact,
                          "config": {"mediaType": "application/vnd.oci.empty.v1+json", "size": 2, "digest": digest(b"{}")},
                          "layers": [{"mediaType": media, "size": len(payload), "digest": digest(payload)}]}).encode()
        binding = InputBinding(INPUT, DATA, CLIENT, "g3-build-tooling", digest(raw),
                               payload_sha, len(payload), artifact, media)
        calls = []
        class Imds:
            def __init__(self, host, timeout):
                assert host == "169.254.169.254"
            def request(self, method, path, headers):
                calls.append(path)
                assert CLIENT in path and headers == {"Metadata": "true"}
            def getresponse(self):
                return Response(200, json.dumps({"client_id": CLIENT, "access_token": "TEST_AAD_EPHEMERAL"}).encode())
            def close(self):
                pass
        def handler(host, method, path, body, headers):
            auth = auth_response(method, path, body)
            if auth:
                return auth
            if "/manifests/" in path:
                return Response(200, raw, {"Content-Type": MEDIA, "Docker-Content-Digest": digest(raw)})
            if "/blobs/" in path:
                return Response(307, headers={"Location": "https://" + DATA + "?sig=local%2Bonly"})
            assert headers == {"Connection": "close"}
            return Response(200, payload)
        fixture = Fixture(handler)
        with tempfile.TemporaryDirectory() as folder:
            workspace = Path(folder) / "guest"
            pipeline = GuestPipeline([binding], fixture.factory, Imds)
            proof = pipeline.retrieve_inputs(workspace, {payload_sha: {
                "file": {"bytes": 3, "mode": 0o644, "sha256": hashlib.sha256(b"abc").hexdigest()}}})
            self.assertEqual((workspace / payload_sha / "file").read_bytes(), b"abc")
            self.assertNotIn("EPHEMERAL", json.dumps(proof))
            self.assertEqual(len(calls), 1)

    def test_guest_build_invokes_staged_executable_only_not_real_build(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            executable = root / "controller"
            executable.write_bytes(b"fixture-only-not-ELF")
            output = root / "output"
            output.mkdir()
            runner = Mock(return_value=Mock(returncode=0))
            pipeline = GuestPipeline([], None, None, runner)
            pipeline.build(executable, root / "inputs", root / "work", output,
                           hashlib.sha256(executable.read_bytes()).hexdigest())
            self.assertEqual(runner.call_count, 1)
            self.assertEqual(runner.call_args.kwargs["env"], {"PATH": "/unavailable", "DOCKER_HOST": ""})


if __name__ == "__main__":
    unittest.main()
