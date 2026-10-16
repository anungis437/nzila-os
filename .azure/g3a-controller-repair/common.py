"""Evidence-only helpers for the bounded repair lane."""

import hashlib
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PRIOR = HERE.parent / "g3a-full-rehearsal"
IMAGE = "golang@sha256:3b15ba438c60ab8fabe5fee3b11025c0049e358b31feff384648f11fc8e335f8"
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\33382160-7a82-4708-be0f-08147f436837\Pasted text #1.txt")


def ensure(value, message):
    if not value:
        raise RuntimeError(message)


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
        values = {"path": str(path)}
        for key, args in (("head", ["rev-parse", "HEAD"]), ("branch", ["branch", "--show-current"]),
                          ("status", ["--no-pager", "status", "--short"])):
            result = subprocess.run(["git", "-C", str(path), *args], capture_output=True, text=True, timeout=60)
            ensure(result.returncode == 0, "CONCURRENCY_READ_FAILED")
            values[key] = result.stdout.strip().splitlines() if key == "status" else result.stdout.strip()
        snapshots.append(values)
    ensure(snapshots[0]["head"] == "7bec20aad11d43eeae8099c14e021b3074154b27" and
           snapshots[0]["status"] == ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"],
           "ISOLATED_CONCURRENCY_DRIFT")
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


def run(name, command, timeout=240):
    result = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
    write(HERE / (name + ".txt"), (result.stdout + result.stderr).encode())
    fresh(name + ".json", {"command": command, "exitCode": result.returncode,
                          "stdout": result.stdout, "stderr": result.stderr})
    return result
