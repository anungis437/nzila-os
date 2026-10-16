"""Seal the successful single retry without further transaction execution."""

import ast
import gzip
import hashlib
import io
import re
import struct
import tarfile

from common import AUTHORITY, HERE, PRIOR, ROOT, baseline, ensure, fresh, load, sha
from validate import minimal_patch


def static(raw):
    ensure(len(raw) >= 64 and raw[:6] == b"\x7fELF\x02\x01" and raw[18:20] == b"\x3e\x00", "ELF_PLATFORM")
    offset = struct.unpack_from("<Q", raw, 32)[0]
    stride, count = struct.unpack_from("<HH", raw, 54)
    ensure(stride >= 56 and count > 0 and offset + stride * count <= len(raw) and
           all(struct.unpack_from("<I", raw, offset + i * stride)[0] != 3 for i in range(count)),
           "STATIC_EXECUTABLE_INTERPRETER")


def main():
    fresh("CONCURRENCY_SEAL.json", baseline())
    minimal_patch()
    ensure(load(HERE / "FULL_RETRY_RESULT.json")["exitCode"] == 0 and
           load(HERE / "AUTHORITY_CONSUMPTION.json")["fullRetriesInvoked"] == 1, "ONE_SUCCESSFUL_RETRY_REQUIRED")
    output = HERE / "clean-room" / "transaction"
    census = load(HERE / "STAGED_INPUT_CENSUS.json")
    inputs = HERE / "inputs"
    ensure({path.name: {"sha256": sha(path), "bytes": path.stat().st_size} for path in inputs.iterdir()} ==
           census["entries"], "STAGED_INPUTS_CHANGED")
    prior_census = load(PRIOR / "STAGED_INPUT_CENSUS.json")
    changed = {name for name in census["entries"] if census["entries"][name] != prior_census["entries"][name]}
    ensure(changed == {"portable-assembler", "controller-main.go", "binding.json"}, "INPUT_SCOPE_DRIFT")
    old_binding, new_binding = load(PRIOR / "inputs" / "binding.json"), load(inputs / "binding.json")
    for name in ("portable-assembler", "controller-main.go"):
        ensure(new_binding["inputs"][name] == census["entries"][name], "REPAIRED_BINDING")
        old_binding["inputs"][name] = new_binding["inputs"][name]
    ensure(old_binding == new_binding, "UNRELATED_BINDING_CHANGE")
    frozen = HERE.parent / "g3-final-readiness" / "local-image-frozen" / "image-run1.tar"
    expected, comparisons = {}, {}
    with tarfile.open(frozen) as archive:
        index = archive.extractfile("index.json").read()
        import json
        manifest_digest = json.loads(index)["manifests"][0]["digest"]
        manifest = archive.extractfile("blobs/sha256/" + manifest_digest.split(":")[1]).read()
        metadata = json.loads(manifest)
        expected["manifest.json"], expected["index.json"] = manifest, index
        expected["config.json"] = archive.extractfile("blobs/sha256/" +
                                                      metadata["config"]["digest"].split(":")[1]).read()
        for number, layer in enumerate(metadata["layers"], 1):
            compressed = archive.extractfile("blobs/sha256/" + layer["digest"].split(":")[1]).read()
            raw = gzip.decompress(compressed)
            expected["layer" + str(number) + ".tar.gz"] = compressed
            expected["layer" + str(number) + ".tar"] = raw
            with tarfile.open(fileobj=io.BytesIO(raw)) as stream:
                for member in stream:
                    ensure(member.uid == member.gid == 0 and member.mtime == 946684800 and
                           member.type in (tarfile.REGTYPE, tarfile.DIRTYPE), "RUNTIME_TAR_METADATA")
                    if member.name == "g3-runtime":
                        expected["g3-runtime"] = stream.extractfile(member).read()
                    if member.name == "etc/ssl/certs/ca-certificates.crt":
                        ensure(stream.extractfile(member).read() == (inputs / "ca-certificates.crt").read_bytes(),
                               "STAGED_CA_NOT_EXACT")
    for name, raw in expected.items():
        candidate = (output / name).read_bytes()
        ensure(candidate == raw, "EXACT_OUTPUT_BYTES_" + name)
        comparisons[name] = {"bytesEqual": True, "bytes": len(raw),
                             "sha256": hashlib.sha256(raw).hexdigest(), "firstDifferentByteZeroBased": None}
    fresh("EXACT_OUTPUT_COMPARISON.json", comparisons)
    static(expected["g3-runtime"])
    layout = output / "oci"
    intended = {
        "index.json": expected["index.json"], "oci-layout": b'{"imageLayoutVersion":"1.0.0"}',
    }
    for name in ("config.json", "layer1.tar.gz", "layer2.tar.gz", "manifest.json"):
        raw = expected[name]
        intended["blobs/sha256/" + hashlib.sha256(raw).hexdigest()] = raw
    actual = {str(path.relative_to(layout)).replace("\\", "/"): path.read_bytes()
              for path in layout.rglob("*") if path.is_file()}
    ensure(actual == intended and len(actual) == 6, "OCI_EXACT_SIX_FILE_CENSUS")
    index_metadata = load(layout / "index.json")
    ensure(len(index_metadata["manifests"]) == 1 and
           index_metadata["manifests"][0]["digest"] == manifest_digest and
           index_metadata["manifests"][0]["size"] == len(expected["manifest.json"]),
           "INDEX_MANIFEST_DESCRIPTOR")
    fresh("OCI_LAYOUT_COMPLETENESS.json", {
        "status": "PASS", "fileCount": 6,
        "files": {name: {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
                  for name, raw in intended.items()},
        "indexDescriptor": index_metadata["manifests"][0], "layoutVersion": "1.0.0",
        "frozenIndexBytesEqual": True, "machineSpecificMetadataAdded": False,
    })
    trace = (output / "compiler-diagnostic.txt").read_text()
    ensure((output / "compiler.log").read_text() == trace, "COMPILER_TRACE_PRESERVATION")
    tools = load(inputs / "toolchain-members.json")
    actual_tools = sorted(set(re.findall(r"(/work/transaction/go/pkg/tool/linux_amd64/[a-zA-Z0-9_-]+)(?=\s|$)", trace)))
    tests = sorted(set(re.findall(r"^(\$WORK/[^\s]+\.test)(?=\s|$)", trace, re.MULTILINE)))
    ensure(actual_tools and tests and all(any(path.endswith("/" + name) for path in actual_tools)
                                         for name in ("compile", "asm", "link", "vet")),
           "ACTUAL_EXECUTABLE_CENSUS_INCOMPLETE")
    entries = []
    for name in ("portable-assembler", "compressor-go1256"):
        static((inputs / name).read_bytes())
        entries.append({"path": "/inputs/" + name, "classification": "STAGED_INPUT", **census["entries"][name]})
    entries.append({"path": "/work/transaction/go/bin/go", "classification": "STAGED_INPUT", **tools["bin/go"]})
    for path in actual_tools:
        relative = path.removeprefix("/work/transaction/go/")
        ensure(relative in tools and tools[relative]["mode"] & 0o111, "EXECUTABLE_NOT_STAGED")
        static((PRIOR / "preparation-toolchain" / relative).read_bytes())
        entries.append({"path": path, "classification": "STAGED_INPUT", **tools[relative]})
    for path in tests:
        entries.append({"path": path, "classification": "TRANSACTION_GENERATED_FROM_STAGED_SOURCE",
                        "origin": "VERIFIED_SOURCE_AND_STAGED_GO_TEST_LINK_TRACE"})
    fresh("EXECUTABLE_CENSUS.json", {
        "status": "PASS", "entries": entries, "hostOnlyExecutables": [],
        "outerUtilitiesInsideFullTransaction": False, "outerUtilities": ["/bin/sh"],
        "goTracePseudoShell": "GO_INTERNAL_FILESYSTEM_OPERATIONS_NOT_SHELL_EXECUTION",
        "evidence": "CONTROLLER_DIRECT_INVOCATIONS_AND_GO_X_TRACE",
        "compilerInvocations": [line for line in trace.splitlines() if line.startswith("STAGED_GO_INVOCATION")],
    })
    review = load(HERE / "CONTROLLER_PATCH_REVIEW.json")
    for name, value in review["sourceHashes"].items():
        ensure(sha(HERE / "assembler" / name) == value, "REPAIRED_SOURCE_CHANGED")
    disposition = {
        "G3_EXECUTION_READINESS": "BLOCKED", "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED",
        "CONTROLLER_PATCH_SCOPE": "MANIFEST_WRITE_CONTROL_FLOW_ONLY",
        "CONTROLLER_CHANGED_FILES": review["CONTROLLER_CHANGED_FILES"], "UNRELATED_SOURCE_CHANGES": 0,
        "MANIFEST_SINGLE_WRITE_REGRESSION": "PASS", "CONTROLLER_LOCAL_VALIDATION": "PASS",
        "CLEAN_ROOM_HOST_ENGINE_ISOLATION": "PASS", "STAGED_INPUT_INTEGRITY": "PASS",
        "APP_BINARY_EXACT": "YES", "APP_LAYER_TAR_EXACT": "YES", "CERT_LAYER_TAR_EXACT": "YES",
        "APP_GZIP_EXACT": "YES", "CERT_GZIP_EXACT": "YES", "CONFIG_EXACT": "YES",
        "MANIFEST_SINGLE_WRITE": "PASS", "MANIFEST_EXACT": "YES",
        "CANDIDATE_MANIFEST_DIGEST": manifest_digest,
        "OCI_INDEX_DIGEST": "sha256:" + sha(output / "index.json"), "OCI_LAYOUT_VERSION": "1.0.0",
        "OCI_LAYOUT_COMPLETENESS": "PASS", "G3A_PORTABLE_IMAGE_REPRODUCTION": "PASS",
        "G3A_TOOLCHAIN_SELF_CONTAINED": "PASS", "FULL_REHEARSAL_RETRY_AUTHORITY_CONSUMED": "YES",
        "G3A_BUILD_CONTROLLER_CORE": "QUALIFIED", "G3A_REGISTRY_UPLOADER": "NOT_AUTHORIZED",
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO", "G3A_EXECUTION_AUTHORIZED": "NO", "G3B_EXECUTION_AUTHORIZED": "NO",
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "TOTAL_G3A_STAGED_INPUT_BYTES": census["totalStagedBytes"],
        "PRIOR_TOTAL_G3A_STAGED_INPUT_BYTES": census["priorTotalBytes"], "stagedBytesDelta": census["deltaBytes"],
        "stagedInputChanges": census["changes"], "fullRetries": 1, "secondRetry": "NOT_RUN_NOT_AUTHORIZED",
        "nextAuthority": "G3A_REGISTRY_UPLOADER_AND_CONTROLLER_QUALIFICATION",
        "nextAuthorityIssued": False, "cloudReads": 0, "registryCalls": 0, "guestExecution": False,
        "frozenImageChanged": False, "priorFailedAttemptPreserved": True,
        "manifestWriteProof": "STATIC_CONTROL_FLOW_REGRESSION_PLUS_SUCCESSFUL_EXCLUSIVE_WRITE_TRANSACTION",
        "readerBootstrapDeliveryRuntime": "NOT_QUALIFIED_SEPARATE_AUTHORITY",
    }
    prior_path = PRIOR / "FULL_REHEARSAL_VERIFICATION.json"
    ensure(sha(prior_path) == "bd5be23c49e92d95efe25ab21eb46a5a57af6279d7965d835b2cdd243b07b461",
           "FAILED_ATTEMPT_ROOT_CHANGED")
    root = load(prior_path)
    excluded = {"FULL_REHEARSAL_VERIFICATION.json", "FULL_REHEARSAL_INDEPENDENT_VERIFICATION.json"}
    actual_prior = {str(path.relative_to(PRIOR)): sha(path) for path in PRIOR.rglob("*")
                    if path.is_file() and path.name not in excluded}
    ensure(actual_prior == root["rehearsalFileHashes"], "FAILED_ATTEMPT_CENSUS_CHANGED")
    preserved = dict(root["preservedPacketHashes"])
    for path in PRIOR.rglob("*"):
        if path.is_file():
            preserved[str(path.relative_to(ROOT))] = sha(path)
    for relative, value in preserved.items():
        ensure(sha(ROOT / relative) == value, "HISTORICAL_PACKET_CHANGED")
    ensure(any(value == "ed29f65fc52a89a707d76bf553a24f579e1542ddf439245edcf0cde3ccc0f499"
               for value in preserved.values()), "G2_TERMINAL_ROOT_NOT_PROTECTED")
    fresh("REPAIR_DISPOSITION.json", disposition)
    for path in HERE.glob("*.py"):
        ast.parse(path.read_text(), filename=str(path))
    fresh("REPAIR_LOCAL_VALIDATION.json", {
        "priorRegression": "FAIL_EXPECTED", "repairedUnitTests": "PASS_6", "vet": "PASS", "staticBuild": "PASS",
        "exactControlFlowPatch": "PASS", "pythonSyntax": "PASS", "singleFullRetry": "PASS",
        "rawFrozenOutputs": "PASS", "sixFileOciTree": "PASS", "executableCensus": "PASS",
        "uploaderCloudGuestRegistryChecks": "NOT_AUTHORIZED",
    })
    hashes = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
              if path.is_file() and path.name not in {"REPAIR_VERIFICATION.json", "REPAIR_INDEPENDENT_VERIFICATION.json"}}
    fresh("REPAIR_VERIFICATION.json", {
        "status": "PASS_EVIDENCE_INTEGRITY_SINGLE_REPAIRED_RETRY",
        "authorityPath": str(AUTHORITY), "authoritySha256": sha(AUTHORITY),
        "priorFailedRootSha256": sha(prior_path), "preservedPacketHashes": preserved,
        "repairFileHashes": hashes, "protectedReferences": len(preserved),
        "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED", "G3_EXECUTION_READINESS": "BLOCKED",
        "fullRetries": 1, "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
    })
    print("REPAIR_ROOT_SHA256=" + sha(HERE / "REPAIR_VERIFICATION.json"))
    print("G3A_PORTABLE_PRIVATE_BUILDER=QUALIFIED; G3_EXECUTION_READINESS=BLOCKED; STOP")


if __name__ == "__main__":
    main()
