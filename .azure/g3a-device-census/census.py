"""Read-only artifact/source device inventory; never infer reachability from strings alone."""

import hashlib
import json
from pathlib import Path
import re
import sys
import tarfile

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\c63dccd5-0979-4b67-9654-4dae2be52e1e\Pasted text #1.txt")
sys.path.insert(0, str(BASE / "g3a-isolation-live"))
import isolation_live as prior

REFERENCE = re.compile(rb'/(?:dev/[A-Za-z0-9_./-]+|proc/self/fd[A-Za-z0-9_./-]*)')


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def fresh(name, value):
    if (HERE / name).exists():
        require(load(HERE / name) == value, "REFUSING_TO_REPLACE_DIFFERENT_EVIDENCE_" + name)
        print("UNCHANGED_EVIDENCE_REUSED=" + name)
        return
    with (HERE / name).open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def refs(raw):
    return sorted(set(value.decode("ascii") for value in REFERENCE.findall(raw)))


def source_inventory(root):
    files, matches, directories = {}, [], []
    for path in root.rglob("*.go"):
        if path.is_dir():
            directories.append(str(path.relative_to(root)))
            continue
        raw = path.read_bytes()
        files[str(path.relative_to(root))] = hashlib.sha256(raw).hexdigest()
        for number, line in enumerate(raw.decode("utf-8").splitlines(), 1):
            found = refs(line.encode())
            if found:
                matches.append({"path": str(path), "line": number, "references": found,
                                "source": line.strip(),
                                "testOrGenerator": path.name.endswith("_test.go") or "testdata" in path.parts,
                                "reachability": "NOT_IMPLIED_BY_TEXT_MATCH"})
    return {"root": str(root), "fileHashes": files, "references": matches,
            "directoriesWithGoSuffixNotSourceFiles": directories}


def main():
    fresh("CONCURRENCY_CENSUS_RESUME.json" if (HERE / "CONCURRENCY_CENSUS.json").exists()
          else "CONCURRENCY_CENSUS.json", prior.baseline())
    previous_root = BASE / "g3a-work-redirection" / "REDIRECTION_VERIFICATION.json"
    require(sha(previous_root) == "4b759c380d700fec54542c1774a1f89f262f0805ab2aa44b9b627a7e9ec9ca5f",
            "PREVIOUS_ROOT_CHANGED")
    previous = load(previous_root)
    protected = {
        **previous["protectedFileHashes"],
        **{str(previous_root.parent / name): digest for name, digest in previous["fileHashes"].items()},
        str(previous_root): sha(previous_root),
    }
    for path, expected in protected.items():
        require(sha(path) == expected, "PROTECTED_HISTORY_CHANGED")
    frozen = BASE / "g3a-controller-repair" / "inputs"
    binding = load(frozen / "binding.json")
    for name, expected in binding["inputs"].items():
        require(sha(frozen / name) == expected["sha256"] and
                (frozen / name).stat().st_size == expected["bytes"], "FROZEN_INPUT_CHANGED_" + name)
    fresh("AUTHORITY_BINDING.json", {
        "mission": "NZ-20261008-INFRA-001", "authorityPath": str(AUTHORITY), "authoritySha256": sha(AUTHORITY),
        "sameUnconsumedLiveAuthority": True, "consumed": False, "maximumLiveAttempts": 1,
        "previousRoot": str(previous_root), "previousRootSha256": sha(previous_root),
        "protectedFileHashes": protected, "deviceEntriesCreated": 0,
    })
    go_versions = {}
    toolchain = {}
    with tarfile.open(frozen / "go-toolchain.tar") as archive:
        go_versions["actualBuildToolchain"] = archive.extractfile("VERSION").read().decode()
        for member in archive:
            if not member.isfile():
                continue
            name = member.name
            if name.startswith(("bin/", "pkg/tool/linux_amd64/")):
                raw = archive.extractfile(member).read()
                entry = {"sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw),
                         "literalReferences": refs(raw)}
                require(entry["sha256"] == load(frozen / "toolchain-members.json")[name]["sha256"],
                        "EXACT_TOOLCHAIN_BINARY_BINDING")
                toolchain[name] = entry
    native, python_sources, embedded_files = {}, {}, {}
    with tarfile.open(BASE / "g3a-capsule-offline" / "payload.tar") as archive:
        for member in archive:
            if not member.isfile():
                continue
            raw = archive.extractfile(member).read()
            embedded_files[member.name] = {"sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)}
            found = refs(raw)
            if raw.startswith(b"\x7fELF"):
                native[member.name] = {**embedded_files[member.name], "literalReferences": found,
                                      "reachability": "REQUIRES_NATIVE_CALL_PATH_CLASSIFICATION"}
            elif member.name.endswith(".py") and found:
                matches = [{"line": n, "references": refs(line.encode()), "source": line.strip()}
                           for n, line in enumerate(raw.decode().splitlines(), 1) if refs(line.encode())]
                python_sources[member.name] = {**embedded_files[member.name], "matches": matches}
    binaries = {}
    for name in ("portable-assembler", "compressor-go1256"):
        path = frozen / name
        binaries[name] = {"sha256": sha(path), "bytes": path.stat().st_size,
                          "literalReferences": refs(path.read_bytes()),
                          "warning": "Go concatenates string constants; literal tails are not real device paths."}
    build_source = source_inventory(BASE / "g3a-full-rehearsal" / "preparation-toolchain" / "src")
    gzip_source = source_inventory(BASE / "g3a-go1256" / "toolchain" / "go" / "src")
    go_versions["compressorToolchain"] = (BASE / "g3a-go1256" / "toolchain" / "go" / "VERSION").read_text()
    fresh("GO_SOURCE_DEVICE_REFERENCES.json", {"versions": go_versions,
          "buildToolchain": build_source, "compressorToolchain": gzip_source,
          "sourceMatchesIncludeDormantPlatformsAndTests": True})
    fresh("BINARY_AND_RUNTIME_DEVICE_REFERENCES.json", {
        "coreBinaries": binaries, "actualToolchainBinaries": toolchain,
        "embeddedNative": native, "embeddedPythonSource": python_sources,
        "embeddedArchiveSha256": sha(BASE / "g3a-capsule-offline" / "payload.tar"),
        "embeddedFileHashes": embedded_files, "literalCensus": "COMPLETE_FOR_ENUMERATED_BYTES",
        "requiredPathCensus": "NOT_COMPLETE_FROM_LITERAL_STRINGS",
    })
    fresh("DEVICE_CLASSIFICATION.json", {
        "FROZEN_DEVICE_PATH_CENSUS": "INCOMPLETE",
        "REQUIRED_DEVICE_PATHS": ["/dev/null"],
        "requiredListScope": "CONFIRMED_REQUIRED_ONLY_NOT_A_CLOSED_COMPLETE_ALLOWLIST",
        "CURRENT_BLOCKER": "MINIMAL_DEVICE_CONTRACT",
        "REDIRECTED_WORK_ROOT_CREATION_CONFLICT": "CLOSED",
        "devices": [
            {"path": "/dev/null", "classification": "REQUIRED_OBSERVED",
             "readRequired": "YES", "writeRequired": "YES",
             "writeBasis": "Subprocess nil output descriptors and runtime fd repair paths; discard semantics",
             "seek": "Character null-device semantics; no application seek requirement established",
             "deviceType": "CHARACTER", "major": 1, "minor": 3,
             "inheritedDescriptorAlternative": "NO_FOR_UNCHANGED_CORE_UNSET_STDIN",
             "hostBindRequired": "YES_PREFERRED_EXACT_FILE_BIND",
             "observedFailure": "Exact frozen core: open /dev/null: no such file or directory",
             "setupExecuted": False},
            {"path": "/dev/urandom", "classification": "CONDITIONAL_NOT_AUTHORIZED",
             "readRequired": "CONDITIONAL_UNRESOLVED", "writeRequired": "NO",
             "deviceType": "CHARACTER", "major": 1, "minor": 9,
             "inheritedDescriptorAlternative": "GETRANDOM_KERNEL_SYSCALL_NOT_FD",
             "hostBindRequired": "UNRESOLVED",
             "branches": ["Go runtime AT_RANDOM fallback", "Go crypto getrandom ENOSYS fallback",
                          "CPython/OpenSSL/libc native entropy paths"],
             "whyNotAdded": "No proof that every exact native entropy path avoids file fallback in final runtime."},
            {"path": "/dev/random", "classification": "NATIVE_LITERAL_UNCLASSIFIED_NOT_AUTHORIZED",
             "readRequired": "UNRESOLVED", "writeRequired": "NO",
             "deviceType": "CHARACTER", "major": 1, "minor": 8, "hostBindRequired": "UNRESOLVED"},
            {"path": "/dev/stdin|/dev/stdout|/dev/stderr", "classification": "INHERITED_FD_LABELS_IN_GO",
             "pathAccessRequired": "NO_FOR_GO_OS_NEWFILE", "inheritedDescriptorAlternative": "YES",
             "hostBindRequired": "NO", "added": False},
            {"path": "/proc/self/fd", "classification": "CONDITIONAL_UNRESOLVED_NATIVE_FALLBACK",
             "Go": "Fchmodat fallback when fchmodat2 unavailable; no nofollow chmod requirement in frozen extraction.",
             "Python": "_posixsubprocess binary includes FD enumeration path",
             "publicCPythonSource": "v3.11.17 fallback closes numeric FD ranges if enumeration unavailable",
             "publicSourceURL": "https://raw.githubusercontent.com/python/cpython/v3.11.17/Modules/_posixsubprocess.c",
             "publicSourceNotExactBinaryBuildProvenance": True,
             "libc": "Exact native binary has FD paths; complete invoked fallback reachability not resolved",
             "mandatory": "NOT_PROVEN", "procMountAuthorized": False},
        ],
        "unresolvedNativeLiterals": {
            "loader": ["/dev/full"],
            "libc": ["/dev/block/", "/dev/console", "/dev/full", "/dev/log", "/dev/ptmx",
                     "/dev/shm/", "/dev/tty", "/dev/random", "/dev/urandom", "/proc/self/fd"],
            "OpenSSL": ["/dev/hwrng", "/dev/random", "/dev/srandom", "/dev/tty", "/dev/urandom"],
        },
        "zeroDevice": "NO_REFERENCE_IN_BOUND_EMBEDDED_BINARY_OR_CORE_LITERAL_CENSUS; not added",
        "tty": "No interactive frozen invocation; native literal presence does not authorize exposure.",
        "completenessGap": "Exact embedded native ABI call-path/fallback reachability and final production dispatch remain unqualified.",
        "stopCondition": "Section33 device census incomplete: STOP before creating even /dev/null.",
        "HOST_DEV_TREE_EXPOSED": "NO", "deviceEntriesCreated": 0,
        "qualifiedPrimitiveEdits": 0, "coreEdits": 0, "registryMutations": 0, "cloudCalls": 0,
    })
    print("FROZEN_DEVICE_PATH_CENSUS=INCOMPLETE")
    print("CONFIRMED_REQUIRED_PATH=/dev/null")
    print("STOP_BEFORE_DEVICE_CREATION_UNRESOLVED_NATIVE_ENTROPY_AND_FD_FALLBACKS")


if __name__ == "__main__":
    main()
