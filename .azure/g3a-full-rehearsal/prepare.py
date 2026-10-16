"""Fresh offline retry preparation; never performs an application transaction."""

import hashlib
import json
from pathlib import Path
import struct
import subprocess
import tarfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PRIOR = HERE.parent / "g3a-go1256"
PORTABLE = HERE.parent / "g3a-portable"
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\7de54e12-cd03-41b2-bc3d-4893e626ec23\Pasted text #1.txt")
IMAGE = "golang@sha256:3b15ba438c60ab8fabe5fee3b11025c0049e358b31feff384648f11fc8e335f8"


def ensure(value, stage):
    if not value:
        raise RuntimeError(stage)


def sha(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, raw):
    with path.open("xb") as file:
        file.write(raw)


def fresh(name, value):
    write(HERE / name, (json.dumps(value, indent=2) + "\n").encode())


def baseline():
    snapshots = []
    for path in (ROOT, Path(r"C:\APPS\nzila-os")):
        results = {}
        for key, args in (("head", ["rev-parse", "HEAD"]), ("branch", ["branch", "--show-current"]),
                          ("status", ["--no-pager", "status", "--short"])):
            result = subprocess.run(["git", "-C", str(path), *args], capture_output=True, text=True, timeout=60)
            ensure(result.returncode == 0, "CONCURRENCY_READ_FAILED")
            results[key] = result.stdout.strip().splitlines() if key == "status" else result.stdout.strip()
        snapshots.append({"path": str(path), **results})
    ensure(snapshots[0]["head"] == "7bec20aad11d43eeae8099c14e021b3074154b27" and
           snapshots[0]["status"] == ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"],
           "ISOLATED_CONCURRENCY_DRIFT_STOP")
    return snapshots


def boundary():
    return [
        "docker", "run", "--rm", "--pull", "never", "--network", "none", "--read-only",
        "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--memory", "3g",
        "--pids-limit", "256", "--tmpfs", "/work:rw,exec,size=2g",
        "--tmpfs", "/tmp:rw,exec,size=256m", "--tmpfs", "/usr/local/go:rw,noexec,size=1m",
        "--tmpfs", "/go:rw,noexec,size=1m", "--tmpfs", "/etc/ssl:rw,noexec,size=1m",
        "--tmpfs", "/usr/share/ca-certificates:rw,noexec,size=1m",
        "--env", "PATH=/unavailable", "--env", "DOCKER_HOST=",
    ]


def static(path):
    raw = path.read_bytes()
    ensure(len(raw) >= 64 and raw[:6] == b"\x7fELF\x02\x01" and raw[18:20] == b"\x3e\x00", "ELF_PLATFORM")
    offset = struct.unpack_from("<Q", raw, 32)[0]
    stride, count = struct.unpack_from("<HH", raw, 54)
    ensure(stride >= 56 and count > 0 and offset + stride * count <= len(raw) and
           all(struct.unpack_from("<I", raw, offset + i * stride)[0] != 3 for i in range(count)),
           "ELF_INTERPRETER_NOT_ALLOWED")


def extract(path, dest, contract):
    with tarfile.open(path) as archive:
        members = archive.getmembers()
        seen, files = set(), {}
        for member in members:
            name = member.name.rstrip("/")
            ensure(name and not name.startswith("/") and "\\" not in name and
                   all(part not in ("", ".", "..") for part in name.split("/")) and name not in seen and
                   member.mode & ~0o777 == 0, "ARCHIVE_NAME_MODE_DUPLICATE")
            seen.add(name)
            ensure(member.isdir() or member.isfile(), "ARCHIVE_LINK_DEVICE_REJECTED")
            if member.isdir():
                ensure(member.mode == 0o755 and any(key.startswith(name + "/") for key in contract),
                       "ARCHIVE_UNEXPECTED_DIRECTORY")
            else:
                ensure(name in contract, "ARCHIVE_UNEXPECTED_FILE")
                expected = contract[name]
                raw = archive.extractfile(member).read()
                ensure(member.size == len(raw) == expected["bytes"] and member.mode == expected["mode"] and
                       hashlib.sha256(raw).hexdigest() == expected["sha256"], "ARCHIVE_MEMBER_CONTRACT")
                files[name] = member
        ensure(set(files) == set(contract), "ARCHIVE_FILE_CENSUS")
        if dest is not None:
            dest.mkdir()
            for name, member in files.items():
                target = dest.joinpath(*name.split("/"))
                target.parent.mkdir(parents=True, exist_ok=True)
                write(target, archive.extractfile(member).read())
                target.chmod(member.mode)
    return {"files": len(files), "members": len(members), "sha256": sha(path), "bytes": path.stat().st_size}


def main():
    fresh("CONCURRENCY_PREPARE.json", baseline())
    ensure(sha(PRIOR / "GO1256_VERIFICATION.json") ==
           "7dea5383fac3277120b4a4c71350f21635cc10d9a8c4021afe34dcbded6db8cc", "PRIOR_ROOT_CHANGED")
    fresh("AUTHORITY_BINDING.json", {"path": str(AUTHORITY), "sha256": sha(AUTHORITY),
                                  "fullTransactionsAuthorized": 1, "scope": "LOCAL_OFFLINE_ONLY"})
    output = HERE / "clean-room"
    output.mkdir()
    (output / "transaction").mkdir()
    checks = """
set -eu
test "$PATH" = /unavailable
test -z "$DOCKER_HOST"
for name in docker buildx buildkitd buildctl go apt apt-get apk yum dnf; do
  if command -v "$name" >/dev/null 2>&1; then exit 91; fi
done
for path in /var/run/docker.sock /run/docker.sock /usr/local/go/bin/go /go/bin/go /usr/bin/go /usr/bin/docker /usr/bin/buildctl /root/.docker /root/.cache/go-build /etc/ssl/certs/ca-certificates.crt; do
  test ! -e "$path"
done
test ! -e /inputs
test ! -e /frozen
test ! -e /var/lib/docker
test ! -e /var/lib/buildkit
printf 'HOST_ENGINE_ISOLATION_PASS_NO_COMPILER_INVOKED\\n'
"""
    command = boundary() + ["--entrypoint", "/bin/sh", IMAGE, "-c", checks]
    result = subprocess.run(command, capture_output=True, text=True, timeout=90)
    fresh("HOST_ENGINE_ISOLATION.json", {"command": command, "exitCode": result.returncode,
          "stdout": result.stdout, "stderr": result.stderr, "compilerInvoked": False,
          "shellRole": "OUTER_BOUNDARY_OBSERVER_NOT_BUILD_TRANSACTION_EXECUTABLE",
          "network": "NONE", "hostEngine": "ISOLATION_ONLY", "socketMounted": False})
    ensure(result.returncode == 0 and result.stdout.strip() ==
           "HOST_ENGINE_ISOLATION_PASS_NO_COMPILER_INVOKED", "HOST_ENGINE_ISOLATION_STOP")
    inputs = HERE / "inputs"
    inputs.mkdir()
    binding = load(PRIOR / "PROPOSED_UPDATED_BUILD_BINDING.json")
    for name, expected in binding["inputs"].items():
        source = PRIOR / name if name == "compressor-go1256" else PORTABLE / "inputs" / name
        ensure(source.stat().st_size == expected["bytes"] and sha(source) == expected["sha256"],
               "SEALED_INPUT_MISMATCH_" + name)
        write(inputs / name, source.read_bytes())
    write(inputs / "binding.json", (json.dumps(binding, indent=2) + "\n").encode())
    tools = load(inputs / "toolchain-members.json")
    archives = {
        "toolchain": extract(inputs / "go-toolchain.tar", HERE / "preparation-toolchain", tools),
        "source": extract(inputs / "source.tar", None, binding["sourceMembers"]),
    }
    for name in ("bin/go", "pkg/tool/linux_amd64/compile", "pkg/tool/linux_amd64/link",
                 "pkg/tool/linux_amd64/asm", "pkg/tool/linux_amd64/vet"):
        static(HERE / "preparation-toolchain" / name)
    static(inputs / "compressor-go1256")
    ensure(sha(inputs / "compressor-go1256") ==
           "378bacae9bd14e6d2c428fb52ea537ae06bedae01392849293ba9863eb62f95c" and
           (inputs / "compressor-go1256").stat().st_size == 2166932, "PROVEN_COMPRESSOR_MISMATCH")
    source = HERE / "assembler"
    source.mkdir()
    for name in ("main.go", "compressor.go", "go.mod"):
        write(source / name, (PRIOR / "prepared-assembler" / name).read_bytes())
    fresh("INPUT_PREPARATION.json", {"status": "PASS", "archives": archives,
          "inputs": binding["inputs"], "isolatedBeforeCompilerOrAssembler": True,
          "frozenImageMounted": False, "applicationTransactions": 0})
    print("HOST_ENGINE_ISOLATION_PASS_STAGED_INPUTS_VERIFIED_NO_COMPILER_INVOKED")


if __name__ == "__main__":
    main()
