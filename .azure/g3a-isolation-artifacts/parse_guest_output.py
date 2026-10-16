"""Local controller helper; never runs in the capsule or mutates/cloud-calls."""

import json
import re

CHECKS = {
    "baseline", "mountNamespace", "rootIsolation", "hostFSNegative",
    "networkIsolation", "networkNegative", "noNewPrivs", "privilegeDrop",
    "privilegeRegainNegative", "selfContained",
}


def unique_marker(text, prefix):
    lines = [line[len(prefix):] for line in text.splitlines() if line.startswith(prefix)]
    if len(lines) != 1:
        raise ValueError("MARKER_ABSENT_OR_DUPLICATED")
    return json.loads(lines[0])


def inspect_proof(text, candidate_sha, candidate_bytes):
    result = unique_marker(text, "G3A_ISOLATION_PROOF_V1 ")
    if (result.get("schema") != "g3a-isolation-proof/v1" or
            result.get("mode") != "--guest-isolation-proof" or
            result.get("candidateSha256") != candidate_sha or
            result.get("candidateBytes") != candidate_bytes or
            result.get("embeddedFileCount") != 141 or
            set(result.get("checks", {})) != CHECKS):
        raise ValueError("PROOF_IDENTITY_OR_GATE_CONTRACT")
    for field in ("baselineSha256", "evidenceSha256", "embeddedCensusSha256"):
        if not re.fullmatch("[0-9a-f]{64}", result.get(field, "")):
            raise ValueError("PROOF_EVIDENCE_DIGEST")
    if not re.fullmatch(r"\.g3a-isolation-proof-[0-9]+/proof\.json", result.get("evidenceFile", "")):
        raise ValueError("UNSAFE_EVIDENCE_REFERENCE")
    return result


def require_guest_pass(text, binding, exit_code):
    result = inspect_proof(text, binding["candidateSha256"], binding["candidateBytes"])
    if ("embeddedCensusSha256" in binding and
            result["embeddedCensusSha256"] != binding["embeddedCensusSha256"]):
        raise ValueError("EMBEDDED_CENSUS_BINDING_MISMATCH")
    handoff = unique_marker(text, "G3A_HANDOFF_V1 ")
    if (exit_code != 0 or result.get("outcome") != "PASS" or
            any(value != "PASS" for value in result["checks"].values()) or
            result.get("failedPrimitive") or result.get("errorCode") or
            not re.fullmatch("[0-9a-f]{64}", result.get("runtimeEvidenceSha256", "")) or
            result.get("runtimeCensusCount", 0) <= 0):
        raise ValueError("GUEST_PROOF_FAILED_OR_INCOMPLETE")
    if (handoff.get("schema") != "g3a-handoff/v1" or
            handoff.get("mode") != "--guest-isolation-proof" or
            handoff.get("shimSha256") != binding["shimSha256"] or
            handoff.get("shimBytes") != binding["shimBytes"] or
            handoff.get("candidateSha256") != binding["candidateSha256"] or
            handoff.get("candidateBytes") != binding["candidateBytes"] or
            handoff.get("outcome") != "PASS" or handoff.get("capsuleExit") != 0):
        raise ValueError("HANDOFF_FAILED_OR_IDENTITY_MISMATCH")
    return result, handoff
