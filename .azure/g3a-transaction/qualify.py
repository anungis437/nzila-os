"""Persist redacted local fixture evidence and explicit readiness boundaries."""

import ast
from decimal import Decimal
import hashlib
import io
import json
from pathlib import Path
import subprocess
import unittest

from controller import cost_ceiling
from prepare import CORE, HERE, baseline, ensure, fresh, load, sha, write
from registry import MANIFEST, RegistrySession, Uploader, probe
from test_registry import CLIENT, HOST, INPUT, LAYOUT, Fixture, Response, UploadFixture, auth_response

FAKE_TOKENS = ("TEST_AAD_EPHEMERAL", "TEST_REFRESH_EPHEMERAL", "TEST_SCOPED_EPHEMERAL")


def safe_evidence(name, value):
    raw = json.dumps(value, indent=2)
    ensure(not any(token in raw for token in FAKE_TOKENS), "TOKEN_SENTINEL_EVIDENCE_LEAK")
    ensure('"Authorization"' not in raw and '"refresh_token"' not in raw and '"access_token"' not in raw,
           "TOKEN_BODY_OR_HEADER_EVIDENCE_LEAK")
    fresh(name, value)


def main():
    fresh("CONCURRENCY_QUALIFICATION.json", baseline())
    stream = io.StringIO()
    suite = unittest.defaultTestLoader.loadTestsFromNames(["test_registry", "test_controller"])
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
    raw = stream.getvalue()
    ensure(not any(token in raw for token in FAKE_TOKENS), "TEST_LOG_TOKEN_BODY_LEAK")
    write(HERE / "LOCAL_FIXTURE_TESTS.txt", raw.encode())
    ensure(result.wasSuccessful() and result.testsRun == 25, "FIXTURE_SUITE_FAILURE")
    fixture = UploadFixture()
    session = RegistrySession(HOST, "g3-synthetic-runtime", fixture.factory)
    uploader = Uploader(session, "g3-proof-82b24793125b")
    proof = uploader.push(LAYOUT, FAKE_TOKENS[0])
    safe_evidence("UPLOAD_FIXTURE_PROOF.json", {
        "status": "PASS_LOCAL_HTTP_PROTOCOL_FIXTURE_NOT_REAL_ACR",
        "putBodySha256": "sha256:" + hashlib.sha256(fixture.manifest_body).hexdigest(),
        "putBytes": len(fixture.manifest_body), **proof,
        "tokenErasedAfterTransaction": session.token is None,
        "REMOTE_MANIFEST_ATTEMPTS_MAX": 1, "blobCommitAttemptsMaxEach": 1,
        "atomicNoOverwriteClaimed": False,
        "futureNoConcurrentWriterRequired": True,
    })
    matrix = []
    for host, repository, operation, status, identity in (
        (HOST, "g3-synthetic-runtime", "READ", 200, "FUTURE_BUILD_PUSH_UAMI"),
        (HOST, "g3-synthetic-runtime", "WRITE", 202, "FUTURE_BUILD_PUSH_UAMI"),
        (HOST, "g3-negative-only", "READ", 403, "FUTURE_BUILD_PUSH_UAMI"),
        (HOST, "g3-negative-only", "WRITE", 403, "FUTURE_BUILD_PUSH_UAMI"),
        (INPUT, "g3-build-source", "WRITE", 403, "FUTURE_INPUT_READER_UAMI"),
        (INPUT, "g3-build-tooling", "WRITE", 401, "FUTURE_INPUT_READER_UAMI"),
        (INPUT, "g3-build-source", "WRITE", 403, "FUTURE_BUILD_PUSH_UAMI"),
        (INPUT, "g3-build-tooling", "WRITE", 403, "FUTURE_BUILD_PUSH_UAMI"),
    ):
        def handler(host, method, path, body, headers):
            response = auth_response(method, path, body)
            if response:
                return response
            ensure(headers.get("Authorization") == "Bearer " + FAKE_TOKENS[2], "PROBE_AUTH_HEADER")
            if method == "DELETE":
                return Response(204)
            return Response(status, b'{"errors":[{"code":"DENIED"}]}' if status in (401, 403) else b"{}",
                            {"Location": "/v2/" + repository + "/blobs/uploads/fixture-owned"})
        local = Fixture(handler)
        record = probe(RegistrySession(host, repository, local.factory), identity,
                       operation, FAKE_TOKENS[0], MANIFEST)
        ensure(record["classification"] == ("AUTHENTICATED_DENIAL" if status in (401, 403) else "ALLOWED"),
               "NEGATIVE_MATRIX_CLASSIFICATION")
        matrix.append(record)
    safe_evidence("NEGATIVE_AUTHORIZATION_FIXTURES.json", {
        "status": "PASS_LOCAL_FIXTURES_NOT_LIVE_ABAC_PROOF", "records": matrix,
        "unexpectedAllowedUploads": "EXACT_SESSION_CANCELLATION_ONCE", "networkTLSPrivatePaths": "SYNTHETIC_LOCAL_WITNESSES",
        "futureProbePrincipalIds": "BIND_REAL_PRINCIPALS_FROM_SEPARATE_BOOTSTRAP_NOT_FAKE_CLIENT_ID",
        "dnsTLS404TimeoutAreDenials": False, "401WithoutAuthenticatedScopeEvidenceIsDenial": False,
    })
    safe_evidence("TOKEN_HYGIENE_PROOF.json", {
        "status": "PASS_LOCAL_SENTINEL_TESTS", "evidenceFilesScanned": [
            "LOCAL_FIXTURE_TESTS.txt", "UPLOAD_FIXTURE_PROOF.json", "NEGATIVE_AUTHORIZATION_FIXTURES.json"],
        "sentinelTokenLeakCount": 0, "requestBodiesPersisted": False, "authorizationHeadersPersisted": False,
        "signedRedirectUrlPersisted": False, "rawServerErrorBodiesPersisted": False,
        "tokensMemoryOnly": True, "fixtureTransportKeepsSyntheticTokensInMemoryOnly": True,
        "guestRuntimeHygiene": "NOT_LIVE_TESTED",
    })
    bicep = Path(r"C:\Users\AubertNungisa\.azure\bin\bicep.exe")
    commands = []
    for name in ("repository-reader", "repository-writer"):
        for operation in ("build", "lint"):
            args = [str(bicep), operation, str(HERE / "bicep" / (name + ".bicep"))]
            if operation == "build":
                args += ["--stdout"]
            value = subprocess.run(args, capture_output=True, text=True, timeout=120)
            ensure(value.returncode == 0 and not value.stderr.strip(), "BICEP_MODULE_LOCAL_VALIDATION")
            if operation == "build":
                compiled = json.loads(value.stdout)
                ensure(len(compiled["resources"]) == 1 and
                       compiled["resources"][0]["type"] == "Microsoft.Authorization/roleAssignments" and
                       compiled["resources"][0]["properties"]["conditionVersion"] == "2.0",
                       "BICEP_CONDITION_COMPILED")
            commands.append({"command": args, "exitCode": value.returncode, "diagnostics": value.stderr})
    fresh("BICEP_LOCAL_VALIDATION.json", {
        "status": "PASS_ASSIGNMENT_MODULES_ONLY", "commands": commands,
        "topLevelPackage": "INCOMPLETE_NOT_EMITTED_PLACEHOLDER_CSE_FORBIDDEN",
        "azureValidationOrWhatIf": False, "bicepInstalled": False,
    })
    for path in HERE.glob("*.py"):
        ast.parse(path.read_text(), filename=str(path))
    cost = load(HERE / "G3A_COST_MODEL.json")
    amounts = [Decimal(value) for value in cost["amountsCAD"].values()]
    computed = cost_ceiling(amounts, Decimal("1.5"))
    ensure(computed["expected"] == cost["knownComponentSubtotalCAD"], "COMPONENT_COST_ARITHMETIC")
    fresh("COST_ARITHMETIC_PROOF.json", {
        "status": "PASS_SUBTOTAL_ARITHMETIC_NOT_EXECUTION_CEILING", "subtotalCAD": computed["expected"],
        "illustrative150PercentRoundedSubtotalCAD": computed["ceiling"],
        "notG3AApprovedCeiling": True, "materialBootstrapCostsRemainUnpriced": True,
    })
    disposition = {
        "G3_EXECUTION_READINESS": "BLOCKED", "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED",
        "G3A_PRIVATE_INPUT_READER_INTEGRATION": "QUALIFIED",
        "readerQualificationScope": "LOCAL_PROTOCOL_AND_GUEST_PIPELINE_FIXTURES_NOT_PINNED_GUEST_RUNTIME",
        "G3A_REGISTRY_UPLOADER": "QUALIFIED", "uploaderQualificationScope": "EXACT_QUALIFIED_OCI_TREE_LOCAL_HTTP_FIXTURES_ONLY",
        "G3A_UPLOADER_NO_RETRY": "PASS", "G3A_COLLISION_GUARD": "PASS",
        "G3A_MANIFEST_UPLOAD_BYTES_EXACT": "PASS", "G3A_NEGATIVE_AUTH_PROBES": "READY",
        "negativeProbeScope": "MECHANICALLY_EXECUTABLE_FIXTURES_ONLY_LIVE_RESULTS_NOT_RUN",
        "G3A_TOKEN_HYGIENE": "PASS", "G3A_FIRST_BYTE_BOOTSTRAP_MODEL": "BLOCKED",
        "G3A_CSE_CONTRACT": "BLOCKED", "G3A_BOOTSTRAP_INLINE_BYTES": "UNRESOLVED",
        "G3A_BOOTSTRAP_SIZE_MARGIN": "UNRESOLVED", "G3A_CONTROLLER": "INCOMPLETE",
        "G3A_BICEP_PACKAGE": "INCOMPLETE", "G3A_FINAL_IMAGE_RETENTION": "RETAIN_IMMUTABLE",
        "G3A_EXPECTED_COST_CAD": "UNRESOLVED", "G3A_COST_CEILING_CAD": "UNRESOLVED",
        "G3A_EXECUTION_AUTHORITY_MAX_RUNS": 1, "G3A_EXECUTION_AUTHORIZED": "NO",
        "G3B_EXECUTION_AUTHORIZED": "NO", "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "cloudAuthenticatedReads": 0, "guestExecutions": 0, "imageRebuilds": 0,
        "frozenManifest": MANIFEST, "qualifiedCoreRoot": sha(CORE / "REPAIR_VERIFICATION.json"),
        "survivingBlockers": [
            "FIRST_BYTE_AND_GUEST_RUNTIME_CHANNEL: no pinned Python/curl/CA-runtime proof or self-contained "
            "CSE reader payload/delivery proof; no inline size/exact command can be bound.",
            "LIVE_CONTROLLER_AND_TOP_LEVEL_PACKAGE: fixture phase adapters are not a live orchestration/controller; "
            "stage-lock, provisioning, bootstrap and reconciliation adapters plus exact VM/CSE package remain unimplemented.",
            "ALL_IN_COST: final bootstrap-dependent resources/transport bytes remain unpriced; "
            "known component subtotal is not an execution ceiling.",
        ],
        "noNewAuthorityPreparedAsIssued": True,
        "initialFixtureFailure": "TEST_COUNTED_THREE_DISTINCT_BLOB_INITIATIONS_AS_RETRIES_FIXED_ASSERTION_NOT_UPLOADER",
        "inputTransport": "NORMALIZED_BUILD_INPUT_BUNDLE_MEDIA_SUPPORTED_FIXTURE_ONLY_ENVELOPE_NOT_FINALIZED",
    }
    fresh("TRANSACTION_DISPOSITION.json", disposition)
    fresh("TRANSACTION_LOCAL_VALIDATION.json", {
        "status": "PASS_LOCAL_FIXTURES_WITH_EXPLICIT_COMPLETENESS_BLOCKERS",
        "testCount": result.testsRun, "tests": "PASS", "pythonSyntax": "PASS",
        "bicepModuleBuildLint": "PASS", "topLevelBicep": "INCOMPLETE",
        "exactPutBytes": "PASS", "noRetry": "PASS", "tokenHygiene": "PASS",
        "cleanupAndAuthorityConsumption": "PASS_LOCAL_STATE_MACHINE", "costArithmetic": "PASS_SUBTOTAL",
        "remoteAzureEntraRegistryCalls": 0, "buildCoreExecutedOrModified": False,
    })
    print(json.dumps({"tests": result.testsRun, "uploader": "QUALIFIED_FIXTURE_ONLY",
                      "controller": "INCOMPLETE", "firstByte": "BLOCKED",
                      "knownComponentSubtotalCAD": cost["knownComponentSubtotalCAD"]}, indent=2))


if __name__ == "__main__":
    main()
