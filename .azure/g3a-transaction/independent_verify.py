"""Independent hashes, direct fixture replay and honest completeness verification."""

from decimal import Decimal, ROUND_CEILING
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import unittest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CACHE = {}


def ensure(value, stage):
    if not value:
        raise RuntimeError(stage)


def sha(path):
    info = path.stat()
    key = (str(path), info.st_size, info.st_mtime_ns)
    if key not in CACHE:
        with path.open("rb") as file:
            CACHE[key] = hashlib.file_digest(file, "sha256").hexdigest()
        after = path.stat()
        ensure((info.st_size, info.st_mtime_ns) == (after.st_size, after.st_mtime_ns), "FILE_CHANGED_WHILE_HASHED")
    return CACHE[key]


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def main():
    ensure(len(sys.argv) == 2 and re.fullmatch(r"[0-9a-f]{64}", sys.argv[1]), "EXPECTED_ROOT_REQUIRED")
    path = HERE / "TRANSACTION_VERIFICATION.json"
    ensure(sha(path) == sys.argv[1], "ROOT_CHANGED")
    root = load(path)
    excluded = {"TRANSACTION_VERIFICATION.json", "TRANSACTION_INDEPENDENT_VERIFICATION.json"}
    actual = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(actual == root["transactionFileHashes"], "EXACT_TRANSACTION_CENSUS_CHANGED")
    references = len(actual) + 1
    for relative, expected in root["preservedPacketHashes"].items():
        ensure(sha(ROOT / relative) == expected, "HISTORICAL_BYTES_CHANGED")
        references += 1
    for directory, filename, key, names in (
        ("g3-design", "DESIGN_VERIFICATION.json", "designFileHashes", {"DESIGN_VERIFICATION.json"}),
        ("g3-readiness", "READINESS_FINAL_VERIFICATION.json", "readinessFileHashes",
         {"READINESS_FINAL_VERIFICATION.json", "READINESS_INDEPENDENT_VERIFICATION.json"}),
        ("g3-live-readiness", "LIVE_READINESS_FINAL_VERIFICATION.json", "liveReadinessFileHashes",
         {"LIVE_READINESS_FINAL_VERIFICATION.json", "LIVE_READINESS_INDEPENDENT_VERIFICATION.json"}),
        ("g3-final-readiness", "FINAL_READINESS_VERIFICATION.json", "finalReadinessFileHashes",
         {"FINAL_READINESS_VERIFICATION.json", "FINAL_READINESS_INDEPENDENT_VERIFICATION.json"}),
        ("g3-execution-lane", "EXECUTION_LANE_VERIFICATION.json", "executionLaneFileHashes",
         {"EXECUTION_LANE_VERIFICATION.json", "EXECUTION_LANE_INDEPENDENT_VERIFICATION.json"}),
        ("g3-input-readiness", "INPUT_READINESS_VERIFICATION.json", "inputReadinessFileHashes",
         {"INPUT_READINESS_VERIFICATION.json", "INPUT_READINESS_INDEPENDENT_VERIFICATION.json"}),
        ("g3a-portable", "PORTABLE_BUILDER_VERIFICATION.json", "portableFileHashes",
         {"PORTABLE_BUILDER_VERIFICATION.json", "PORTABLE_BUILDER_INDEPENDENT_VERIFICATION.json"}),
        ("g3a-compressor", "COMPRESSOR_VERIFICATION.json", "compressorFileHashes",
         {"COMPRESSOR_VERIFICATION.json", "COMPRESSOR_INDEPENDENT_VERIFICATION.json"}),
        ("g3a-go1256", "GO1256_VERIFICATION.json", "go1256FileHashes",
         {"GO1256_VERIFICATION.json", "GO1256_INDEPENDENT_VERIFICATION.json"}),
        ("g3a-full-rehearsal", "FULL_REHEARSAL_VERIFICATION.json", "rehearsalFileHashes",
         {"FULL_REHEARSAL_VERIFICATION.json", "FULL_REHEARSAL_INDEPENDENT_VERIFICATION.json"}),
        ("g3a-controller-repair", "REPAIR_VERIFICATION.json", "repairFileHashes",
         {"REPAIR_VERIFICATION.json", "REPAIR_INDEPENDENT_VERIFICATION.json"}),
    ):
        base = HERE.parent / directory
        census = {str(path.relative_to(base)): sha(path) for path in base.rglob("*")
                  if path.is_file() and path.name not in names}
        ensure(census == load(base / filename)[key], "HISTORICAL_EXACT_CENSUS_" + directory)
        references += len(census)
    ensure(sha(HERE.parent / "g3a-controller-repair" / "REPAIR_VERIFICATION.json") ==
           root["qualifiedCoreRootSha256"] ==
           "3d155ebc2a739ff9c91fd7011e8497878f34fd3390c6d0ecbd0554c730313f81", "QUALIFIED_CORE_ROOT")
    ensure(sha(Path(root["authorityPath"])) == root["authoritySha256"], "AUTHORITY_CHANGED")
    ensure(any(value == "ed29f65fc52a89a707d76bf553a24f579e1542ddf439245edcf0cde3ccc0f499"
               for value in root["preservedPacketHashes"].values()), "G2_TERMINAL_PROTECTED")
    ensure(sha(HERE / "sealed_reader.py") ==
           sha(HERE.parent / "g3-input-readiness" / "private_reader.py") ==
           "c7ac915a4b5d295eb23f55a5ceea801a4f9a0bcaded04e7839a30a7a0743bc68", "SEALED_READER_SOURCE")
    from test_registry import HOST, LAYOUT, UploadFixture
    from registry import RegistrySession, Uploader, MANIFEST, validate_layout
    raw, descriptors = validate_layout(LAYOUT)
    ensure("sha256:" + hashlib.sha256(raw).hexdigest() == MANIFEST and len(raw) == 840, "CORE_MANIFEST_BYTES")
    fixture = UploadFixture()
    session = RegistrySession(HOST, "g3-synthetic-runtime", fixture.factory)
    uploader = Uploader(session, "g3-proof-82b24793125b")
    outcome = uploader.push(LAYOUT, "TEST_AAD_EPHEMERAL")
    ensure(fixture.manifest_body == raw and outcome["manifestAttempts"] == 1 and session.token is None and
           len(outcome["blobCommitAttempts"]) == 3 and
           all(value == 1 for value in outcome["blobCommitAttempts"].values()), "REPLAY_EXACT_SINGLE_PUT")
    manifest_puts = [call for call in fixture.calls if call[1] == "PUT" and "/manifests/" in call[2]]
    ensure(len(manifest_puts) == 1 and manifest_puts[0][3] == raw, "OBSERVED_FIXTURE_PUT_BYTES")
    recorded = load(HERE / "UPLOAD_FIXTURE_PROOF.json")
    ensure(recorded["manifestDigest"] == recorded["putBodySha256"] == MANIFEST and
           recorded["putBytes"] == len(raw) and recorded["REMOTE_MANIFEST_ATTEMPTS_MAX"] == 1 and
           not recorded["atomicNoOverwriteClaimed"], "RECORDED_PUT_SCOPE")
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream, verbosity=1).run(
        unittest.defaultTestLoader.loadTestsFromNames(["test_registry", "test_controller"]))
    ensure(result.wasSuccessful() and result.testsRun == 25, "INDEPENDENT_FIXTURE_REPLAY")
    for name in ("LOCAL_FIXTURE_TESTS.txt", "UPLOAD_FIXTURE_PROOF.json", "NEGATIVE_AUTHORIZATION_FIXTURES.json",
                 "TOKEN_HYGIENE_PROOF.json"):
        evidence = (HERE / name).read_text()
        ensure(not any(value in evidence for value in
                       ("TEST_AAD_EPHEMERAL", "TEST_REFRESH_EPHEMERAL", "TEST_SCOPED_EPHEMERAL",
                        '"Authorization"', '"refresh_token"', '"access_token"')), "TOKEN_EVIDENCE_LEAK")
    negative = load(HERE / "NEGATIVE_AUTHORIZATION_FIXTURES.json")
    ensure(len(negative["records"]) == 8 and
           sum(item["classification"] == "AUTHENTICATED_DENIAL" for item in negative["records"]) == 6 and
           all(item["successfulTokenExchange"] and item["authenticatedRequest"] and
               item["networkStatus"] == "PRIVATE_DNS_TLS_PASS" for item in negative["records"]),
           "NEGATIVE_MATRIX_CONTEXT")
    for item in negative["records"]:
        if item["classification"] == "AUTHENTICATED_DENIAL":
            ensure(item["httpStatus"] in (401, 403) and item["authResult"] == "DENIED", "AUTH_DENIAL_SEMANTICS")
    for name in ("repository-reader", "repository-writer"):
        module = load(HERE / "bicep" / (name + ".json"))
        ensure(len(module["resources"]) == 1, "ROLE_MODULE_RESOURCE_CENSUS")
        assignment = module["resources"][0]
        properties = assignment["properties"]
        ensure(assignment["type"] == "Microsoft.Authorization/roleAssignments" and
               properties["conditionVersion"] == "2.0" and "guid(" in assignment["name"] and
               "AcrPush" not in json.dumps(module), "ROLE_MODULE_EXACT_CONDITION")
        text = (HERE / "bicep" / (name + ".bicep")).read_text()
        ensure("StringEquals" in text and "StringStartsWith" not in text and
               "G3A_TRANSACTION_OWNED" in text, "REPOSITORY_EXACT_ROLE_BOUNDARY")
    graph = load(HERE / "G3A_RESOURCE_GRAPH.json")
    ensure(graph["identityBoundary"] == "SEPARATE_INPUT_READER_AND_BUILD_PUSH_UAMIS_PRESERVED" and
           graph["targetRegistry"] == "EXISTING_G2_ACR_NEVER_UPDATE_OR_DELETE" and
           graph["inputRegistryPostState"] == "RETIRE", "RESOURCE_GRAPH_BOUNDARIES")
    for item in graph["resources"]:
        if item["ownership"] == "CONTROL_PLANE_BOOTSTRAP_OWNED":
            ensure(not item["deleteByG3A"] and not item["update"], "BOOTSTRAP_NOT_G3A_CLEANUP")
    phases = load(HERE / "G3A_CONTROLLER_PHASE_CONTRACT.json")
    ensure(phases["count"] == len(phases["phases"]) == 18 and phases["singleUseAuthorityMaxRuns"] == 1 and
           not phases["completeAdapter"], "FALSE_LIVE_CONTROLLER")
    cost = load(HERE / "G3A_COST_MODEL.json")
    for name, binding in cost["rates"].items():
        source = Path(binding["source"])
        ensure(sha(source) == binding["sourceSha256"], "PRICE_SOURCE_CHANGED")
        records = [entry for entry in load(source)["Items"] if entry["meterId"] == binding["meterId"] and
                   entry["meterName"] == binding["meterName"] and entry["unitOfMeasure"] == binding["unit"] and
                   entry["tierMinimumUnits"] == 0 and entry["isPrimaryMeterRegion"]]
        ensure(len(records) == 1 and records[0]["currencyCode"] == "CAD" and
               Decimal(str(records[0]["retailPrice"])) == Decimal(binding["rateCAD"]), "PRICE_METER_RATE_UNIT")
    rates = {name: Decimal(item["rateCAD"]) for name, item in cost["rates"].items()}
    recomputed = {
        "inputRegistryConservativeOneDay": rates["registry"],
        "inputStorage0_5GBOneDayUpperBound": rates["storage"] * Decimal("0.5") / 30,
        "twoPrivateEndpoints4Hours": rates["pe"] * 8, "builderTwoHours": rates["vm"] * 2,
        "osDiskOneDayUpperBound": rates["disk"] / 30, "diskOperations100000": rates["diskIO"] * 10,
        "oneDnsZoneConservativeFullMonth": rates["dnsZone"], "dns10000Queries": rates["dnsQuery"] / 100,
        "finalImageOneMonthIncrementalStorage": rates["storage"] * Decimal(3309418) / Decimal(10**9),
        "peIngress2GBBound": rates["peIngress"] * 2, "peEgress2GBBound": rates["peEgress"] * 2,
        "artifactTransfer2GBConservativeBound": rates["trafficConservative"] * 2,
    }
    ensure(recomputed == {name: Decimal(value) for name, value in cost["amountsCAD"].items()} and
           sum(recomputed.values()) == Decimal(cost["knownComponentSubtotalCAD"]), "INDEPENDENT_COST_ARITHMETIC")
    ensure(cost["G3A_EXPECTED_COST_CAD"] == cost["G3A_COST_CEILING_CAD"] == "UNRESOLVED" and
           cost["materialUnpriced"], "FALSE_ALL_IN_CEILING")
    bootstrap = load(HERE / "G3A_BOOTSTRAP_CONTRACT.json")
    ensure(bootstrap["status"] == "BLOCKED" and bootstrap["inlineBytes"] == "UNRESOLVED" and
           bootstrap["exactCommand"] is None and bootstrap["pinnedVmPythonCurlRuntimeProof"] == "NOT_ON_FILE" and
           not bootstrap["candidateQualified"], "FALSE_BOOTSTRAP_READY")
    cse = (HERE / "public" / "CSE_LINUX.txt").read_text()
    ensure("256 KB" in cse and "Azure Storage private blobs" in cse and "/bin/sh" in cse,
           "OFFICIAL_CSE_SUPPORTING_SOURCE")
    d = load(HERE / "TRANSACTION_DISPOSITION.json")
    ensure(d["G3A_PRIVATE_INPUT_READER_INTEGRATION"] == d["G3A_REGISTRY_UPLOADER"] == "QUALIFIED" and
           d["G3A_CONTROLLER"] == d["G3A_BICEP_PACKAGE"] == "INCOMPLETE" and
           d["G3_EXECUTION_READINESS"] == "BLOCKED" and
           d["G3A_FIRST_BYTE_BOOTSTRAP_MODEL"] == d["G3A_CSE_CONTRACT"] == "BLOCKED" and
           d["G3A_BOOTSTRAP_INLINE_BYTES"] == d["G3A_EXPECTED_COST_CAD"] == d["G3A_COST_CEILING_CAD"] == "UNRESOLVED" and
           len(d["survivingBlockers"]) == 3, "HONEST_COMPLETENESS_DISPOSITION")
    for key in ("AZURE_MUTATIONS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS"):
        ensure(root[key] == d[key] == 0, "MUTATION_BOUNDARY")
    ensure(d["G3_TECHNICAL_EXECUTION_AUTHORIZED"] == d["G3A_EXECUTION_AUTHORIZED"] ==
           d["G3B_EXECUTION_AUTHORIZED"] == "NO" and d["UE_INFRA"] == d["CORA_INFRA"] == "INFRA_NO_GO",
           "UNAUTHORIZED_READY_CLAIM")
    report = {
        "status": "PASS_DIRECT_EVIDENCE_FIXTURE_QUALIFICATION_WITH_BLOCKERS",
        "rootSha256": sys.argv[1], "hashReferencesVerified": references,
        "fixtureTestsIndependentlyReplayed": result.testsRun, "manifestPutBytesExact": True,
        "remoteManifestAttemptsMax": 1, "noRemoteMutationRetries": True,
        "negativeFixtureRecords": 8, "authenticatedDenialFixtures": 6, "tokenSentinelEvidenceLeaks": 0,
        "costArithmeticVerified": True, "coreAndPriorFailedCensusesUnchanged": True,
        "sealerImportedOrExecuted": False, "additionalImageBuilds": 0,
        "realAzureEntraRegistryCalls": 0, "guestExecutions": 0,
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_CSE_CONTRACT": "BLOCKED",
        "G3A_COST_CEILING_CAD": "UNRESOLVED", "G3_EXECUTION_READINESS": "BLOCKED",
    }
    with (HERE / "TRANSACTION_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8") as file:
        json.dump(report, file, indent=2)
        file.write("\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
