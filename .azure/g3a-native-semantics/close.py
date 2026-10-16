"""Seal actual local semantic results and STOP; never promote partial entropy coverage."""

import hashlib
import json
import subprocess
import tarfile
import time
import urllib.request

from prepare import BASE, HERE, fresh, prior, read, require, sha

IMAGE = "sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce"


def source_binding():
    inventories = read(BASE / "g3a-device-census/GO_SOURCE_DEVICE_REFERENCES.json")
    bindings = {}
    for version, key in (("go1.27.2", "buildToolchain"), ("go1.25.6", "compressorToolchain")):
        source = inventories[key]
        required = ("runtime/os_linux.go", "runtime/rand.go", "crypto/internal/sysrand/rand_getrandom.go",
                    "crypto/internal/sysrand/rand.go")
        bindings[version] = {}
        for name in required:
            from pathlib import Path
            path = Path(source["root"]) / name
            expected = source["fileHashes"][str(path.relative_to(source["root"]))]
            require(sha(path) == expected, "FOCUSED_GO_SOURCE_CHANGED")
            bindings[version][name] = {"path": str(path), "sha256": expected}
    return bindings


def owned_cleanup():
    command = ["docker", "events", "--since", "60m", "--until", str(int(time.time())),
               "--filter", "type=container", "--filter", "image=" + IMAGE, "--format", "{{json .}}"]
    result = subprocess.run(command, capture_output=True, text=True, timeout=30)
    require(result.returncode == 0, "DOCKER_EVENT_READ_FAILURE_" + result.stderr)
    owned = {}
    for line in result.stdout.splitlines():
        event = json.loads(line)
        attributes = event["Actor"]["Attributes"]
        sources = [value for key, value in attributes.items() if key.endswith("/Source")]
        if not any(str(HERE).casefold() in str(value).casefold() for value in sources):
            continue
        identity = event["Actor"]["ID"]
        owned.setdefault(identity, []).append({"action": event["Action"], "timeNano": event["timeNano"],
                                               "exitCode": attributes.get("exitCode")})
    require(len(owned) == 4, "OWNED_CONTAINER_CENSUS_NOT_FOUR_WITNESS_PLUS_THREE_CONSTRUCTORS")
    absence = {}
    for identity, events in owned.items():
        require(any(event["action"] == "destroy" for event in events), "OWNED_CONTAINER_NOT_DESTROYED")
        observed = subprocess.run(["docker", "inspect", identity], capture_output=True, text=True, timeout=30)
        require(observed.returncode == 1 and
                ("no such object: " + identity) in observed.stderr.casefold(), "OWNED_CONTAINER_ABSENCE_NOT_PROVEN")
        absence[identity] = {"inspectExitCode": observed.returncode, "stderr": observed.stderr}
    return {"events": owned, "exactIdAbsence": absence, "residualState": "ZERO",
            "innerRawCleanupRuling": "FAIL",
            "explanation": "First constructor pinned libcrypto mapping; later mount-id snapshot preceded unshare, falsely treating inherited Docker tmpfs as new. All containers destroyed; exact IDs absent. Raw failures retained unchanged.",
            "fixtureSourceCorrection": "Capture inherited mount IDs after unshare. Not replayed after required entropy gate failed."}


def main():
    concurrency = prior.baseline()
    concurrency_file = "CONCURRENCY_CLOSE_RESUME.json" if (HERE / "CONCURRENCY_CLOSE.json").exists() else "CONCURRENCY_CLOSE.json"
    fresh(concurrency_file, concurrency)
    original = read(HERE / "SEMANTIC_FIXTURE_V2_RESULT.json")
    report = json.loads(original["stdout"])
    require(original["exitCode"] == 1 and report["cleanup"]["status"] == "FAIL",
            "ORIGINAL_FAILURE_NOT_RETAINED")
    entropy = report["entropy"]["report"]
    descriptor = report["descriptor"]["report"]
    require(entropy["status"] == "FAIL" and entropy["operations"]["secrets.token_bytes"]["status"] == "FAIL",
            "NO_ENTROPY_SUCCESS_PROMOTION")
    require(descriptor["status"] == "PASS" and descriptor["child"]["unrelatedFd19Errno"] == 9,
            "NO_PROC_DESCRIPTOR_CONTRACT_NOT_PASS")
    fresh("EXACT_RUNTIME_SEMANTIC_FIXTURE.json", report)
    cleanup = owned_cleanup()
    fresh("EXACT_CONTAINER_CLEANUP.json", cleanup)
    url = "https://raw.githubusercontent.com/openssl/openssl/openssl-3.5.7/include/crypto/rand.h"
    with urllib.request.urlopen(url, timeout=60) as response:
        raw = response.read(262145)
    require(raw and len(raw) <= 262144, "OPENSSL_RANDOM_HEADER_BOUND")
    path = HERE / "public-source/openssl-rand.h"
    with path.open("xb") as stream:
        stream.write(raw)
    fresh("OPENSSL_RANDOM_HEADER_BINDING.json", {"url": url, "sha256": sha(path), "bytes": len(raw),
                                               "upstreamVersionMatchNotDistroPatchProvenance": True})
    focus = source_binding()
    fresh("FOCUSED_GO_SOURCE_BINDING.json", focus)
    with tarfile.open(BASE / "g3a-capsule-offline/payload.tar") as archive:
        names = {member.name for member in archive if member.isfile()}
    require("runtime/usr/local/lib/python3.11/secrets.py" not in names, "MISSING_MODULE_NOT_CONFIRMED")
    tracer = subprocess.run(["docker", "run", "--rm", "--pull", "never", "--network", "none", "--read-only",
              IMAGE, "python3", "-I", "-B", "-S", "-c", "import shutil,json;print(json.dumps({'strace':shutil.which('strace')}))"],
              capture_output=True, text=True, timeout=30)
    require(tracer.returncode == 0 and json.loads(tracer.stdout)["strace"] is None, "TRACER_AVAILABILITY_CHANGED")
    fresh("TRACER_AVAILABILITY.json", {"cachedImage": IMAGE, "strace": None, "exitCode": tracer.returncode,
                                    "installedAnything": False, "syscallObservation": "NOT_AVAILABLE"})
    fresh("SEMANTIC_CLASSIFICATION.json", {
        "Go1272": {
            "cryptoPrimary": "GETRANDOM", "cryptoDeviceFallback": "ENOSYS only",
            "pinnedCryptoFallbackReachable": "NO_under_bound_kernel_ABI_and_no_seccomp",
            "runtimePrimary": "AT_RANDOM auxiliary vector",
            "runtimeFallback": "/dev/urandom if startupRand lacks16bytes or first two8-byte words are zero",
            "pinnedRuntimeFallbackReachable": "UNRESOLVED_exact_live_auxv_not_retained",
            "scope": "Do not incorrectly replace runtime AT_RANDOM with crypto getrandom semantics",
        },
        "Go1256": {
            "cryptoPrimary": "GETRANDOM", "cryptoDeviceFallback": "ENOSYS only",
            "pinnedCryptoFallbackReachable": "NO_under_bound_kernel_ABI_and_no_seccomp",
            "runtimePrimary": "AT_RANDOM auxiliary vector",
            "runtimeFallback": "/dev/urandom if startupRand lacks16bytes or first two8-byte words are zero",
            "pinnedRuntimeFallbackReachable": "UNRESOLVED_exact_live_auxv_not_retained",
            "localGo1256StaticChild": "Started successfully absent random devices; not a live auxiliary-vector measurement",
        },
        "CPython": {
            "primary": "GETRANDOM_ON_LINUX_BUILD_WHEN_AVAILABLE",
            "fallbackConditions": ["ENOSYS", "EPERM", "EAGAIN during nonblocking nonraising startup hash seeding",
                                   "build lacks getrandom/getentropy support"],
            "availableOsGetrandomObserved": True,
            "startupAndOsUrandomWithoutDev": "PASS_LOCAL_EXACT_RUNTIME",
            "secretsTokenBytes": "FAIL_MODULE_ABSENT",
            "pinnedStartupPoolInitialization": "NOT_DIRECTLY_MEASURED",
            "sourceBuildScope": "Exact version upstream source plus bound native fixture; distro patch/config provenance not independently rebuilt",
        },
        "OpenSSL": {
            "version": report["opensslBuildInfo"]["version"],
            "buildInfo": report["opensslBuildInfo"], "nativeHashes": report["nativeHashes"],
            "primary": "GETENTROPY_THEN_GETRANDOM_SYSCALL_FOR_OS_SPECIFIC_LINUX_SEEDING",
            "getentropyProvider": "glibc kernel randomness syscall; no device pathname",
            "deviceFallbackCondition": "Syscall entropy acquisition did not satisfy pool; source returns immediately once entropy available",
            "upstreamDefaultDeviceFallbacks": ["/dev/urandom", "/dev/random", "/dev/hwrng", "/dev/srandom"],
            "runtimeRandAndSSLContext": "PASS_ABSENT_ALL_DEVICE_PATHS",
            "strictSection13Disposition": "UNRESOLVED_entire_required_no_device_fixture_failed_secrets_probe",
        },
        "Descriptor": {
            "procSelfFd": "OPTIONAL_OPTIMIZATION",
            "CPythonFallback": "close_range first when built; then /proc/self/fd enumeration; ENOENT falls back numeric close loop",
            "exactNoProcFixture": "PASS_static_child_starts_fd19_EBADF_standard_FDs_valid",
            "stdioPaths": "NOT_REQUIRED_IN_OBSERVED_NONINTERACTIVE_DISPATCH_inherited_FDs0_1_2",
            "tty": "DEAD_FOR_NONINTERACTIVE_TESTED_PATHS_no_terminal_input_or_password_prompt",
        },
        "finalAllowlistIssued": False,
        "confirmedRequiredSubset": ["/dev/null"],
        "noFrozenComponentChanged": True,
        "noHostSecretsModuleSubstituted": True,
        "stop": "Required exact entropy fixture FAIL; semantic complete/qualified prerequisites unsatisfied; no frozen-core rehearsal",
    })
    result = {
        "G3_EXECUTION_READINESS": "BLOCKED", "CURRENT_BLOCKER": "MINIMAL_DEVICE_CONTRACT",
        "REDIRECTED_WORK_ROOT_CREATION_CONFLICT": "CLOSED",
        "PINNED_PLATFORM_BINDING": "PASS", "PINNED_GETRANDOM_AVAILABLE": "YES",
        "PINNED_KERNEL_RELEASE": "6.17.0-1022-azure", "PINNED_ARCHITECTURE": "linux/amd64",
        "PINNED_SECCOMP_STATE": 0, "PINNED_NO_NEW_PRIVS_STATE": 1,
        "GO1272_RANDOM_PRIMARY": "GETRANDOM_CRYPTO_AT_RANDOM_RUNTIME",
        "GO1272_URANDOM_FALLBACK_REACHABLE": "UNRESOLVED",
        "GO1272_RANDOM_DEVICE_REQUIREMENT": "UNRESOLVED",
        "GO1256_RANDOM_PRIMARY": "GETRANDOM_CRYPTO_AT_RANDOM_RUNTIME",
        "GO1256_URANDOM_FALLBACK_REACHABLE": "UNRESOLVED",
        "GO1256_RANDOM_DEVICE_REQUIREMENT": "UNRESOLVED",
        "EMBEDDED_CPYTHON_VERSION": "3.11.17",
        "EMBEDDED_LIBC_SHA256": report["nativeHashes"]["libc.so.6"],
        "EMBEDDED_LIBSSL_SHA256": report["nativeHashes"]["libssl.so.3"],
        "EMBEDDED_LIBCRYPTO_SHA256": report["nativeHashes"]["libcrypto.so.3"],
        "CPYTHON_RANDOM_PRIMARY": "GETRANDOM",
        "CPYTHON_URANDOM_FALLBACK_REACHABLE": "UNRESOLVED",
        "CPYTHON_RANDOM_DEVICE_REQUIREMENT": "UNRESOLVED",
        "LIVE_PYTHON_NO_RANDOM_DEVICE_EVIDENCE": "UNPROVEN",
        "OPENSSL_VERSION": report["opensslBuildInfo"]["version"],
        "OPENSSL_BUILD_INFO": report["opensslBuildInfo"],
        "OPENSSL_LIBRARY_HASHES": report["nativeHashes"],
        "OPENSSL_ENTROPY_PRIMARY": "GETENTROPY_THEN_GETRANDOM_SYSCALL",
        "OPENSSL_RANDOM_DEVICE_FALLBACKS": ["/dev/urandom", "/dev/random", "/dev/hwrng", "/dev/srandom"],
        "OPENSSL_RANDOM_DEVICE_FALLBACKS_SCOPE": "Version-matching upstream OS-specific defaults; no device was exposed",
        "OPENSSL_RANDOM_DEVICE_REQUIREMENT": "UNRESOLVED",
        "NO_RANDOM_DEVICE_ENTROPY_FIXTURE": "FAIL",
        "ENTROPY_SYSCALL_OBSERVATION": "NOT_AVAILABLE",
        "CPYTHON_PROC_SELF_FD_CLASS": "OPTIONAL_WITH_FALLBACK",
        "NO_PROC_SUBPROCESS_FIXTURE": "PASS",
        "DEV_STDIO_PATH_REQUIREMENT": "NONE", "DEV_TTY_REQUIREMENT": "NONE",
        "RANDOM_DEVICE_REQUIREMENT": "UNRESOLVED", "PROCFS_REQUIREMENT": "NONE",
        "FINAL_REQUIRED_DEVICE_PATHS": [],
        "FINAL_REQUIRED_DEVICE_PATHS_STATUS": "NOT_ISSUED_NOT_AN_EMPTY_DEVICE_ALLOWLIST",
        "CONFIRMED_REQUIRED_SUBSET": ["/dev/null"],
        "FROZEN_DEVICE_PATH_CENSUS": "INCOMPLETE", "MINIMAL_DEVICE_CONTRACT": "BLOCKED",
        "PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED": "NO",
        "G3A_PRODUCTION_COMPATIBLE_RUNNER": "BLOCKED", "G3A_TRANSACTION_READINESS": "BLOCKED",
        "G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED": "NO", "G3A_EXECUTION_AUTHORIZED": "NO",
        "G3B_EXECUTION_AUTHORIZED": "NO", "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "AZURE_READS": 0, "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
        "AZURE_MUTATING_DISPATCHES": 0, "AZURE_SUCCESSFUL_MUTATING_DISPATCHES": 0,
        "AZURE_REJECTED_MUTATING_DISPATCHES": 0, "AZURE_DELETE_DISPATCHES": 0,
        "ROLE_ASSIGNMENT_CREATES": 0, "ROLE_ASSIGNMENT_DELETES": 0, "UAMI_CREATES": 0, "UAMI_DELETES": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "FROZEN_CORE_INVOCATIONS": 0, "PRODUCTION_CANDIDATE_BUILDS": 0,
        "REDIRECTED_DEVICE_AWARE_FROZEN_REHEARSAL": "NOT_RUN",
        "BUILD_ROOT_PEAK_BYTES": "UNRESOLVED", "BUILD_ROOT_PEAK_FILES": "UNRESOLVED",
        "TMP_PEAK_BYTES": "UNRESOLVED", "TMP_PEAK_FILES": "UNRESOLVED",
        "BUILD_ROOT_CAPACITY_BYTES": "UNRESOLVED", "TMP_CAPACITY_BYTES": "UNRESOLVED",
        "PRODUCTION_TMP_CONTRACT": "BLOCKED", "PRODUCTION_RUNNER_OFFLINE_QUALIFICATION": "FAIL",
        "LOCAL_SEMANTIC_TRANSACTION_RESIDUAL_STATE": "ZERO",
        "INNER_CONSTRUCTOR_CLEANUP_RAW": "FAIL_RETAINED",
        "INNER_CONSTRUCTOR_CLEANUP_FINAL_SCOPE": "All transaction mounts gone after exact proof-container destroy/absence",
        "STOP_REASON": "Required secrets.token_bytes probe cannot run: exact embedded runtime lacks secrets.py. No runtime alteration or module substitution authorized.",
        "QUALIFIED_PRIMITIVES_UNCHANGED": "YES",
        "RUNTIME_CHANGES": "Ephemeral local null-only bind for descriptor probe, fully disposed; frozen capsule/source bytes unchanged",
        "FOREIGN_CHANGES_OBSERVED": {
            "head": concurrency[1]["head"], "statusCount": len(concurrency[1]["status"]),
            "disposition": "OBSERVED_ONLY_NO_FOREIGN_WRITES",
        },
        "CONCURRENCY_EVIDENCE_FILE": concurrency_file,
    }
    fresh("FINAL_DISPOSITION.json", result)
    excluded = {"SEMANTIC_VERIFICATION.json", "INDEPENDENT_VERIFICATION.json"}
    files = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
             if path.is_file() and path.name not in excluded}
    fresh("SEMANTIC_VERIFICATION.json", {
        "ruling": "MANDATORY_STOP_EXACT_EMBEDDED_SECRETS_PROBE_UNAVAILABLE",
        "fileHashes": files, "protectedFileHashes": read(HERE / "AUTHORITY_BINDING.json")["protectedFileHashes"],
        "excludedOutputs": sorted(excluded),
    })
    print("SEMANTIC_STOP_ROOT=" + sha(HERE / "SEMANTIC_VERIFICATION.json"))
    print("NO_RANDOM_DEVICE_ENTROPY_FIXTURE=FAIL_MISSING_SECRETS")
    print("NO_PROC_SUBPROCESS_FIXTURE=PASS")
    print("LOCAL_SEMANTIC_TRANSACTION_RESIDUAL_STATE=ZERO")


if __name__ == "__main__":
    main()
