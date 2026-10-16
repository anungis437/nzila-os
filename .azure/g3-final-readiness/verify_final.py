"""Local validation and exclusive blocked-readiness seal; no Azure execution."""

import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import unittest

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
AUTHORITY = Path(
    r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData"
    r"\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments"
    r"\ea14d3b2-98df-4b45-8fdb-1439112afaef\Pasted text #1.txt"
)
GENERATED = {
    "FINAL_READINESS_DISPOSITION.json", "FINAL_READINESS_LOCAL_VALIDATION.json",
    "FINAL_READINESS_VERIFICATION.json", "FINAL_READINESS_INDEPENDENT_VERIFICATION.json",
}


def require(value, code):
    if not value:
        raise RuntimeError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def fresh(name, value):
    with (HERE / name).open("x", encoding="utf-8", newline="\n") as file:
        json.dump(value, file, indent=2)
        file.write("\n")


def preserved_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=120, cwd=HERE)
    require(result.returncode == 0, "LOCAL_VALIDATION_FAILED: " + result.stdout + result.stderr)
    return result


def main():
    require(not any((HERE / name).exists() for name in GENERATED), "DO_NOT_OVERWRITE_EXISTING_SEAL")
    census = preserved_module("old_seal", HERE.parent / "g3-live-readiness" / "seal_live.py")
    preservation = census.preservation()
    live = HERE.parent / "g3-live-readiness"
    live_root = load(live / "LIVE_READINESS_FINAL_VERIFICATION.json")
    require(sha(live / "LIVE_READINESS_FINAL_VERIFICATION.json") ==
            "bcdbe75ff8be1a82c852b37399978771fcd0acdaf1d1ae69ea0211e73563524b", "LIVE_ROOT_CHANGED")
    current = {str(path.relative_to(live)): sha(path) for path in live.rglob("*") if path.is_file()
               and path.name not in {"LIVE_READINESS_FINAL_VERIFICATION.json",
                                     "LIVE_READINESS_INDEPENDENT_VERIFICATION.json"}}
    require(current == live_root["liveReadinessFileHashes"], "SEALED_LIVE_CENSUS_CHANGED")
    preservation["rootHashes"][str((live / "LIVE_READINESS_FINAL_VERIFICATION.json").relative_to(ROOT))] = sha(
        live / "LIVE_READINESS_FINAL_VERIFICATION.json")
    preservation["liveFileHashes"] = current
    preservation["liveIndependentSha256"] = sha(live / "LIVE_READINESS_INDEPENDENT_VERIFICATION.json")
    before = census.snapshot(ROOT)
    foreign = census.snapshot(Path(r"C:\APPS\nzila-os"))
    require(before["head"] == "7bec20aad11d43eeae8099c14e021b3074154b27", "ISOLATED_HEAD_DRIFT")
    require(before["status"] == ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"], "ISOLATED_STATUS_DRIFT")

    qualifier = preserved_module("old_qualifier", HERE.parent / "g3-readiness" / "qualify_local.py")
    image_records = []
    for folder in ("local-image-qualification", "local-image-final", "local-image-frozen"):
        directory = HERE / folder
        record = load(directory / "LOCAL_IMAGE_QUALIFICATION.json")
        require(sha(directory / "source.tar") == record["sourceAuthoritySha256"], "SOURCE_ARCHIVE_AUTHORITY")
        observations = [qualifier.inspect(directory / ("image-run" + str(index) + ".tar")) for index in (1, 2)]
        require(observations == record["observations"] and observations[0] == observations[1], "OCI_EQUIVALENCE")
        for index in (1, 2):
            log = (directory / ("build-run" + str(index) + ".log")).read_text()
            require("go test ./..." in log and "go vet ./..." in log, "BUILD_TEST_VET_STEPS_MISSING")
        image_records.append({"directory": folder, "sourceAuthority": record["sourceAuthoritySha256"],
                              "manifest": observations[0]["manifestDigest"], "status": "PASS"})
    image = load(HERE / "local-image-frozen" / "LOCAL_IMAGE_QUALIFICATION.json")
    for name, expected in image["sourceFileHashes"].items():
        require("sha256:" + sha(HERE / "runtime" / name) == expected, "FROZEN_CURRENT_SOURCE_CHANGED")
    smoke = load(HERE / "local-image-frozen" / "LOCAL_CONTAINER_SMOKE.json")
    require(smoke["status"] == "PASS" and smoke["gracefulStopExitCode"] == 0 and smoke["nonRoot"], "SMOKE_FAILED")
    require(smoke["imageManifestDigest"] == image["observations"][0]["manifestDigest"], "SMOKE_IMAGE_BINDING")
    require(smoke["localExecutableSha256"] == sha(HERE / "local-image-frozen" / "g3-runtime"), "SMOKE_ELF_BINDING")
    require(smoke["network"] == "none" and smoke["publishedPorts"] == [] and
            smoke["transactionContainerResiduals"] == [] and not smoke["privateSigningKeyPersisted"], "SMOKE_ISOLATION")

    suite = unittest.defaultTestLoader.discover(str(HERE), pattern="test_transaction_guards.py")
    tests = unittest.TextTestRunner(verbosity=2).run(suite)
    require(tests.wasSuccessful() and tests.testsRun == 5, "GUARD_TEST_FAILURE")
    bicep_checks = []
    executable = Path(r"C:\Users\AubertNungisa\.azure\bin\bicep.exe")
    for source in sorted((HERE / "bicep").glob("*.bicep")):
        for operation, args in (
            ("build", [str(executable), "build", str(source), "--stdout"]),
            ("lint", [str(executable), "lint", str(source)]),
        ):
            result = run(args)
            require(not result.stderr.strip(), "BICEP_WARNINGS: " + result.stderr)
            if operation == "build":
                require(json.loads(result.stdout) == load(source.with_suffix(".json")), "COMPILED_PHASE_DRIFT")
            bicep_checks.append({"file": source.name, "operation": operation, "result": "PASS", "stderr": ""})
    env_template = load(HERE / "bicep" / "environment-phase.json")
    app_template = load(HERE / "bicep" / "application-phase.json")
    require([item["type"] for item in env_template["resources"]] == ["Microsoft.App/managedEnvironments"],
            "ENVIRONMENT_PHASE_CONTAINS_WORKLOAD")
    require([item["type"] for item in app_template["resources"]] == ["Microsoft.App/containerApps"],
            "APPLICATION_PHASE_RECREATES_ENVIRONMENT")
    app = app_template["resources"][0]
    require(len(app["identity"]["userAssignedIdentities"]) == 2, "APPLICATION_IDENTITY_CENSUS")
    require([item["lifecycle"] for item in app["properties"]["configuration"]["identitySettings"]] ==
            ["None", "Main"], "APPLICATION_IDENTITY_LIFECYCLES")
    config_names = {item["name"] for item in app["properties"]["template"]["containers"][0]["env"]}
    require({"G3_RUNTIME_PRINCIPAL_ID", "G3_PULL_CLIENT_ID", "G3_CHALLENGE_ID",
             "G3_EXPECTED_SECRET_SHA256"}.issubset(config_names), "MISSING_INSTRUMENTATION_CONFIGURATION")
    require("IDENTITY_ENDPOINT" not in config_names and "IDENTITY_HEADER" not in config_names, "PLATFORM_IDENTITY_OVERRIDE")

    events = [json.loads(line) for line in (HERE / "AZURE_READ_ONLY_LEDGER.jsonl").read_text().splitlines()]
    require(len(events) == 8, "READ_LEDGER_CENSUS")
    for start, end in zip(events[::2], events[1::2]):
        require(start["event"] == "START" and end["event"] == "COMPLETE" and start["name"] == end["name"],
                "READ_LEDGER_CORRELATION")
        command = start["command"]
        require(command[1:4] == ["rest", "--method", "GET"] or command[1:3] == ["resource", "list"], "READ_ONLY_VIOLATION")
        require(start["mutations"] == end["mutations"] == 0 and end["exitCode"] == 0, "READ_FAILURE_OR_MUTATION")
        response = load(HERE / end["responseFile"])
        require(response["exitCode"] == 0 and response["azureMutationCount"] == 0, "READ_RESPONSE_CORRELATION")
    for name in ("EXECUTOR_SP_OWNERS", "EXECUTOR_APP_OWNERS"):
        response = load(HERE / (name + ".json"))["response"]
        require(response["owners"] == [] and response["nextLink"] is None, "EXECUTOR_REVIEW_CHANGED")
    directory = load(HERE / "DIRECTORY_CAPACITY.json")["response"]
    require(directory["nextLink"] is None and len(directory["organizations"]) == 1, "DIRECTORY_CENSUS")
    organization = directory["organizations"][0]
    require(organization["id"] == "5082b8be-b04d-4a13-b61c-b6397670177b", "DIRECTORY_TENANT")
    quota = organization["directorySizeQuota"]
    require(quota == {"total": 500000, "used": 1183}, "DIRECTORY_SIZE_BINDING")
    estate = load(HERE / "PROTECTED_G2_RESOURCES.json")["response"]
    require(len(estate) == 16 and len({item["id"] for item in estate}) == 16, "PROTECTED_ESTATE_CHANGED")
    cost = load(HERE / "COST_MODEL.json")
    from cost_model import model
    require(cost == model(), "COST_MODEL_ARITHMETIC_OR_BINDING")
    for key in ("G3_EXPECTED_PROOF_COST_CAD", "G3_PROOF_COST_CEILING_CAD"):
        require(cost[key] == "UNRESOLVED", "PARTIAL_COST_MISREPRESENTED_AS_TOTAL")

    for source in HERE.rglob("*.py"):
        compile(source.read_text(encoding="utf-8"), str(source), "exec")
    require(not list(HERE.rglob("*.pyc")), "UNEXPECTED_PERSISTENT_BYTECODE")
    run(["git", "-C", str(ROOT), "--no-pager", "diff", "--check"])
    whitespace_files = []
    for source in sorted(HERE.rglob("*")):
        if source.is_file() and (source.suffix in {".py", ".go", ".mod", ".bicep", ".md", ".json"}
                                or source.name in {"Dockerfile", ".dockerignore"}):
            result = subprocess.run(["git", "-c", "core.safecrlf=false", "diff", "--no-index", "--check",
                                     "--", "NUL", str(source)], capture_output=True, text=True)
            require(result.returncode in (0, 1) and not result.stdout and not result.stderr,
                    "WHITESPACE_FAILURE: " + str(source))
            whitespace_files.append(str(source.relative_to(HERE)))
    links = re.findall(r"\[[^\]]*\]\(([^)]+)\)", (HERE / "FINAL_READINESS_CLOSURE.md").read_text())
    for target in links:
        path = (HERE / target).resolve()
        require(path.exists() or path.parent == HERE and path.name in GENERATED, "REPORT_LINK_MISSING: " + target)
    require(census.snapshot(ROOT) == before, "WRITE_BATCH_ISOLATED_CONCURRENCY_DRIFT")

    matrix = []
    for name, identity, request, target in (
        ("PULL_UAMI_OTHER_REPO_READ", "PULL", "GET /v2/g2-tooling/tags/list?n=1", "g2-tooling"),
        ("PULL_UAMI_REGISTRY_WRITE", "PULL", "POST /v2/g3-synthetic-runtime/blobs/uploads/", "g3-synthetic-runtime"),
        ("PULL_UAMI_APP_TOKEN_ACCESS", "PULL_FROM_APP_MAIN", "GET /proof/pull-token", "ACA local identity endpoint"),
        ("RUNTIME_UAMI_ACR_READ", "RUNTIME", "GET /proof/runtime-acr-read", "g3-synthetic-runtime"),
        ("RUNTIME_UAMI_ACR_WRITE", "RUNTIME", "GET /proof/runtime-acr-write", "g3-synthetic-runtime"),
        ("RUNTIME_UAMI_BUILD_REPO_ACCESS", "RUNTIME", "GET /proof/runtime-build-read", "g2-tooling"),
        ("RUNTIME_UAMI_UNAUTHORIZED_SECRET_READ", "RUNTIME", "GET /proof/secret-denied", "g3-forbidden-reference"),
        ("PUBLIC_RUNTIME_ACCESS", "UNAUTHENTICATED_PUBLIC_CALLER", "GET /health", "runtime returned internal FQDN"),
    ):
        matrix.append({"name": name, "identity": identity, "request": request, "target": target,
                       "expected": "DENIED", "execution": "NOT_EXECUTED",
                       "callerController": "UNWIRED",
                       "acceptance": (
                           "INTERNAL_ENV_AND_PRIVATE_POSITIVE_CONTROL_AND_INDEPENDENT_PUBLIC_OBSERVER; "
                           "NETWORK_BOUNDARY_DENIAL_NOT_RBAC_DENIAL"
                           if name == "PUBLIC_RUNTIME_ACCESS" else
                           "LOCAL_IDENTITY_HTTP403; HTTP400_CONFIG_FAILURE_IS_INCONCLUSIVE"
                           if name == "PULL_UAMI_APP_TOKEN_ACCESS" else
                           "AUTHENTICATED_KV403_WITH_ForbiddenByRbac; FIREWALL403_AND404_INCONCLUSIVE"
                           if name.endswith("SECRET_READ") else
                           "TOKEN_SELECTED_IDENTITY_AND_PRIVATE_VERIFIED_TLS_AND_BOUND_TARGET_HTTP401_OR403; "
                           "DNS_TLS_REDIRECT404_OR500_INCONCLUSIVE")})
    outputs = {
        "G3_EXECUTION_READINESS": "BLOCKED",
        "G3_MANAGED_IDENTITY_QUOTA": "PASS_DOCUMENTED_LIMIT",
        "G3_CONSUMPTION_CORE_QUOTA": "DEFERRED_RUNTIME_CHECK",
        "G3_CONSUMPTION_QUOTA_GATE": "DEFERRED_FAIL_CLOSED",
        "G3_EGRESS_ARCHITECTURE": "NO_FORCED_TUNNEL",
        "G3_EGRESS_INSPECTION": "NOT_PROVEN",
        "G3_FIREWALL_UDR_MODEL": "NOT_SELECTED",
        "G3_EXECUTOR_IDENTITY": "NONE",
        "G3_EXECUTOR_PERMISSION_MODEL": "BLOCKED",
        "G3_SECRET_BOOTSTRAP_MODEL": "BLOCKED",
        "G3_ACCOUNTABLE_MAINTAINER": "BOUND",
        "G3_RISK_OWNER": "BOUND",
        "G3_IMAGE_MANIFEST_DIGEST": image["observations"][0]["manifestDigest"],
        "G3_SOURCE_AUTHORITY": image["sourceAuthoritySha256"],
        "G3_PROOF_SURFACE_EXPOSURE": "PRIVATE_AUTHENTICATED",
        "G3_PROOF_SURFACE_SCOPE": "CANDIDATE_INTERNAL_DESIGN_AND_LOCAL_AUTH_TESTS_NOT_AZURE_EXPOSURE_PROOF",
        "G3A_BUILDER_MODEL": "NEW_TRANSIENT_G3A_PRIVATE_VM_DELIVERY_UNBOUND",
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3B_CONTROLLER": "INCOMPLETE", "G3B_BICEP_PACKAGE": "INCOMPLETE",
        "G3_EXPECTED_PROOF_COST_CAD": "UNRESOLVED", "G3_PROOF_COST_CEILING_CAD": "UNRESOLVED",
        "G3_EXPECTED_IDLE_MONTHLY_COST_CAD": cost["retainedStateCandidate"]["newArtifactOnlyBillableUpperBoundCADPerMonth"],
        "G3_IDLE_COST_SCOPE": "PROPOSED_IMAGE_ONLY_BILLABLE_BOUND_NOT_CURRENT_AZURE_IDLE_STATE",
        "G3_PLATFORM_EGRESS_BREADTH": "ACCEPTED_FOR_SYNTHETIC_PROOF",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "APPLICATION_ROLLOUT_AUTHORIZED": "NO", "PRODUCTION_DATA_AUTHORIZED": "NO",
        "AZURE_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0, "AZURE_READ_CALLS": 4,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "PROTECTED_G2_RESOURCE_COUNT": 16,
        "G3_PRIVATE_APPLICATION_SUBSTRATE": "NOT_EXECUTED",
        "TARGET_REGISTRY_IMAGE_PRESENT": "NOT_PROVEN",
        "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "remainingBlockers": [
            {"id": "executor-bootstrap", "detail": "No lifecycle-owned G3 executor, grant executor or private one-time secret author is bound."},
            {"id": "transaction-delivery", "detail": "No executable private builder/compiler/artifact/probe transport, VM image contract or complete G3A/G3B controller/top-level package."},
            {"id": "all-in-cost-ceiling", "detail": "Delivery/probe resources, final traffic/endpoint quantities and Standard secret-operation billing mapping remain unbound."},
        ],
        "negativeTestMatrix": matrix,
    }
    fresh("FINAL_READINESS_DISPOSITION.json", outputs)
    fresh("FINAL_READINESS_LOCAL_VALIDATION.json", {
        "status": "PASS", "scope": "LOCAL_COMPONENT_VALIDATION_NOT_COMPLETE_TRANSACTION_PACKAGE",
        "guardTests": tests.testsRun, "bicepChecks": bicep_checks,
        "goTestsAndVet": "PASS_IN_TWO_OFFLINE_FROZEN_BUILDS", "imageQualifications": image_records,
        "localSmoke": "PASS", "syntax": "PASS", "costRecalculation": "PASS_PARTIAL_MODEL",
        "whitespaceCheckedFiles": whitespace_files, "trackedGitDiffCheck": "PASS",
        "topLevelG3AAndG3BBuildLint": "NOT_RUN_PACKAGES_INCOMPLETE",
        "AzureValidationWhatIfDeploymentGuestExecution": "NOT_EXECUTED",
        "reportLinks": links,
    })
    bound = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*") if path.is_file()}
    fresh("FINAL_READINESS_VERIFICATION.json", {
        "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "PASS", "meaning": "EVIDENCE_INTEGRITY_AND_HONEST_BLOCKED_RULING_NOT_EXECUTION_READINESS",
        "authorityPath": str(AUTHORITY), "authoritySha256": sha(AUTHORITY),
        "concurrency": {"isolated": before, "sharedForeign": foreign, "foreignDisposition": "NONE"},
        "preservation": preservation, "finalReadinessFileHashes": bound,
        "G3_EXECUTION_READINESS": "BLOCKED", "AZURE_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
    })
    print(json.dumps({"status": "PASS", "G3_EXECUTION_READINESS": "BLOCKED",
                      "rootSha256": sha(HERE / "FINAL_READINESS_VERIFICATION.json"),
                      "boundFiles": len(bound)}, indent=2))


if __name__ == "__main__":
    main()
