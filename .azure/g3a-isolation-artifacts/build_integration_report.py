"""Generate one self-contained offline integration evidence report; never build."""

import hashlib
import json
from pathlib import Path
import subprocess

import result_parser as parser

LANE = Path(__file__).resolve().parent


def digest(raw):
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def sorted_maps(value):
    if isinstance(value, dict):
        return {key: sorted_maps(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        return [sorted_maps(item) for item in value]
    return value


def go_json(value):
    return (json.dumps(value, separators=(",", ":"), ensure_ascii=False)
            .replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
            .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def fixture(name, command):
    recorded = json.loads((LANE / name).read_text())
    full = sorted_maps(recorded["fullEvidence"])
    # Go structs retain declaration order; decoded details/maps sort their keys.
    full["baseline"] = {key: full["baseline"][key] for key in
                        ("architecture", "kernel", "cwd", "status", "namespaces",
                         "relevantMountState")}
    baseline_raw = go_json(full["baseline"])
    proof_keys = (
        "schema", "mode", "candidateSha256", "candidateBytes", "outcome",
        "failedPrimitive", "failedOperation", "errorCode", "baseline", "checks", "details",
        "baselineSha256", "evidenceFile", "embeddedCensusSha256", "embeddedFileCount",
        "runtimeEvidenceSha256", "runtimeCensusCount",
    )
    proof_raw = go_json({key: full[key] for key in proof_keys if key in full})
    marker = recorded["marker"]
    assert digest(baseline_raw) == marker["baselineSha256"]
    assert digest(proof_raw) == marker["evidenceSha256"]
    envelope = {"message": command["stdout"], "baselineJson": baseline_raw, "proofJson": proof_raw}
    if "runtimeEvidenceSha256" in marker:
        runtime_raw = json.dumps(full["details"]["runtimeSelfTest"], sort_keys=True) + "\n"
        assert digest(runtime_raw) == marker["runtimeEvidenceSha256"]
        envelope["runtimeJson"] = runtime_raw
    parsed = parser.parse(envelope)
    assert parsed["proof"] == marker
    assert parsed["allPassed"] == (command["exitCode"] == 0)
    return {
        "scope": "RECORDED_OFFLINE_DOCKER_NOT_PINNED_GUEST",
        "guestFileBytes": "RECONSTRUCTED_EXACT_BYTES_VERIFIED_AGAINST_ORIGINAL_CAPTURED_SHA256",
        "fixtureCommand": command["command"], "actualExitCode": command["exitCode"],
        "rawMarkerStdout": command["stdout"], "exactEvidenceEnvelope": envelope,
        "parsed": parsed,
    }


def main():
    binding = json.loads((LANE / "ARTIFACT_BINDING.json").read_text())
    commands = json.loads((LANE / "BUILD_AND_OFFLINE_COMMANDS.json").read_text())["commands"]
    root = next(c for c in commands if c["exitCode"] == 0 and parser.PROOF_PREFIX in c["stdout"])
    no_cap = next(c for c in commands if c["exitCode"] == 1 and parser.PROOF_PREFIX in c["stdout"])
    positive = fixture("OFFLINE_ROOT_FIXTURE_PROOF.json", root)
    negative = fixture("OFFLINE_UNSUPPORTED_PROOF.json", no_cap)
    embedded = json.loads((LANE / "EMBEDDED_CENSUS.json").read_text())
    assert embedded["embeddedFileCount"] == len(embedded["embeddedCensus"]) == 141
    assert embedded["embeddedCensusSha256"] == parser.CENSUS_SHA
    report = {
        "schema": "g3a-authoritative-parent-integration/v1",
        "scope": "LOCAL_OFFLINE_ARTIFACT_INTEGRATION_NOT_LIVE_CERTIFICATION",
        "artifactIdentity": {key: binding[key] for key in
                             ("candidateSha256", "candidateBytes", "candidatePath",
                              "candidateSourceSha256", "shimSha256", "shimBytes", "shimPath")},
        "parserFile": "result_parser.py",
        "parserSha256": hashlib.sha256((LANE / "result_parser.py").read_bytes()).hexdigest(),
        "requestedSuccessFields": positive["parsed"]["outcomes"],
        "requestedFailureFields": negative["parsed"]["outcomes"],
        "positiveFixtureFullOutputs": positive,
        "requiredNoCAPFixtureFullOutputs": negative,
        "embeddedRuntimeNativeFullFileCensus": embedded,
        "contract": {
            "entry": "result_parser.parse(message)",
            "markers": {"proof": parser.PROOF_PREFIX, "handoff": parser.HANDOFF_PREFIX},
            "proofSchema": "g3a-isolation-proof/v1", "handoffSchema": "g3a-handoff/v1",
            "rawProofFields": ["schema", "mode", "candidateSha256", "candidateBytes", "outcome",
                              "checks", "baselineSha256", "evidenceSha256", "evidenceFile",
                              "embeddedCensusSha256", "embeddedFileCount"],
            "rawSuccessFields": ["runtimeEvidenceSha256", "runtimeCensusCount"],
            "rawFailureFields": ["failedPrimitive", "errorCode", "failedOperation (optional)"],
            "rawHandoffFields": ["schema", "mode", "candidateSha256", "candidateBytes",
                                "shimSha256", "shimBytes", "outcome", "capsuleExit",
                                "errorCode (failure)"],
            "message": "Raw stdout or {message, baselineJson?, proofJson?, runtimeJson?}; exact UTF-8 evidence text",
            "normalization": "mount PASS -> SUPPORTED; handoff PASS -> QUALIFIED; mechanism PASS -> fixed source-bound mechanism identifiers; other statuses unchanged",
            "fullBaseline": "architecture/kernel/cwd, real-effective-saved/filesystem UID/GID, supplementary groups, all capability sets, NNP, seccomp/filter count, seven namespace IDs, relevant mount options/propagation",
            "fullRuntime": "128-entry imported module/path census in this actual fixture, Python/SSL versions, import-only status and disabled-live/network-zero/unqualified-transaction fields; isolation details also retain four native SONAME aliases/source/hash/classes",
            "fullNativeClosure": "Embedded loader, Python and libraries only; proof-root native import probe imports _hashlib/_ssl/_bz2/_lzma; full recorded census and alias evidence included above",
            "successGate": "allPassed = checksAllPassed AND full hash-verified evidenceComplete; parent separately requires actual extension success and canonical VM binding",
            "compactOnly": "Hash-bound references only; allPassed=false, structuredOutputAdequate=false, diagnosticRequired=true when syscall checks otherwise pass",
            "failure": "Adequate structured failure allPassed=false, diagnosticRequired=false; parse failures raise ParseError",
            "diagnostic": "Parent alone owns <=1 permitted safe failure/insufficient-output diagnostic before cleanup; no implicit calls, no assumed full evidence in handler logs",
            "retention": "Persist exact baseline/proof/runtime evidence before guest cleanup; no substitute offline fixture for live evidence",
            "bounds": {"messageBytes": 16384, "markerBytes": 4096, "eachEvidenceBytes": 262144},
            "dispatchFreshness": "Parent-owned 30-minute guard; this parser never extends or overrides authority",
        },
        "qualification": {
            "command": "python -B -m unittest -v result_parser_test", "result": "PASS",
            "testMethods": 10, "preFinalBuildPrivilegedChildFixtures": [
                "SOURCE_FIXTURE_ISOLATED_ROOT_FINAL.json",
                "SOURCE_FIXTURE_INHERITED_ROOT_NNP_ZERO.json"],
            "preFinalBuildNoCAPFixture": "SOURCE_FIXTURES_DROPPED_CAPS_FINAL.json",
            "mountBoundary": "Disposable child clone mount/net namespaces verified distinct before mounts; no global mounts",
            "newBuilds": 0, "newCloudCalls": 0, "newDockerRuns": 0,
            "pinnedGuestQualification": "NOT_RUN_NOT_CLAIMED",
        },
    }
    def git(path, *args):
        return subprocess.check_output(["git", "-C", str(path), *args], text=True).strip()
    root_path = LANE.parent.parent
    head = git(root_path, "rev-parse", "HEAD")
    status = git(root_path, "status", "--short").splitlines()
    assert head == "7bec20aad11d43eeae8099c14e021b3074154b27"
    assert set(status) == {"?? .azure/", "?? infrastructure/landing-zone/g2-builder/"}
    report["baselineBeforeReportWrite"] = {
        "activeHead": head, "activeStatus": status,
        "foreignHead": git(r"C:\APPS\nzila-os", "rev-parse", "HEAD"),
        "foreignEntryCount": len(git(r"C:\APPS\nzila-os", "status", "--short").splitlines()),
        "foreignDisposition": "OBSERVE_ONLY",
    }
    raw = json.dumps(report, indent=2, sort_keys=True) + "\n"
    path = LANE / "PARENT_INTEGRATION_REPORT.json"
    path.write_bytes(raw.encode("utf-8"))
    print(json.dumps({"reportFile": path.name, "reportSha256": digest(raw),
                      "reportBytes": len(raw.encode("utf-8")), "requestedSuccessFields":
                      report["requestedSuccessFields"], "fullEvidenceVerified": True}))


if __name__ == "__main__":
    main()
