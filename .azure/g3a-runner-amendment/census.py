"""Read-only frozen-core census, bound before compatibility tests or runner edits."""

import hashlib
import json
from pathlib import Path
import re
import sys
import tarfile

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
CORE = BASE / "g3a-controller-repair"
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\d6d4d510-faf4-4b3e-90eb-fe57eff9cb77\Pasted text #1.txt")
sys.path.insert(0, str(BASE / "g3a-isolation-live"))
import isolation_live as prior


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def fresh(name, value):
    with (HERE / name).open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def main():
    prior.ca.refresh.HERE = HERE
    prior.ca.refresh.fresh("CONCURRENCY_CENSUS.json", prior.baseline())
    root = BASE / "g3a-isolation-live" / "ISOLATION_VERIFICATION.json"
    require(sha(root) == "ef348fa762c5e62a73ace8a26a95cb4e5427fa36677ce437a0d0c6dcc4890bae",
            "PREVIOUS_PROOF_ROOT_CHANGED")
    previous = json.loads(root.read_text())
    protected = dict(previous["protectedFileHashes"])
    protected.update({str(root.parent / key): value for key, value in previous["fileHashes"].items()})
    protected.update({str(Path(previous["artifactPath"]) / key): value
                      for key, value in previous["artifactFileHashes"].items()})
    protected[str(root)] = sha(root)
    for name, expected in protected.items():
        require(sha(name) == expected, "PRIOR_REFERENCE_CHANGED_" + name)
    binding = json.loads((CORE / "inputs" / "binding.json").read_text())
    for name, expected in binding["inputs"].items():
        path = CORE / "inputs" / name
        require(sha(path) == expected["sha256"] and path.stat().st_size == expected["bytes"],
                "FROZEN_INPUT_DRIFT_" + name)
    require(sha(CORE / "assembler" / "main.go") == binding["inputs"]["controller-main.go"]["sha256"] and
            sha(CORE / "assembler" / "compressor.go") == binding["inputs"]["controller-compressor.go"]["sha256"],
            "FROZEN_ASSEMBLER_SOURCE_DRIFT")
    trace_path = CORE / "clean-room" / "transaction" / "compiler.log"
    trace = trace_path.read_text()
    tools = json.loads((CORE / "inputs" / "toolchain-members.json").read_text())
    execution = []
    for path, component, readonly, source, dynamic in (
        ("/inputs/portable-assembler", "frozen assembler", True, "portable-assembler", False),
        ("/inputs/compressor-go1256", "frozen compressor", True, "compressor-go1256", False),
        ("/work/transaction/go/bin/go", "staged Go driver", False, "bin/go", False),
        *[(f"/work/transaction/go/pkg/tool/linux_amd64/{name}", f"Go {name}", False,
           f"pkg/tool/linux_amd64/{name}", False) for name in ("compile", "asm", "link", "vet")],
        ("/tmp/go-build<random>/b001/g3-final-synthetic.test", "generated source test ELF",
         False, "sealed source.tar + staged Go link", True),
    ):
        entry = {"guestPath": path, "component": component, "readOnly": readonly,
                 "executionRequired": True, "privilegeStage": "AFTER_DROP",
                 "sourceArtifact": source, "transactionGenerated": dynamic}
        if source in binding["inputs"]:
            entry.update(binding["inputs"][source])
        elif source in tools:
            entry.update(tools[source])
        execution.append(entry)
    used_tools = sorted(set(re.findall(r"(?:^| )/work/transaction/go/pkg/tool/linux_amd64/([a-z0-9]+)\b",
                                      trace, re.MULTILINE)))
    require(used_tools == ["asm", "compile", "link", "vet"], "UNEXPECTED_TOOL_IN_FROZEN_TRACE")
    require(re.search(r"^\$WORK/b001/g3-final-synthetic\.test\b", trace, re.MULTILINE),
            "TEMPORARY_TEST_EXECUTION_NOT_IN_TRACE")
    dependencies = {}
    with tarfile.open(CORE / "inputs" / "go-toolchain.tar") as archive:
        for name in ("src/cmd/go/internal/work/action.go", "src/cmd/go/internal/work/gc.go",
                     "src/cmd/go/internal/work/exec.go", "src/cmd/go/internal/work/shell.go",
                     "src/cmd/go/internal/test/test.go", "src/os/file_unix.go"):
            raw = archive.extractfile(name).read()
            path = BASE / "g3a-full-rehearsal" / "preparation-toolchain" / Path(name)
            require(path.read_bytes() == raw, "CACHED_GO_SOURCE_NOT_ACTUAL_STAGED_TOOLCHAIN")
            dependencies[name] = {"sha256": hashlib.sha256(raw).hexdigest(),
                                  "path": str(path), "bytes": len(raw)}
        version = archive.extractfile("VERSION").read().decode()
    source_launches = []
    source_temp = []
    with tarfile.open(CORE / "inputs" / "source.tar") as archive:
        for member in archive:
            if member.isfile() and member.name.endswith(".go"):
                text = archive.extractfile(member).read().decode()
                source_launches.extend((member.name, index, line) for index, line in enumerate(text.splitlines(), 1)
                                       if re.search(r'os/exec|exec\.Command|syscall\.Exec|StartProcess', line))
                source_temp.extend((member.name, index, line) for index, line in enumerate(text.splitlines(), 1)
                                   if re.search(r'TempDir|MkdirTemp|TMPDIR|"/tmp', line))
    require(not source_launches and not source_temp, "NEW_SOURCE_TEST_EXEC_OR_TEMP_CONTRACT")
    fresh("AUTHORITY_BINDING.json", {"mission": "NZ-20261008-INFRA-001", "authorityPath": str(AUTHORITY),
          "authoritySha256": sha(AUTHORITY), "newLiveAuthority": True, "consumed": False,
          "maximumLiveRuns": 1, "previousRootSha256": sha(root), "protectedFileHashes": protected})
    fresh("EXEC_PATH_CENSUS.json", {
        "status": "COMPLETE", "entries": execution, "actualToolchainVersion": version,
        "coreSha256": binding["inputs"]["portable-assembler"]["sha256"],
        "directExec": [
            {"source": "assembler/main.go", "line": 311, "target": "work/go/bin/go", "count": 3},
            {"source": "assembler/compressor.go", "line": 32, "target": "inputs/compressor-go1256", "count": 2}],
        "syscallExecOrShellHelpersInCore": [], "sourceApplicationOrTestsSpawnChildren": False,
        "notInvokedInExactContract": ["gofmt", "cgo (CGO_ENABLED=0)", "cover (no coverage flag)",
                                      "fix (no fix command)", "preprofile (no PGO profile)"],
        "goTransitiveSources": dependencies, "traceSha256": sha(trace_path),
        "traceUsedTools": used_tools, "binaryOutputIsNotExecutedByAssembler": True,
        "compressor": "Static frozen Go1.25.6 gzip binary; files in work, no external executable.",
        "stagedDriver": "Go1.27.2; distinct from frozen gzip compiler version.",
        "creationPreconditions": [
            {"path": "/work/transaction", "requirement": "MUST_NOT_EXIST", "sourceLine": 224},
            {"path": "/work/transaction/go", "requirement": "MUST_NOT_EXIST",
             "sourceFunction": "extract: os.Mkdir(dest,0700)"}],
        "hypothesis": "Pre-mounted exec /work/transaction/go; NOT approved or production-qualified.",
    })
    fresh("TEMP_PATH_CENSUS.json", {
        "status": "COMPLETE_PATHS_CAPACITY_UNQUALIFIED",
        "environment": {"TMPDIR": "/tmp", "TEMP": "NOT_PASSED", "TMP": "NOT_PASSED",
                        "GOTMPDIR": "NOT_PASSED; os.MkdirTemp falls back to TMPDIR",
                        "HOME": "/work/transaction", "GOCACHE": "/work/transaction/cache",
                        "GOPATH": "/work/transaction/gopath"},
        "entries": [
            {"path": "/tmp/go-build<random>", "writeRequired": True, "executionRequired": True,
             "bytesRequired": "UNRESOLVED_NO_SUCCESSFUL_REHEARSAL_IN_AMENDED_TOPOLOGY",
             "lifetime": "Per Go command, removed by Go cleanup; entire tmpfs ends with child"},
            {"path": "/work/transaction/cache", "writeRequired": True, "executionRequired": False,
             "bytesRequired": "UNRESOLVED", "lifetime": "Transaction"},
            {"path": "/work/transaction/gopath", "writeRequired": "NOT_OBSERVED_WITH_NO_EXTERNAL_MODULES",
             "executionRequired": False, "bytesRequired": "UNRESOLVED", "lifetime": "Transaction"},
            {"path": "/work/transaction/<tar-sha>.tar|.gz", "writeRequired": True,
             "executionRequired": False,
             "bytesRequired": sum((CORE / "clean-room" / "transaction" / name).stat().st_size
                                  for name in ("layer1.tar", "layer2.tar", "layer1.tar.gz", "layer2.tar.gz")),
             "lifetime": "Transaction"}],
        "tmpExecNecessity": "go test builds and launches $WORK/b001/g3-final-synthetic.test",
        "randomPathCannotBePremounted": True, "defaultNoexecTmpWouldFail": True,
        "fixtureTmpfsCeilingBytes": 1073741824, "ceilingIsNotMeasuredRequiredBytes": True,
        "PRODUCTION_TMP_CONTRACT": "BLOCKED",
    })
    print("FROZEN_CENSUS_PATHS_COMPLETE_CAPACITY_AND_TOPOLOGY_NOT_QUALIFIED")


if __name__ == "__main__":
    main()
