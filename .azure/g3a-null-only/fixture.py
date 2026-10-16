"""Single null-only isolated core execution with independent sampled usage and mandatory cleanup."""

import ctypes
import errno
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import stat
import subprocess
import threading
import time

ROOT = Path("/null-only-root")
LIBC = ctypes.CDLL(None, use_errno=True)
LIBC.mount.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p,
                      ctypes.c_ulong, ctypes.c_char_p]
LIBC.umount2.argtypes = [ctypes.c_char_p, ctypes.c_int]


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def mount(source, target, kind, flags, options=None):
    if LIBC.mount(source.encode() if source else None, str(target).encode(),
                  kind.encode() if kind else None, flags, options.encode() if options else None):
        raise OSError(ctypes.get_errno(), "MOUNT_" + str(target))


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def child():
    os.chroot(ROOT)
    os.chdir("/")
    require(LIBC.prctl(38, 1, 0, 0, 0) == 0, "NNP_SET")
    for cap in range(41):
        require(LIBC.prctl(24, cap, 0, 0, 0) == 0, "CAP_BOUND_DROP")
    os.setgroups([])
    os.setresgid(65532, 65532, 65532)
    os.setresuid(65532, 65532, 65532)
    require(LIBC.prctl(39, 0, 0, 0, 0) == 1, "NNP_VERIFY")
    require(os.getresuid() == os.getresgid() == (65532,) * 3 and os.getgroups() == [],
            "PRIVILEGE_DROP")
    try:
        os.setresuid(0, 0, 0)
    except PermissionError:
        regain = "DENIED"
    else:
        raise RuntimeError("PRIVILEGE_REGAIN")
    header = (ctypes.c_uint32 * 2)(0x20080522, 0)
    caps = (ctypes.c_uint32 * 6)()
    require(LIBC.capget(ctypes.byref(header), ctypes.byref(caps)) == 0 and not any(caps),
            "EFFECTIVE_PERMITTED_INHERITABLE_CAPS_NOT_ZERO")
    require(LIBC.prctl(23, 27, 0, 0, 0) == 0, "CAP_MKNOD_BOUNDING_NOT_ABSENT")
    try:
        os.mknod("/build/unauthorized-device", stat.S_IFCHR | 0o600, os.makedev(1, 3))
    except PermissionError:
        mknod = "DENIED"
    else:
        raise RuntimeError("UNAUTHORIZED_DEVICE_CREATION_SUCCEEDED")
    host = {path: not os.path.exists(path) for path in
            ("/var/lib/waagent", "/etc/shadow", "/sealed-inputs", "/retained", "/proc",
             "/proc/self/fd", "/sys", "/home", "/etc/ssl/certs/ca-certificates.crt")}
    require(all(host.values()), "HOST_OR_PROC_PATH_VISIBLE")
    devices = ("/dev/urandom", "/dev/random", "/dev/hwrng", "/dev/srandom", "/dev/tty",
               "/dev/console", "/dev/mem", "/dev/kmem", "/dev/kmsg", "/dev/vda", "/dev/sda",
               "/dev/nvme0n1", "/dev/loop0", "/dev/tty0")
    negative = {path: not os.path.lexists(path) for path in devices}
    require(all(negative.values()) and os.listdir("/dev") == ["null"], "UNAUTHORIZED_DEVICE_PRESENT")
    value = os.stat("/dev/null")
    require(stat.S_ISCHR(value.st_mode) and os.major(value.st_rdev) == 1 and os.minor(value.st_rdev) == 3,
            "NULL_NOT_CHAR_1_3")
    with open("/dev/null", "rb") as stream:
        require(stream.read(1) == b"", "NULL_READ_NOT_EOF")
    with open("/dev/null", "wb") as stream:
        require(stream.write(b"null-only-discard") == 17, "NULL_WRITE_NOT_DISCARDED")
    network = {}
    for address in ("127.0.0.1", "10.91.3.1", "169.254.169.254"):
        with socket.socket() as connection:
            connection.settimeout(1)
            try:
                connection.connect((address, 443))
            except OSError as error:
                require(error.errno in (errno.ENETUNREACH, errno.EHOSTUNREACH, errno.ECONNREFUSED),
                        "NETWORK_TIMEOUT_NOT_PROOF")
                network[address] = error.errno
            else:
                raise RuntimeError("ISOLATED_NETWORK_AVAILABLE")
    execution = {}
    flags = {name: os.statvfs("/" + name).f_flag for name in ("work", "output", "build", "tmp", "dev")}
    for name in ("work", "output", "build", "tmp"):
        require(flags[name] & os.ST_NOSUID and flags[name] & os.ST_NODEV, "MOUNT_MISSING_NOSUID_NODEV")
        require(bool(flags[name] & os.ST_NOEXEC) == (name in ("work", "output")), "EXEC_FLAGS_WRONG")
        try:
            result = subprocess.run(["/" + name + "/witness"], env={"PATH": "/unavailable"},
                                    capture_output=True, timeout=30)
        except PermissionError:
            execution[name] = "DENIED"
        else:
            execution[name] = "PERMITTED"
        require(execution[name] == ("DENIED" if name in ("work", "output") else "PERMITTED"),
                "EXEC_MOUNT_SEMANTICS")
        Path("/" + name + "/witness").unlink()
    require(flags["dev"] & os.ST_NOSUID and flags["dev"] & os.ST_NOEXEC and
            not flags["dev"] & os.ST_NODEV, "DEV_FLAGS_WRONG")
    require(not Path("/build/transaction").exists(), "FROZEN_WORK_ALREADY_EXISTS")
    fixture = {
        "type": "NULL_ONLY_FIXTURE", "status": "PASS", "ISOLATED_DEV_NULL": "PASS",
        "UNAUTHORIZED_DEVICE_NEGATIVES": "PASS", "unauthorizedDevices": negative,
        "null": {"uid": value.st_uid, "gid": value.st_gid, "mode": oct(stat.S_IMODE(value.st_mode)),
                 "major": 1, "minor": 3, "read": "EOF", "write": "DISCARDED",
                 "worldWritableRisk": "Linux null semantics only, exact bind, no persistent data or host traversal"},
        "deviceCensus": ["null"], "hostNegatives": host, "networkNegatives": network,
        "noNewPrivs": 1, "uidGid": 65532, "capEffectivePermittedInheritable": list(caps),
        "capMknod": "ABSENT", "mknodNegative": mknod, "regain": regain,
        "mountFlags": flags, "execution": execution, "frozenWorkChildAbsent": True,
    }
    print(json.dumps(fixture), flush=True)
    with Path("/output/LOCAL_CORE_DISPATCH.json").open("x") as stream:
        json.dump({"coreInvocations": 1, "command": ["/inputs/portable-assembler", "/inputs",
                  "/build/transaction", "/output/transaction"], "deviceCensus": ["null"]}, stream)
    start = time.monotonic()
    result = subprocess.run(["/inputs/portable-assembler", "/inputs", "/build/transaction",
                             "/output/transaction"], env={"PATH": "/unavailable", "DOCKER_HOST": ""},
                            capture_output=True, text=True, timeout=900)
    print(json.dumps({"type": "FROZEN_REHEARSAL", "exitCode": result.returncode,
                      "stdout": result.stdout, "stderr": result.stderr,
                      "elapsedSeconds": time.monotonic() - start}), flush=True)
    return result.returncode


def usage(path):
    value = os.statvfs(path)
    return {"allocatedBytes": (value.f_blocks - value.f_bfree) * value.f_frsize,
            "allocatedInodes": value.f_files - value.f_ffree}


def main():
    require(LIBC.unshare(0x00020000 | 0x40000000) == 0, "NEW_MOUNT_NETWORK_NAMESPACES")
    inherited = {line.split()[0] for line in Path("/proc/self/mountinfo").read_text().splitlines()}
    mount(None, "/", None, 16384 | (1 << 18))
    mounts = []
    report = {}
    pid = None
    stop_files = threading.Event()
    file_counts = {name: {"peakRegularFiles": 0, "samples": 0, "disappearedDuringCensus": 0}
                   for name in ("build", "tmp")}
    file_errors = []

    def observe_files():
        while not stop_files.is_set():
            for name in file_counts:
                count = 0
                try:
                    for directory, _, names in os.walk(ROOT / name):
                        for filename in names:
                            try:
                                if stat.S_ISREG(os.lstat(Path(directory) / filename).st_mode):
                                    count += 1
                            except FileNotFoundError:
                                file_counts[name]["disappearedDuringCensus"] += 1
                    file_counts[name]["peakRegularFiles"] = max(file_counts[name]["peakRegularFiles"], count)
                    file_counts[name]["samples"] += 1
                except OSError as error:
                    file_errors.append(str(error))
                    return
            stop_files.wait(0.01)

    try:
        mount("tmpfs", ROOT, "tmpfs", 2 | 4, "size=268435456,mode=0755")
        mounts.append(ROOT)
        for name in ("inputs", "work", "output", "build", "tmp", "dev"):
            (ROOT / name).mkdir()
        mount(str(ROOT), ROOT, None, 4096)
        mounts.append(ROOT)
        mount(None, ROOT, None, 4096 | 32 | 1 | 2 | 4)
        mount("/sealed-inputs", ROOT / "inputs", None, 4096)
        mounts.append(ROOT / "inputs")
        mount(None, ROOT / "inputs", None, 4096 | 32 | 1 | 2 | 4)
        for name in ("work", "output", "build", "tmp"):
            flags = 2 | 4 | (8 if name in ("work", "output") else 0)
            capacity = 2147483648 if name == "build" else 1073741824
            mount("tmpfs", ROOT / name, "tmpfs", flags, f"size={capacity},nr_inodes=262144,mode=0700")
            mounts.append(ROOT / name)
            os.chown(ROOT / name, 65532, 65532)
        mount("tmpfs", ROOT / "dev", "tmpfs", 2 | 8, "size=1048576,mode=0755")
        mounts.append(ROOT / "dev")
        (ROOT / "dev/null").touch()
        mount("/dev/null", ROOT / "dev/null", None, 4096)
        mounts.append(ROOT / "dev/null")
        mount(None, ROOT / "dev/null", None, 4096 | 32 | 2 | 8)
        (ROOT / "output/transaction").mkdir(mode=0o700)
        os.chown(ROOT / "output/transaction", 65532, 65532)
        for name in ("work", "output", "build", "tmp"):
            target = ROOT / name / "witness"
            shutil.copyfile(ROOT / "inputs/compressor-go1256", target)
            target.chmod(0o555)
        read_fd, write_fd = os.pipe()
        pid = os.fork()
        if pid == 0:
            os.close(read_fd)
            os.dup2(write_fd, 1)
            os.close(write_fd)
            try:
                code = child()
            except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
                print(json.dumps({"type": "CHILD_EXPLICIT_FAILURE", "error": str(error)}), flush=True)
                code = 1
            os._exit(code)
        os.close(write_fd)
        os.set_blocking(read_fd, False)
        observer = threading.Thread(target=observe_files)
        observer.start()
        peaks = {name: {"allocatedBytes": 0, "allocatedInodes": 0} for name in ("build", "tmp")}
        samples = 0
        start = previous = time.monotonic()
        max_interval = 0
        evidence = bytearray()
        while True:
            now = time.monotonic()
            max_interval = max(max_interval, now - previous)
            previous = now
            for name in peaks:
                value = usage(ROOT / name)
                for key in value:
                    peaks[name][key] = max(peaks[name][key], value[key])
            samples += 1
            try:
                evidence.extend(os.read(read_fd, 65536))
            except BlockingIOError:
                pass
            require(len(evidence) <= 1048576, "CHILD_EVIDENCE_BOUND")
            observed, status = os.waitpid(pid, os.WNOHANG)
            if observed:
                pid = None
                while True:
                    chunk = os.read(read_fd, 65536)
                    if not chunk:
                        break
                    evidence.extend(chunk)
                break
            require(time.monotonic() - start <= 960, "LOCAL_TRANSACTION_LIFETIME")
            time.sleep(0.001)
        stop_files.set()
        observer.join(timeout=30)
        require(not observer.is_alive() and not file_errors, "FILE_CENSUS_OBSERVER_FAILED")
        os.close(read_fd)
        records = [json.loads(line) for line in evidence.decode().splitlines()]
        output = Path("/retained/output")
        output.mkdir()
        files = {}
        for path in (ROOT / "output").rglob("*"):
            if path.is_file():
                relative = path.relative_to(ROOT / "output")
                files[str(relative)] = {"bytes": path.stat().st_size, "sha256": digest(path)}
                target = output / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, target)
        report.update({
            "childExitCode": os.waitstatus_to_exitcode(status), "records": records, "outputCensus": files,
            "measurement": {"method": "Independent parent statvfs requested1ms plus actual regular-file traversal",
                "samples": samples, "maxSampleIntervalSeconds": max_interval,
                "sampledHighWater": peaks, "sampledRegularFileHighWater": file_counts,
                "final": {name: usage(ROOT / name) for name in peaks},
                "peakSemantics": "Observed sample maxima, not every-allocation/lossless exact peaks",
                "inodesAreNotRegularFileCounts": True},
        })
    finally:
        stop_files.set()
        if pid is not None:
            os.kill(pid, 9)
            os.waitpid(pid, 0)
        emptied = {}
        for name in ("build", "tmp"):
            target = ROOT / name
            if target.exists():
                for entry in target.iterdir():
                    if entry.is_dir() and not entry.is_symlink():
                        shutil.rmtree(entry)
                    else:
                        entry.unlink()
                emptied[name] = not list(target.iterdir())
        cleanup = []
        for target in reversed(mounts):
            rc = LIBC.umount2(str(target).encode(), 0)
            cleanup.append({"path": str(target), "unmounted": rc == 0,
                            "errno": ctypes.get_errno() if rc else 0})
        remaining = [line for line in Path("/proc/self/mountinfo").read_text().splitlines()
                     if line.split()[0] not in inherited and
                     (line.split()[4] == str(ROOT) or line.split()[4].startswith(str(ROOT) + "/"))]
        report["cleanup"] = {"status": "PASS" if all(x["unmounted"] for x in cleanup) and
                            not remaining and all(emptied.values()) else "FAIL",
                            "mounts": cleanup, "remainingTransactionMounts": remaining,
                            "execFilesystemsEmpty": emptied}
        with Path("/retained/GUEST_OFFLINE_RAW.json").open("x") as stream:
            json.dump(report, stream, indent=2)
            stream.write("\n")
        print(json.dumps(report), flush=True)
        require(report["cleanup"]["status"] == "PASS", "LOCAL_DEVICE_EXEC_CLEANUP_FAILED")


if __name__ == "__main__":
    main()
