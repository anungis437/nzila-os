"""Disposable offline topology fixture and independent filesystem observation."""

import ctypes
import errno
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time

ROOT = Path("/fixture-root")
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


def child():
    os.chroot(ROOT)
    os.chdir("/")
    require(LIBC.prctl(38, 1, 0, 0, 0) == 0, "NNP_SET")
    for cap in range(41):
        require(LIBC.prctl(24, cap, 0, 0, 0) == 0, "BOUNDING_CAP_DROP")
    os.setgroups([])
    os.setresgid(65532, 65532, 65532)
    os.setresuid(65532, 65532, 65532)
    require(LIBC.prctl(39, 0, 0, 0, 0) == 1, "NNP_VERIFY")
    require(os.getresuid() == os.getresgid() == (65532,) * 3 and os.getgroups() == [], "PRIVILEGE_DROP")
    try:
        os.setresuid(0, 0, 0)
    except PermissionError:
        regain = "DENIED"
    else:
        raise RuntimeError("PRIVILEGE_REGAIN")
    host = {path: not os.path.exists(path) for path in
            ("/var/lib/waagent", "/etc/shadow", "/sealed-inputs", "/retained", "/proc", "/sys", "/home")}
    require(all(host.values()), "HOST_FILESYSTEM_VISIBLE")
    network = {}
    for address in ("127.0.0.1", "10.91.3.1", "169.254.169.254"):
        with socket.socket() as connection:
            connection.settimeout(1)
            try:
                connection.connect((address, 443))
            except OSError as error:
                require(error.errno in (errno.ENETUNREACH, errno.EHOSTUNREACH, errno.ECONNREFUSED),
                        "TIMEOUT_NOT_NETWORK_PROOF")
                network[address] = error.errno
            else:
                raise RuntimeError("BUILD_NETWORK_AVAILABLE")
    execution = {}
    for path in ("/work/witness", "/work/sibling/witness", "/output/witness",
                 "/build/witness", "/tmp/witness"):
        try:
            result = subprocess.run([path], env={"PATH": "/unavailable"}, capture_output=True, timeout=30)
        except PermissionError as error:
            execution[path] = {"execution": "DENIED", "errno": error.errno}
        else:
            execution[path] = {"execution": "PERMITTED", "exitCode": result.returncode}
    for path in ("/work/witness", "/work/sibling/witness", "/output/witness"):
        require(execution[path]["execution"] == "DENIED", "NONEXEC_MOUNT_EXECUTED")
    for path in ("/build/witness", "/tmp/witness"):
        require(execution[path]["execution"] == "PERMITTED", "EXEC_MOUNT_NOT_EXECUTABLE")
    for path in ("/build/witness", "/tmp/witness", "/output/witness"):
        Path(path).unlink()
    require(not Path("/build/transaction").exists(), "FROZEN_WORK_CHILD_ALREADY_CREATED")
    fixture = {"type": "REDIRECTED_FIXTURE", "status": "PASS", "execution": execution,
               "hostNegatives": host, "networkNegatives": network, "uidGid": 65532,
               "noNewPrivs": 1, "regain": regain, "frozenWorkChildAbsent": True}
    print(json.dumps(fixture), flush=True)
    start = time.monotonic()
    result = subprocess.run(["/inputs/portable-assembler", "/inputs", "/build/transaction", "/output/transaction"],
                            env={"PATH": "/unavailable", "DOCKER_HOST": ""}, capture_output=True,
                            text=True, timeout=900)
    print(json.dumps({"type": "FROZEN_REHEARSAL", "exitCode": result.returncode,
                      "stdout": result.stdout, "stderr": result.stderr,
                      "elapsedSeconds": time.monotonic() - start,
                      "compilerInvoked": Path("/build/transaction/compiler.log").exists()}), flush=True)
    return result.returncode


def usage(path):
    value = os.statvfs(path)
    return {"allocatedBytes": (value.f_blocks - value.f_bfree) * value.f_frsize,
            "allocatedInodes": value.f_files - value.f_ffree}


def main():
    mounts = []
    require(LIBC.unshare(0x00020000 | 0x40000000) == 0, "NEW_MOUNT_NET_NAMESPACES")
    mount(None, "/", None, 16384 | (1 << 18))
    mount("tmpfs", ROOT, "tmpfs", 2 | 4, "size=2147483648,mode=0755")
    mounts.append(ROOT)
    for name in ("inputs", "work", "output", "build", "tmp"):
        (ROOT / name).mkdir()
    mount("/sealed-inputs", ROOT / "inputs", None, 4096)
    mounts.append(ROOT / "inputs")
    mount(None, ROOT / "inputs", None, 4096 | 32 | 1 | 2 | 4)
    for name in ("work", "output", "build", "tmp"):
        flags = 2 | 4 | (8 if name in ("work", "output") else 0)
        capacity = 2147483648 if name == "build" else 1073741824
        mount("tmpfs", ROOT / name, "tmpfs", flags, f"size={capacity},mode=0700")
        mounts.append(ROOT / name)
        os.chown(ROOT / name, 65532, 65532)
    (ROOT / "output" / "transaction").mkdir(mode=0o700)
    os.chown(ROOT / "output" / "transaction", 65532, 65532)
    (ROOT / "work" / "sibling").mkdir()
    for name in ("work/witness", "work/sibling/witness", "output/witness", "build/witness", "tmp/witness"):
        path = ROOT / name
        shutil.copyfile(ROOT / "inputs" / "compressor-go1256", path)
        path.chmod(0o555)
    read_fd, write_fd = os.pipe()
    child_pid = os.fork()
    if child_pid == 0:
        os.close(read_fd)
        os.dup2(write_fd, 1)
        os.close(write_fd)
        try:
            exit_code = child()
        except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
            print(json.dumps({"type": "CHILD_EXPLICIT_FAILURE", "error": str(error)}), flush=True)
            exit_code = 1
        os._exit(exit_code)
    os.close(write_fd)
    os.set_blocking(read_fd, False)
    peaks = {name: {"allocatedBytes": 0, "allocatedInodes": 0} for name in ("build", "tmp")}
    samples = 0
    output = bytearray()
    start = previous = time.monotonic()
    max_interval = 0
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
            output.extend(os.read(read_fd, 65536))
        except BlockingIOError:
            pass
        require(len(output) < 1048576, "CHILD_EVIDENCE_BYTE_CEILING")
        observed_pid, status = os.waitpid(child_pid, os.WNOHANG)
        if observed_pid:
            while True:
                chunk = os.read(read_fd, 65536)
                if not chunk:
                    break
                output.extend(chunk)
            break
        if time.monotonic() - start > 960:
            os.kill(child_pid, 9)
            os.waitpid(child_pid, 0)
            raise RuntimeError("LOCAL_CHILD_LIFETIME_EXCEEDED")
        time.sleep(0.002)
    os.close(read_fd)
    records = [json.loads(line) for line in output.decode("utf-8").splitlines()]
    final_usage = {name: usage(ROOT / name) for name in peaks}
    files = {}
    destination = Path("/retained") / "output"
    require(not destination.exists(), "RETAINED_OUTPUT_COLLISION")
    destination.mkdir()
    for path in (ROOT / "output" / "transaction").rglob("*"):
        if path.is_file():
            relative = path.relative_to(ROOT / "output" / "transaction")
            with path.open("rb") as stream:
                digest = hashlib.file_digest(stream, "sha256").hexdigest()
            files[str(relative)] = {"bytes": path.stat().st_size, "sha256": digest}
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
    cleanup = []
    for name in ("build", "tmp"):
        path = ROOT / name
        for entry in path.iterdir():
            if entry.is_dir() and not entry.is_symlink():
                shutil.rmtree(entry)
            else:
                entry.unlink()
        require(not list(path.iterdir()), "EXEC_FILESYSTEM_CONTENTS_SURVIVE")
    for path in reversed(mounts):
        require(LIBC.umount2(str(path).encode(), 0) == 0, "EXEC_MOUNT_UNMOUNT_FAILED")
        cleanup.append(str(path))
    mountinfo = Path("/proc/self/mountinfo").read_text()
    require(not any(" " + str(ROOT / name) + " " in mountinfo for name in ("build", "tmp")),
            "EXEC_MOUNT_SURVIVES")
    report = {"childExitCode": os.waitstatus_to_exitcode(status), "records": records,
              "measurement": {"method": "Independent parent statvfs observation every requested2ms",
                              "samples": samples, "maxSampleIntervalSeconds": max_interval,
                              "peaks": peaks, "final": final_usage,
                              "peakSemantics": "Measured sample high-water, not lossless every-syscall peak.",
                              "filesMeaning": "Allocated filesystem inodes including directories"},
              "outputCensus": files, "cleanup": {"status": "PASS", "unmounted": cleanup,
                                               "executableContentsRemoved": True,
                                               "executableMountsSurviving": 0}}
    (Path("/retained") / "GUEST_OFFLINE_RAW.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
