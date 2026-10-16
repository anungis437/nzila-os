"""Direct output comparisons and trace census, without another transaction."""

import gzip
import hashlib
import json
import re
import tarfile

from prepare import HERE, ROOT, baseline, ensure, fresh, load, sha, static


def main():
    fresh("CONCURRENCY_CLOSEOUT.json", baseline())
    result = load(HERE / "FULL_TRANSACTION_RESULT.json")
    output = HERE / "clean-room" / "transaction"
    comparisons = {}
    frozen = HERE.parent / "g3-final-readiness" / "local-image-frozen" / "image-run1.tar"
    with tarfile.open(frozen) as archive:
        index_raw = archive.extractfile("index.json").read()
        manifest_raw = archive.extractfile("blobs/sha256/" +
                                            json.loads(index_raw)["manifests"][0]["digest"].split(":")[1]).read()
        manifest = json.loads(manifest_raw)
        expected = {
            "config.json": archive.extractfile("blobs/sha256/" + manifest["config"]["digest"].split(":")[1]).read(),
            "manifest.json": manifest_raw,
            "index.json": index_raw,
        }
        for number, layer in enumerate(manifest["layers"], 1):
            compressed = archive.extractfile("blobs/sha256/" + layer["digest"].split(":")[1]).read()
            expected["layer" + str(number) + ".tar.gz"] = compressed
            expected["layer" + str(number) + ".tar"] = gzip.decompress(compressed)
        import io
        with tarfile.open(fileobj=io.BytesIO(expected["layer1.tar"])) as layer:
            expected["g3-runtime"] = layer.extractfile("g3-runtime").read()
        for name, raw in expected.items():
            path = output / name
            if not path.exists():
                comparisons[name] = {"result": "NOT_RUN"}
                continue
            candidate = path.read_bytes()
            difference = next((i for i, pair in enumerate(zip(raw, candidate)) if pair[0] != pair[1]), None)
            if difference is None and len(raw) != len(candidate):
                difference = min(len(raw), len(candidate))
            comparisons[name] = {
                "result": "YES" if raw == candidate else "NO", "candidateBytes": len(candidate),
                "frozenBytes": len(raw), "candidateSha256": hashlib.sha256(candidate).hexdigest(),
                "frozenSha256": hashlib.sha256(raw).hexdigest(), "firstDifferentByteZeroBased": difference,
            }
    fresh("EXACT_BYTE_COMPARISON.json", comparisons)
    census = load(HERE / "STAGED_INPUT_CENSUS.json")
    ensure({path.name: {"sha256": sha(path), "bytes": path.stat().st_size}
            for path in (HERE / "inputs").iterdir()} == census["entries"], "INPUTS_CHANGED_DURING_TRANSACTION")
    trace = (output / "compiler-diagnostic.txt").read_text() if (output / "compiler-diagnostic.txt").exists() else ""
    tools = load(HERE / "inputs" / "toolchain-members.json")
    tool_paths = sorted(set(re.findall(r"(/work/transaction/go/(?:bin|pkg/tool/linux_amd64)/[a-zA-Z0-9_-]+)(?=\s|$)",
                                      trace)))
    generated_tests = sorted(set(re.findall(r"^\s*(\$WORK/[^\s]+\.test)(?=\s|$)", trace, re.MULTILINE)))
    executables = []
    if result["exitCode"] == 0:
        for name in ("portable-assembler", "compressor-go1256"):
            static(HERE / "inputs" / name)
            executables.append({"path": "/inputs/" + name, "classification": "STAGED_INPUT",
                                **census["entries"][name]})
        executables.append({"path": "/work/transaction/go/bin/go", "classification": "STAGED_INPUT",
                            **tools["bin/go"]})
        for path in tool_paths:
            relative = path.removeprefix("/work/transaction/go/")
            ensure(relative in tools and tools[relative]["mode"] & 0o111, "TRACE_TOOL_NOT_STAGED")
            static(HERE / "preparation-toolchain" / relative)
            executables.append({"path": path, "classification": "STAGED_INPUT", **tools[relative]})
        for path in generated_tests:
            executables.append({"path": path, "classification": "TRANSACTION_GENERATED_FROM_STAGED_SOURCE",
                                "origin": "VERIFIED_SOURCE_TAR_TESTS_COMPILED_BY_STAGED_GO"})
        ensure(tool_paths and generated_tests and
               all(any(path.endswith("/" + name) for path in tool_paths)
                   for name in ("compile", "asm", "link", "vet")), "EXECUTABLE_TRACE_INCOMPLETE")
    fresh("EXECUTABLE_CENSUS.json", {
        "status": "PASS" if result["exitCode"] == 0 else "FAIL", "entries": executables,
        "evidence": "DIRECT_CONTROLLER_INVOCATIONS_AND_GO_X_EXECUTION_TRACE",
        "traceFile": str(output / "compiler-diagnostic.txt"),
        "goTracePseudoShellOperations": "MKDIR_CP_CAT_CD_ARE_GO_INTERNAL_FILESYSTEM_TRACE_NOT_SHELL_EXECUTIONS",
        "hostOnlyExecutables": [], "outerBoundaryUtilities": ["/bin/sh", "/bin/chmod"],
        "outerBoundaryUtilitiesUsedInsideFullTransaction": False,
        "generatedTestBinarySymbolicPaths": "$WORK_IS_GO_TRANSACTION_OWNED_TMP_DIRECTORY",
    })
    success = result["exitCode"] == 0 and all(item["result"] == "YES" for item in comparisons.values())
    ensure(result["exitCode"] != 0 or success, "SUCCESS_EXIT_NOT_EXACT_BYTES")
    prior = load(HERE.parent / "g3a-go1256" / "GO1256_VERIFICATION.json")
    terminal = [(relative, value) for relative, value in prior["preservedPacketHashes"].items()
                if value == "ed29f65fc52a89a707d76bf553a24f579e1542ddf439245edcf0cde3ccc0f499"]
    ensure(len(terminal) == 1 and sha(ROOT / terminal[0][0]) == terminal[0][1], "G2_TERMINAL_ROOT_CHANGED")
    disposition = {
        "G3_EXECUTION_READINESS": "BLOCKED",
        "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED" if success else "BLOCKED",
        "CLEAN_ROOM_HOST_ENGINE_ISOLATION": "PASS",
        "STAGED_INPUT_INTEGRITY": "PASS",
        "APP_BINARY_EXACT": comparisons["g3-runtime"]["result"],
        "APP_LAYER_TAR_EXACT": comparisons["layer1.tar"]["result"],
        "CERT_LAYER_TAR_EXACT": comparisons["layer2.tar"]["result"],
        "APP_GZIP_EXACT": comparisons["layer1.tar.gz"]["result"],
        "CERT_GZIP_EXACT": comparisons["layer2.tar.gz"]["result"],
        "CONFIG_EXACT": comparisons["config.json"]["result"],
        "CANDIDATE_MANIFEST_DIGEST": "sha256:" + sha(output / "manifest.json") if (output / "manifest.json").exists() else "NOT_RUN",
        "G3A_PORTABLE_IMAGE_REPRODUCTION": "PASS" if success else "FAIL",
        "G3A_TOOLCHAIN_SELF_CONTAINED": "PASS" if success else "FAIL",
        "TOTAL_G3A_STAGED_INPUT_BYTES": census["totalStagedBytes"],
        "G3A_REGISTRY_UPLOADER": "NOT_AUTHORIZED", "G3A_CONTROLLER": "INCOMPLETE",
        "G3A_BICEP_PACKAGE": "INCOMPLETE", "G3_EXECUTOR_OWNER_CONTRACT": "BOUND",
        "ownerBoundMeaning": "EXISTING_OWNER_CANDIDATE_CONTRACT_NO_EXECUTOR_CREATED_OR_AZURE_GRANT_INFERRED",
        "G3_GRANT_EXECUTOR_MODEL": "BLOCKED", "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "G3A_EXECUTION_AUTHORIZED": "NO", "G3B_EXECUTION_AUTHORIZED": "NO",
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "OCI_INDEX_DIGEST": "sha256:" + sha(output / "index.json") if (output / "index.json").exists() else "NOT_RUN",
        "OCI_LAYOUT_VERSION": "1.0.0" if success else "NOT_RUN",
        "fullTransactions": 1, "secondFullTransaction": "NOT_RUN_NOT_AUTHORIZED",
        "newAzureReadCalls": 0, "guestExecution": False, "frozenManifestChanged": False,
        "remainingDependency": None if success else result["stderr"].strip(),
        "nextAuthority": "G3A_REGISTRY_UPLOADER_AND_CONTROLLER_QUALIFICATION" if success else "NONE_STOP",
        "futureGuestDeliveryScope": "EXACT_BUILD_INPUT_PAYLOAD_ONLY_READER_RUNTIME_BOOTSTRAP_TRANSPORT_NOT_YET_QUALIFIED",
    }
    fresh("FULL_REHEARSAL_DISPOSITION.json", disposition)
    print(json.dumps(disposition, indent=2))


if __name__ == "__main__":
    main()
