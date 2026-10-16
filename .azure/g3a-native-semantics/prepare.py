"""Bind prior proofs and acquire version-matching public source for local semantic checks."""

import hashlib
import json
from pathlib import Path
import sys
import urllib.request

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
sys.path.insert(0, str(BASE / "g3a-isolation-live"))
import isolation_live as prior

AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\e956efbf-fda0-4b05-b64a-b41de2f9c2b3\Pasted text #1.txt")


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def fresh(name, value):
    if (HERE / name).exists():
        require(read(HERE / name) == value, "REFUSING_TO_REPLACE_DIFFERENT_EVIDENCE_" + name)
        return
    with (HERE / name).open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def main():
    fresh("CONCURRENCY_PREPARE.json", prior.baseline())
    previous_path = BASE / "g3a-device-census" / "CORRECTION_VERIFICATION.json"
    require(sha(previous_path) == "bbab65295aedd886bd6043dba21ef79378236a44fbe7163cfad25c4638597ea5",
            "PREVIOUS_CENSUS_ROOT_CHANGED")
    previous = read(previous_path)
    protected = {
        **previous["protectedFileHashes"],
        **{str(previous_path.parent / name): digest for name, digest in previous["fileHashes"].items()},
        str(previous_path): sha(previous_path),
        str(previous_path.parent / "CORRECTION_INDEPENDENT_VERIFICATION.json"):
            sha(previous_path.parent / "CORRECTION_INDEPENDENT_VERIFICATION.json"),
    }
    for name, digest in protected.items():
        require(sha(name) == digest, "PROTECTED_REFERENCE_CHANGED")
    live_path = BASE / "g3a-isolation-live" / "LIVE_EXACT_EVIDENCE.json"
    live = read(live_path)
    baseline = json.loads(live["baselineJson"])
    proof = json.loads(live["proofJson"])
    require(baseline == proof["baseline"], "LIVE_BASELINE_NOT_IDENTICAL")
    require(baseline["kernel"] == "6.17.0-1022-azure" and
            baseline["architecture"] == "linux/amd64" and
            baseline["status"]["Seccomp"] == baseline["status"]["Seccomp_filters"] == "0",
            "PINNED_GETRANDOM_PLATFORM_NOT_ESTABLISHED")
    require(proof["details"]["privilegeState"]["noNewPrivs"] == 1, "NNP_NOT_BOUND")
    fresh("AUTHORITY_BINDING.json", {
        "mission": "NZ-20261008-INFRA-001", "authorityPath": str(AUTHORITY),
        "authoritySha256": sha(AUTHORITY), "localOnly": True,
        "liveAuthorityConsumed": False, "azureReads": 0, "azureMutations": 0,
        "protectedFileHashes": protected,
    })
    fresh("PINNED_PLATFORM_BINDING.json", {
        "PINNED_PLATFORM_BINDING": "PASS", "PINNED_KERNEL_RELEASE": baseline["kernel"],
        "PINNED_ARCHITECTURE": baseline["architecture"],
        "PINNED_SECCOMP_STATE": {"outer": 0, "filters": 0,
            "child": "No seccomp installation in qualified mechanism; not independently recorded in child status"},
        "PINNED_NO_NEW_PRIVS_STATE": {"outer": 0, "child": 1},
        "PINNED_GETRANDOM_AVAILABLE": "YES",
        "basis": "Exact Linux amd64 6.17 kernel ABI includes syscall318 since Linux3.17; retained seccomp0; NNP/UID/caps do not deny it.",
        "actualLiveGetrandomSyscallObserved": False,
        "priorEvidencePath": str(live_path), "priorEvidenceSha256": sha(live_path),
        "baselineBytesSha256": hashlib.sha256(live["baselineJson"].encode()).hexdigest(),
        "LIVE_PYTHON_NO_RANDOM_DEVICE_EVIDENCE": "UNPROVEN",
        "whyUnproven": "Retained full evidence proves Python startup but does not explicitly record an isolated /dev directory/device census. No inferred device absence.",
    })
    sources = {
        "cpython-bootstrap_hash.c": "https://raw.githubusercontent.com/python/cpython/v3.11.17/Python/bootstrap_hash.c",
        "cpython-posixsubprocess.c": "https://raw.githubusercontent.com/python/cpython/v3.11.17/Modules/_posixsubprocess.c",
        "openssl-rand_unix.c": "https://raw.githubusercontent.com/openssl/openssl/openssl-3.5.7/providers/implementations/rands/seeding/rand_unix.c",
        "openssl-crypto.h.in": "https://raw.githubusercontent.com/openssl/openssl/openssl-3.5.7/include/openssl/crypto.h.in",
        "openssl-info.c": "https://raw.githubusercontent.com/openssl/openssl/openssl-3.5.7/crypto/info.c",
        "openssl-e_os.h": "https://raw.githubusercontent.com/openssl/openssl/openssl-3.5.7/include/internal/e_os.h",
    }
    directory = HERE / "public-source"
    directory.mkdir()
    receipts = {}
    for name, url in sources.items():
        with urllib.request.urlopen(url, timeout=60) as response:
            raw = response.read(262145)
        require(len(raw) <= 262144 and raw, "PUBLIC_SOURCE_BOUND")
        with (directory / name).open("xb") as stream:
            stream.write(raw)
        receipts[name] = {"url": url, "sha256": sha(directory / name), "bytes": len(raw),
                          "versionMatchingUpstreamSourceNotDistroPatchProvenance": True}
    fresh("PUBLIC_SOURCE_BINDING.json", receipts)
    print("PINNED_PLATFORM_BINDING=PASS")
    print("PINNED_GETRANDOM_AVAILABLE=YES_EXACT_KERNEL_ABI_NO_LIVE_CALL")


if __name__ == "__main__":
    main()
