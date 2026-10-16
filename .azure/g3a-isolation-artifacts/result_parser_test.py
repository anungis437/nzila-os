"""Parent contract fixtures; real Docker stdout is reused without any guest call."""

import copy
import hashlib
import json
from pathlib import Path
import unittest

import result_parser as parser

LANE = Path(__file__).resolve().parent


class ParserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        commands = json.loads((LANE / "BUILD_AND_OFFLINE_COMMANDS.json").read_text())["commands"]
        cls.no_cap = next(c for c in commands if c["exitCode"] == 1 and
                          parser.PROOF_PREFIX in c["stdout"])
        cls.positive = next(c for c in commands if c["exitCode"] == 0 and
                            parser.PROOF_PREFIX in c["stdout"])

    def markers(self):
        result = parser.parse(self.positive["stdout"])
        return copy.deepcopy(result["proof"]), copy.deepcopy(result["handoff"])

    def text(self, proof, handoff):
        return parser.PROOF_PREFIX + json.dumps(proof) + "\n" + parser.HANDOFF_PREFIX + json.dumps(handoff)

    def test_real_no_cap_docker_failure_is_adequate_without_diagnostic(self):
        command = self.no_cap["command"]
        self.assertIn("--pull", command)
        self.assertIn("never", command)
        self.assertEqual(command[command.index("--cap-drop") + 1], "ALL")
        self.assertNotIn("--cap-add", command)
        result = parser.parse(self.no_cap["stdout"])
        self.assertFalse(result["allPassed"])
        self.assertFalse(result["diagnosticRequired"])
        self.assertTrue(result["structuredOutputAdequate"])
        self.assertEqual(result["baselineOutcome"], "PASS")
        self.assertEqual(result["mountNamespace"], "UNSUPPORTED")
        self.assertEqual(result["failedPrimitive"], "namespaceClone")
        self.assertEqual(result["capsuleExit"], 1)
        self.assertFalse(result["fullBaselineAvailable"])
        self.assertIsNone(result["baselineEvidence"])

    def test_real_offline_root_success_does_not_claim_live_proven(self):
        result = parser.parse("[stdout]\n" + self.positive["stdout"] + "[stderr]\n")
        self.assertTrue(result["checksAllPassed"])
        self.assertFalse(result["allPassed"])
        self.assertFalse(result["structuredOutputAdequate"])
        self.assertTrue(result["diagnosticRequired"])
        self.assertTrue(result["evidenceRetentionRequiredBeforeCleanup"])
        self.assertTrue(result["extensionSuccessRequiredSeparately"])
        self.assertFalse(result["provenance"]["liveQualificationClaimedByParser"])
        self.assertEqual(result["evidenceReference"]["runtimeCensusCount"], 128)
        self.assertEqual(result["fullEvidenceAvailability"], "HASH_BOUND_REFERENCE_ONLY")

    def test_full_bounded_evidence_exact_hash_contract(self):
        proof, handoff = self.markers()
        full = json.loads((LANE / "OFFLINE_ROOT_FIXTURE_PROOF.json").read_text())["fullEvidence"]
        baseline_raw = json.dumps(full["baseline"])
        runtime_raw = json.dumps(full["details"]["runtimeSelfTest"]) + "\n"
        proof["baselineSha256"] = hashlib.sha256(baseline_raw.encode()).hexdigest()
        proof["runtimeEvidenceSha256"] = hashlib.sha256(runtime_raw.encode()).hexdigest()
        full.update({k: v for k, v in proof.items() if k != "evidenceSha256"})
        full_raw = json.dumps(full)
        proof["evidenceSha256"] = hashlib.sha256(full_raw.encode()).hexdigest()
        envelope = {"message": self.text(proof, handoff), "baselineJson": baseline_raw,
                    "proofJson": full_raw, "runtimeJson": runtime_raw}
        result = parser.parse(envelope)
        self.assertTrue(result["allPassed"])
        self.assertTrue(result["evidenceComplete"])
        self.assertFalse(result["diagnosticRequired"])
        self.assertEqual(result["baselineEvidence"]["status"]["Uid"], "0\t0\t0\t0")
        self.assertEqual(result["fullProofEvidence"]["details"]["privilegeState"]
                         ["uidRealEffectiveSaved"], [65532] * 3)
        self.assertTrue(result["fullRuntimeAvailable"])
        self.assertEqual(result["fullEvidenceAvailability"], "SUPPLIED_HASH_VERIFIED")
        for field in ("baselineJson", "proofJson", "runtimeJson"):
            bad = dict(envelope)
            bad[field] += " "
            with self.subTest(field=field), self.assertRaises(parser.ParseError):
                parser.parse(bad)

    def test_exact_parent_outcome_mapping_success_and_no_cap_failure(self):
        required = set(parser.OUTCOME_MAP) | {"BOOTSTRAP_TO_CAPSULE_HANDOFF"}
        self.assertEqual(len(required), 13)
        for text in (self.positive["stdout"], self.no_cap["stdout"]):
            result = parser.parse(text)
            self.assertEqual(set(result["outcomes"]), required)
            for name, check in parser.OUTCOME_MAP.items():
                expected = result["checks"][check]
                if expected == "PASS":
                    expected = {
                        "GUEST_MOUNT_NAMESPACE": "SUPPORTED",
                        "ISOLATED_ROOT_MECHANISM": parser.ROOT_MECHANISM,
                        "GUEST_NETWORK_ISOLATION_MECHANISM": parser.NETWORK_MECHANISM,
                    }.get(name, expected)
                self.assertEqual(result[name], expected)
                self.assertEqual(result["outcomes"][name], result[name])
            self.assertEqual(result["BOOTSTRAP_TO_CAPSULE_HANDOFF"],
                             "QUALIFIED" if result["handoffOutcome"] == "PASS" else "FAIL")
        failed = parser.parse(self.no_cap["stdout"])
        self.assertEqual(failed["PINNED_GUEST_BASELINE_CAPTURE"], "PASS")
        self.assertEqual(failed["GUEST_MOUNT_NAMESPACE"], "UNSUPPORTED")
        self.assertEqual(failed["ISOLATED_ROOT_MECHANISM"], "NOT_RUN")
        self.assertEqual(failed["GUEST_NETWORK_ISOLATION_MECHANISM"], "NOT_RUN")
        self.assertEqual(failed["controllerBaselineView"], "HASH_ONLY")
        self.assertFalse(failed["diagnosticRequired"])

    def test_recovered_actual_full_offline_evidence_is_hash_verified(self):
        from build_integration_report import fixture
        result = fixture("OFFLINE_ROOT_FIXTURE_PROOF.json", self.positive)
        parsed = result["parsed"]
        self.assertTrue(parsed["allPassed"])
        self.assertTrue(parsed["evidenceComplete"])
        self.assertEqual(parsed["BOOTSTRAP_TO_CAPSULE_HANDOFF"], "QUALIFIED")
        self.assertEqual(parsed["GUEST_MOUNT_NAMESPACE"], "SUPPORTED")
        self.assertEqual(parsed["ISOLATED_ROOT_MECHANISM"], parser.ROOT_MECHANISM)
        self.assertEqual(len(parsed["runtimeEvidence"]["importedRuntimeCensus"]), 128)
        self.assertFalse(parsed["provenance"]["liveQualificationClaimedByParser"])
        failed = fixture("OFFLINE_UNSUPPORTED_PROOF.json", self.no_cap)["parsed"]
        self.assertFalse(failed["allPassed"])
        self.assertTrue(failed["fullBaselineAvailable"])
        self.assertFalse(failed["diagnosticRequired"])

    def test_missing_duplicate_truncated_or_embedded_markers_raise(self):
        text = self.positive["stdout"]
        proof_line, handoff_line = text.splitlines()
        cases = [proof_line, handoff_line, "", text + proof_line, text + handoff_line,
                 proof_line[:-10] + "\n" + handoff_line, proof_line + "\n" + handoff_line[:-10],
                 "prefix " + text, text.replace(parser.HANDOFF_PREFIX, "G3A_HANDOFF_V1"),
                 text.replace('"outcome":"PASS"', '"outcome":"PASS","outcome":"FAIL"', 1)]
        for index, bad in enumerate(cases):
            with self.subTest(index=index), self.assertRaises(parser.ParseError):
                parser.parse(bad)

    def test_identity_contract_and_contradiction_negatives(self):
        proof, handoff = self.markers()
        cases = []
        for obj, key, value in [
            ("proof", "candidateSha256", "0" * 64), ("handoff", "shimSha256", "0" * 64),
            ("handoff", "candidateBytes", True), ("handoff", "capsuleExit", False),
            ("proof", "embeddedCensusSha256", "0" * 64),
            ("proof", "evidenceFile", "../etc/shadow"),
            ("proof", "runtimeCensusCount", True), ("proof", "baselineSha256", None),
            ("proof", "runtimeEvidenceSha256", ""), ("proof", "outcome", "FAIL"),
            ("proof", "errorCode", "FAILURE"), ("handoff", "errorCode", "FAILURE"),
            ("handoff", "capsuleExit", 1), ("proof", "schema", "wrong"),
            ("proof", "outcome", []), ("handoff", "outcome", {}),
        ]:
            p, h = copy.deepcopy(proof), copy.deepcopy(handoff)
            (p if obj == "proof" else h)[key] = value
            cases.append(self.text(p, h))
        for state in ("FAIL", "NOT_RUN", "UNSUPPORTED", "unknown", True):
            p = copy.deepcopy(proof)
            p["checks"]["rootIsolation"] = state
            cases.append(self.text(p, handoff))
        p = copy.deepcopy(proof)
        del p["checks"]["selfContained"]
        cases.append(self.text(p, handoff))
        for index, bad in enumerate(cases):
            with self.subTest(index=index), self.assertRaises(parser.ParseError):
                parser.parse(bad)

    def test_proof_pass_handoff_failure_never_all_passed(self):
        proof, handoff = self.markers()
        handoff.update(outcome="FAIL", capsuleExit=1, errorCode="CAPSULE_PROOF_FAILED")
        result = parser.parse(self.text(proof, handoff))
        self.assertFalse(result["allPassed"])
        self.assertFalse(result["diagnosticRequired"])

    def test_bounds_and_invalid_json(self):
        for bad in ("x" * (parser.MAX_MESSAGE_BYTES + 1), "\ud800", None, [],
                    {"message": "x", "extra": 1}):
            with self.subTest(value=type(bad).__name__), self.assertRaises(parser.ParseError):
                parser.parse(bad)
        for raw in ('{"x":NaN}', '{"x":Infinity}', "[]", '{"x":1,"x":2}'):
            with self.subTest(raw=raw), self.assertRaises(parser.ParseError):
                parser._json(raw, 100)

    def test_full_evidence_bounds_and_missing_baseline_fields(self):
        with self.assertRaises(parser.ParseError):
            parser._evidence(" " * (parser.MAX_EVIDENCE_BYTES + 1), "0" * 64)
        proof, handoff = self.markers()
        raw = json.dumps({"status": {}})
        proof["baselineSha256"] = hashlib.sha256(raw.encode()).hexdigest()
        with self.assertRaises(parser.ParseError):
            parser.parse({"message": self.text(proof, handoff), "baselineJson": raw})


if __name__ == "__main__":
    unittest.main()
