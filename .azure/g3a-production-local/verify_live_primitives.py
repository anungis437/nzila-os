"""Independent raw-byte/kernel-evidence check; no deployment or artifact parser imports."""

import hashlib
import json
from pathlib import Path
import re
import sys

BASE = Path(__file__).resolve().parent.parent
LIVE = BASE / "g3a-isolation-live"
sys.path.insert(0, str(LIVE))
import evidence_transport


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def load(path):
    return json.loads(Path(path).read_text())


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    report = load(BASE / "g3a-isolation-artifacts" / "PARENT_INTEGRATION_REPORT.json")
    envelope = load(LIVE / "LIVE_EXACT_EVIDENCE.json")
    capture = load(LIVE / "DIAGNOSTIC_CAPTURE.json")
    decoded = evidence_transport.decode(capture["safeOutput"], evidence_transport.dictionary(report))
    require(decoded == {key: envelope[key] for key in evidence_transport.FIELDS}, "LIVE_EVIDENCE_TRANSPORT_CHANGED")
    proof = json.loads(envelope["proofJson"])
    baseline = json.loads(envelope["baselineJson"])
    runtime = json.loads(envelope["runtimeJson"])
    markers = {}
    for name in ("G3A_HANDOFF_V1", "G3A_ISOLATION_PROOF_V1"):
        found = re.findall(r"^" + name + r" (\{[^\n]+\})$", envelope["message"], re.MULTILINE)
        require(len(found) == 1, "RAW_MARKER_CENSUS_" + name)
        markers[name] = json.loads(found[0])
    marker = markers["G3A_ISOLATION_PROOF_V1"]
    handoff = markers["G3A_HANDOFF_V1"]
    require(marker["evidenceSha256"] == sha(envelope["proofJson"].encode()) and
            marker["baselineSha256"] == proof["baselineSha256"] == sha(envelope["baselineJson"].encode()) and
            marker["runtimeEvidenceSha256"] == proof["runtimeEvidenceSha256"] ==
            sha(envelope["runtimeJson"].encode()), "RAW_EVIDENCE_HASH_BINDINGS")
    identity = report["artifactIdentity"]
    require(marker["candidateSha256"] == proof["candidateSha256"] == handoff["candidateSha256"] ==
            identity["candidateSha256"] and handoff["shimSha256"] == identity["shimSha256"] and
            marker["candidateBytes"] == handoff["candidateBytes"] == identity["candidateBytes"] and
            handoff["outcome"] == marker["outcome"] == proof["outcome"] == "PASS" and
            handoff["capsuleExit"] == 0, "RAW_HANDOFF_CAPSULE_BINDINGS")
    require(baseline["architecture"] == "linux/amd64" and
            baseline["cwd"] == "/var/lib/waagent/custom-script/download/0" and
            baseline == proof["baseline"], "RAW_BASELINE_BINDING")
    require(set(proof["checks"].values()) == {"PASS"} and len(proof["checks"]) == 10,
            "ALL_KERNEL_ISOLATION_CHECKS_REQUIRED")
    details = proof["details"]
    require(set(details["dependencyClasses"]) == {"CAPSULE_EMBEDDED", "PINNED_KERNEL_ABI"},
            "HOST_USERSPACE_DEPENDENCY")
    for kind in ("mnt", "net"):
        require(details["isolatedNamespaces"][kind] != baseline["namespaces"][kind],
                "NAMESPACE_NOT_ISOLATED_" + kind)
    require(details["hostAccessibilityOnly"] == "waagent,shadow,originalCWD,root,home,proc,sys:ENOENT",
            "HOST_FILESYSTEM_ACCESSIBLE")
    privilege = details["privilegeState"]
    require(privilege["noNewPrivs"] == 1 and privilege["supplementaryGroups"] == [] and
            privilege["gidRealEffectiveSaved"] == privilege["uidRealEffectiveSaved"] == [65532] * 3 and
            privilege["capBoundingAmbient"] == "ZERO" and
            all(set(item.values()) == {0} for item in privilege["capEffectivePermittedInheritable"]),
            "PRIVILEGE_DROP_NOT_PROVEN")
    require(details["routeCount"] == 0 and
            len(details["interfaces"]) == 1 and details["interfaces"][0]["name"] == "lo" and
            details["interfaces"][0]["addressCount"] == 0 and
            {item["targetClass"] for item in details["tcpNegatives"]} == {"loopback", "private", "linklocal"} and
            {item["state"] for item in details["tcpNegatives"]} == {"UNREACHABLE"}, "NETWORK_NEGATIVES_NOT_PROVEN")
    require(details["isolatedMountFlags"]["/"] & 1 and details["isolatedMountFlags"]["/runtime"] & 1 and
            not details["isolatedMountFlags"]["/work"] & 1 and not details["isolatedMountFlags"]["/output"] & 1,
            "READONLY_RUNTIME_WRITABLE_OUTPUT_BOUNDARY")
    require(runtime == details["runtimeSelfTest"] and runtime["networkRequests"] == 0 and
            runtime["liveExecution"] == "DISABLED" and runtime["transactionQualified"] is False,
            "RUNTIME_EVIDENCE_OR_PRODUCTION_BOUNDARY")
    census = report["embeddedRuntimeNativeFullFileCensus"]
    require(census["embeddedCensusSha256"] == marker["embeddedCensusSha256"] and
            len(census["embeddedCensus"]) == marker["embeddedFileCount"] == 141, "EMBEDDED_CENSUS_BINDING")
    entries = runtime["importedRuntimeCensus"]
    require(len(entries) == marker["runtimeCensusCount"] == 128 and
            len({item["module"] for item in entries}) == len(entries) and
            all(item["path"] in census["embeddedCensus"] for item in entries), "FULL_RUNTIME_FILE_CENSUS")
    for alias in details["runtimeSONAMEAliases"]:
        require(alias["classification"] == "CAPSULE_EMBEDDED" and
                alias["sha256"] == census["embeddedCensus"][alias["source"]]["sha256"],
                "NATIVE_ALIAS_HASH_BINDING")
    result = load(LIVE / "GUEST_PROOF_RESULT.json")
    require(result["allPassed"] and result["evidenceComplete"] and result["extensionSucceeded"] and
            result["effectiveHandler"] == "2.1.19", "EXTENSION_OR_EVIDENCE_NOT_COMPLETE")
    output = {"status": "PASS", "proofSha256": sha(envelope["proofJson"].encode()),
              "baselineSha256": sha(envelope["baselineJson"].encode()),
              "runtimeSha256": sha(envelope["runtimeJson"].encode()),
              "kernel": baseline["kernel"], "embeddedFiles": 141, "runtimeEntries": 128,
              "nativeAliases": len(details["runtimeSONAMEAliases"]),
              "guestParserImported": False, "cloudCalls": 0,
              "productionCapsuleAutomaticallyPromoted": False}
    with (Path(__file__).resolve().parent / "LIVE_PRIMITIVES_INDEPENDENT.json").open("x") as stream:
        json.dump(output, stream, indent=2)
        stream.write("\n")
    print("LIVE_PRIMITIVES_INDEPENDENT=PASS")


if __name__ == "__main__":
    main()
