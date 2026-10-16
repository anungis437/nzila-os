"""Offline architectural ruling with explicit incomplete dependencies and hashes."""

from decimal import Decimal
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import unittest

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FROZEN = HERE.parent / "g3-final-readiness"
AUTHORITY = Path(
    r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData"
    r"\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments"
    r"\35cf2a86-3e0d-4f00-afa5-163d9e7586c2\Pasted text #1.txt"
)
GENERATED = {
    "INPUT_INVENTORY.json", "OPTION_COST_OBSERVATIONS.json", "EXECUTION_LANE_DISPOSITION.json",
    "EXECUTION_LANE_LOCAL_VALIDATION.json", "EXECUTION_LANE_VERIFICATION.json",
    "EXECUTION_LANE_INDEPENDENT_VERIFICATION.json",
}


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


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    imported = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(imported)
    return imported


def cli(args):
    result = subprocess.run(args, cwd=HERE, capture_output=True, text=True, timeout=120)
    ensure(result.returncode == 0, "LOCAL_CHECK_FAILED: " + result.stdout + result.stderr)
    return result


def preserved():
    old_sealer = module("old_live_sealer", HERE.parent / "g3-live-readiness" / "seal_live.py")
    prior = old_sealer.preservation()
    roots = {}
    for directory, filename, digest, key, excluded in (
        (FROZEN, "FINAL_READINESS_VERIFICATION.json",
         "20463eb5976cf8152d69ca7c37f50623c2331fd5c7dc5882c9e3fad91eeee5ad", "finalReadinessFileHashes",
         {"FINAL_READINESS_VERIFICATION.json", "FINAL_READINESS_INDEPENDENT_VERIFICATION.json"}),
        (HERE.parent / "g3-live-readiness", "LIVE_READINESS_FINAL_VERIFICATION.json",
         "bcdbe75ff8be1a82c852b37399978771fcd0acdaf1d1ae69ea0211e73563524b", "liveReadinessFileHashes",
         {"LIVE_READINESS_FINAL_VERIFICATION.json", "LIVE_READINESS_INDEPENDENT_VERIFICATION.json"}),
    ):
        root_path = directory / filename
        ensure(sha(root_path) == digest, "SEALED_ROOT_CHANGED")
        root = load(root_path)
        current = {str(path.relative_to(directory)): sha(path) for path in directory.rglob("*")
                   if path.is_file() and path.name not in excluded}
        ensure(current == root[key], "SEALED_FILE_CENSUS_CHANGED")
        roots[str(root_path.relative_to(ROOT))] = digest
        for path in directory.rglob("*"):
            if path.is_file():
                roots[str(path.relative_to(ROOT))] = sha(path)
    before = old_sealer.snapshot(ROOT)
    shared = old_sealer.snapshot(Path(r"C:\APPS\nzila-os"))
    ensure(before["head"] == "7bec20aad11d43eeae8099c14e021b3074154b27" and
           before["status"] == ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"],
           "ISOLATED_CONCURRENCY_DRIFT")
    return old_sealer, prior, roots, before, shared


def inspect_compiler():
    compiler = HERE / "compiler-dockerarchive.tar"
    with tarfile.open(compiler) as archive:
        members = [member for member in archive if member.isfile()]
        ensure(len({member.name for member in members}) == len(members), "DUPLICATE_COMPILER_MEMBER")
        index = json.load(archive.extractfile("index.json"))
        ensure(len(index["manifests"]) == 1, "COMPILER_INDEX_CENSUS")
        descriptor = index["manifests"][0]
        manifest_raw = archive.extractfile("blobs/sha256/" + descriptor["digest"].split(":")[1]).read()
        ensure("sha256:" + hashlib.sha256(manifest_raw).hexdigest() == descriptor["digest"] and
               len(manifest_raw) == descriptor["size"], "COMPILER_MANIFEST_HASH_OR_LENGTH")
        image = load(FROZEN / "local-image-frozen" / "LOCAL_IMAGE_QUALIFICATION.json")
        ensure(descriptor["digest"] == image["BASE_IMAGE_DIGEST"], "COMPILER_FROZEN_REFERENCE")
        manifest = json.loads(manifest_raw)
        config = None
        for item in [manifest["config"], *manifest["layers"]]:
            raw = archive.extractfile("blobs/sha256/" + item["digest"].split(":")[1]).read()
            ensure("sha256:" + hashlib.sha256(raw).hexdigest() == item["digest"] and
                   len(raw) == item["size"], "COMPILER_BLOB_HASH_OR_LENGTH")
            if item == manifest["config"]:
                config = json.loads(raw)
        ensure(config["os"] == "linux" and config["architecture"] == "amd64", "COMPILER_PLATFORM")
    return descriptor["digest"]


def artifact(path, provenance, destination, cleanup):
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": sha(path),
            "provenance": provenance, "futureDestination": destination, "cleanup": cleanup}


def rows(value):
    if isinstance(value, dict):
        if "meterId" in value:
            yield value
        for child in value.values():
            yield from rows(child)
    elif isinstance(value, list):
        for child in value:
            yield from rows(child)


def main():
    ensure(not any((HERE / name).exists() for name in GENERATED), "DO_NOT_OVERWRITE_EXECUTION_LANE_SEAL")
    old_sealer, preservation, preserved_hashes, before, foreign = preserved()
    compiler_manifest = inspect_compiler()
    qualification = load(FROZEN / "local-image-frozen" / "LOCAL_IMAGE_QUALIFICATION.json")
    exact_inputs = {
        "sourceBundle": artifact(FROZEN / "local-image-frozen" / "source.tar",
                                 "Frozen witness source authority " + qualification["sourceAuthoritySha256"],
                                 "/var/lib/nzila-g3/inputs/source.tar", "DELETE_WITH_BUILDER"),
        "compilerArchive": {
            **artifact(HERE / "compiler-dockerarchive.tar", "Cached pinned compiler; Docker image save local only",
                       "/var/lib/nzila-g3/inputs/compiler-dockerarchive.tar", "DELETE_WITH_BUILDER_AND_INPUT_ACR"),
            "upstreamOCIManifest": compiler_manifest,
            "completeCompilerAndBuildToolingBundle": False,
        },
        "finalQualifiedOCIArtifact": artifact(FROZEN / "local-image-frozen" / "image-run1.tar",
                                              "Two deterministic offline builds, frozen manifest",
                                              "LOCAL_COMPARISON_ONLY_BUILDER_MUST_BUILD_INDEPENDENTLY",
                                              "RETAIN_FROZEN_LOCAL_EVIDENCE"),
        "OCIIntermediate": {"status": "NOT_PRODUCED_NEW_VM_BUILD_NOT_EXECUTED", "bytes": None, "sha256": None},
        "portableToolingBundle": {
            "status": "NOT_PRODUCED", "bytes": None, "sha256": None,
            "missing": ["portable Docker/BuildKit/buildx binaries and provenance",
                        "qualified guest first-byte OCI reader",
                        "exact guest image/interpreter and VM agent platform dependencies"],
        },
        "G3AController": {"status": "NOT_PRODUCED", "bytes": None, "sha256": None},
        "G3BController": {"status": "NOT_PRODUCED", "bytes": None, "sha256": None},
        "privateProofScripts": {"status": "NOT_PRODUCED", "bytes": None, "sha256": None},
        "fixedRuntimeProofImplementation": artifact(FROZEN / "runtime" / "main.go",
                                                    "Frozen source archive member; not a probe caller",
                                                    "RUNTIME_IMAGE_ALREADY_BOUND", "RETAIN_FROZEN_LOCAL_EVIDENCE"),
        "localDesignGuardsNotControllers": artifact(HERE / "lane_contract.py",
                                                    "Current design fixtures only", "NO_GUEST_DELIVERY",
                                                    "RETAIN_LOCAL_EVIDENCE"),
        "CSEEncodedInlineLimitBytes": 256 * 1024,
    }
    ensure(exact_inputs["compilerArchive"]["bytes"] == 75258880 and
           exact_inputs["compilerArchive"]["sha256"] == "dd77d71cd5579549a1a6f62b54554bfb3bccdcdf81a443401b64f88e17a3d20b",
           "COMPILER_EXPORT_SIZE_OR_SHA_DRIFT")
    ensure(exact_inputs["sourceBundle"]["sha256"] == qualification["sourceAuthoritySha256"], "SOURCE_AUTHORITY_DRIFT")
    ensure(exact_inputs["finalQualifiedOCIArtifact"]["bytes"] == 3317248, "FINAL_ARCHIVE_SIZE_DRIFT")
    ensure(exact_inputs["compilerArchive"]["bytes"] > exact_inputs["CSEEncodedInlineLimitBytes"], "INLINE_CONTRACT")

    pricing = load(HERE / "PUBLIC_CAD_PRICING.json")
    ensure(any(item["component"] == "nat" and not any(page["response"]["Items"] for page in item["pages"])
               for item in pricing["observations"]), "EMPTY_NAT_QUERY_HISTORY")
    corrected = load(HERE / "PUBLIC_CAD_NAT_CORRECTED.json")
    bindings = {}
    for name, data, meter, expected, unit in (
        ("inputPremiumRegistry", pricing, "2f8e1105-47d0-4105-a934-b2175c766a71", "2.360822", "1/Day"),
        ("paidTaskCPU", pricing, "bb93fa13-a4e2-4027-85b9-b06e3353ffc3", "0.000142", "1 Second"),
        ("NATStandard", corrected, "ae30040a-67f5-485b-b0f4-a6ef50504d9c", "0.063745", "1 Hour"),
        ("NATProcessing", corrected, "d32b6352-b66b-4c4c-8f21-60e94058e04d", "0.063745", "1 GB"),
    ):
        matches = [row for row in rows(data) if row.get("meterId") == meter and
                   row.get("currencyCode") == "CAD" and row.get("isPrimaryMeterRegion") is True and
                   row.get("armRegionName") in ("Global", "canadacentral", "") and
                   Decimal(str(row["retailPrice"])) == Decimal(expected) and row.get("unitOfMeasure") == unit]
        ensure(matches, "PRIMARY_CAD_METER_BINDING_MISSING: " + name)
        row = matches[0]
        bindings[name] = {"meterId": meter, "meterName": row["meterName"], "rateCAD": expected,
                          "unit": unit, "region": row["armRegionName"],
                          "tierMinimumUnits": row["tierMinimumUnits"]}
    idle = load(FROZEN / "COST_MODEL.json")["retainedStateCandidate"]["newArtifactOnlyBillableUpperBoundCADPerMonth"]
    ensure(Decimal(idle) == Decimal(qualification["observations"][0]["imageBlobBytes"]) /
           Decimal(10**9) * Decimal("0.141655"), "IDLE_ARTIFACT_ARITHMETIC")
    costs = {
        "currency": "CAD", "status": "OPTION_COMPONENTS_NOT_ALL_IN",
        "meterBindings": bindings,
        "inputRegistry8hProratedIllustrationCAD": str(Decimal("2.360822") / 3),
        "inputRegistryConservativeOneDayComponentBudgetCAD": "2.360822",
        "NAT4hBeforeIPFilterAndTrafficCAD": str(Decimal("0.063745") * 4),
        "nativeBuildAgentAllocationPrice": "UNRESOLVED_NOT_SUBSTITUTED_WITH_TASK_CPU",
        "priorPartialScenarioSource": str(FROZEN / "COST_MODEL.json"),
        "priorPartialScenarioSha256": sha(FROZEN / "COST_MODEL.json"),
        "futureDurations": {"G3A_hours": "UNBOUND_NOT_FINAL", "G3B_hours": "UNBOUND_NOT_FINAL",
                            "producerWindowHours": "UNBOUND", "illustrationsAreNotAnExecutionBudget": True},
        "G3_EXPECTED_PROOF_COST_CAD": "UNRESOLVED", "G3_PROOF_COST_CEILING_CAD": "UNRESOLVED",
        "minimumFutureContingencyMultiplier": "1.5",
        "G3_EXPECTED_IDLE_MONTHLY_COST_CAD": idle,
        "idleScope": "ONE_FINAL_IMAGE_ONLY_PROPOSED_FULL_TEARDOWN_BILLABLE_UPPER_BOUND_NOT_LIVE_SPEND",
        "missing": ["complete portable tooling/proof/controller artifact bytes",
                    "bound producer window and guest/platform dependencies",
                    "final VM/disk/PE/DNS/LB/IP/telemetry/operation/traffic quantities"],
        "incrementalG2FirewallCostCAD": "0_NOT_SELECTED",
        "inputRegistryRetainedAfterProof": False,
    }

    suite = unittest.defaultTestLoader.discover(str(HERE), pattern="test_lane_contract.py")
    tests = unittest.TextTestRunner(verbosity=2).run(suite)
    ensure(tests.wasSuccessful() and tests.testsRun == 5, "LANE_CONTRACT_TEST_FAILURE")
    source = HERE / "bicep" / "input-registry-phase.bicep"
    bicep = r"C:\Users\AubertNungisa\.azure\bin\bicep.exe"
    build = cli([bicep, "build", str(source), "--stdout"])
    lint = cli([bicep, "lint", str(source)])
    ensure(not build.stderr and not lint.stderr, "BICEP_WARNING")
    compiled = json.loads(build.stdout)
    ensure(compiled == load(source.with_suffix(".json")), "COMPILED_MODULE_DRIFT")
    ensure(compiled["parameters"]["phase"]["defaultValue"] == "PRIVATE_LOCKED" and
           compiled["parameters"]["stagingAuthorized"]["defaultValue"] is False, "UNSAFE_REGISTRY_DEFAULT")
    ensure(len(compiled["resources"]) == 1 and compiled["resources"][0]["type"] ==
           "Microsoft.ContainerRegistry/registries", "UNRELATED_RESOURCE_IN_PHASE")
    properties = compiled["resources"][0]["properties"]
    ensure(properties["roleAssignmentMode"] == "AbacRepositoryPermissions" and
           properties["networkRuleBypassOptions"] == "None" and not properties["adminUserEnabled"] and
           not properties["anonymousPullEnabled"] and properties["networkRuleSet"]["defaultAction"] == "Deny",
           "INPUT_REGISTRY_CONTROL_DRIFT")
    references = load(HERE / "PUBLIC_SOURCES.json")
    ensure(len(references["documents"]) == 13, "REFERENCE_CENSUS")
    for entry in references["documents"].values():
        ensure(sha(HERE / entry["path"]) == entry["sha256"], "PUBLIC_REFERENCE_HASH")
    events = [json.loads(line) for line in (HERE / "AZURE_READ_ONLY_LEDGER.jsonl").read_text().splitlines()]
    ensure(len(events) == 4, "CURRENT_READ_CALL_CENSUS")
    for start, end in zip(events[::2], events[1::2]):
        ensure(start["event"] == "START" and end["event"] == "COMPLETE" and start["name"] == end["name"],
               "CURRENT_LEDGER_CORRELATION")
        ensure(start["command"][1:3] in (["account", "show"], ["resource", "list"]), "CURRENT_LEDGER_MUTATION")
        ensure(start["mutations"] == end["mutations"] == 0 and end["exitCode"] == 0, "CURRENT_READ_FAILURE")
    estate = load(HERE / "PROTECTED_G2_RESOURCES.json")["response"]
    ensure(len(estate) == 16 and {row["id"] for row in estate} ==
           {row["id"] for row in load(FROZEN / "PROTECTED_G2_RESOURCES.json")["response"]}, "PROTECTED_ESTATE_DRIFT")
    syntax = []
    for path in sorted(HERE.glob("*.py")):
        compile(path.read_text(encoding="utf-8"), str(path), "exec")
        syntax.append(path.name)
    ensure(not list(HERE.rglob("*.pyc")), "PERSISTENT_BYTECODE")
    cli(["git", "-C", str(ROOT), "--no-pager", "diff", "--check"])
    whitespace = []
    for path in sorted(HERE.rglob("*")):
        if path.is_file() and path.suffix in {".py", ".md", ".bicep", ".json"}:
            checked = subprocess.run(["git", "-c", "core.safecrlf=false", "diff", "--no-index", "--check",
                                      "--", "NUL", str(path)], capture_output=True, text=True)
            ensure(checked.returncode in (0, 1) and not checked.stdout and not checked.stderr, "WHITESPACE: " + str(path))
            whitespace.append(str(path.relative_to(HERE)))
    links = re.findall(r"\[[^\]]*\]\(([^)]+)\)", (HERE / "EXECUTION_LANE_ARCHITECTURE.md").read_text())
    for target in links:
        path = (HERE / target).resolve()
        ensure(path.exists() or path.parent == HERE and path.name in GENERATED, "BROKEN_LOCAL_REPORT_LINK")
    ensure(old_sealer.snapshot(ROOT) == before, "ISOLATED_CONCURRENCY_CHANGED_DURING_VALIDATION")
    outputs = {
        "G3_EXECUTION_READINESS": "BLOCKED", "G3_EXISTING_STAGING_PRINCIPAL_REUSED": "NO",
        "G3_EXECUTOR_MODEL": "DEDICATED_GITHUB_OIDC_SERVICE_PRINCIPAL",
        "G3_EXECUTOR_OWNER_CONTRACT": "BLOCKED",
        "G3_EXECUTOR_APPLICATION_OWNER": "BLOCKED_NAMED_TENANT_OBJECT_ID_REQUIRED",
        "G3_EXECUTOR_SERVICE_PRINCIPAL_OWNER": "BLOCKED_NAMED_TENANT_OBJECT_ID_REQUIRED",
        "G3_GRANT_EXECUTOR_MODEL": "MAINTAINER_CONTROLLED_ONE_TIME_EXACT_GRANT_LEDGER",
        "G3_GRANT_OPERATOR_BOUND": "NO",
        "G3_PRIVATE_INPUT_DELIVERY_MODEL": "ACR_OCI_INPUTS_SEPARATE_G3_REGISTRY_GOVERNED_STAGING",
        "G3_PRODUCER_STAGING_CONTRACT": "PROPOSED_EXPLICIT_TEMPORARY_G3_PUBLIC_INGRESS_NOT_APPROVED",
        "G3A_BUILDER_MODEL": "NEW_TRANSIENT_PRIVATE_VM", "G3A_INPUT_DELIVERY": "BLOCKED",
        "G3_SECRET_BOOTSTRAP_IDENTITY": "SEPARATE_SHORT_LIVED_BOOTSTRAP_PROBE_UAMI_DESIGN_ONLY",
        "G3_PRIVATE_PROBE_CALLER": "TRANSIENT_PRIVATE_PROBE_VM_DESIGN_ONLY",
        "G3_PUBLIC_DENIAL_OBSERVER": "SEPARATE_UNPRIVILEGED_GITHUB_HOSTED_JOB_DESIGN_ONLY",
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3B_CONTROLLER": "INCOMPLETE", "G3B_BICEP_PACKAGE": "INCOMPLETE",
        "G3_EXPECTED_PROOF_COST_CAD": "UNRESOLVED", "G3_PROOF_COST_CEILING_CAD": "UNRESOLVED",
        "G3_EXPECTED_IDLE_MONTHLY_COST_CAD": idle,
        "G3_IDLE_COST_SCOPE": costs["idleScope"],
        "G3_EGRESS_ARCHITECTURE": "NO_FORCED_TUNNEL", "G3_FIREWALL_UDR_MODEL": "NOT_SELECTED",
        "G3_EGRESS_INSPECTION": "NOT_PROVEN",
        "G3_PLATFORM_EGRESS_BREADTH": "ACCEPTED_FOR_SYNTHETIC_PROOF",
        "G3_ACA_PRIVATE_ENDPOINT": "NOT_REQUIRED", "G3_ARTIFACT_EXECUTION_SPLIT": "G3A_G3B",
        "G3_IMAGE_REPOSITORY": "g3-synthetic-runtime", "G3_RESOURCE_GROUP": "nzila-shared-test-g3-001-rg",
        "G3_MANAGED_IDENTITY_QUOTA": "PASS_DOCUMENTED_LIMIT",
        "G3_CONSUMPTION_QUOTA_GATE": "DEFERRED_FAIL_CLOSED", "G3_REQUIRED_AVAILABLE_CORES": "1.0",
        "G3_IMAGE_MANIFEST_DIGEST": qualification["observations"][0]["manifestDigest"],
        "G3_SOURCE_AUTHORITY": qualification["sourceAuthoritySha256"],
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO", "APPLICATION_ROLLOUT_AUTHORIZED": "NO",
        "PRODUCTION_DATA_AUTHORIZED": "NO", "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
        "AZURE_READ_CALLS": 2, "G2_TERMINAL_ROOT_UNCHANGED": "YES", "PROTECTED_G2_RESOURCE_COUNT": 16,
        "G3_PRIVATE_APPLICATION_SUBSTRATE": "NOT_EXECUTED", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "executorContract": {
            "displayName": "nzila-g3-proof-executor", "appId": "FUTURE", "objectId": "FUTURE",
            "subject": "repo:anungis437/nzila-os:environment:g3-proof",
            "issuer": "https://token.actions.githubusercontent.com", "audiences": ["api://AzureADTokenExchange"],
            "passwordCredentials": [], "productDeploymentResponsibility": False, "ownerObjectIds": [],
        },
        "remainingArchitecturalBlockers": [
            {"id": "owner-grant-binding", "detail": "Named tenant application/SP owners and a capable accountable exact-grant operator remain unbound."},
            {"id": "delivery-toolchain", "detail": "Selected new input-ACR staging window requires explicit acceptance/producer binding; guest first-byte, portable frozen-manifest-equivalent tooling and private probe implementations remain unqualified; complete controllers/packages depend on them."},
            {"id": "all-in-cost", "detail": "Exact remaining artifacts, guest/platform dependencies and transaction/traffic quantities prevent complete CAD total/ceiling."},
        ],
        "nextMutationGate": "DEDICATED_EXECUTOR_OWNERSHIP_G3_RG_GRANT_BOOTSTRAP_ONLY_AFTER_SEPARATE_AUTHORITY",
    }
    fresh("INPUT_INVENTORY.json", exact_inputs)
    fresh("OPTION_COST_OBSERVATIONS.json", costs)
    fresh("EXECUTION_LANE_DISPOSITION.json", outputs)
    fresh("EXECUTION_LANE_LOCAL_VALIDATION.json", {
        "status": "PASS", "scope": "OFFLINE_ARCHITECTURE_COMPONENTS_NOT_COMPLETE_EXECUTION_PACKAGES",
        "laneGuardTests": tests.testsRun, "inputRegistryBicepBuild": "PASS", "inputRegistryBicepLint": "PASS",
        "compilerArchiveRawOCIHashes": "PASS", "syntaxChecked": syntax,
        "trackedDiffCheck": "PASS", "whitespaceChecked": whitespace, "reportLinks": links,
        "G3A_MAIN_BICEP_AND_CONTROLLER": "NOT_PRODUCED", "G3B_MAIN_BICEP_AND_CONTROLLER": "NOT_PRODUCED",
        "guestExecution": "NOT_EXECUTED", "registryPushImport": "NOT_EXECUTED",
        "AzureValidationWhatIfDeploy": "NOT_EXECUTED",
    })
    hashes = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*") if path.is_file()}
    fresh("EXECUTION_LANE_VERIFICATION.json", {
        "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "PASS", "meaning": "EVIDENCE_INTEGRITY_NOT_G3_EXECUTION_READINESS",
        "authorityPath": str(AUTHORITY), "authoritySha256": sha(AUTHORITY),
        "concurrency": {"isolated": before, "sharedForeign": foreign, "foreignDisposition": "NONE"},
        "priorPreservation": preservation, "preservedPacketHashes": preserved_hashes,
        "executionLaneFileHashes": hashes, "G3_EXECUTION_READINESS": "BLOCKED",
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
    })
    print(json.dumps({"status": "PASS", "G3_EXECUTION_READINESS": "BLOCKED", "boundFiles": len(hashes),
                      "rootSha256": sha(HERE / "EXECUTION_LANE_VERIFICATION.json")}, indent=2))


if __name__ == "__main__":
    main()
