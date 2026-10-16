"""Exclusive local qualification and integrity seal; no cloud mutation."""

import ast
from decimal import Decimal
import datetime
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
ARCH = HERE.parent / "g3-execution-lane"
AUTHORITY = Path(
    r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData"
    r"\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments"
    r"\83f68713-e309-4f2f-b6d3-d5c7106ef427\Pasted text #1.txt"
)
OWNER = "a88c6cf4-adc7-4287-a553-53b93cd1f002"
SUB = "5d819f33-d16f-429c-a3c0-5b0e94740ba3"
TENANT = "5082b8be-b04d-4a13-b61c-b6397670177b"
PREFIX = "/subscriptions/" + SUB
G3_SCOPE = PREFIX + "/resourceGroups/nzila-shared-test-g3-001-rg"
OUTPUTS = (
    "OWNER_EXECUTOR_CONTRACT.json", "GRANT_OPERATION_PLAN.json", "INPUT_READINESS_COST.json",
    "INPUT_READINESS_DISPOSITION.json", "INPUT_READINESS_LOCAL_VALIDATION.json",
    "INPUT_READINESS_VERIFICATION.json", "INPUT_READINESS_INDEPENDENT_VERIFICATION.json",
)


def ensure(value, message):
    if not value:
        raise RuntimeError(message)


def sha(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def fresh(name, value):
    with (HERE / name).open("x", encoding="utf-8", newline="\n") as file:
        json.dump(value, file, indent=2)
        file.write("\n")


def snapshot(path):
    def run(*args):
        result = subprocess.run(["git", "-C", str(path), *args], capture_output=True, text=True, timeout=60)
        ensure(result.returncode == 0, "CONCURRENCY_READ_FAILURE")
        return result.stdout.strip()
    return {"path": str(path), "head": run("rev-parse", "HEAD"),
            "branch": run("branch", "--show-current"),
            "status": run("--no-pager", "status", "--short").splitlines()}


def history():
    expected = "c94423f8cd94ff415334e3d840505f52cc4e14cc1413e64fd2958d17984ee049"
    root_path = ARCH / "EXECUTION_LANE_VERIFICATION.json"
    ensure(sha(root_path) == expected, "EXECUTION_LANE_ROOT_CHANGED")
    root = load(root_path)
    excluded = {"EXECUTION_LANE_VERIFICATION.json", "EXECUTION_LANE_INDEPENDENT_VERIFICATION.json"}
    actual = {str(path.relative_to(ARCH)): sha(path) for path in ARCH.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(actual == root["executionLaneFileHashes"], "EXECUTION_LANE_FILE_CENSUS_CHANGED")
    hashes = {str(path.relative_to(ROOT)): sha(path) for path in ARCH.rglob("*") if path.is_file()}
    hashes.update(root["preservedPacketHashes"])
    hashes.update(root["priorPreservation"]["rootHashes"])
    for relative, digest in hashes.items():
        ensure(sha(ROOT / relative) == digest, "PRESERVED_PACKET_CHANGED: " + relative)
    for directory, filename, key, excluded_names in (
        ("g3-design", "DESIGN_VERIFICATION.json", "designFileHashes", {"DESIGN_VERIFICATION.json"}),
        ("g3-readiness", "READINESS_FINAL_VERIFICATION.json", "readinessFileHashes",
         {"READINESS_FINAL_VERIFICATION.json", "READINESS_INDEPENDENT_VERIFICATION.json"}),
        ("g3-final-readiness", "FINAL_READINESS_VERIFICATION.json", "finalReadinessFileHashes",
         {"FINAL_READINESS_VERIFICATION.json", "FINAL_READINESS_INDEPENDENT_VERIFICATION.json"}),
        ("g3-live-readiness", "LIVE_READINESS_FINAL_VERIFICATION.json", "liveReadinessFileHashes",
         {"LIVE_READINESS_FINAL_VERIFICATION.json", "LIVE_READINESS_INDEPENDENT_VERIFICATION.json"}),
    ):
        base = HERE.parent / directory
        existing = load(base / filename)
        actual = {str(path.relative_to(base)): sha(path) for path in base.rglob("*")
                  if path.is_file() and path.name not in excluded_names}
        ensure(actual == existing[key], "HISTORIC_CENSUS_CHANGED: " + directory)
        for path in base.rglob("*"):
            if path.is_file():
                hashes[str(path.relative_to(ROOT))] = sha(path)
    terminal_path = HERE.parent / "evidence" / "G2_TERMINAL_FINAL_VERIFICATION.json"
    ensure(sha(terminal_path) == "ed29f65fc52a89a707d76bf553a24f579e1542ddf439245edcf0cde3ccc0f499",
           "G2_TERMINAL_ROOT_CHANGED")
    terminal = load(terminal_path)
    for key, name in (
        ("currentPlanSha256", "deployment-plan.md"), ("missionStatusSha256", "mission-gate-status.json"),
        ("validationWorkflowSha256", "validate-status.json"),
    ):
        path = HERE.parent / name
        ensure(sha(path) == terminal[key], "G2_GOVERNANCE_BYTES_CHANGED")
        hashes[str(path.relative_to(ROOT))] = sha(path)
    for key, base in (
        ("evidenceHashes", HERE.parent / "evidence"), ("completePriorEvidenceHashes", HERE.parent / "evidence"),
        ("stageRootHashes", HERE.parent / "evidence"),
        ("sourceHashes", ROOT / "infrastructure" / "landing-zone" / "g2-builder"),
    ):
        for relative, digest in terminal[key].items():
            path = base / relative
            ensure(sha(path) == digest.lower(), "G2_PROTECTED_BYTES_CHANGED")
            hashes[str(path.relative_to(ROOT))] = digest.lower()
    return hashes


def grant_plan():
    reader = "b93aa761-3e63-49ed-ac28-beffa264f7ac"
    writer = "2a1e307c-b015-4ebd-883e-5b7698a07328"
    final_scope = PREFIX + "/resourceGroups/nzila-g2-proof-xre47vggs5uhw/providers/Microsoft.ContainerRegistry/registries/nzilag2tzo75uuozprbo"
    entries = [{
        "scope": {"literal": G3_SCOPE}, "principalOutput": "executorObjectId",
        "role": "Contributor", "roleDefinitionId": "b24988ac-6180-42a0-ab88-20f7382dd24c",
        "repository": "", "phase": "CONTROL_PLANE_BOOTSTRAP",
    }]
    for principal, role, role_id, phase in (
        ("executorObjectId", "Container Registry Repository Writer", writer, "INPUT_STAGING_TEMPORARY"),
        ("inputReaderPrincipalId", "Container Registry Repository Reader", reader, "PRIVATE_INPUT_CONSUMPTION"),
    ):
        for repo in ("g3-build-source", "g3-build-tooling"):
            entries.append({
                "scope": {"precedingGateOutput": "inputRegistryResourceId"},
                "principalOutput": principal, "role": role, "roleDefinitionId": role_id,
                "repository": repo, "phase": phase, "conditionVersion": "2.0",
                "condition": "@Request[Microsoft.ContainerRegistry/registries/repositories:name] "
                             "StringEqualsIgnoreCase '" + repo + "'",
            })
    for principal, role_id, role in (
        ("finalPushPrincipalId", writer, "Container Registry Repository Writer"),
        ("pullPrincipalId", reader, "Container Registry Repository Reader"),
    ):
        entries.append({
            "scope": {"literal": final_scope}, "principalOutput": principal,
            "role": role, "roleDefinitionId": role_id, "repository": "g3-synthetic-runtime",
            "conditionVersion": "2.0",
            "condition": "@Request[Microsoft.ContainerRegistry/registries/repositories:name] "
                         "StringEqualsIgnoreCase 'g3-synthetic-runtime'",
            "phase": "G3A_FINAL_PUSH" if principal == "finalPushPrincipalId" else "G3B_IMAGE_PULL",
        })
    entries.extend([
        {"scope": {"precedingGateOutput": "g3VaultResourceId"},
         "principalOutput": "secretBootstrapPrincipalId", "role": "Key Vault Secrets Officer",
         "roleDefinitionId": "b86a8fe4-44ce-4948-aee5-eccb2c155cd7", "repository": "",
         "phase": "G3B_ONE_SECRET_BOOTSTRAP_TEMPORARY",
         "technicalScope": "ENTIRE_NEW_SYNTHETIC_VAULT_NOT_SECRET_CONDITIONED",
         "operationRestriction": "ONE_NAMED_SYNTHETIC_SECRET_THEN_ROLE_REVOCATION"},
        {"scope": {"precedingGateOutput": "g3NamedSecretResourceId"},
         "principalOutput": "runtimePrincipalId", "role": "Key Vault Secrets User",
         "roleDefinitionId": "4633458b-17de-408a-b874-0445c86b69e6", "repository": "",
         "phase": "G3B_RUNTIME_NAMED_SECRET_ONLY"},
    ])
    return {
        "model": "MAINTAINER_CONTROLLED_ONE_TIME_GRANT_OPERATION",
        "status": "PROPOSED_OPERATION_MODEL_NOT_EXECUTABLE_DELEGATION",
        "governanceOwnerCandidateObjectId": OWNER,
        "authenticatedAzureGrantOperatorObjectId": None,
        "operatorPrivilegeVerification": "REQUIRED_AT_SEPARATE_BOOTSTRAP_GATE_NOT_INFERRED_FROM_DIRECTORY_ADMIN",
        "existingBroadAzureGrantPrincipalsAuthorized": False,
        "newGenericGrantRoles": [], "assignments": entries,
        "deterministicAssignmentId": {
            "algorithm": "UUIDv5", "namespace": "af5b3bfd-4808-4de7-b875-e302bc9aa3b2",
            "nameFieldsInOrder": ["scope.lower()", "principalId.lower()", "roleDefinitionId.lower()",
                                  "repository", "transactionId"],
            "separator": "\\n", "implementation": "staging_contract.py:assignment_id",
            "resolution": "ONLY_REAL_OUTPUT_IDS_OF_PRECEDING_GATE_NO_FABRICATED_FUTURE_GUIDS",
        },
        "G3_INPUT_STAGE_THEN_BUILD_ORDER": "ENFORCED_IN_LOCAL_STATE_GUARD_NOT_EXECUTING_CONTROLLER",
        "noRuntimeACRRights": True, "noInputReaderWriter": True,
        "firstMutationGateExcludes": ["input registry", "registry push", "builder", "ACA", "Key Vault", "G3A", "G3B"],
    }


def main():
    ensure(not any((HERE / name).exists() for name in OUTPUTS), "DO_NOT_OVERWRITE_INPUT_READINESS_SEAL")
    before = snapshot(ROOT)
    foreign = snapshot(Path(r"C:\APPS\nzila-os"))
    ensure(before["head"] == "7bec20aad11d43eeae8099c14e021b3074154b27" and
           before["status"] == ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"],
           "ISOLATED_CONCURRENCY_DRIFT")
    preserved = history()
    owner = load(HERE / ("ADMIN_DETAIL_" + OWNER + ".json"))["response"]
    ensure(owner["id"] == OWNER and owner["accountEnabled"] and owner["userType"] == "Member" and
           owner["displayName"] == "Aubert Nungisa", "OWNER_CANDIDATE_INELIGIBLE")
    directory = load(HERE / "DIRECTORY_ROLE_ASSIGNMENTS.json")["response"]
    ensure(not directory["nextLink"] and any(item["principalId"] == OWNER and item["directoryScopeId"] == "/" and
           item["roleDefinitionId"] == "62e90394-69f5-4237-9190-012177145e10"
           for item in directory["assignments"]), "OWNER_DIRECTORY_ROLE_NOT_BOUND")
    policy = ROOT / "docs" / "governance" / "owner-operated-review-model.md"
    ensure("Aubert Nungisa is the authorized owner" in policy.read_text(), "OWNER_ACCOUNTABILITY_NOT_BOUND")
    preserved[str(policy.relative_to(ROOT))] = sha(policy)
    account = load(HERE / "FINAL_ACCOUNT.json")["response"]
    ensure(account["id"] == SUB and account["tenantId"] == TENANT, "ACCOUNT_BINDING_CHANGED")
    protected = load(HERE / "FINAL_PROTECTED_G2_RESOURCES.json")["response"]
    old_resources = load(ARCH / "PROTECTED_G2_RESOURCES.json")["response"]
    ensure(len(protected) == 16 and {item["id"].lower() for item in protected} ==
           {item["id"].lower() for item in old_resources}, "PROTECTED_G2_IDS_CHANGED")
    events = [json.loads(line) for line in (HERE / "AZURE_READ_ONLY_LEDGER.jsonl").read_text().splitlines()]
    ensure(len(events) == 28, "READ_ONLY_INVOCATION_CENSUS")
    failed = []
    for start, end in zip(events[::2], events[1::2]):
        command = start["command"]
        ensure(start["event"] == "START" and end["event"] == "COMPLETE" and start["name"] == end["name"] and
               start["mutations"] == end["mutations"] == 0 and
               (command[1:4] == ["rest", "--method", "GET"] or
                command[1:4] == ["role", "assignment", "list"] or
                command[1:3] in (["account", "show"], ["resource", "list"])), "NON_READ_INVOCATION")
        result = load(HERE / end["responseFile"])
        ensure(result["exitCode"] == end["exitCode"] and result["azureMutationCount"] == 0,
               "READ_LEDGER_RESPONSE_MISMATCH")
        if end["exitCode"]:
            ensure(start["name"] in (
                "ADMIN_DETAIL_acfefd18-4551-4df2-a159-5dbd10a83d2c",
                "ADMIN_DETAIL_c48edeb1-6ae1-4274-a9fe-daf17f435f69",
            ) and result["stderr"].startswith("ERROR: Not Found(") and
                   '"code":"Request_ResourceNotFound"' in result["stderr"], "UNCLASSIFIED_READ_FAILURE")
            failed.append(start["name"])
    ensure(len(failed) == 2, "READ_FAILURE_CENSUS")
    inputs = load(HERE / "OCI_INPUT_CONTRACT.json")
    for entry in inputs["contracts"].values():
        payload, manifest = Path(entry["payloadPath"]), Path(entry["manifestPath"])
        ensure(sha(payload) == entry["sha256"] and payload.stat().st_size == entry["bytes"] and
               "sha256:" + sha(manifest) == entry["manifestDigest"] and manifest.stat().st_size == entry["manifestBytes"],
               "OCI_CONTRACT_BYTES_MISMATCH")
    rehearsal = load(HERE / "OFFLINE_REHEARSAL_RESULT.json")
    frozen_digest = "sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7"
    ensure(rehearsal["frozenManifestDigest"] == rehearsal["rehearsedManifestDigest"] == frozen_digest and
           rehearsal["offlineNoCacheBuilds"] == 2 and rehearsal["G3A_OFFLINE_BUILD_REHEARSAL"] == "FAIL" and
           not rehearsal["portableToolingEstablishedByPayloads"], "UNSUPPORTED_COMPLETE_REHEARSAL")
    probe = load(HERE / "PROBE_LOCAL_QUALIFICATION_V3.json")
    binary = HERE / "probe" / "g3-private-probe"
    ensure(sha(binary) == probe["binarySha256"] and binary.stat().st_size == probe["binaryBytes"],
           "PROBE_BINARY_CHANGED")
    for name, expected in probe["goSources"].items():
        ensure(sha(HERE / "probe" / name) == expected, "PROBE_QUALIFIED_SOURCE_CHANGED")
    raw = binary.read_bytes()
    ensure(raw[:6] == b"\x7fELF\x02\x01" and raw[18:20] == b"\x3e\x00", "PROBE_ELF_PLATFORM")
    offset, stride, count = struct.unpack_from("<Q", raw, 32)[0], struct.unpack_from("<H", raw, 54)[0], struct.unpack_from("<H", raw, 56)[0]
    ensure(stride >= 56 and count > 0 and offset + count * stride <= len(raw) and
           all(struct.unpack_from("<I", raw, offset + n * stride)[0] != 3 for n in range(count)),
           "PROBE_DYNAMIC_INTERPRETER_NOT_ALLOWED")
    check = subprocess.run([sys.executable, "-B", "-m", "unittest", "-v",
                            "test_private_reader", "test_staging_contract", "test_public_observer"],
                           cwd=HERE, capture_output=True, text=True, timeout=120)
    ensure(check.returncode == 0 and "Ran 14 tests" in check.stderr, "PYTHON_COMPONENT_TEST_FAILURE")
    python_files = []
    for path in HERE.rglob("*.py"):
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        python_files.append(str(path.relative_to(HERE)))
    whitespace = []
    for path in HERE.rglob("*"):
        if path.is_file() and path.suffix in {".py", ".go", ".md", ".mod"}:
            for number, line in enumerate(path.read_text().splitlines(), 1):
                if line.rstrip() != line:
                    whitespace.append(str(path.relative_to(HERE)) + ":" + str(number))
    ensure(not whitespace, "NEW_SOURCE_TRAILING_WHITESPACE")
    go_log = (HERE / "PROBE_LOCAL_BUILD_LOG_V3.txt").read_text()
    ensure(go_log.count("--- PASS: Test") == 5 and "--- FAIL:" not in go_log, "GO_TEST_CENSUS")
    image = load(HERE / "VM_IMAGE_METADATA.json")["response"]
    ensure(image["name"] == "24.04.202609040" and image["properties"]["architecture"] == "x64" and
           image["properties"]["imageDeprecationStatus"]["imageState"] == "Active", "EXACT_VM_IMAGE")
    owner_contract = {
        "status": "BOUND_OWNER_CANDIDATES_ONLY_NO_OWNERSHIP_MUTATION",
        "applicationOwnerCandidate": OWNER, "servicePrincipalOwnerCandidate": OWNER,
        "tenantId": TENANT, "user": owner, "activeTenantGlobalAdministrator": True,
        "repositoryAccountabilityPolicy": str(policy), "policySha256": sha(policy),
        "ownerConsentOrDesignationMutation": False, "azureGrantCapabilityInferred": False,
        "executorName": "nzila-g3-proof-executor", "executorObjectId": None, "appClientId": None,
        "issuer": "https://token.actions.githubusercontent.com",
        "subject": "repo:anungis437/nzila-os:environment:g3-proof", "audience": "api://AzureADTokenExchange",
        "passwordOrClientSecretAllowed": False, "existingStagingPrincipalReused": False,
    }
    fresh("OWNER_EXECUTOR_CONTRACT.json", owner_contract)
    fresh("GRANT_OPERATION_PLAN.json", grant_plan())
    old_cost = load(ARCH / "OPTION_COST_OBSERVATIONS.json")
    idle = str(Decimal("3309418") / Decimal("1000000000") * Decimal("0.141655"))
    ensure(idle == old_cost["G3_EXPECTED_IDLE_MONTHLY_COST_CAD"], "IMAGE_ONLY_IDLE_COST_MISMATCH")
    cost = {
        "currency": "CAD", "status": "MAX_DURATIONS_BOUND_ALL_IN_PROOF_COST_UNRESOLVED",
        "maximumHours": {"inputStagingPublic": 1, "builder": 2, "G3BProof": 4, "probe": 4},
        "inputRegistrySKU": "Premium", "conservativeRegistryDayBudgetCAD": "2.360822",
        "knownSourceAndCompilerBytes": 75299840, "portableUtilityBytes": None,
        "proofPostState": "PROOF_ONLY_TEARDOWN", "inputRegistryRetained": False,
        "retainedImageBlobBytes": 3309418, "artifactStorageRateCADPerGBMonth": "0.141655",
        "idleBillableUpperBoundCAD": idle, "idleScope": "INCREMENTAL_ONE_IMAGE_NOT_ENTIRE_REGISTRY_SPEND",
        "G3_EXPECTED_PROOF_COST_CAD": "UNRESOLVED", "G3_PROOF_COST_CEILING_CAD": "UNRESOLVED",
        "minimumCeilingMultiplier": "1.5", "incrementalG2FirewallCAD": "0_NOT_SELECTED",
        "meterEvidence": str(ARCH / "PUBLIC_CAD_PRICING.json"),
        "rateAuthority": str(ARCH / "OPTION_COST_OBSERVATIONS.json"),
        "unresolved": ["complete utility/guest bootstrap/probe/controller bytes and transport",
                       "final PE/DNS/VM disk/provider ACA LB/IP/telemetry/traffic quantities",
                       "Standard Key Vault secret-operation meter binding"],
        "notReportedAsAllIn": True,
    }
    fresh("INPUT_READINESS_COST.json", cost)
    disposition = {
        "mission": "NZ-20261008-INFRA-001", "G3_EXECUTION_READINESS": "BLOCKED",
        "G3_EXECUTOR_OWNER_CONTRACT": "BOUND",
        "G3_GRANT_EXECUTOR_MODEL": "MAINTAINER_CONTROLLED_ONE_TIME_GRANT_OPERATION",
        "grantModelScope": "BOUND_PROPOSED_OPERATION_ONLY_AUTHENTICATED_OPERATOR_AND_DELEGATION_NOT_ESTABLISHED",
        "G3_PRIVATE_INPUT_DELIVERY_MODEL": "SEPARATE_G3_OCI_INPUT_REGISTRY",
        "G3_INPUT_STAGING_PUBLIC_ENDPOINT": "TEMPORARILY_REQUIRED",
        "G3_INPUT_REGISTRY_LOCKDOWN_CONTRACT": "READY",
        "G3_INPUT_PRODUCER": "DEDICATED_G3_OIDC_EXECUTOR", "G3_INPUT_OCI_CONTRACT": "BLOCKED",
        "G3_PRIVATE_INPUT_READER": "BLOCKED",
        "G3A_VM_IMAGE": "Canonical:ubuntu-24_04-lts:server:24.04.202609040",
        "G3A_VM_BASE_TOOLCHAIN": "UNPROVEN_EXPECTED_SHELL_PYTHON_CA_ARCHIVE_AGENT_INVENTORY",
        "G3A_OFFLINE_BUILD_REHEARSAL": "FAIL", "componentTwoBuildRehearsal": "PASS_EXACT_FROZEN_MANIFEST",
        "G3_PRIVATE_PROBE_CALLER": "BLOCKED", "privateProbeComponent": "PASS_LOCAL_TEST_VET_STATIC_ELF",
        "G3_PUBLIC_DENIAL_OBSERVER": "EXTERNAL_NETWORK_OBSERVER", "publicObserverScope": "CONTRACT_AND_FIXTURES_ONLY",
        "G3A_CONTROLLER": "INCOMPLETE", "G3B_CONTROLLER": "INCOMPLETE",
        "G3A_BICEP_PACKAGE": "INCOMPLETE", "G3B_BICEP_PACKAGE": "INCOMPLETE",
        "G3_POST_PROOF_STATE": "PROOF_ONLY_TEARDOWN",
        "G3_EXPECTED_PROOF_COST_CAD": "UNRESOLVED", "G3_PROOF_COST_CEILING_CAD": "UNRESOLVED",
        "G3_EXPECTED_IDLE_MONTHLY_COST_CAD": idle,
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO", "APPLICATION_ROLLOUT_AUTHORIZED": "NO",
        "PRODUCTION_DATA_AUTHORIZED": "NO", "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "guestExecution": False, "protectedG2ResourceCount": 16,
        "survivingBlocker": "COMPLETE_PORTABLE_PRIVATE_GUEST_TRANSACTION_NOT_QUALIFIED",
        "dependentIncompleteWork": [
            "staged engine/exporter utility archive and pinned VM base/interpreter/agent transport inventory",
            "complete offline guest rehearsal without pre-existing workstation tooling",
            "probe control-plane handshake, one-secret bootstrap and pull-UAMI repository negatives",
            "executing G3A/G3B controllers and built/linted top-level packages",
            "authenticated grant operation/delegation qualification and full all-in proof cost/ceiling",
        ],
        "noBootstrapAuthorityPrepared": True,
    }
    fresh("INPUT_READINESS_DISPOSITION.json", disposition)
    fresh("INPUT_READINESS_LOCAL_VALIDATION.json", {
        "status": "PASS_LOCAL_COMPONENTS_AND_INTEGRITY_NOT_EXECUTION_READINESS",
        "pythonTests": {"command": [sys.executable, "-B", "-m", "unittest", "-v",
                                   "test_private_reader", "test_staging_contract", "test_public_observer"],
                        "result": "PASS", "count": 14, "output": check.stdout + check.stderr},
        "go": {"command": probe["command"], "result": "PASS", "tests": 5, "vet": "PASS",
               "staticLinuxAmd64ELFNoInterpreter": True, "binarySha256": probe["binarySha256"]},
        "pythonAST": {"result": "PASS", "files": python_files}, "newSourceWhitespace": "PASS",
        "completeGuestRehearsal": "FAIL_HOST_ENGINE_NOT_ESTABLISHED_BY_INPUTS",
        "newTopLevelBicepBuildAndLint": "NOT_RUN_NO_COMPLETE_PACKAGES",
        "repoWidePRChecks": "NOT_RUN_NO_PR_OR_PRODUCT_SOURCE_CHANGE",
        "readCalls": 14, "successes": 12, "retainedFailedReadNames": failed,
        "protectedG2ResourceCountAndIds": "PASS_16_EXACT_PRIOR_IDS",
        "azureMutations": 0, "entraMutations": 0, "registryMutations": 0, "guestExecution": False,
    })
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", (HERE / "INPUT_READINESS_REPORT.md").read_text()):
        path = (HERE / target).resolve()
        ensure(path.exists() or path.name in (
            "INPUT_READINESS_VERIFICATION.json", "INPUT_READINESS_INDEPENDENT_VERIFICATION.json"),
            "BROKEN_REPORT_LINK: " + target)
    after = snapshot(ROOT)
    ensure(after == before, "ISOLATED_CONCURRENCY_DRIFT_DURING_SEAL")
    root = {
        "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "PASS", "meaning": "EVIDENCE_INTEGRITY_NOT_EXECUTION_READINESS",
        "authorityPath": str(AUTHORITY), "authoritySha256": sha(AUTHORITY),
        "concurrency": {"isolated": after, "foreignBefore": foreign,
                        "foreignAfter": snapshot(Path(r"C:\APPS\nzila-os")), "foreignDispositioned": False},
        "preservedPacketHashes": preserved,
        "inputReadinessFileHashes": {str(path.relative_to(HERE)): sha(path)
                                    for path in HERE.rglob("*") if path.is_file()},
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
        "G3_EXECUTION_READINESS": "BLOCKED",
    }
    fresh("INPUT_READINESS_VERIFICATION.json", root)
    print(json.dumps({"rootSha256": sha(HERE / "INPUT_READINESS_VERIFICATION.json"),
                      "sealedFiles": len(root["inputReadinessFileHashes"]),
                      "preservedHashReferences": len(preserved),
                      "G3_EXECUTION_READINESS": "BLOCKED"}, indent=2))


if __name__ == "__main__":
    main()
