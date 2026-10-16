"""New authority, additive V1 interpretation correction; historical bytes stay frozen."""

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
sys.path.insert(0, str(BASE / "g3a-transaction-integration-stop"))
from record_stop import baseline

AUTHORITY = Path(
    r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4"
    r"\attachments\18ca65e2-85b9-4758-b65a-bea7ec5efb17\Pasted text #1.txt")


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def fresh(name, value):
    with (HERE / name).open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def protected():
    root = BASE / "g3a-hard-capacity/FINAL_VERIFICATION.json"
    stop = BASE / "g3a-transaction-integration-stop/VERIFICATION.json"
    require(sha(root) == "e5a652df093781d51d225119d3ded4849fe44e2f5cf8db13bf994e08b78d5f0e",
            "V1_QUALIFIED_ROOT_CHANGED")
    require(sha(stop) == "220230442c5eaf79fc02645b2d1c1ac39089285b5e019134e381fd15399ab6ea",
            "INTEGRATION_STOP_ROOT_CHANGED")
    values = {str(root): sha(root), str(stop): sha(stop)}
    for group in ("fileHashes", "protectedFileHashes"):
        values.update(load(root)[group])
    values.update(load(stop)["fileHashes"])
    for path, expected in values.items():
        require(sha(path) == expected, "HISTORICAL_REFERENCE_CHANGED_" + path)
    return values


def main():
    fresh("CONCURRENCY_PREPARE.json", baseline())
    old = protected()
    runner = BASE / "g3a-hard-runner-candidate/production-runner"
    require(sha(runner) == "9889228f05e27a95593ba02e44e54127985175d4748bf98e0c6600bb662d1273" and
            runner.stat().st_size == 28094588, "V1_BYTES_CHANGED")
    fresh("AUTHORITY_BINDING.json", {
        "mission": "NZ-20261008-INFRA-001", "gate": "G3_PRIVATE_APPLICATION_SUBSTRATE",
        "path": str(AUTHORITY), "sha256": sha(AUTHORITY), "protectedFileHashes": old,
        "runnerV2SourceDelta": "AUTHORITY_BOUNDARY_ONLY",
        "localV2FrozenBuildQualificationAuthorized": True,
        "newPinnedGuestProofAuthority": True, "maximumLiveAttempts": 1,
        "liveConsumptionBoundary": "FIRST_AZURE_MUTATION", "proofCostCeilingCAD": "3.00",
        "liveAuthorityConsumed": False, "outerFullTransactionExecuted": False,
        "LOCAL_FULL_TRANSACTION_ALLOWANCE_REMAINING": 1,
        "G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED": "NO", "G3A_EXECUTION_AUTHORIZED": "NO",
        "G3B_EXECUTION_AUTHORIZED": "NO", "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "UTC": datetime.now(timezone.utc).isoformat(),
    })
    fresh("V1_INTERPRETATION_CORRECTION.json", {
        "RUNNER_V1_UNCHANGED": "YES",
        "RUNNER_V1_SHA256": sha(runner), "RUNNER_V1_BYTES": runner.stat().st_size,
        "RUNNER_V1_ROLE": "QUALIFIED_EXECUTION_CORE_PROOF_ARTIFACT",
        "RUNNER_V1_PRODUCTION_INVOCABLE": "NO",
        "RUNNER_V1_QUALIFICATION": "EXECUTION_CORE_AND_PROOF_RUNNER_QUALIFIED",
        "retiredInterpretation": "FINAL_PRODUCTION_RUNNER_QUALIFIED",
        "defect": "PRODUCTION_AUTHORIZATION_INJECTION_MODEL",
        "priorProofResults": "PRESERVED_PASS_NOT_REWRITTEN",
        "isolationHardCapacityDevicePinnedGuestEvidence": "QUALIFIED",
        "compileTimeTransactionAuthorityModel": "TO_BE_RETIRED_IN_V2_NOT_CHANGED_IN_V1",
        "correctionAuthorityPath": str(AUTHORITY), "correctionAuthoritySHA256": sha(AUTHORITY),
    })
    fresh("CONTEXT_MAP.json", {
        "reviewedAgainstAuthority": True, "historicalFilesModified": [],
        "newParentLane": str(HERE), "newSourceLane": str(BASE / "g3a-runner-v2-source"),
        "referenceDependencies": [
            "g3a-hard-runner-candidate dispatch/production/launcher and normalized primitive verifiers",
            "g3a-controller-repair frozen15inputs and seven exact image outputs",
            "g3a-hard-live governed transport/lifecycle/cleanup and evidence accounting",
            "g3a-hard-runner-delivery strict tar/handoff/diagnostic prior art",
        ],
        "validation": [
            "Strict runtime authority temporal/scope/digest/input/file/capacity denies",
            "Source AST identities and ordered constructor primitives",
            "Actual V2 CLI positive synthetic qualification and one-shot duplicate denial",
            "Actual frozen build seven outputs, exact cleanup",
            "Conditional single pinned static-dispatch proof, no assembler or ACR",
        ],
        "risks": [
            "Stable source self-binding must not create hash circularity",
            "Caller-provided hash does not authenticate issuer; no hostile-root attestation claim",
            "Runtime envelope validation must apply to public and child dispatch",
            "Proof entry may not become unrestricted production execution path",
            "One-shot receipt must survive build failure, no automatic rerun",
        ],
    })
    print("V1_UNCHANGED_ADDITIVE_CORRECTION_PERSISTED")
    print("V2_NEW_AUTHORITY_UNCONSUMED_OUTER_ALLOWANCE_REMAINS_1")


if __name__ == "__main__":
    main()
