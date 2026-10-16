"""Only local tools; every output remains in this new sibling."""

import ast
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
ACTIVE = ROOT.parent.parent
FOREIGN = Path(r"C:\APPS\nzila-os")


def run(command):
    result = subprocess.run(command, cwd=ROOT, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
                            capture_output=True, text=True, timeout=180)
    return {"command": command, "exitCode": result.returncode, "stdout": result.stdout,
            "stderr": result.stderr}


def baseline():
    records = {}
    for label, repo, expected, status in [
        ("active", ACTIVE, "7bec20aad11d43eeae8099c14e021b3074154b27",
         ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"]),
        ("foreign", FOREIGN, "1c337567635bb86ea0df7831557d8d2d22df1e6f", None),
    ]:
        head = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
        rows = subprocess.check_output(["git", "-C", str(repo), "status", "--short"], text=True).splitlines()
        if head != expected or (status is not None and rows != status) or (
                label == "foreign" and len(rows) != 505):
            raise RuntimeError("CONCURRENCY_BASELINE_DRIFT_" + label)
        records[label] = {"head": head, "status": rows if label == "active" else None,
                          "statusCount": len(rows), "dispositioned": False}
    return records


def main():
    before = baseline()
    for file in ROOT.glob("*.py"):
        ast.parse(file.read_bytes(), str(file))
    checks = [run([sys.executable, "-B", "-m", "unittest", "-v", "test_closure"])]
    compiler = Path(r"C:\Users\AubertNungisa\.azure\bin\bicep.exe")
    for file in sorted((ROOT / "bicep").glob("*.bicep")):
        for operation in ("build", "lint"):
            command = [str(compiler), operation, str(file)]
            if operation == "build":
                command += ["--stdout"]
            result = run(command)
            if operation == "build":
                raw = result.pop("stdout")
                result["compiledTemplateSha256"] = hashlib.sha256(raw.encode()).hexdigest()
                result["compiledTemplateBytes"] = len(raw.encode())
                if result["exitCode"] == 0:
                    json.loads(raw)
            checks.append(result)
    after = baseline()
    result = {
        "localChecks": "PASS" if all(item["exitCode"] == 0 for item in checks) else "FAIL",
        "checks": checks, "before": before, "after": after,
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3A_TRANSACTION_READINESS": "BLOCKED", "liveCalls": 0,
        "registryMutations": 0, "guestExecution": False, "coreRebuilt": False,
        "uploaderRequalified": False,
    }
    # Rebaseline immediately before this write batch, not just before tests.
    result["immediateWriteBaseline"] = baseline()
    (ROOT / "LOCAL_VALIDATION.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: result[key] for key in ("localChecks", "G3A_CONTROLLER", "G3A_BICEP_PACKAGE")}))
    for item in checks:
        if item["exitCode"] or item["stderr"]:
            print("COMMAND:", " ".join(item["command"]))
            print(item["stderr"])
    return 0 if result["localChecks"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
