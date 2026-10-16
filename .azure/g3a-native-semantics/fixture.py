"""Local no-device/no-proc probes of the exact embedded runtime; no frozen-core invocation."""

import ctypes
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tarfile

ROOT = Path("/semantic-root")
LIBC = ctypes.CDLL(None, use_errno=True)
LIBC.mount.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p,
                      ctypes.c_ulong, ctypes.c_char_p]
LIBC.umount2.argtypes = [ctypes.c_char_p, ctypes.c_int]
LOCAL_SECCOMP = LIBC.prctl(21, 0, 0, 0, 0)


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def mount(source, target, kind, flags, options=None):
    if LIBC.mount(source.encode() if source else None, str(target).encode(),
                  kind.encode() if kind else None, flags, options.encode() if options else None):
        raise OSError(ctypes.get_errno(), "MOUNT_" + str(target))


def preexec():
    try:
        os.chroot(ROOT)
        os.chdir("/")
        require(LIBC.prctl(38, 1, 0, 0, 0) == 0, "NNP_SET")
        for cap in range(41):
            require(LIBC.prctl(24, cap, 0, 0, 0) == 0, "CAP_BOUND_DROP")
        os.setgroups([])
        os.setresgid(65532, 65532, 65532)
        os.setresuid(65532, 65532, 65532)
        require(LIBC.prctl(39, 0, 0, 0, 0) == 1 and
                LIBC.prctl(21, 0, 0, 0, 0) == LOCAL_SECCOMP,
                "NNP_OR_SECCOMP_STATE")
    except (OSError, RuntimeError) as error:
        os.write(2, ("CONSTRUCTOR_PREEXEC_FAILURE: " + str(error) + "\n").encode())
        raise


def launch(mode):
    configuration = json.loads((ROOT / "runtime.json").read_text())
    loader = "/" + configuration["loader"]
    libraries = ":".join("/" + path for path in configuration["libraryDirectories"])
    command = [loader, "--library-path", libraries, "/" + configuration["python"],
               "-I", "-B", "-S", "/probe.py", mode]
    result = subprocess.run(command, env={"PATH": "/unavailable",
                            "PYTHONHOME": "/" + configuration["pythonHome"],
                            "PYTHONDONTWRITEBYTECODE": "1"},
                            capture_output=True, text=True, preexec_fn=preexec, timeout=90)
    require(len(result.stdout.encode()) <= 65536 and len(result.stderr.encode()) <= 65536,
            "PROBE_EVIDENCE_BOUND")
    return {"command": command, "exitCode": result.returncode, "stderr": result.stderr,
            "report": json.loads(result.stdout) if result.stdout.strip() else None,
            "stdout": result.stdout}


def main():
    require(LIBC.unshare(0x00020000 | 0x40000000) == 0, "MOUNT_NETWORK_NAMESPACE")
    inherited_mount_ids = {line.split()[0] for line in Path("/proc/self/mountinfo").read_text().splitlines()}
    mount(None, "/", None, 16384 | (1 << 18))
    mounts = []
    report = {"localSeccompState": LOCAL_SECCOMP,
              "localVsPinnedSeccomp": "Cached harness inherits mode2 filter; pinned live outer mode0. No new filter installed; semantic syscall success is observed locally, not relabeled live.",
              "runtimeIsExact": True}
    try:
        mount("tmpfs", ROOT, "tmpfs", 2 | 4, "size=268435456,mode=0755")
        mounts.append(ROOT)
        census = json.loads(Path("/input/device-reference.json").read_text())["embeddedFileHashes"]
        with tarfile.open("/input/payload.tar") as archive:
            members = [member for member in archive if member.isfile()]
            require({member.name for member in members} == set(census), "EXACT_EMBEDDED_MEMBER_CENSUS")
            for member in members:
                path = Path(member.name)
                require(not path.is_absolute() and ".." not in path.parts and member.isfile(),
                        "UNSAFE_EMBEDDED_MEMBER")
                raw = archive.extractfile(member).read()
                require(hashlib.sha256(raw).hexdigest() == census[member.name]["sha256"] and
                        len(raw) == census[member.name]["bytes"], "EMBEDDED_RUNTIME_BYTES_CHANGED")
                target = ROOT / path
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open("xb") as stream:
                    stream.write(raw)
                target.chmod(member.mode)
                os.chown(target, 65532, 65532)
        aliases = {
            "libbz2.so.1.0": "libbz2.so.1.0.4",
            "liblzma.so.5": "liblzma.so.5.8.1",
            "libz.so.1": "libz.so.1.3.1",
            "libzstd.so.1": "libzstd.so.1.5.7",
        }
        library = ROOT / "runtime/usr/lib/x86_64-linux-gnu"
        for alias, source in aliases.items():
            shutil.copyfile(library / source, library / alias)
            (library / alias).chmod(0o500)
            os.chown(library / alias, 65532, 65532)
            require(digest(library / alias) == digest(library / source), "ALIAS_BYTES_NOT_EXACT")
        for source, name in (("/input/probe.py", "probe.py"), ("/input/fd-witness", "fd-witness"),
                             ("/input/bound-ca.pem", "bound-ca.pem")):
            shutil.copyfile(source, ROOT / name)
            (ROOT / name).chmod(0o500 if name == "fd-witness" else 0o400)
            os.chown(ROOT / name, 65532, 65532)
        (ROOT / "probe-data").write_bytes(b"unrelated-descriptor-witness")
        (ROOT / "probe-data").chmod(0o444)
        native_hashes = {name: digest(library / name) for name in
                         ("libc.so.6", "libssl.so.3", "libcrypto.so.3")}
        require(digest("/usr/lib/x86_64-linux-gnu/libc.so.6") == native_hashes["libc.so.6"],
                "METADATA_QUERY_LIBC_NOT_EXACT")
        metadata_script = """
import ctypes,json,sys
c=ctypes.CDLL(sys.argv[1])
c.OpenSSL_version.argtypes=[ctypes.c_int]
c.OpenSSL_version.restype=ctypes.c_char_p
c.OPENSSL_info.argtypes=[ctypes.c_int]
c.OPENSSL_info.restype=ctypes.c_char_p
r={n:c.OpenSSL_version(i).decode() for n,i in
   (("version",0),("compilerFlags",1),("builtOn",2),("platform",3))}
s=c.OPENSSL_info(1007)
r["seedSources"]=s.decode() if s else None
r["queryScope"]="Exact libcrypto metadata API in disposable metadata child; no entropy operation"
print(json.dumps(r))
"""
        metadata_result = subprocess.run(["python3", "-I", "-B", "-S", "-c", metadata_script,
                            str(library / "libcrypto.so.3")], capture_output=True, text=True, timeout=30)
        require(metadata_result.returncode == 0, "OPENSSL_METADATA_CHILD_FAILED_" + metadata_result.stderr)
        metadata = json.loads(metadata_result.stdout)
        report["nativeHashes"] = native_hashes
        report["opensslBuildInfo"] = metadata
        require(not (ROOT / "dev").exists() and not (ROOT / "proc").exists(),
                "ENTROPY_ROOT_HAS_DEV_OR_PROC")
        mount(str(ROOT), ROOT, None, 4096)
        mounts.append(ROOT)
        mount(None, ROOT, None, 4096 | 32 | 1 | 2 | 4)
        report["entropy"] = launch("entropy")
        mount(None, ROOT, None, 4096 | 32 | 2 | 4)
        (ROOT / "dev").mkdir()
        mount("tmpfs", ROOT / "dev", "tmpfs", 2 | 8, "size=1048576,mode=0755")
        mounts.append(ROOT / "dev")
        (ROOT / "dev/null").touch()
        mount("/dev/null", ROOT / "dev/null", None, 4096)
        mounts.append(ROOT / "dev/null")
        mount(None, ROOT / "dev/null", None, 4096 | 32 | 2 | 8)
        value = (ROOT / "dev/null").stat()
        require(stat.S_ISCHR(value.st_mode) and os.major(value.st_rdev) == 1 and
                os.minor(value.st_rdev) == 3, "NULL_NOT_CHAR_1_3")
        report["devNull"] = {"uid": value.st_uid, "gid": value.st_gid,
                             "mode": oct(stat.S_IMODE(value.st_mode)), "major": 1, "minor": 3,
                             "devContainerFlags": "rw,nosuid,noexec",
                             "deviceBindFlags": "rw,nosuid,noexec",
                             "worldWritableRiskBound": "Intrinsic Linux null semantics; exact file bind only, no state persistence, no random/dev tree access",
                             "purpose": "Authorized semantic descriptor fixture only"}
        mount(None, ROOT, None, 4096 | 32 | 1 | 2 | 4)
        report["descriptor"] = launch("descriptor")
    finally:
        cleanup = []
        for target in reversed(mounts):
            rc = LIBC.umount2(str(target).encode(), 0)
            cleanup.append({"path": str(target), "unmounted": rc == 0,
                            "errno": ctypes.get_errno() if rc else 0})
        relevant = [line for line in Path("/proc/self/mountinfo").read_text().splitlines()
                    if line.split()[4] == str(ROOT) or line.split()[4].startswith(str(ROOT) + "/")]
        remaining = [line for line in relevant if line.split()[0] not in inherited_mount_ids]
        report["cleanup"] = {"mounts": cleanup, "remainingMounts": remaining,
                             "inheritedHarnessMounts": [line for line in relevant
                                                       if line.split()[0] in inherited_mount_ids],
                             "inheritedHarnessLifecycle": "Docker --rm removes its original tmpfs at container exit; not a new isolation-constructor mount",
                             "status": "PASS" if all(x["unmounted"] for x in cleanup) and not remaining else "FAIL"}
        print(json.dumps(report), flush=True)
        require(report["cleanup"]["status"] == "PASS", "LOCAL_SEMANTIC_MOUNT_CLEANUP_FAILED")


if __name__ == "__main__":
    main()
