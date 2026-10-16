"""Local controller tests; all transport, evidence writes and calls mocked."""

import hashlib
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

import isolation_live as live


class StagingTests(unittest.TestCase):
    def fixture(self):
        proof = object.__new__(live.IsolationProof)
        proof.storage_token = lambda: "memory-only-fixture-token"
        proof.blob = lambda *args, **kwargs: (200, {}, b"")
        events = []
        proof.event = lambda kind, **values: events.append((kind, values))
        raw = b"fixture-synthetic-bytes"
        items = [{"role": role, "objectPath": "sha256/" + hashlib.sha256(raw).hexdigest() + "/" + role,
                  "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw),
                  "path": role + ".fixture"} for role in ("handoff", "capsule")]
        return proof, events, raw, items

    def test_two_distinct_paths_one_put_each(self):
        proof, events, raw, items = self.fixture()
        calls, records = [], []

        def request(method, token, data=None):
            calls.append((method, live.ca.OBJECT))
            if method == "HEAD":
                return 404, {"errorCode": "BlobNotFound"}, b""
            return (201 if method == "PUT" else 200), {"ETag": '"fixture"', "Last-Modified": "fixture"}, (
                b"" if method == "PUT" else raw)

        proof.object_request = request
        with patch.object(live, "verify_artifacts"), patch.object(live, "read", return_value={"objects": items}), \
                patch.object(live, "baseline", return_value=[]), \
                patch.object(live, "fresh", side_effect=lambda name, value: records.append((name, value))), \
                patch.object(Path, "read_bytes", return_value=raw):
            proof.stage()
        self.assertEqual([method for method, _ in calls], ["HEAD", "PUT", "GET"] * 2)
        self.assertEqual(len({path for _, path in calls}), 2)
        self.assertEqual(len(events), 2)
        self.assertEqual(records[-1][1]["objectCount"], 2)

    def test_collision_does_not_upload(self):
        proof, events, raw, items = self.fixture()
        proof.object_request = lambda *args: (200, {}, b"")
        with patch.object(live, "verify_artifacts"), patch.object(live, "read", return_value={"objects": items}):
            with self.assertRaisesRegex(RuntimeError, "OBJECT_COLLISION"):
                proof.stage()
        self.assertEqual(events, [])

    def test_wrong_absence_error_does_not_upload(self):
        proof, events, raw, items = self.fixture()
        proof.object_request = lambda *args: (404, {"errorCode": "ContainerNotFound"}, b"")
        with patch.object(live, "verify_artifacts"), patch.object(live, "read", return_value={"objects": items}):
            with self.assertRaisesRegex(RuntimeError, "OBJECT_COLLISION"):
                proof.stage()
        self.assertEqual(events, [])

    def test_hash_drift_does_not_upload(self):
        proof, events, raw, items = self.fixture()
        proof.object_request = lambda *args: (404, {"errorCode": "BlobNotFound"}, b"")
        with patch.object(live, "verify_artifacts"), patch.object(live, "read", return_value={"objects": items}), \
                patch.object(Path, "read_bytes", return_value=b"different"):
            with self.assertRaisesRegex(RuntimeError, "OBJECT_BYTES_CHANGED"):
                proof.stage()
        self.assertEqual(events, [])

    def test_readback_mismatch_no_second_put(self):
        proof, events, raw, items = self.fixture()
        calls = []

        def request(method, token, data=None):
            calls.append(method)
            if method == "HEAD":
                return 404, {"errorCode": "BlobNotFound"}, b""
            return (201 if method == "PUT" else 200), {"ETag": "x", "Last-Modified": "x"}, b"wrong"

        proof.object_request = request
        with patch.object(live, "verify_artifacts"), patch.object(live, "read", return_value={"objects": items}), \
                patch.object(live, "baseline", return_value=[]), patch.object(live, "fresh"), \
                patch.object(Path, "read_bytes", return_value=raw):
            with self.assertRaisesRegex(RuntimeError, "OBJECT_READBACK_FAILED"):
                proof.stage()
        self.assertEqual(calls, ["HEAD", "PUT", "GET"])

    def test_second_artifact_failure_no_replay(self):
        proof, events, raw, items = self.fixture()
        calls = []

        def request(method, token, data=None):
            calls.append(method)
            if method == "HEAD":
                return 404, {"errorCode": "BlobNotFound"}, b""
            if method == "PUT":
                return (201 if calls.count("PUT") == 1 else 409), {"ETag": "x", "Last-Modified": "x"}, b""
            return 200, {"ETag": "x"}, raw

        proof.object_request = request
        with patch.object(live, "verify_artifacts"), patch.object(live, "read", return_value={"objects": items}), \
                patch.object(live, "baseline", return_value=[]), patch.object(live, "fresh"), \
                patch.object(Path, "read_bytes", return_value=raw):
            with self.assertRaisesRegex(RuntimeError, "OBJECT_PUT_FAILED"):
                proof.stage()
        self.assertEqual(calls.count("PUT"), 2)
        self.assertEqual(len(events), 2)


class ExecutionBoundaryTests(unittest.TestCase):
    def check_failure(self, cse_count, consumed, diagnostic_calls):
        proof = object.__new__(live.IsolationProof)
        proof.cse_count = cse_count
        proof.execute_once = Mock(side_effect=RuntimeError("fixture-terminal-failure"))
        proof.diagnostic = Mock()
        with patch.object(live, "fresh") as evidence, patch.object(Path, "exists", return_value=consumed):
            with self.assertRaisesRegex(RuntimeError, "fixture-terminal-failure"):
                proof.execute()
        proof.execute_once.assert_called_once_with()
        self.assertEqual(proof.diagnostic.call_count, diagnostic_calls)
        evidence.assert_called_once_with("EXECUTION_FAILURE_BOUNDARY.json", {
            "reason": "fixture-terminal-failure", "noRetry": True, "CSEAttempts": cse_count,
        })

    def test_no_diagnostic_before_cse(self):
        self.check_failure(0, False, 0)

    def test_one_diagnostic_on_unstructured_cse_failure(self):
        self.check_failure(1, False, 1)

    def test_no_second_diagnostic(self):
        self.check_failure(1, True, 0)

    def test_structured_failure_needs_no_diagnostic(self):
        proof = object.__new__(live.IsolationProof)
        proof.execute_once = Mock(return_value=None)
        proof.diagnostic = Mock()
        with patch.object(live, "fresh") as evidence:
            proof.execute()
        proof.execute_once.assert_called_once_with()
        proof.diagnostic.assert_not_called()
        evidence.assert_not_called()


if __name__ == "__main__":
    unittest.main()
