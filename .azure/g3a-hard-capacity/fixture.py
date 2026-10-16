"""Bounded adapter around the sealed null-only constructor; privileged parent verifies kernel limits."""

import ctypes
import errno
import hashlib
import importlib.util
import json
import os
from pathlib import Path

from policy import MAXIMA, effective

source = Path("/prior-fixture.py")
spec = importlib.util.spec_from_file_location("sealed_null_fixture", source)
prior = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prior)
require = prior.require
require(hashlib.sha256(source.read_bytes()).hexdigest() ==
        json.loads(Path("/hard-binding.json").read_text())["reusedConstructorSha256"],
        "REUSED_CONSTRUCTOR_CHANGED")

ORIGINAL_MOUNT = prior.mount
ORIGINAL_CHILD = prior.child
observations = {}
synthetic = []
LIBC = prior.LIBC


def filesystem(path):
    buffer = (ctypes.c_long * 32)()
    require(LIBC.statfs(str(path).encode(), ctypes.byref(buffer)) == 0, "STATFS_FAILED")
    value = os.statvfs(path)
    return {
        "filesystemType": "TMPFS" if buffer[0] == 0x01021994 else hex(buffer[0]),
        "totalBytes": value.f_blocks * value.f_frsize, "availableBytes": value.f_bavail * value.f_frsize,
        "totalInodes": value.f_files, "availableInodes": value.f_favail,
        "mountFlags": value.f_flag, "rw": not bool(value.f_flag & os.ST_RDONLY),
        "exec": not bool(value.f_flag & os.ST_NOEXEC),
        "nosuid": bool(value.f_flag & os.ST_NOSUID), "nodev": bool(value.f_flag & os.ST_NODEV),
    }


def exhaustion(target, resource, kind):
    ORIGINAL_MOUNT("tmpfs", target, "tmpfs", 2 | 4,
                   "size=16384,nr_inodes=64,mode=0700" if kind == "bytes" else
                   "size=1048576,nr_inodes=4,mode=0700")
    evidence = {"resource": resource, "kind": kind, "effective": filesystem(target)}
    try:
        if kind == "bytes":
            with (target / "bounded").open("xb", buffering=0) as stream:
                for _ in range(8):
                    stream.write(b"x" * 4096)
            raise RuntimeError("SYNTHETIC_BYTES_NOT_ENFORCED")
        else:
            for index in range(8):
                (target / str(index)).touch(exist_ok=False)
            raise RuntimeError("SYNTHETIC_INODES_NOT_ENFORCED")
    except OSError as error:
        require(error.errno == errno.ENOSPC, "LIMIT_FAILURE_NOT_ENOSPC")
        evidence["errno"] = error.errno
        evidence["status"] = "PASS_DETERMINISTIC_ENOSPC"
    finally:
        for path in target.iterdir():
            path.unlink()
        require(LIBC.umount2(str(target).encode(), 0) == 0, "SYNTHETIC_LIMIT_UNMOUNT_FAILED")
    synthetic.append(evidence)


def bounded_mount(source, target, kind, flags, options=None):
    target = Path(target)
    resource = target.name
    if target.parent == prior.ROOT and resource in ("build", "tmp") and kind == "tmpfs":
        exhaustion(target, resource, "bytes")
        exhaustion(target, resource, "inodes")
        prefix = "buildRoot" if resource == "build" else "tmp"
        options = f"size={MAXIMA[prefix + 'Bytes']},nr_inodes={MAXIMA[prefix + 'Inodes']},mode=0700"
        require(flags == 2 | 4, "BOUNDED_EXEC_FLAGS_CHANGED")
        ORIGINAL_MOUNT(source, target, kind, flags, options)
        observations[resource] = filesystem(target)
        return
    ORIGINAL_MOUNT(source, target, kind, flags, options)


def bounded_child():
    kernel = {name: filesystem(prior.ROOT / name) for name in ("build", "tmp")}
    effective(MAXIMA, kernel)
    with (prior.ROOT / "output/EFFECTIVE_LIMITS.json").open("x") as stream:
        json.dump({"BUILD_LIMIT_EFFECTIVE": "PASS", "TMP_LIMIT_EFFECTIVE": "PASS",
                   "beforeCoreInvocation": True, "observed": kernel,
                   "constructorMountObservations": observations,
                   "syntheticExhaustionTests": synthetic,
                   "kernelEnforced": True, "automaticExpansion": False}, stream)
    return ORIGINAL_CHILD()


if __name__ == "__main__":
    prior.mount = bounded_mount
    prior.child = bounded_child
    prior.main()
