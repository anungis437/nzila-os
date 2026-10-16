"""Seal exact local delivery binding and clean only exclusively owned validation resources."""
import hashlib
import json
import os
import shutil
import sys
from delivery_guard import CANDIDATE, GO, HERE, execute, fresh, guard, sha
import delivery_evidence as d


def main():
    before = guard()
    test = execute([sys.executable, "-B", "-m", "unittest", "test_delivery_evidence", "-v"])
    fresh("FINAL_PORTABLE_PARSER_VALIDATION.json", test)
    assert test["exitCode"] == 0
    independent = execute([sys.executable, "-B", "verify_delivery.py"])
    fresh("FINAL_VERIFICATION_COMMAND.json", independent)
    assert independent["exitCode"] == 0
    b = d.bindings()
    census = json.loads((HERE / "BUNDLE_CENSUS.json").read_text())
    members = {m["name"]: m for m in census["members"]}
    candidate_source = json.loads((CANDIDATE / "SOURCE_BINDING.json").read_text())
    matrices = {}
    for name in ("PRODUCTION_PRIMITIVE_EQUIVALENCE_MATRIX.json", "STATIC_PROOF_PRIMITIVE_EQUIVALENCE_MATRIX.json"):
        value = json.loads((CANDIDATE / name).read_text())
        assert len(value["primitiveMatrix"]) == 30 and value["originalStatementsPreservedInOrder"]
        matrices[name] = {"sha256": sha(CANDIDATE / name), "matrix": value,
            "binding": "UNCHANGED_SEALED_CANDIDATE_SOURCES_AND_EXECUTABLE_NOT_SHIM_ORCHESTRATION"}
    fresh("DELIVERY_COMPONENT_CENSUS.json", {
        "schema": "g3a-hard-delivery-components/v1",
        "candidateSourceComponents": candidate_source["sourceComponentCensus"],
        "qualifiedRuntimeCensus": json.loads((CANDIDATE / "QUALIFIED_RUNTIME_COMPONENT_CENSUS.json").read_text()),
        "candidateSourceBindingSha256": sha(CANDIDATE / "SOURCE_BINDING.json"),
        "candidateSourceSha256": candidate_source["PRODUCTION_RUNNER_SOURCE_SHA256"],
        "candidateBytes": b["candidateBytes"], "candidateSha256": b["candidateSha256"],
        "shimCompiledSources": {name: sha(HERE / name) for name in ("handoff_linux.go", "bundle_binding.go")},
        "shimReaderPackagingSourceSha256": sha(HERE / "package_reader.py"),
        "readerFooterBinding": json.loads((HERE / "READER_PACKAGING.json").read_text()),
        "primitiveEquivalence": matrices,
    })
    base = d.BASE
    cse = ("set -eu; cd " + base + '; test "$(pwd -P)" = "' + base +
           '"; umask 077; chmod 0700 .; chmod 0500 g3a-handoff; chmod 0400 g3a-proof-capsule; ' +
           "printf '%s\\n' '" + b["shimSha256"] + "  g3a-handoff' | sha256sum -c -; " +
           "exec ./g3a-handoff --deliver-bound-static-proof " + b["bundleSha256"])
    fresh("CSE_COMMAND.txt", cse)
    controls = len(cse.encode()) + len(d.diagnostic_script().encode())
    groups = {
        "G3A_BOOTSTRAP_BYTES": b["shimBytes"],
        "G3A_PRODUCTION_CAPSULE_BYTES": b["candidateBytes"],
        "G3A_BUILD_TOOLCHAIN_BYTES": members["go-toolchain.tar"]["bytes"],
        "G3A_SOURCE_BYTES": sum(members[n]["bytes"] for n in (
            "source.tar", "controller-main.go", "controller-main_test.go", "controller-go.mod")),
        "G3A_TOOLING_BYTES": sum(members[n]["bytes"] for n in (
            "portable-assembler", "compressor-go1256", "controller-compressor.go", "private-reader.py", "toolchain-members.json")),
        "G3A_CA_BUNDLE_BYTES": members["ca-certificates.crt"]["bytes"],
    }
    overhead = b["bundleBytes"] - sum(m["bytes"] for m in members.values())
    other_raw = sum(members[n]["bytes"] for n in (
        "config-template.json", "index-template.json", "manifest-template.json", "source-manifest.json"))
    groups["G3A_OTHER_INPUT_BYTES"] = overhead + other_raw + controls
    groups["G3A_TOTAL_PRIVATE_INPUT_BYTES"] = sum(groups.values())
    objects_total = b["bundleBytes"] + b["shimBytes"]
    assert groups["G3A_TOTAL_PRIVATE_INPUT_BYTES"] == objects_total + controls
    binding = {
        "schema": "g3a-hard-runner-live-delivery/v1", "outcome": "LOCAL_DELIVERY_INTEGRATION_PASS",
        "objects": [
            {"name": "g3a-handoff", "localFile": str(HERE / "g3a-handoff-bound-reader"),
             "objectPath": "sha256/" + b["shimSha256"] + "/g3a-handoff",
             "sha256": b["shimSha256"], "bytes": b["shimBytes"], "mode": "0500", "type": "STATIC_ELF_WITH_BOUND_READONLY_READER_FOOTER"},
            {"name": "g3a-proof-capsule", "localFile": str(HERE / "g3a-proof-capsule"),
             "objectPath": "sha256/" + b["bundleSha256"] + "/g3a-proof-capsule",
             "sha256": b["bundleSha256"], "bytes": b["bundleBytes"], "mode": "0400", "type": "DETERMINISTIC_16_REGULAR_FILE_USTAR_NOT_RUNNER_BINARY"},
        ],
        "candidate": {k: b[k] for k in ("candidateSha256", "candidateBytes", "proofContractSha256")},
        "sourceCandidateSha256": candidate_source["PRODUCTION_RUNNER_SOURCE_SHA256"],
        "candidateArgv": [base + "/g3a-final-runner", "--hard-bound-static-proof", b["proofContractSha256"]],
        "inputCount": 15, "inputBytes": 265077049, "bundleMembers": census["members"],
        "inputRoot": base + "/.g3a-transaction-HARD_BOUND_STATIC_PROOF/inputs",
        "receiptRoot": base + "/.g3a-transaction-HARD_BOUND_STATIC_PROOF/receipts",
        "staging": "EXCLUSIVE_TRANSACTION_OWNED_EXTERNAL_DISK_READONLY_BIND_NO_TMPFS_COPY_NO_BUILD_CHARGE",
        "cseCommand": cse, "cseCommandSha256": sha(HERE / "CSE_COMMAND.txt"), "cseCommandUtf8Bytes": len(cse.encode()),
        "cseCwd": base, "cseRequiredUser": "root", "cseRequiredStandardTool": "sha256sum",
        "diagnosticRequiredInterpreter": "/usr/bin/python3", "diagnosticFile": str(HERE / "FIXED_DIAGNOSTIC.sh"),
        "diagnosticSha256": sha(HERE / "FIXED_DIAGNOSTIC.sh"), "diagnosticInvocationUtf8Bytes": len(d.diagnostic_script().encode()),
        "diagnosticMaximumCharacters": 3800, "actualLocalCompleteDiagnosticCharacters": 1620,
        "parserAPI": "result_parser.parse(message)",
        "transportAPIs": ["evidence_transport.diagnostic_script()", "evidence_transport.reader_script()", "evidence_transport.decode(message)"],
        "callerSelectedConfigurationAccepted": False,
        "completeEnvelopeFields": sorted(d.FIELDS), "exactHandoffFieldCount": 26, "exactProofCheckCount": 20,
        "compactSummaryAllPassed": False, "compactSummaryDiagnosticRequired": True,
        "pinnedKernel": b["pinnedKernel"], "pinnedRootCaps": b["pinnedRootCaps"],
        "pinnedBaseline": {"uidGid": "four root IDs", "Seccomp": "0", "Seccomp_filters": "0", "NoNewPrivs": "0"},
        "buildCapacityBytes": 1073741824, "buildCapacityInodes": 32768,
        "tmpCapacityBytes": 268435456, "tmpCapacityInodes": 4096,
        "preserveBeforeCleanup": ["baselineJson", "proofJson", "runtimeJson", "handoffJson"],
        "privateInputCategories": groups,
        "categoryDefinition": "Non-overlapping exact object payloads plus the two published private control invocation UTF8 strings; HTTP/TLS/SAS/service metadata excluded",
        "rawOtherInputsBytes": other_raw, "tarFramingAndPaddingBytes": overhead,
        "twoObjectTransferBytes": objects_total, "privateControlInvocationBytes": controls,
        "costRefreshRequired": True, "historical100MBGateUsable": False,
        "oldIsolationProofObjectNamingCompatible": True, "oldTwoObject100MBSizeGateCompatible": False,
        "newProducerObjectGrants": 0, "objectCount": 2,
        "productionExecutionAuthorityDigest": "", "futureAuthorityIssued": False, "liveAuthorityConsumed": False,
        "AzureReads": 0, "AzureMutations": 0, "registryOperations": 0, "frozenCoreInvocations": 0,
        "pinnedGuestQualification": "NOT_RUN", "costApproval": "PARENT_REFRESH_REQUIRED_CAD_3_00_CEILING",
    }
    fresh("ARTIFACT_BINDING.json", binding)
    cleanup = []
    for receipt in ("LOCAL_VOLUME_OWNERSHIP.json", "LOCAL_READER_VOLUME_OWNERSHIP.json"):
        ownership = json.loads((HERE / receipt).read_text())
        name = ownership["name"]
        inspected = execute(["docker", "volume", "inspect", name])
        assert inspected["exitCode"] == 0 and ownership["preexisting"] is False
        metadata = json.loads(inspected["stdout"])[0]
        assert metadata["Name"] == name
        assert metadata["Labels"]["nzila.scope"] == "g3a-hard-runner-delivery"
        assert metadata["Labels"]["nzila.owner"] == "14500503"
        removed = execute(["docker", "volume", "rm", name])
        assert removed["exitCode"] == 0
        absent = execute(["docker", "volume", "inspect", name])
        assert absent["exitCode"] != 0 and "no such volume" in absent["stderr"].lower()
        cleanup.append({"receipt": receipt, "inspect": inspected, "remove": removed, "absent": absent})
    guard()
    cache = HERE / ".checks"
    assert cache.is_dir() and not cache.is_symlink() and cache.resolve().parent == HERE
    for root, directories, files in os.walk(cache):
        assert all(not (cache / root / name).is_symlink() for name in directories + files)
    shutil.rmtree(cache)
    fresh("LOCAL_DELIVERY_VALIDATION_CLEANUP.json", {
        "outcome": "PASS", "ownedVolumes": cleanup, "ownedChecksRemoved": not cache.exists(),
        "exactEvidenceRetained": True, "candidateBinaryHistoricalArtifactsUnchanged": True})
    sources = []
    for path in sorted(HERE.iterdir()):
        if path.suffix in (".py", ".go", ".sh", ".md"):
            sources.append({"name": path.name, "sha256": sha(path), "bytes": path.stat().st_size})
    source_sha = hashlib.sha256(json.dumps(sources, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    fresh("DELIVERY_SOURCE_BINDING.json", {"definition": "SHA256 sorted canonical JSON array of name/sha256/bytes for complete delivery .py/.go/.sh/.md census",
        "sourceSha256": source_sha, "files": sources, "compiledShimSources": ["handoff_linux.go", "bundle_binding.go"],
        "candidatePreservationCensusSha256": sha(HERE / "PRESERVED_BYTES.json")})
    guard()
    fresh("PARENT_DELIVERY_REPORT.json", {
        "schema": "g3a-hard-runner-parent-delivery-report/v1",
        "integration": "PASS", "disposition": "READY_FOR_PARENT_FRESH_SAFETY_COST_AND_SINGLE_PINNED_GUEST_PROOF_NOT_LIVE_QUALIFIED",
        "artifactBindingFile": str(HERE / "ARTIFACT_BINDING.json"), "artifactBindingSha256": sha(HERE / "ARTIFACT_BINDING.json"),
        "deliverySourceBindingFile": str(HERE / "DELIVERY_SOURCE_BINDING.json"),
        "deliverySourceSha256": source_sha, "deliverySourceBindingSha256": sha(HERE / "DELIVERY_SOURCE_BINDING.json"),
        "completeSourceChanges": sources, "publishedObjects": binding["objects"], "candidate": binding["candidate"],
        "componentCensusFile": str(HERE / "DELIVERY_COMPONENT_CENSUS.json"), "componentCensusSha256": sha(HERE / "DELIVERY_COMPONENT_CENSUS.json"),
        "qualifiedPrimitivesUnchanged": True, "productionPrimitiveRows": 30, "staticProofPrimitiveRows": 30,
        "equivalenceDisposition": "Inherited exact unchanged sealed source/binary bindings, helper function and ordered inline subtree identities, not whole shim orchestration equivalence",
        "actualFinalHandoffFile": str(HERE / "FINAL_HANDOFF_VALIDATION.json"),
        "actualFinalHandoffSha256": sha(HERE / "FINAL_HANDOFF_VALIDATION.json"),
        "actualHarmlessHandoffInvocations": 2, "actualFinalCandidateProofChecks": 20,
        "strictTarGoTestsAndSubtests": 26, "actualShimEntrypointDenials": 7, "actualCorruptBundleDenied": True,
        "actualReaderFilesystemIdentityDenials": 6,
        "finalPortableParserCommand": test, "independentVerificationCommand": independent,
        "actualReaderDiagnosticReceipt": str(HERE / "DIAGNOSTIC_VALIDATION_FINAL.json"),
        "actualReaderDiagnosticSha256": sha(HERE / "DIAGNOSTIC_VALIDATION_FINAL.json"),
        "actualDiagnosticInvocationBytes": 1156, "actualCompleteDiagnosticCharacters": 1620,
        "actualKernelEvidenceScope": "LOCAL_DOCKER_KERNEL_NOT_PINNED_AZURE; PINNED_PARSER_REJECTS_IT",
        "positiveParserFixtures": "SYNTHETIC_ONLY_NOT_LIVE_AUTHORITY_OR_KERNEL_PROOF",
        "localReaderFixture": "Interpreter path aliases and owned shell executable only; published source unchanged",
        "preservedFailures": ["HANDOFF_VALIDATION_ATTEMPT_1.json", "DIAGNOSTIC_VALIDATION.json", "DIAGNOSTIC_VALIDATION_V2.json"],
        "failureDisposition": "Test USTAR metadata canonicalization and local interpreter fixture corrections; no candidate, primitive, capacity or production constructor changes",
        "localValidationResidualState": "ZERO", "localCleanupSha256": sha(HERE / "LOCAL_DELIVERY_VALIDATION_CLEANUP.json"),
        "privateInputCategories": groups, "twoObjectTransferBytes": objects_total,
        "sourceTests": [
            {"command": "python -B build_handoff.py", "result": "FIRST_UNIT_FIXTURE_FAILED; shim build PASS; original failure retained"},
            {"command": "python -B continue_validation.py", "result": "PASS actual harmless handoff and strict tar tests"},
            {"command": "python -B package_reader.py", "result": "PASS final published footer-bound shim actual handoff"},
            {"command": "python -B validate_reader_final.py", "result": "PASS exact diagnostic, six denials, lossless roundtrip, seven portable test methods"},
            {"command": "python -B -m unittest test_delivery_evidence -v", "result": "PASS final strict schema/parser fixtures"},
            {"command": "python -B verify_delivery.py", "result": "PASS independent static ELF, footer, tar, members, exact hashes and deny scope"},
        ],
        "repeatableReadOnlyVerificationCommands": [
            "python -B -m unittest test_delivery_evidence -v",
            'python -B -c "from verify_delivery import verify; print(verify())"'],
        "oneShotProducersMustNotBeBlindlyRerun": True,
        "AzureReads": 0, "AzureMutations": 0, "registryOperations": 0, "frozenCoreInvocations": 0,
        "candidateRebuilds": 0, "commits": 0, "liveAuthorityConsumed": False, "futureAuthorityIssued": False,
        "productionAuthorityDigest": "", "pinnedGuestQualification": "NOT_RUN",
        "costApproval": "PARENT_REFRESH_REQUIRED", "hardCostCeilingCAD": "3.00",
        "parentRemainingGates": ["fresh safety/permissions/image/SKU/CSE gates", "actual exact ~296MB IO pricing with >=50% contingency",
            "CAD3 cost PASS", "one-shot pinned guest final controls/static dispatch proof", "full exact evidence retention",
            "extension success and proof-owned cloud residual ZERO"],
        "beforeBaseline": before, "afterBaseline": guard(),
    })
    print(json.dumps({"integration": "PASS", "parentReportSha256": sha(HERE / "PARENT_DELIVERY_REPORT.json"),
        "artifactBindingSha256": sha(HERE / "ARTIFACT_BINDING.json"), "twoObjectBytes": objects_total,
        "privateInputCategories": groups, "localResidual": "ZERO", "AzureOperations": 0}))


if __name__ == "__main__":
    main()
