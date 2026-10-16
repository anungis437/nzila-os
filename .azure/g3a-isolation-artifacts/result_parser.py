"""Pure parent-side parsing: no file reads, diagnostics, execution, or cloud calls."""

import hashlib
import json
import re

CANDIDATE_SHA = "3c5b51321eb9763cff8b2ff215610fc104f076c9bc400800f64d7a9848032469"
SHIM_SHA = "ffcf92e6e93f3ff5f57d535d63ad22aec2f0f2ffd9ad8d4afefcbd54b4effa68"
CENSUS_SHA = "c897671ce9a136f2f0fa011e84c4dbada37b47f08d158a8e3086c7ac23bf5654"
CANDIDATE_BYTES = 26296444
SHIM_BYTES = 2982012
CHECKS = {
    "baseline", "mountNamespace", "rootIsolation", "hostFSNegative",
    "networkIsolation", "networkNegative", "noNewPrivs", "privilegeDrop",
    "privilegeRegainNegative", "selfContained",
}
OUTCOME_MAP = {
    "PINNED_GUEST_BASELINE_CAPTURE": "baseline",
    "GUEST_MOUNT_NAMESPACE": "mountNamespace",
    "ISOLATED_ROOT_MECHANISM": "rootIsolation",
    "GUEST_ROOT_ISOLATION": "rootIsolation",
    "ISOLATED_ROOT_HOST_FS_NEGATIVE": "hostFSNegative",
    "GUEST_NETWORK_ISOLATION_MECHANISM": "networkIsolation",
    "ISOLATED_BUILD_NETWORK": "networkIsolation",
    "ISOLATED_BUILD_NETWORK_NEGATIVE": "networkNegative",
    "GUEST_NO_NEW_PRIVS": "noNewPrivs",
    "GUEST_PRIVILEGE_DROP": "privilegeDrop",
    "GUEST_PRIVILEGE_REGAIN_NEGATIVE": "privilegeRegainNegative",
    "PROOF_MODE_CAPSULE_SELF_CONTAINED": "selfContained",
}
PROOF_PREFIX = "G3A_ISOLATION_PROOF_V1 "
HANDOFF_PREFIX = "G3A_HANDOFF_V1 "
MAX_MESSAGE_BYTES = 16384
MAX_EVIDENCE_BYTES = 262144
ROOT_MECHANISM = "clone(CLONE_NEWNS|CLONE_NEWNET)+private-bind-readonly+chroot(no-proc)"
NETWORK_MECHANISM = "CLONE_NEWNET_DISCONNECTED_LOOPBACK_NO_USABLE_ROUTES"


class ParseError(ValueError):
    """Malformed/incomplete output; parent may perform its one safe diagnostic."""


def _require(condition, code):
    if not condition:
        raise ParseError(code)


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        _require(key not in result, "DUPLICATE_JSON_KEY")
        result[key] = value
    return result


def _constant(value):
    raise ParseError("NONFINITE_JSON_NUMBER")


def _utf8(raw):
    try:
        return raw.encode("utf-8")
    except UnicodeEncodeError as exc:
        raise ParseError("INVALID_UTF8_TEXT") from exc


def _json(raw, limit):
    _require(isinstance(raw, str), "EXPECTED_JSON_TEXT")
    _require(len(_utf8(raw)) <= limit, "OUTPUT_BOUND_EXCEEDED")
    try:
        result = json.loads(raw, object_pairs_hook=_pairs, parse_constant=_constant)
    except (ValueError, RecursionError) as exc:
        raise ParseError("INVALID_OR_TRUNCATED_JSON: " + str(exc)) from exc
    _require(isinstance(result, dict), "EXPECTED_JSON_OBJECT")
    return result


def _marker(text, prefix):
    lines = [line for line in text.splitlines() if prefix.rstrip() in line]
    _require(len(lines) == 1, "MISSING_OR_AMBIGUOUS_" + prefix.strip())
    _require(lines[0].startswith(prefix), "MALFORMED_MARKER_PREFIX")
    return _json(lines[0][len(prefix):], 4096)


def _hash(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None


def _integer(value):
    return type(value) is int


def _evidence(raw, expected_sha):
    result = _json(raw, MAX_EVIDENCE_BYTES)
    _require(hashlib.sha256(_utf8(raw)).hexdigest() == expected_sha,
             "FULL_EVIDENCE_HASH_MISMATCH")
    return result


def parse(message):
    """Accept raw stdout or {message, baselineJson?, proofJson?, runtimeJson?}.

    Optional evidence values are EXACT UTF-8 file/output text, not reserialized
    objects. Missing full evidence stays explicitly unavailable, never fabricated.
    Extension success and permission to mark PROVEN remain the parent's decision.
    """
    envelope = {"message": message} if isinstance(message, str) else message
    _require(isinstance(envelope, dict), "EXPECTED_MESSAGE_OR_ENVELOPE")
    _require(set(envelope) <= {"message", "baselineJson", "proofJson", "runtimeJson"},
             "UNKNOWN_ENVELOPE_FIELD")
    text = envelope.get("message")
    _require(isinstance(text, str), "EXPECTED_MESSAGE_TEXT")
    _require(len(_utf8(text)) <= MAX_MESSAGE_BYTES, "MESSAGE_BOUND_EXCEEDED")
    proof = _marker(text, PROOF_PREFIX)
    handoff = _marker(text, HANDOFF_PREFIX)
    for obj, schema in ((proof, "g3a-isolation-proof/v1"), (handoff, "g3a-handoff/v1")):
        _require(obj.get("schema") == schema and obj.get("mode") == "--guest-isolation-proof",
                 "SCHEMA_OR_MODE_MISMATCH")
        _require(obj.get("candidateSha256") == CANDIDATE_SHA and
                 _integer(obj.get("candidateBytes")) and obj["candidateBytes"] == CANDIDATE_BYTES,
                 "CANDIDATE_BINDING_MISMATCH")
        _require(isinstance(obj.get("outcome"), str) and obj["outcome"] in {"PASS", "FAIL"},
                 "INVALID_OUTCOME")
    _require(handoff.get("shimSha256") == SHIM_SHA and
             _integer(handoff.get("shimBytes")) and handoff["shimBytes"] == SHIM_BYTES,
             "HANDOFF_BINDING_MISMATCH")
    _require(_integer(handoff.get("capsuleExit")) and 0 <= handoff["capsuleExit"] <= 255,
             "MISSING_OR_INVALID_CAPSULE_EXIT")
    checks = proof.get("checks")
    _require(isinstance(checks, dict) and set(checks) == CHECKS, "MISSING_OR_UNKNOWN_CHECK")
    _require(all(isinstance(v, str) and v in {"PASS", "FAIL", "UNSUPPORTED", "NOT_RUN"}
                 for v in checks.values()), "INVALID_CHECK_STATUS")
    _require(_integer(proof.get("embeddedFileCount")) and proof["embeddedFileCount"] == 141 and
             proof.get("embeddedCensusSha256") == CENSUS_SHA, "EMBEDDED_CENSUS_BINDING_MISMATCH")
    for key in ("baselineSha256", "evidenceSha256"):
        _require(_hash(proof.get(key)), "MISSING_OR_INVALID_EVIDENCE_HASH")
    if "runtimeEvidenceSha256" in proof:
        _require(_hash(proof["runtimeEvidenceSha256"]), "INVALID_RUNTIME_HASH")
    if "runtimeCensusCount" in proof:
        _require(_integer(proof["runtimeCensusCount"]) and proof["runtimeCensusCount"] > 0,
                 "INVALID_RUNTIME_COUNT")
    _require(isinstance(proof.get("evidenceFile"), str) and
             re.fullmatch(r"\.g3a-isolation-proof-[0-9]+/proof\.json", proof["evidenceFile"]),
             "UNSAFE_OR_MISSING_EVIDENCE_REFERENCE")
    for obj in (proof, handoff):
        for key in ("failedPrimitive", "failedOperation", "errorCode"):
            if key in obj:
                _require(isinstance(obj[key], str) and 0 < len(obj[key]) <= 256,
                         "INVALID_FAILURE_DETAIL")
    passed = proof["outcome"] == "PASS"
    if passed:
        _require(all(v == "PASS" for v in checks.values()) and
                 not any(k in proof for k in ("failedPrimitive", "failedOperation", "errorCode")),
                 "CONTRADICTORY_PROOF_PASS")
        _require(_hash(proof.get("runtimeEvidenceSha256")) and
                 _integer(proof.get("runtimeCensusCount")) and proof["runtimeCensusCount"] > 0,
                 "MISSING_RUNTIME_PROOF")
    else:
        _require(any(v != "PASS" for v in checks.values()) and
                 bool(proof.get("failedPrimitive")) and bool(proof.get("errorCode")),
                 "INADEQUATE_STRUCTURED_FAILURE")
    _require((handoff["outcome"] == "PASS") == (handoff["capsuleExit"] == 0),
             "CONTRADICTORY_HANDOFF_EXIT")
    _require(not (handoff["outcome"] == "PASS" and "errorCode" in handoff),
             "CONTRADICTORY_HANDOFF_PASS")
    _require(passed or handoff["outcome"] == "FAIL", "CONTRADICTORY_MARKER_OUTCOMES")
    baseline = None
    full = None
    runtime = None
    if "baselineJson" in envelope:
        baseline = _evidence(envelope["baselineJson"], proof["baselineSha256"])
    if "proofJson" in envelope:
        full = _evidence(envelope["proofJson"], proof["evidenceSha256"])
        for key, value in proof.items():
            if key != "evidenceSha256":
                _require(full.get(key) == value, "FULL_PROOF_MARKER_MISMATCH")
        _require(isinstance(full.get("baseline"), dict), "FULL_BASELINE_MISSING")
        if baseline is not None:
            _require(full["baseline"] == baseline, "BASELINE_EVIDENCE_MISMATCH")
        baseline = full["baseline"]
        details = full.get("details", {})
        _require(isinstance(details, dict), "INVALID_RUNTIME_DETAILS")
        runtime = details.get("runtimeSelfTest")
        _require(runtime is None or isinstance(runtime, dict), "INVALID_RUNTIME_EVIDENCE")
    if "runtimeJson" in envelope:
        _require(_hash(proof.get("runtimeEvidenceSha256")), "UNEXPECTED_RUNTIME_EVIDENCE")
        supplied = _evidence(envelope["runtimeJson"], proof["runtimeEvidenceSha256"])
        _require(runtime is None or supplied == runtime, "RUNTIME_EVIDENCE_MISMATCH")
        runtime = supplied
    baseline_keys = {"architecture", "kernel", "cwd", "status", "namespaces", "relevantMountState"}
    if baseline is not None:
        _require(baseline_keys <= set(baseline) and isinstance(baseline["status"], dict) and
                 isinstance(baseline["namespaces"], dict) and
                 isinstance(baseline["relevantMountState"], list), "INVALID_FULL_BASELINE")
        _require(all(isinstance(baseline[key], str) and baseline[key]
                     for key in ("architecture", "kernel", "cwd")) and
                 {"Uid", "Gid", "CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb",
                  "NoNewPrivs", "Seccomp"} <= set(baseline["status"]) and
                 all(isinstance(v, str) for v in baseline["status"].values()) and
                 {"mnt", "net", "pid", "user", "uts", "ipc", "cgroup"} <= set(baseline["namespaces"]) and
                 all(isinstance(v, str) for v in baseline["namespaces"].values()) and
                 bool(baseline["relevantMountState"]) and
                 all(isinstance(v, str) for v in baseline["relevantMountState"]),
                 "INCOMPLETE_FULL_BASELINE")
    checks_passed = passed and handoff["outcome"] == "PASS" and handoff["capsuleExit"] == 0
    evidence_complete = baseline is not None and full is not None and (not passed or runtime is not None)
    insufficient = checks_passed and not evidence_complete
    outcomes = {key: checks[value] for key, value in OUTCOME_MAP.items()}
    if outcomes["GUEST_MOUNT_NAMESPACE"] == "PASS":
        outcomes["GUEST_MOUNT_NAMESPACE"] = "SUPPORTED"
    if outcomes["ISOLATED_ROOT_MECHANISM"] == "PASS":
        outcomes["ISOLATED_ROOT_MECHANISM"] = ROOT_MECHANISM
    if outcomes["GUEST_NETWORK_ISOLATION_MECHANISM"] == "PASS":
        outcomes["GUEST_NETWORK_ISOLATION_MECHANISM"] = NETWORK_MECHANISM
    outcomes["BOOTSTRAP_TO_CAPSULE_HANDOFF"] = (
        "QUALIFIED" if handoff["outcome"] == "PASS" else handoff["outcome"])
    return {
        "candidateSha256": CANDIDATE_SHA, "shimSha256": SHIM_SHA,
        "allPassed": checks_passed and evidence_complete, "checksAllPassed": checks_passed,
        **outcomes, "outcomes": outcomes,
        **checks, "checks": dict(checks), "baselineOutcome": checks["baseline"],
        "isolationOutcome": proof["outcome"], "handoffOutcome": handoff["outcome"],
        "capsuleExit": handoff["capsuleExit"], "failedPrimitive": proof.get("failedPrimitive"),
        "failedOperation": proof.get("failedOperation"), "errorCode": proof.get("errorCode"),
        "handoffErrorCode": handoff.get("errorCode"), "structuredOutputAdequate": not insufficient,
        "diagnosticRequired": insufficient, "extensionSuccessRequiredSeparately": True,
        "evidenceComplete": evidence_complete,
        "evidenceRetentionRequiredBeforeCleanup": not evidence_complete,
        "insufficientOutputReason": "FULL_BASELINE_AND_RUNTIME_NOT_RETAINED" if insufficient else None,
        "baselineCaptureState": ("GUEST_CAPTURED_HASH_BOUND_FILE" if checks["baseline"] == "PASS"
                                 else checks["baseline"]),
        "controllerBaselineView": "FULL_HASH_VERIFIED" if baseline is not None else "HASH_ONLY",
        "mechanismStatusMeaning": "Aliases of actual root/network boundary checks; not independent probes",
        "mechanisms": {
            "sourceBoundRoot": ROOT_MECHANISM,
            "sourceBoundNetwork": NETWORK_MECHANISM,
            "observedIsolationDetailsAvailable": full is not None,
        },
        "baselineSha256": proof["baselineSha256"], "evidenceSha256": proof["evidenceSha256"],
        "runtimeEvidenceSha256": proof.get("runtimeEvidenceSha256"),
        "runtimeCensusCount": proof.get("runtimeCensusCount"),
        "baselineEvidence": baseline, "runtimeEvidence": runtime, "fullProofEvidence": full,
        "baselineStatus": baseline["status"] if baseline is not None else None,
        "baselineNamespaces": baseline["namespaces"] if baseline is not None else None,
        "baselineMountState": baseline["relevantMountState"] if baseline is not None else None,
        "isolationEvidence": full.get("details", {}) if full is not None else None,
        "fullBaselineAvailable": baseline is not None, "fullRuntimeAvailable": runtime is not None,
        "fullEvidenceAvailability": "SUPPLIED_HASH_VERIFIED" if full else "HASH_BOUND_REFERENCE_ONLY",
        "evidenceReference": {
            "proofFile": proof["evidenceFile"],
            "baselineFile": proof["evidenceFile"].rsplit("/", 1)[0] + "/baseline.json",
            "baselineSha256": proof["baselineSha256"], "proofSha256": proof["evidenceSha256"],
            "runtimeEvidenceSha256": proof.get("runtimeEvidenceSha256"),
            "runtimeCensusCount": proof.get("runtimeCensusCount"),
        },
        "provenance": {
            "schema": proof["schema"], "handoffSchema": handoff["schema"],
            "candidateBytes": CANDIDATE_BYTES, "shimBytes": SHIM_BYTES,
            "embeddedFileCount": 141, "embeddedCensusSha256": CENSUS_SHA,
            "candidateSourceSha256": "f62032f21813d6b118c40d5e6a4661d9bee97f78cec4ef86290dc15004d86054",
            "classification": "CAPSULE_EMBEDDED", "liveQualificationClaimedByParser": False,
        },
        "proof": proof, "handoff": handoff,
    }
