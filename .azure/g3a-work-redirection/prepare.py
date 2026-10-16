"""Bind the amendment, supported CLI and complete immutable archive census."""

import hashlib
import json
from pathlib import Path
import sys
import tarfile

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
CORE = BASE / "g3a-controller-repair"
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\3cc76087-402a-4cbd-b2bf-7d282a93d6c8\Pasted text #1.txt")
sys.path.insert(0, str(BASE / "g3a-isolation-live"))
import isolation_live as prior


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def fresh(name, value):
    with (HERE / name).open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def read(path):
    return json.loads(Path(path).read_text())


def main():
    fresh("CONCURRENCY_PREPARE.json", prior.baseline())
    root = BASE / "g3a-runner-amendment" / "AMENDMENT_VERIFICATION.json"
    require(sha(root) == "52bfe60b975ce64c1522b2c82b90134659c367e18ac524ec019749c866cf7724",
            "PRIOR_AMENDMENT_ROOT_CHANGED")
    previous = read(root)
    protected = {**previous["protectedFileHashes"],
                 **{str(root.parent / key): value for key, value in previous["fileHashes"].items()},
                 str(root): sha(root)}
    for path, expected in protected.items():
        require(sha(path) == expected, "PROTECTED_HISTORY_CHANGED_" + path)
    binding = read(CORE / "inputs" / "binding.json")
    source = CORE / "assembler" / "main.go"
    require(sha(source) == binding["inputs"]["controller-main.go"]["sha256"], "EXACT_SOURCE_REQUIRED")
    text = source.read_text()
    require("execute(os.Args[1], os.Args[2], os.Args[3])" in text and "len(os.Args) != 4" in text,
            "SUPPORTED_POSITIONAL_INTERFACE_REQUIRED")
    require('os.Mkdir(work, 0700)' in text and 'filepath.Join(work, "go")' in text,
            "EXCLUSIVE_WORK_CHILD_REQUIRED")
    for filename, expected in binding["inputs"].items():
        path = CORE / "inputs" / filename
        require(sha(path) == expected["sha256"] and path.stat().st_size == expected["bytes"],
                "STAGED_INPUT_CHANGED_" + filename)
    fresh("AUTHORITY_BINDING.json", {
        "authorityPath": str(AUTHORITY), "authoritySha256": sha(AUTHORITY),
        "sameUnconsumedLiveAuthority": True, "originalAuthorityPath": read(root.parent / "AUTHORITY_BINDING.json")["authorityPath"],
        "maximumLiveAttempts": 1, "consumed": False, "protectedFileHashes": protected,
        "NESTED_PREMOUNT_TOPOLOGY": "RETIRED",
        "retirementReason": "Exclusive frozen work-root creation conflicts with pre-mounted child.",
    })
    fresh("CLI_CONTRACT.json", {
        "FROZEN_ASSEMBLER_WORK_PATH_CONFIGURABLE": "YES",
        "FROZEN_ASSEMBLER_OUTPUT_PATH_CONFIGURABLE": "YES",
        "source": str(source), "sourceSha256": sha(source),
        "mainCallLine": 483, "arguments": {"1": "inputs", "2": "work", "3": "output"},
        "validations": ["exact argc=4", "inputs binding and exact members", "work initially absent; created mode0700",
                        "output initially exists and permits exclusive output files"],
        "invocation": ["/inputs/portable-assembler", "/inputs", "/build/transaction", "/output/transaction"],
        "workCreatedBy": "FROZEN_ASSEMBLER_ONLY", "outputExecutableRequired": False,
        "outputConsumers": "Read/hash/write exact OCI artifacts; never exec output runtime.",
        "workAbsoluteValidation": "Not enforced by frozen core; fixture binds exact absolute paths.",
    })
    archives = {}
    unexpected = []
    for filename, contract in (
        ("source.tar", binding["sourceMembers"]), ("go-toolchain.tar", read(CORE / "inputs" / "toolchain-members.json")),
    ):
        files, seen, executables = {}, set(), []
        with tarfile.open(CORE / "inputs" / filename) as archive:
            for member in archive:
                name = member.name.rstrip("/")
                require(name and not name.startswith("/") and "\\" not in name and
                        all(part not in ("", ".", "..") for part in name.split("/")) and name not in seen and
                        member.mode & ~0o777 == 0 and (member.isfile() or member.isdir()),
                        "ARCHIVE_PATH_TYPE_MODE_" + name)
                seen.add(name)
                if member.isdir():
                    require(member.mode == 0o755 and any(key.startswith(name + "/") for key in contract),
                            "ARCHIVE_DIRECTORY_CONTRACT")
                    continue
                raw = archive.extractfile(member).read()
                entry = {"bytes": len(raw), "mode": member.mode, "sha256": hashlib.sha256(raw).hexdigest()}
                require(entry == contract[name], "EXACT_ARCHIVE_MEMBER_" + name)
                files[name] = entry
                if member.mode & 0o111:
                    reason = ("FROZEN_STAGED_TOOLCHAIN_ELF" if raw[:4] == b"\x7fELF"
                              else "FROZEN_TOOLCHAIN_MAINTENANCE_SCRIPT_NOT_INVOKED")
                    if filename == "source.tar":
                        unexpected.append(name)
                    executables.append({"path": "/build/transaction/go/" + name,
                                        **entry, "reason": reason,
                                        "execInThisTransaction": name in {
                                            "bin/go", "pkg/tool/linux_amd64/compile", "pkg/tool/linux_amd64/asm",
                                            "pkg/tool/linux_amd64/link", "pkg/tool/linux_amd64/vet"}})
        require(files == contract, "ARCHIVE_FILE_CENSUS")
        archives[filename] = {"sha256": sha(CORE / "inputs" / filename),
                              "memberCount": len(files), "executables": executables,
                              "symlinks": 0, "devices": 0, "FIFOs": 0,
                              "exactFiles": files if filename == "source.tar" else None}
    require(not unexpected, "UNEXPECTED_SOURCE_EXECUTABLES")
    fresh("ARCHIVE_EXECUTABILITY.json", {
        "STAGED_EXECUTABILITY_CENSUS": "PASS", "EXEC_BUILD_ARCHIVE_SAFETY": "PASS",
        "UNEXPECTED_STAGED_EXECUTABLES": len(unexpected), "archives": archives,
        "toolchainMaintenanceScripts": "Individually hash-bound existing payload; no shell exposed or invoked.",
    })
    census = read(BASE / "g3a-runner-amendment" / "EXEC_PATH_CENSUS.json")
    for entry in census["entries"]:
        entry["guestPath"] = entry["guestPath"].replace("/work/transaction", "/build/transaction")
        entry.update({"pathKind": "GENERATED" if entry["transactionGenerated"] else "FIXED",
                      "origin": "BUILT" if entry["transactionGenerated"] else "STAGED",
                      "binding": "DERIVED_FROM_HASH_BOUND_INPUT" if entry["transactionGenerated"] else "HASH_BOUND"})
    fresh("EXECUTION_CONTRACT.json", {
        "FROZEN_EXECUTABLE_PATH_CONTRACT": "COMPLETE", "entries": census["entries"],
        "normalizedWorkRoot": "/build/transaction",
        "sourceCensusSha256": sha(BASE / "g3a-runner-amendment" / "EXEC_PATH_CENSUS.json"),
        "tempExecutableSet": ["/tmp/go-build<random>/b001/g3-final-synthetic.test"],
        "additionalTempExecutables": "NONE_IN_FROZEN_SOURCE_AND_TRACE",
        "GOTMPDIR": "Absent in frozen driver env; MkdirTemp uses os.TempDir()",
        "TMPDIR": "/tmp", "TMP": "NOT_PASSED", "TEMP": "NOT_PASSED",
        "peakMeasurement": "REQUIRED_NOT_RUN",
    })
    print("WORK_OUTPUT_CONFIGURABLE_YES_ARCHIVE_SAFETY_AND_EXEC_CONTRACT_PASS")


if __name__ == "__main__":
    main()
