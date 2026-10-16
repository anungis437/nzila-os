"""Parser fixtures are explicitly synthetic, never pinned-guest or authority evidence."""
import base64
import copy
import hashlib
import json
import unittest
import zlib
import delivery_evidence as d


def actual():
    output = json.loads((d.HERE / "FINAL_HANDOFF_VALIDATION.json").read_text())["stdout"]
    record = json.loads(next(line.split(" ", 1)[1] for line in output.splitlines()
                             if line.startswith("G3A_LOCAL_DELIVERY_VALIDATION_V1 ")))
    files = record["exactFiles"]
    proof = files[".g3a-isolation-proof-hard-bound-static/proof.json"]
    return {
        "proofJson": proof,
        "baselineJson": files[".g3a-isolation-proof-hard-bound-static/baseline.json"],
        "handoffJson": files[".g3a-hard-delivery-evidence/handoff.json"],
        "runtimeJson": json.dumps(json.loads(proof)["details"]["runtimeSelfTest"], sort_keys=True) + "\n",
    }


def rebinding(value, proof, baseline=None, handoff=None):
    if baseline is not None:
        value["baselineJson"] = json.dumps(baseline, sort_keys=True) + "\n"
        proof["baseline"] = baseline
        proof["baselineSha256"] = hashlib.sha256(value["baselineJson"].encode()).hexdigest()
    value["proofJson"] = json.dumps(proof, sort_keys=True) + "\n"
    h = json.loads(value["handoffJson"]) if handoff is None else handoff
    for field, key in (("proofJson", "proofSha256"), ("baselineJson", "baselineSha256"), ("runtimeJson", "runtimeSha256")):
        h[key] = hashlib.sha256(value[field].encode()).hexdigest()
    value["handoffJson"] = json.dumps(h, separators=(",", ":"), sort_keys=True)
    return value


def synthetic():
    value = actual()
    proof = json.loads(value["proofJson"])
    baseline = copy.deepcopy(proof["baseline"])
    baseline["kernel"] = d.bindings()["pinnedKernel"]
    baseline["status"].update({"Uid": "0 0 0 0", "Gid": "0 0 0 0", "Groups": "0",
        "NoNewPrivs": "0", "Seccomp": "0", "Seccomp_filters": "0",
        "CapEff": d.bindings()["pinnedRootCaps"], "CapPrm": d.bindings()["pinnedRootCaps"],
        "CapBnd": d.bindings()["pinnedRootCaps"], "CapAmb": "0000000000000000",
        "CapInh": "0000000000000000"})
    return rebinding(value, proof, baseline)


class DeliveryEvidenceTests(unittest.TestCase):
    def test_actual_complete_roundtrip_not_pinned(self):
        value = actual()
        self.assertEqual(d.decode(d.encode(value)), value)
        with self.assertRaises(ValueError):
            d.parse(value)
        h = value["handoffJson"]
        parsed = d.parse(d.HANDOFF + h)
        self.assertFalse(parsed["allPassed"])
        self.assertTrue(parsed["diagnosticRequired"])

    def test_synthetic_only_complete_positive(self):
        value = synthetic()
        self.assertTrue(d.parse(value)["allPassed"])
        self.assertTrue(d.parse(d.encode(value))["evidenceComplete"])
        self.assertTrue(d.parse(dict(value, message=d.HANDOFF + value["handoffJson"]))["allPassed"])

    def test_identity_and_handoff_negatives(self):
        for key in ("shimSha256", "shimBytes", "candidateSha256", "candidateBytes", "bundleSha256",
                    "bundleBytes", "proofContractSha256", "inputCount", "inputBytes",
                    "frozenCoreInvocations", "productionAuthorityDigest", "futureAuthorityIssued",
                    "inputBuildChargeBytes", "ownedStagingCleanup", "readonlyInputBind", "inputRoot",
                    "candidatePath", "evidenceRoot", "inputStagingFilesystem",
                    "candidateAndExactEvidenceRetained", "candidateExitCode"):
            with self.subTest(key=key):
                value = synthetic()
                h = json.loads(value["handoffJson"])
                h[key] = "INVALID"
                value["handoffJson"] = json.dumps(h)
                with self.assertRaises((ValueError, KeyError)):
                    d.parse(value)
        for remove in (True, False):
            value = synthetic()
            h = json.loads(value["handoffJson"])
            if remove:
                del h["inputCount"]
            else:
                h["unrequested"] = True
            value["handoffJson"] = json.dumps(h)
            with self.assertRaises(ValueError):
                d.parse(value)

    def test_rebound_structural_negatives(self):
        mutations = [
            lambda p: p.update(schema="historical/import-only"),
            lambda p: p.update(outcome="FAIL"),
            lambda p: p.update(failedPrimitive="network"),
            lambda p: p["checks"].pop("minimalNull"),
            lambda p: p["checks"].update(unrequested="PASS"),
            lambda p: p["checks"].update(networkNegative="FAIL"),
            lambda p: p.update(embeddedFileCount=142),
            lambda p: p.update(runtimeCensusCount=127),
            lambda p: p["details"].update(coreInvocations=1),
            lambda p: p["details"].update(staticWitnessInvocations=0),
            lambda p: p["details"].update(productionExecutionAuthorityDigest="issued"),
            lambda p: p["details"].update(inputLayout="/build/.inputs"),
            lambda p: p["details"].update(inputBuildChargeBytes=265077049),
            lambda p: p["details"].update(inputSpecSha256="0"*64),
            lambda p: p["details"]["effectiveLimitsBeforeCore"]["build"].update(totalBytes=1073741825),
            lambda p: p["details"]["initialLimits"]["tmp"].update(totalInodes=4097),
            lambda p: p["details"]["finalLimits"]["build"].update(availableInodes=True),
            lambda p: p["details"]["actualMounts"]["/work"].update(mountFlags=4134),
            lambda p: p["details"]["actualMounts"]["/output"].update(mountFlags=4134),
            lambda p: p["details"]["actualMounts"]["/inputs"].update(mountFlags=4134),
            lambda p: p["details"]["actualMounts"]["/dev"].update(totalInodes=9),
            lambda p: p["details"]["privilegeState"].update(noNewPrivs=0),
            lambda p: p["details"]["privilegeState"].update(supplementaryGroups=[0]),
            lambda p: p["details"].update(routeCount=1),
            lambda p: p["details"].update(interfaces=[]),
            lambda p: p["details"].update(tcpNegatives=[]),
            lambda p: p["details"]["namespaceCleanup"].update(childGone=False),
            lambda p: p["details"].update(actualDispatchNegatives={}),
            lambda p: p["details"]["isolatedNamespaces"].update(mnt=p["baseline"]["namespaces"]["mnt"]),
        ]
        for index, mutate in enumerate(mutations):
            with self.subTest(index=index):
                value = synthetic()
                proof = json.loads(value["proofJson"])
                mutate(proof)
                rebinding(value, proof)
                with self.assertRaises((ValueError, KeyError)):
                    d.parse(value)

    def test_pinned_baseline_negatives(self):
        for field in ("kernel", "Seccomp", "Seccomp_filters", "CapEff", "NoNewPrivs"):
            with self.subTest(field=field):
                value = synthetic()
                proof = json.loads(value["proofJson"])
                baseline = copy.deepcopy(proof["baseline"])
                (baseline if field == "kernel" else baseline["status"])[field] = "wrong"
                rebinding(value, proof, baseline)
                with self.assertRaises(ValueError):
                    d.parse(value)

    def test_exact_field_hash_and_summary_negatives(self):
        for field in d.FIELDS:
            with self.subTest(missing=field):
                value = synthetic()
                del value[field]
                with self.assertRaises(ValueError):
                    d.parse(value)
        value = synthetic()
        for field in ("baselineJson", "proofJson", "runtimeJson"):
            with self.subTest(hash=field):
                bad = dict(value)
                bad[field] += " "
                with self.assertRaises(ValueError):
                    d.parse(bad)
        for bad in (dict(value, extra="{}"), dict(value, proofJson='{"x":1,"x":2}'),
                    dict(value, message=d.HANDOFF + actual()["handoffJson"])):
            with self.assertRaises(ValueError):
                d.parse(bad)

    def test_transport_failclosed(self):
        line = d.encode(synthetic())
        for bad in ("", line[:-4], line+"\n"+line, line+"\n"+d.MARKER+"MALFORMED!",
                    d.MARKER+"!", "x"*16385, line+"garbage"):
            with self.subTest(bad=bad[:40]):
                with self.assertRaises(Exception):
                    d.decode(bad)
        payload = base64.b64decode(line[len(d.MARKER):])
        for bad in (payload+b"trailing", payload[:-1]):
            with self.assertRaises(ValueError):
                d.decode(d.MARKER + base64.b64encode(bad).decode())
        compressor = zlib.compressobj(9, zdict=d.dictionary())
        bomb = compressor.compress(b"x"*(d.MAX_DECODED+1))+compressor.flush()
        with self.assertRaises(ValueError):
            d.decode(d.MARKER + base64.b64encode(bomb).decode())
        with self.assertRaises(ValueError):
            d.encode(dict(synthetic(), handoffJson=json.dumps({"x": "z"*16384})))
        self.assertLessEqual(len(d.diagnostic_script()), 3800)


if __name__ == "__main__":
    unittest.main()
