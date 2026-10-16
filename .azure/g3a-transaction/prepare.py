"""Freeze a new fixture-only lane; preserve the qualified build core."""

import hashlib
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CORE = HERE.parent / "g3a-controller-repair"
READER = HERE.parent / "g3-input-readiness"
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\cbd87055-b09a-4819-9465-8b417b8029d5\Pasted text #1.txt")


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
        result = {"path": str(path)}
        for key, args in (("head", ["rev-parse", "HEAD"]), ("branch", ["branch", "--show-current"]),
                          ("status", ["--no-pager", "status", "--short"])):
            value = subprocess.run(["git", "-C", str(path), *args], capture_output=True, text=True, timeout=60)
            ensure(value.returncode == 0, "CONCURRENCY_READ_FAILED")
            result[key] = value.stdout.strip().splitlines() if key == "status" else value.stdout.strip()
        snapshots.append(result)
    ensure(snapshots[0]["head"] == "7bec20aad11d43eeae8099c14e021b3074154b27" and
           snapshots[0]["status"] == ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"],
           "ISOLATED_CONCURRENCY_DRIFT")
    return snapshots


def main():
    fresh("CONCURRENCY_PREPARE.json", baseline())
    ensure(sha(CORE / "REPAIR_VERIFICATION.json") ==
           "3d155ebc2a739ff9c91fd7011e8497878f34fd3390c6d0ecbd0554c730313f81", "QUALIFIED_CORE_ROOT_CHANGED")
    root = load(CORE / "REPAIR_VERIFICATION.json")
    excluded = {"REPAIR_VERIFICATION.json", "REPAIR_INDEPENDENT_VERIFICATION.json"}
    actual = {str(path.relative_to(CORE)): sha(path) for path in CORE.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(actual == root["repairFileHashes"], "CORE_CENSUS_CHANGED")
    reader_path = READER / "private_reader.py"
    ensure(sha(reader_path) == "c7ac915a4b5d295eb23f55a5ceea801a4f9a0bcaded04e7839a30a7a0743bc68",
           "SEALED_READER_CHANGED")
    write(HERE / "sealed_reader.py", reader_path.read_bytes())
    fresh("AUTHORITY_BINDING.json", {"path": str(AUTHORITY), "sha256": sha(AUTHORITY),
          "scope": "LOCAL_FIXTURES_PUBLIC_DOCS_PRICING_ONLY", "cloudCallsAuthorized": False,
          "coreRootSha256": sha(CORE / "REPAIR_VERIFICATION.json"), "readerSha256": sha(reader_path)})
    print("QUALIFIED_CORE_PRESERVED_READER_COPIED_EXACTLY")


if __name__ == "__main__":
    main()
