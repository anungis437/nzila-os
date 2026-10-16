"""Separate direct-byte qualification verifier; never imports the sealer."""

from decimal import Decimal
import datetime
import hashlib
import json
from pathlib import Path
import re
import struct
import sys
import tarfile
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def ensure(value, message):
    if not value:
        raise RuntimeError(message)


def sha(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def main():
    ensure(len(sys.argv) == 2 and re.fullmatch(r"[0-9a-f]{64}", sys.argv[1]), "EXPECTED_ROOT_SHA_REQUIRED")
    root_path = HERE / "INPUT_READINESS_VERIFICATION.json"
    ensure(sha(root_path) == sys.argv[1], "ACTIVE_ROOT_MISMATCH")
    root = load(root_path)
    excluded = {"INPUT_READINESS_VERIFICATION.json", "INPUT_READINESS_INDEPENDENT_VERIFICATION.json"}
    census = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(census == root["inputReadinessFileHashes"], "ACTIVE_FILE_CENSUS_MISMATCH")
    count = len(census) + 1
    for relative, expected in root["preservedPacketHashes"].items():
        ensure(sha(ROOT / relative) == expected, "HISTORIC_PACKET_BYTES_CHANGED")
        count += 1
    for directory, filename, key, excluded_names in (
        ("g3-design", "DESIGN_VERIFICATION.json", "designFileHashes", {"DESIGN_VERIFICATION.json"}),
        ("g3-readiness", "READINESS_FINAL_VERIFICATION.json", "readinessFileHashes",
         {"READINESS_FINAL_VERIFICATION.json", "READINESS_INDEPENDENT_VERIFICATION.json"}),
        ("g3-live-readiness", "LIVE_READINESS_FINAL_VERIFICATION.json", "liveReadinessFileHashes",
         {"LIVE_READINESS_FINAL_VERIFICATION.json", "LIVE_READINESS_INDEPENDENT_VERIFICATION.json"}),
        ("g3-final-readiness", "FINAL_READINESS_VERIFICATION.json", "finalReadinessFileHashes",
         {"FINAL_READINESS_VERIFICATION.json", "FINAL_READINESS_INDEPENDENT_VERIFICATION.json"}),
        ("g3-execution-lane", "EXECUTION_LANE_VERIFICATION.json", "executionLaneFileHashes",
         {"EXECUTION_LANE_VERIFICATION.json", "EXECUTION_LANE_INDEPENDENT_VERIFICATION.json"}),
    ):
        base = HERE.parent / directory
        expected = load(base / filename)[key]
        actual = {str(path.relative_to(base)): sha(path) for path in base.rglob("*")
                  if path.is_file() and path.name not in excluded_names}
        ensure(actual == expected, "HISTORIC_EXACT_CENSUS_CHANGED")
        count += len(actual)
    ensure(sha(Path(root["authorityPath"])) == root["authoritySha256"], "ACTIVE_AUTHORITY_CHANGED")
    disposition = load(HERE / "INPUT_READINESS_DISPOSITION.json")
    ensure(disposition["G3_EXECUTION_READINESS"] == "BLOCKED" and
           disposition["G3A_OFFLINE_BUILD_REHEARSAL"] == "FAIL", "FALSE_COMPLETE_READINESS")
    for name in ("G3A_CONTROLLER", "G3B_CONTROLLER", "G3A_BICEP_PACKAGE", "G3B_BICEP_PACKAGE"):
        ensure(disposition[name] == "INCOMPLETE", "FALSE_CONTROLLER_PACKAGE_COMPLETENESS")
    for name in ("G3_PRIVATE_INPUT_READER", "G3_PRIVATE_PROBE_CALLER", "G3_INPUT_OCI_CONTRACT"):
        ensure(disposition[name] == "BLOCKED", "FALSE_GUEST_QUALIFICATION")
    for name in ("AZURE_MUTATIONS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS"):
        ensure(root[name] == disposition[name] == 0, "MUTATION_DISPOSITION")
    for name in ("G3_TECHNICAL_EXECUTION_AUTHORIZED", "APPLICATION_ROLLOUT_AUTHORIZED", "PRODUCTION_DATA_AUTHORIZED"):
        ensure(disposition[name] == "NO", "UNEXPECTED_AUTHORITY")
    ensure(disposition["UE_INFRA"] == disposition["CORA_INFRA"] == "INFRA_NO_GO" and
           not disposition["guestExecution"] and disposition["noBootstrapAuthorityPrepared"], "SCOPE_DRIFT")
    owner = load(HERE / "OWNER_EXECUTOR_CONTRACT.json")
    candidate = "a88c6cf4-adc7-4287-a553-53b93cd1f002"
    detail = load(HERE / ("ADMIN_DETAIL_" + candidate + ".json"))["response"]
    ensure(owner["applicationOwnerCandidate"] == owner["servicePrincipalOwnerCandidate"] == candidate and
           detail["id"] == candidate and detail["accountEnabled"] and detail["userType"] == "Member" and
           not owner["ownerConsentOrDesignationMutation"] and not owner["azureGrantCapabilityInferred"],
           "OWNER_CANDIDATE_CONTRACT")
    policy = Path(owner["repositoryAccountabilityPolicy"])
    ensure(sha(policy) == owner["policySha256"] and "Aubert Nungisa is the authorized owner" in policy.read_text(),
           "OWNER_ACCOUNTABILITY_POLICY")
    directory = load(HERE / "DIRECTORY_ROLE_ASSIGNMENTS.json")["response"]
    ensure(not directory["nextLink"] and any(item["principalId"] == candidate and item["directoryScopeId"] == "/" and
           item["roleDefinitionId"] == "62e90394-69f5-4237-9190-012177145e10"
           for item in directory["assignments"]), "OWNER_ELIGIBILITY_EVIDENCE")
    ensure(owner["subject"] == "repo:anungis437/nzila-os:environment:g3-proof" and
           not owner["existingStagingPrincipalReused"] and owner["executorObjectId"] is None, "EXECUTOR_REUSE")
    grant = load(HERE / "GRANT_OPERATION_PLAN.json")
    ensure(grant["authenticatedAzureGrantOperatorObjectId"] is None and not grant["newGenericGrantRoles"] and
           not grant["existingBroadAzureGrantPrincipalsAuthorized"] and len(grant["assignments"]) == 9,
           "UNAUTHORIZED_GENERIC_GRANT")
    recipe = grant["deterministicAssignmentId"]
    ensure(recipe["algorithm"] == "UUIDv5" and
           recipe["namespace"] == "af5b3bfd-4808-4de7-b875-e302bc9aa3b2", "ASSIGNMENT_RECIPE")
    namespace = uuid.UUID(recipe["namespace"])
    identities = set()
    for item in grant["assignments"]:
        key = (json.dumps(item["scope"], sort_keys=True), item["principalOutput"],
               item["roleDefinitionId"], item["repository"])
        ensure(key not in identities, "DUPLICATE_ASSIGNMENT_TUPLE")
        identities.add(key)
        ensure(item["role"] not in ("Owner", "User Access Administrator"), "BROAD_ROLE_PROPOSAL")
        scope = item["scope"]
        ensure(set(scope) in ({"literal"}, {"precedingGateOutput"}), "FAKE_SCOPE_BINDING")
        if item["repository"]:
            ensure(item["conditionVersion"] == "2.0" and
                   ("StringEqualsIgnoreCase '" + item["repository"] + "'") in item["condition"], "REPO_BOUNDARY")
        # A synthetic UUID example checks the documented recipe, not a future assignment ID.
        uuid.uuid5(namespace, "\n".join(("synthetic-scope", "synthetic-principal",
                                      item["roleDefinitionId"].lower(), item["repository"], "fixture")))
    input_contract = load(HERE / "OCI_INPUT_CONTRACT.json")
    for key, item in input_contract["contracts"].items():
        payload = Path(item["payloadPath"])
        manifest_path = Path(item["manifestPath"])
        manifest = load(manifest_path)
        ensure(sha(payload) == item["sha256"] and payload.stat().st_size == item["bytes"] and
               "sha256:" + sha(manifest_path) == item["manifestDigest"], "FROZEN_INPUT_BYTES")
        ensure(item["repository"] == ("g3-build-source" if key == "source" else "g3-build-tooling") and
               manifest["artifactType"] == item["artifactType"] and manifest["layers"] == [{
                   "mediaType": item["payloadMediaType"], "digest": "sha256:" + item["sha256"], "size": item["bytes"],
               }], "OCI_MEDIA_REPOSITORY_CONTRACT")
        count += 2
    frozen = "sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7"
    qualification = load(HERE / "offline-component-rehearsal-corrected" / "two-builds" / "LOCAL_IMAGE_QUALIFICATION.json")
    ensure(qualification["sourceAuthoritySha256"] == input_contract["contracts"]["source"]["sha256"],
           "REHEARSED_SOURCE_AUTHORITY")
    for name in ("image-run1.tar", "image-run2.tar"):
        path = HERE / "offline-component-rehearsal-corrected" / "two-builds" / name
        with tarfile.open(path) as archive:
            index = json.load(archive.extractfile("index.json"))
            descriptor = index["manifests"][0]
            ensure(descriptor["digest"] == frozen, "REHEARSED_MANIFEST_NOT_FROZEN")
            raw = archive.extractfile("blobs/sha256/" + frozen.split(":")[1]).read()
            ensure("sha256:" + hashlib.sha256(raw).hexdigest() == frozen and len(raw) == descriptor["size"],
                   "REHEARSED_RAW_MANIFEST")
            manifest = json.loads(raw)
            for blob in [manifest["config"], *manifest["layers"]]:
                raw = archive.extractfile("blobs/sha256/" + blob["digest"].split(":")[1]).read()
                ensure("sha256:" + hashlib.sha256(raw).hexdigest() == blob["digest"] and len(raw) == blob["size"],
                       "REHEARSED_RAW_BLOB")
                count += 1
    rehearsal = load(HERE / "OFFLINE_REHEARSAL_RESULT.json")
    ensure(rehearsal["rehearsedManifestDigest"] == frozen and rehearsal["G3A_OFFLINE_BUILD_REHEARSAL"] == "FAIL" and
           not rehearsal["portableToolingEstablishedByPayloads"], "WORKSTATION_REHEARSAL_MISLABELLED")
    probe = load(HERE / "PROBE_LOCAL_QUALIFICATION_V3.json")
    binary = HERE / "probe" / "g3-private-probe"
    ensure(sha(binary) == probe["binarySha256"] and binary.stat().st_size == probe["binaryBytes"], "PROBE_RAW_BINARY")
    for relative, digest in probe["goSources"].items():
        ensure(sha(HERE / "probe" / relative) == digest, "PROBE_SOURCE_BINDING")
    elf = binary.read_bytes()
    ensure(elf[:6] == b"\x7fELF\x02\x01" and elf[18:20] == b"\x3e\x00", "PROBE_ELF_TARGET")
    offset = struct.unpack_from("<Q", elf, 32)[0]
    stride, number = struct.unpack_from("<HH", elf, 54)
    ensure(stride >= 56 and number > 0 and offset + number * stride <= len(elf) and
           all(struct.unpack_from("<I", elf, offset + i * stride)[0] != 3 for i in range(number)),
           "PROBE_DYNAMIC_INTERPRETER")
    first = load(HERE / "PROBE_LOCAL_QUALIFICATION.json")
    with tarfile.open(HERE / "probe-qualification-v1-source.tar") as archive:
        for name, digest in first["goSources"].items():
            raw = archive.extractfile(name).read()
            ensure(hashlib.sha256(raw).hexdigest() == digest, "FIRST_PROBE_SOURCE_HISTORY_CHANGED")
        raw = archive.extractfile("g3-private-probe").read()
        ensure(hashlib.sha256(raw).hexdigest() == first["binarySha256"], "FIRST_PROBE_BINARY_HISTORY_CHANGED")
    account = load(HERE / "FINAL_ACCOUNT.json")["response"]
    ensure(account["id"] == "5d819f33-d16f-429c-a3c0-5b0e94740ba3" and
           account["tenantId"] == owner["tenantId"], "ACCOUNT_TENANT_BINDING")
    estate = load(HERE / "FINAL_PROTECTED_G2_RESOURCES.json")["response"]
    previous = load(HERE.parent / "g3-execution-lane" / "PROTECTED_G2_RESOURCES.json")["response"]
    ensure(len(estate) == 16 and {r["id"].lower() for r in estate} == {r["id"].lower() for r in previous},
           "PROTECTED_ESTATE_CHANGED")
    events = [json.loads(line) for line in (HERE / "AZURE_READ_ONLY_LEDGER.jsonl").read_text().splitlines()]
    ensure(len(events) == 28, "READ_LEDGER_CENSUS")
    failures = 0
    for start, end in zip(events[::2], events[1::2]):
        command = start["command"]
        ensure(start["name"] == end["name"] and start["mutations"] == end["mutations"] == 0 and
               (command[1:4] == ["rest", "--method", "GET"] or command[1:4] == ["role", "assignment", "list"] or
                command[1:3] in (["account", "show"], ["resource", "list"])), "READ_ONLY_LEDGER_VIOLATION")
        failures += end["exitCode"] != 0
    ensure(failures == 2, "FAILED_READ_CENSUS")
    cost = load(HERE / "INPUT_READINESS_COST.json")
    ensure(cost["maximumHours"] == {"inputStagingPublic": 1, "builder": 2, "G3BProof": 4, "probe": 4} and
           cost["proofPostState"] == "PROOF_ONLY_TEARDOWN" and not cost["inputRegistryRetained"], "COST_MAXIMA")
    idle = str(Decimal(3309418) / Decimal(10**9) * Decimal("0.141655"))
    ensure(cost["idleBillableUpperBoundCAD"] == disposition["G3_EXPECTED_IDLE_MONTHLY_COST_CAD"] == idle and
           cost["G3_EXPECTED_PROOF_COST_CAD"] == cost["G3_PROOF_COST_CEILING_CAD"] == "UNRESOLVED",
           "PARTIAL_COST_REPORTED_AS_ALL_IN")
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", (HERE / "INPUT_READINESS_REPORT.md").read_text()):
        path = (HERE / target).resolve()
        ensure(path.exists() or path.name == "INPUT_READINESS_INDEPENDENT_VERIFICATION.json", "BROKEN_REPORT_LINK")
    result = {
        "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "PASS", "meaning": "DIRECT_BYTE_INTEGRITY_NOT_EXECUTION_READINESS",
        "rootSha256": sys.argv[1], "hashReferencesVerified": count,
        "rawTwoRehearsalOCIArchivesVerified": True, "currentAndFirstProbeRawELFVerified": True,
        "exactHistoricFileCensusesVerified": True, "sealerImportedOrExecuted": False,
        "G3_EXECUTION_READINESS": "BLOCKED", "additionalAzureCalls": 0,
    }
    with (HERE / "INPUT_READINESS_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8", newline="\n") as file:
        json.dump(result, file, indent=2)
        file.write("\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
