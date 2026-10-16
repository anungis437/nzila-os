"""Exclusive candidate-lane writes, fixed worktree baselines and immutable-source guards."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(r"C:\APPS\worktrees\nzila-g2-provenance")
FOREIGN = Path(r"C:\APPS\nzila-os")
HERE = Path(__file__).resolve().parent
SOURCE = ROOT / ".azure" / "g3a-hard-runner-source" / "revision-readonly-inputs"
QUALIFIED = ROOT / ".azure" / "g3a-isolation-artifacts"
GO = Path(r"C:\Program Files\Go\bin\go.exe")
IMAGE = "sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce"
CORE = ("launcher.go", "census.go", "proof_linux.go", "dispatch.go",
        "frozen_bindings.go", "production_linux.go")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def baseline():
    result = {}
    for label, root, expected in (
        ("owned", ROOT, "7bec20aad11d43eeae8099c14e021b3074154b27"),
        ("foreign", FOREIGN, "1c337567635bb86ea0df7831557d8d2d22df1e6f"),
    ):
        head = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
        status = subprocess.check_output(["git", "-C", str(root), "status", "--short"], text=True)
        if head != expected or label == "owned" and status.splitlines() != [
                "?? .azure/", "?? infrastructure/landing-zone/g2-builder/"]:
            raise RuntimeError("WORKTREE_BASELINE_CHANGED_" + label)
        result[label] = {"head": head, "statusCount": len(status.splitlines()),
                         "statusSha256": hashlib.sha256(status.encode()).hexdigest()}
    return result


def protect():
    path = HERE / "PRESERVED_BYTES.json"
    if path.exists():
        for name, expected in json.loads(path.read_text())["hashes"].items():
            if sha(Path(name)) != expected:
                raise RuntimeError("HISTORICAL_BYTES_CHANGED_" + name)


def guard():
    result = baseline()
    protect()
    return result


def fresh(name, value):
    guard()
    path = HERE / name
    raw = value.encode() if isinstance(value, str) else value if isinstance(value, bytes) else (
        json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode()
    with path.open("xb") as output:
        output.write(raw)


def directory(path):
    guard()
    path.mkdir(parents=True, exist_ok=True)


def execute(command, env, timeout=300, cwd=HERE):
    before = guard()
    result = subprocess.run(list(map(str, command)), cwd=cwd, env=env, capture_output=True,
                            text=True, encoding="utf-8", errors="replace", timeout=timeout)
    return {"command": list(map(str, command)), "cwd": str(cwd), "exitCode": result.returncode,
            "stdout": result.stdout, "stderr": result.stderr,
            "beforeBaseline": before, "afterBaseline": guard()}
