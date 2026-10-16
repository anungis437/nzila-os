"""Exclusive delivery writes; candidate and historical bytes remain sealed."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CANDIDATE = HERE.parent / "g3a-hard-runner-candidate"
INPUTS = HERE.parent / "g3a-controller-repair" / "inputs"
OFFLINE = HERE.parent / "g3a-hard-capacity" / "OFFLINE_QUALIFICATION.json"
sys.path.insert(0, str(CANDIDATE))
import candidate_guard as historical
GO = historical.GO
IMAGE = historical.IMAGE


def sha(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for raw in iter(lambda: stream.read(1048576), b""):
            h.update(raw)
    return h.hexdigest()


def guard():
    result = historical.guard()
    preserved = HERE / "PRESERVED_BYTES.json"
    if preserved.exists():
        for name, digest in json.loads(preserved.read_text())["hashes"].items():
            if sha(name) != digest:
                raise RuntimeError("SEALED_DEPENDENCY_CHANGED_" + name)
    if json.loads(OFFLINE.read_text())["PRODUCTION_RUNNER_OFFLINE_QUALIFICATION"] != "PASS":
        raise RuntimeError("PARENT_OFFLINE_QUALIFICATION_NOT_PASS")
    return result


def fresh(name, value):
    guard()
    raw = value if isinstance(value, bytes) else value.encode() if isinstance(value, str) else (
        json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode()
    with (HERE / name).open("xb") as stream:
        stream.write(raw)


def execute(command, timeout=300, env=None):
    before = guard()
    result = subprocess.run(list(map(str, command)), cwd=HERE, env=env or os.environ.copy(),
                            capture_output=True, text=True, encoding="utf-8",
                            errors="replace", timeout=timeout)
    return {"command": list(map(str, command)), "exitCode": result.returncode,
            "stdout": result.stdout, "stderr": result.stderr,
            "beforeBaseline": before, "afterBaseline": guard()}
