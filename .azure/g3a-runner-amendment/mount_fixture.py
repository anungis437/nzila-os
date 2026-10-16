"""Disposable local compatibility experiment; never a production runner or Azure command."""

import ctypes
import errno
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys


def main():
    libc = ctypes.CDLL(None, use_errno=True)
    libc.mount.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p,
                          ctypes.c_ulong, ctypes.c_char_p]
    root = Path("/fixture-root")

    def check(value, reason):
        if not value:
            raise RuntimeError(reason)

    def mount(source, target, kind, flags, options=None):
        result = libc.mount(source.encode() if source else None, str(target).encode(),
                            kind.encode() if kind else None, flags, options.encode() if options else None)
        if result:
            raise OSError(ctypes.get_errno(), "FIXTURE_MOUNT_" + str(target))

    check(libc.unshare(0x00020000 | 0x40000000) == 0, "FIXTURE_NAMESPACE_CREATION")
    mount(None, "/", None, 16384 | (1 << 18))
    check(root.is_dir() and not root.is_symlink(), "DISPOSABLE_ROOT_MOUNT_POINT")
    mount("tmpfs", root, "tmpfs", 2 | 4, "size=1073741824,mode=0755")
    for name in ("inputs", "work", "output", "tmp"):
        (root / name).mkdir()
    mount("/sealed-inputs", root / "inputs", None, 4096)
    mount(None, root / "inputs", None, 4096 | 32 | 1 | 2 | 4)
    for name in ("work", "output"):
        mount("tmpfs", root / name, "tmpfs", 2 | 4 | 8, "size=1073741824,mode=0755")
        os.chown(root / name, 65532, 65532)
    # The census proves temporary test execution is necessary, not merely temporary writes.
    mount("tmpfs", root / "tmp", "tmpfs", 2 | 4, "size=1073741824,mode=1777")
    (root / "work" / "transaction" / "go").mkdir(parents=True)
    mount("tmpfs", root / "work" / "transaction" / "go", "tmpfs", 2 | 4,
          "size=536870912,mode=0755")
    os.chown(root / "work" / "transaction", 65532, 65532)
    os.chown(root / "work" / "transaction" / "go", 65532, 65532)
    (root / "work" / "sibling").mkdir()
    witness = root / "inputs" / "compressor-go1256"
    for name in ("work/witness", "work/sibling/witness", "output/witness",
                 "work/transaction/go/witness", "tmp/witness"):
        destination = root / name
        shutil.copyfile(witness, destination)
        destination.chmod(0o555)
    os.chroot(root)
    os.chdir("/")
    check(libc.prctl(38, 1, 0, 0, 0) == 0, "NO_NEW_PRIVS_SET")
    for cap in range(41):
        check(libc.prctl(24, cap, 0, 0, 0) == 0, "BOUNDING_CAP_DROP")
    os.setgroups([])
    os.setresgid(65532, 65532, 65532)
    os.setresuid(65532, 65532, 65532)
    check(libc.prctl(39, 0, 0, 0, 0) == 1, "NO_NEW_PRIVS_READ")
    check(os.getresuid() == os.getresgid() == (65532,) * 3 and os.getgroups() == [],
          "NUMERIC_PRIVILEGE_DROP")
    try:
        os.setresuid(0, 0, 0)
    except PermissionError:
        regain = "DENIED"
    else:
        raise RuntimeError("PRIVILEGE_REGAIN")
    negatives = {}
    for path in ("/var/lib/waagent", "/etc/shadow", "/sealed-inputs", "/proc", "/sys", "/home"):
        negatives[path] = not os.path.exists(path)
    check(all(negatives.values()), "HOST_FILESYSTEM_VISIBLE")
    network = {}
    for address in ("127.0.0.1", "10.91.3.1", "169.254.169.254"):
        with socket.socket() as connection:
            connection.settimeout(1)
            try:
                connection.connect((address, 443))
            except OSError as error:
                check(error.errno in (errno.ENETUNREACH, errno.EHOSTUNREACH, errno.ECONNREFUSED),
                      "NETWORK_TIMEOUT_NOT_NEGATIVE_PROOF")
                network[address] = error.errno
            else:
                raise RuntimeError("NETWORK_CONNECTED")
    execution = {}
    for path in ("/work/witness", "/work/sibling/witness", "/output/witness",
                 "/work/transaction/go/witness", "/tmp/witness"):
        try:
            result = subprocess.run([path], env={"PATH": "/unavailable"}, capture_output=True, timeout=30)
        except PermissionError as error:
            execution[path] = {"execution": "DENIED", "errno": error.errno}
        else:
            execution[path] = {"execution": "PERMITTED", "exitCode": result.returncode}
    for path in ("/work/witness", "/work/sibling/witness", "/output/witness"):
        check(execution[path]["execution"] == "DENIED", "PARENT_NOEXEC")
    for path in ("/work/transaction/go/witness", "/tmp/witness"):
        check(execution[path]["execution"] == "PERMITTED", "EXACT_EXEC_EXCEPTION")
    print(json.dumps({"type": "MOUNT_FIXTURE", "status": "PASS", "execution": execution,
                      "hostNegatives": negatives, "networkNegatives": network,
                      "noNewPrivs": 1, "uidGid": 65532, "regain": regain}), flush=True)
    Path("/output/witness").unlink()
    result = subprocess.run(["/inputs/portable-assembler", "/inputs", "/work/transaction", "/output"],
                            env={"PATH": "/unavailable", "DOCKER_HOST": ""}, capture_output=True,
                            text=True, timeout=900)
    print(json.dumps({"type": "FROZEN_CORE_REHEARSAL", "exitCode": result.returncode,
                      "stdout": result.stdout, "stderr": result.stderr,
                      "compilerInvoked": os.path.exists("/work/transaction/compiler.log"),
                      "outputFiles": sorted(x.name for x in Path("/output").iterdir()),
                      "noRetry": True}), flush=True)


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
        print(json.dumps({"type": "FIXTURE_EXPLICIT_FAILURE", "error": str(error)}), flush=True)
        sys.exit(1)
