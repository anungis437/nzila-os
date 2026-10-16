"""Read-only prerequisite checks; no runner invocation or rehearsal dispatch."""

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
AUTHORITY = Path(
    r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4"
    r"\attachments\8d832fff-2b74-43e9-9c28-466658286019\Pasted text #1.txt")


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def baseline():
    rows = []
    for directory in (BASE.parent, Path(r"C:\APPS\nzila-os")):
        row = {"path": str(directory)}
        for key, args in (
            ("head", ["rev-parse", "HEAD"]),
            ("status", ["--no-pager", "status", "--short"]),
        ):
            result = subprocess.run(
                ["git", "-C", str(directory), *args],
                capture_output=True, text=True, timeout=60)
            require(result.returncode == 0, "CONCURRENCY_READ_FAILED")
            row[key] = result.stdout.strip().splitlines() if key == "status" else result.stdout.strip()
        rows.append(row)
    require(rows[0]["head"] == "7bec20aad11d43eeae8099c14e021b3074154b27" and
            rows[0]["status"] == ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"],
            "OWNED_WORKTREE_DRIFT")
    return rows


def main():
    concurrency = baseline()
    sealed_path = BASE / "g3a-hard-capacity/FINAL_VERIFICATION.json"
    require(sha(sealed_path) == "e5a652df093781d51d225119d3ded4849fe44e2f5cf8db13bf994e08b78d5f0e",
            "QUALIFIED_ROOT_CHANGED")
    sealed = load(sealed_path)
    checked = 0
    for group in ("fileHashes", "protectedFileHashes"):
        for path, expected in sealed[group].items():
            require(sha(path) == expected, "PROTECTED_BYTES_CHANGED_" + path)
            checked += 1
    candidate = BASE / "g3a-hard-runner-candidate"
    runner = candidate / "production-runner"
    require(sha(runner) == "9889228f05e27a95593ba02e44e54127985175d4748bf98e0c6600bb662d1273" and
            runner.stat().st_size == 28094588, "QUALIFIED_RUNNER_CHANGED")
    dispatch = (candidate / "dispatch.go").read_text()
    production = (candidate / "production_linux.go").read_text()
    launcher = (candidate / "launcher.go").read_text()
    require('const trustedExecutionAuthoritySHA256 = ""' in dispatch, "COMPILED_PIN_CHANGED")
    require('if trustedExecutionAuthoritySHA256 == "" {\n'
            '\t\treturn errors.New("FUTURE_EXECUTION_AUTHORITY_DIGEST_REQUIRED")\n\t}' in production,
            "EARLY_PRODUCTION_DENIAL_CHANGED")
    require(production.index('if trustedExecutionAuthoritySHA256 == ""') <
            production.index("raw, err := io.ReadAll(io.LimitReader(input, 16385))"),
            "REQUEST_READ_PRECEDES_DENIAL")
    require("return dispatchProduction(raw, trustedExecutionAuthoritySHA256, linuxProductionBackend{})" in production and
            'validateRequest([]byte(plan["production"]), trustedExecutionAuthoritySHA256)' in production and
            'if err := runProduction(os.Stdin); err != nil {' in launcher,
            "PUBLIC_OR_CHILD_PIN_BOUNDARY_CHANGED")
    disposition = {
        "mission": "NZ-20261008-INFRA-001",
        "authorityPath": str(AUTHORITY), "authoritySHA256": sha(AUTHORITY),
        "UTC": datetime.now(timezone.utc).isoformat(),
        "disposition": "STOP_IMMUTABLE_RUNNER_PRODUCTION_ENTRY_UNAVAILABLE",
        "stopBasis": "Authority section 1: if runner bytes would need to change, STOP.",
        "G3_EXECUTION_READINESS": "BLOCKED",
        "G3A_PRODUCTION_COMPATIBLE_RUNNER": "QUALIFIED",
        "RUNNER_SHA256": sha(runner), "RUNNER_BYTES": runner.stat().st_size,
        "RUNNER_SOURCE_SHA256": "418a34a10153dc4e653e62b3a282f438a8cc41a8454fae131f53a016806e3475",
        "G3A_LIVE_INPUT_ADAPTER": "INCOMPLETE",
        "G3A_INPUT_STAGING_CONTRACT": "QUALIFIED",
        "G3A_LIVE_BUILD_ADAPTER": "INCOMPLETE",
        "G3A_BUILD_RECEIPT": "INCOMPLETE",
        "G3A_LIVE_UPLOAD_ADAPTER": "INCOMPLETE",
        "G3A_LIVE_AUTH_NEGATIVE_ADAPTER": "INCOMPLETE",
        "G3A_IMMUTABLE_READBACK_CONTRACT": "INCOMPLETE",
        "G3A_TRANSACTION_EVIDENCE": "INCOMPLETE",
        "G3A_PRODUCTION_PAYLOAD_CENSUS": "INCOMPLETE",
        "G3A_TOTAL_PRIVATE_INPUT_BYTES": "UNRESOLVED",
        "G3A_TRANSACTION_STATE_MACHINE": "INCOMPLETE",
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3A_TRANSACTION_MEMORY_MAX_BYTES": 2147483648,
        "G3A_TRANSACTION_MEMORY_PEAK_BYTES": "UNRESOLVED",
        "G3A_MEMORY_ACCOUNTING_COVERAGE": "FAIL",
        "G3A_TRANSACTION_MEMORY_BOUND": "FAIL",
        "memoryStatusMeaning": "NOT_RUN_PREREQUISITE_BLOCKED_NOT_AN_OBSERVED_MEMORY_FAILURE",
        "B2S_MEMORY_PRECONDITION": "NOT_ENFORCED",
        "B2S_CPU_CREDIT_DEPENDENCY": "UNRESOLVED",
        "B2S_BASE_PERFORMANCE_MODELED_DURATION_SECONDS": "UNRESOLVED",
        "G3A_PRODUCTION_BUILDER_SKU": "BLOCKED",
        "G3A_RESOURCE_OWNERSHIP_MATRIX": "INCOMPLETE",
        "G3A_ROLE_OWNERSHIP_MATRIX": "INCOMPLETE",
        "G3A_EXPECTED_COST_CAD": "UNRESOLVED", "G3A_COST_CEILING_CAD": "UNRESOLVED",
        "G3A_COST_GATE_ENFORCED": "FAIL", "G3A_LIFETIME_BOUNDS_ENFORCED": "FAIL",
        "G3A_FAILURE_CLEANUP_MATRIX": "FAIL",
        "unearnedGateMeaning": "INCOMPLETE_OR_NOT_RUN_NOT_OBSERVED_FULL_TRANSACTION_FAILURE",
        "G3A_LOCAL_FULL_TRANSACTION": "NOT_RUN",
        "G3A_PRODUCTION_CAPSULE_SHA256": "NOT_CREATED",
        "G3A_PRODUCTION_CAPSULE_BYTES": "NOT_CREATED",
        "G3A_TRANSACTION_READINESS": "BLOCKED",
        "G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED": "NO", "G3A_EXECUTION_AUTHORIZED": "NO",
        "G3B_EXECUTION_AUTHORIZED": "NO", "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "AZURE_READS": 0, "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
        "AZURE_MUTATING_DISPATCHES": 0, "AZURE_SUCCESSFUL_MUTATING_DISPATCHES": 0,
        "AZURE_REJECTED_MUTATING_DISPATCHES": 0, "AZURE_DELETE_DISPATCHES": 0,
        "ROLE_ASSIGNMENT_CREATES": 0, "ROLE_ASSIGNMENT_DELETES": 0,
        "UAMI_CREATES": 0, "UAMI_DELETES": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "localRehearsalAuthorityConsumed": False, "localFullTransactionAllowanceRemaining": 1,
        "runnerInvocations": 0, "frozenCoreInvocations": 0, "candidateRebuilds": 0,
        "runnerQualificationReopened": False, "productionAuthorityIssued": False,
        "internalEntrypointOrStaticWitnessSubstitution": False,
        "sourceEvidence": {
            "compiledAuthorityDigest": "",
            "publicEntry": "<qualified-runner> --production",
            "sourceDerivedTerminalError": "FUTURE_EXECUTION_AUTHORITY_DIGEST_REQUIRED",
            "requestReadBeforeDenial": False,
            "requestOrOuterAuthorityCannotPopulateCompiledConstant": True,
            "childPathAlsoRequiresSameCompiledDigest": True,
            "files": {str(candidate / name): sha(candidate / name) for name in
                      ("dispatch.go", "production_linux.go", "launcher.go")},
        },
        "protectedHashReferencesVerified": checked,
        "qualifiedRootSHA256": sha(sealed_path),
        "concurrency": concurrency,
        "foreignStatusCount": len(concurrency[1]["status"]),
        "foreignWorkModifiedOrDispositioned": False,
        "nextDecisionRequired": "Resolve the immutable runner's empty compiled production-authority pin without assuming this outer-integration authority permits changing it.",
    }
    output = HERE / "FINAL_DISPOSITION.json"
    with output.open("x", encoding="utf-8") as stream:
        json.dump(disposition, stream, indent=2)
        stream.write("\n")
    receipt = {
        "status": "PASS_SOURCE_BOUND_STOP_EVIDENCE_ONLY",
        "fileHashes": {str(path): sha(path) for path in (Path(__file__), output, AUTHORITY)},
        "protectedHashReferencesVerified": checked,
        "runnerUnchanged": True, "runnerInvocations": 0, "localFullTransactionRuns": 0,
        "AzureReads": 0, "AzureMutations": 0,
    }
    with (HERE / "VERIFICATION.json").open("x", encoding="utf-8") as stream:
        json.dump(receipt, stream, indent=2)
        stream.write("\n")
    print(json.dumps({
        "disposition": disposition["disposition"], "protectedHashesVerified": checked,
        "localRehearsalAuthorityConsumed": False,
        "rootSHA256": sha(HERE / "VERIFICATION.json"),
    }))


if __name__ == "__main__":
    main()
