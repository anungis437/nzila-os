"""Seal the single failed attempt; no controller changes or additional execution."""

import ast
from pathlib import Path
import re

from prepare import HERE, PRIOR, ROOT, baseline, ensure, fresh, load, sha, static


def main():
    fresh("CONCURRENCY_SEAL.json", baseline())
    result = load(HERE / "FULL_TRANSACTION_RESULT.json")
    ensure(result["fullTransactions"] == 1 and result["exitCode"] == 1 and
           result["stderr"].strip() == "open /output/manifest.json: file exists",
           "EXPECTED_SINGLE_ATTEMPT_STOP")
    comparison = load(HERE / "EXACT_BYTE_COMPARISON.json")
    ensure(all(item["result"] == "YES" for name, item in comparison.items() if name != "index.json") and
           comparison["index.json"]["result"] == "NOT_RUN", "EXACT_MEASURED_STOP_BOUNDARY")
    output = HERE / "clean-room" / "transaction"
    ensure(not (output / "index.json").exists() and not (output / "oci").exists() and
           not (output / "result.json").exists(), "INCOMPLETE_TRANSACTION_FALSE_SUCCESS")
    census = load(HERE / "STAGED_INPUT_CENSUS.json")
    trace = (output / "compiler-diagnostic.txt").read_text()
    tools = load(HERE / "inputs" / "toolchain-members.json")
    used_tools = sorted(set(re.findall(
        r"(/work/transaction/go/pkg/tool/linux_amd64/[a-zA-Z0-9_-]+)(?=\s|$)", trace)))
    tests = sorted(set(re.findall(r"^(\$WORK/[^\s]+\.test)(?=\s|$)", trace, re.MULTILINE)))
    ensure(used_tools and tests and all(any(path.endswith("/" + name) for path in used_tools)
                                      for name in ("compile", "asm", "link", "vet")),
           "EXECUTABLE_TRACE_INCOMPLETE")
    entries = []
    for name in ("portable-assembler", "compressor-go1256"):
        static(HERE / "inputs" / name)
        entries.append({"path": "/inputs/" + name, "classification": "STAGED_INPUT",
                        **census["entries"][name]})
    entries.append({"path": "/work/transaction/go/bin/go", "classification": "STAGED_INPUT", **tools["bin/go"]})
    for path in used_tools:
        relative = path.removeprefix("/work/transaction/go/")
        ensure(relative in tools and tools[relative]["mode"] & 0o111, "UNSTAGED_TRACE_EXECUTABLE")
        static(HERE / "preparation-toolchain" / relative)
        entries.append({"path": path, "classification": "STAGED_INPUT", **tools[relative]})
    for path in tests:
        entries.append({"path": path, "classification": "TRANSACTION_GENERATED_FROM_STAGED_SOURCE",
                        "origin": "VERIFIED_SOURCE_TAR_AND_STAGED_GO_TEST_LINKER_TRACE"})
    fresh("EXECUTABLE_CENSUS_FINAL.json", {
        "status": "PASS_FOR_EXECUTED_TRANSACTION", "entries": entries, "hostOnlyExecutables": [],
        "trace": str(output / "compiler-diagnostic.txt"), "compilerInvocations": [
            line for line in trace.splitlines() if line.startswith("STAGED_GO_INVOCATION")],
        "pseudoShellTrace": "GO_INTERNAL_MKDIR_CP_CAT_CD_ARE_NOT_EXTERNAL_PROCESS_INVOCATIONS",
        "outerBoundaryUtilities": ["/bin/sh", "/bin/chmod"], "outerUtilitiesInsideFullTransaction": False,
        "qualification": "SELF_CONTAINMENT_PASSES_NOT_TRANSACTION_COMPLETENESS",
        "supersedes": "EXECUTABLE_CENSUS.json_EMPTY_BECAUSE_FIRST_CLOSEOUT_REQUIRED_SUCCESS_EXIT",
    })
    disposition = load(HERE / "FULL_REHEARSAL_DISPOSITION.json")
    disposition["G3A_TOOLCHAIN_SELF_CONTAINED"] = "PASS"
    disposition["remainingDependency"] = (
        "Move exclusive manifest preservation/exact gate outside the layer-descriptor loop; "
        "the current placement writes the same exclusive output twice and stops before OCI index/layout. "
        "Correction and another full transaction require new authority."
    )
    disposition["failureOwnership"] = "ASSISTANT_INTRODUCED_CONTROLLER_CONTROL_FLOW_BUG_NOT_COMPRESSOR_OR_IMAGE_DRIFT"
    disposition["supersedes"] = "FULL_REHEARSAL_DISPOSITION.json_SELF_CONTAINMENT_WAS_EXIT_CODE_CONFLATED"
    disposition["controllerCorrectedAfterStop"] = False
    fresh("FULL_REHEARSAL_DISPOSITION_FINAL.json", disposition)
    build = load(HERE / "ASSEMBLER_BUILD.json")
    ensure(sha(HERE / "inputs" / "portable-assembler") == build["binarySha256"] and
           build["tests"] == "PASS_5" and build["vet"] == build["build"] == "PASS",
           "EXECUTED_CONTROLLER_CHANGED")
    for name, expected in build["sourceHashes"].items():
        ensure(sha(HERE / "assembler" / name) == expected, "ATTEMPT_SOURCE_CHANGED")
    prior_path = PRIOR / "GO1256_VERIFICATION.json"
    ensure(sha(prior_path) == "7dea5383fac3277120b4a4c71350f21635cc10d9a8c4021afe34dcbded6db8cc",
           "PRIOR_ROOT_CHANGED")
    prior = load(prior_path)
    excluded = {"GO1256_VERIFICATION.json", "GO1256_INDEPENDENT_VERIFICATION.json"}
    actual = {str(path.relative_to(PRIOR)): sha(path) for path in PRIOR.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(actual == prior["go1256FileHashes"], "PRIOR_QUALIFICATION_CENSUS_CHANGED")
    preserved = dict(prior["preservedPacketHashes"])
    for path in PRIOR.rglob("*"):
        if path.is_file():
            preserved[str(path.relative_to(ROOT))] = sha(path)
    for relative, expected in preserved.items():
        ensure(sha(ROOT / relative) == expected, "SEALED_HISTORICAL_BYTES_CHANGED")
    for path in HERE.glob("*.py"):
        ast.parse(path.read_text(), filename=str(path))
    fresh("FULL_REHEARSAL_LOCAL_VALIDATION.json", {
        "controllerUnitTests": "PASS_5", "vet": "PASS", "staticBuild": "PASS", "pythonSyntax": "PASS",
        "singleFullTransaction": "FAIL_CONTROLLER_DUPLICATE_EXCLUSIVE_MANIFEST_WRITE",
        "exactApplicationTarsGzipConfigAndPreservedManifest": "PASS_DIRECT_BYTE_COMPARISON",
        "indexAndLayout": "NOT_RUN", "secondFullTransaction": "NOT_RUN_NOT_AUTHORIZED",
        "controllerFixTests": "NOT_RUN_STOP", "uploaderRegistryCloudGuestChecks": "NOT_AUTHORIZED",
    })
    hashes = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
              if path.is_file() and path.name not in {"FULL_REHEARSAL_VERIFICATION.json",
                                                     "FULL_REHEARSAL_INDEPENDENT_VERIFICATION.json"}}
    authority = load(HERE / "AUTHORITY_BINDING.json")
    ensure(sha(Path(authority["path"])) == authority["sha256"], "AUTHORITY_CHANGED")
    fresh("FULL_REHEARSAL_VERIFICATION.json", {
        "status": "PASS_EVIDENCE_INTEGRITY_SINGLE_FAILED_TRANSACTION",
        "authority": authority, "priorRootSha256": sha(prior_path),
        "preservedPacketHashes": preserved, "rehearsalFileHashes": hashes,
        "protectedReferences": len(preserved), "fullTransactionCount": 1,
        "G3A_PORTABLE_PRIVATE_BUILDER": "BLOCKED", "G3_EXECUTION_READINESS": "BLOCKED",
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
    })
    print("FAILED_REHEARSAL_EVIDENCE_ROOT=" + sha(HERE / "FULL_REHEARSAL_VERIFICATION.json"))


if __name__ == "__main__":
    main()
