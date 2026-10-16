"""New local one-shot capacity allowance; immutable prior image/device proof retained."""

import hashlib
import json
from pathlib import Path
import sys

from policy import MAXIMA

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
CORE = BASE / "g3a-controller-repair"
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\3d123728-29e5-4f5e-9862-5ca634b7275f\Pasted text #1.txt")
sys.path.insert(0, str(BASE / "g3a-isolation-live"))
import isolation_live as prior


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def fresh(name, value):
    with (HERE / name).open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def main():
    fresh("CONCURRENCY_PREPARE.json", prior.baseline())
    old_path = BASE / "g3a-null-only/NULL_ONLY_VERIFICATION.json"
    require(sha(old_path) == "97be5ef9789a31bbf9c5f5e9f8943f39b7100e3c390b4b0aee681fc276c26d72",
            "NULL_ONLY_ROOT_CHANGED")
    old = read(old_path)
    protected = {**old["protectedFileHashes"],
                 **{str(old_path.parent / name): value for name, value in old["fileHashes"].items()},
                 str(old_path): sha(old_path),
                 str(old_path.parent / "INDEPENDENT_VERIFICATION.json"):
                     sha(old_path.parent / "INDEPENDENT_VERIFICATION.json")}
    for path, value in protected.items():
        require(sha(path) == value, "PROTECTED_REFERENCE_CHANGED")
    previous = read(BASE / "g3a-null-only/FINAL_DISPOSITION.json")
    require(previous["MINIMAL_DEVICE_CONTRACT"] == "QUALIFIED" and
            previous["FINAL_REQUIRED_DEVICE_PATHS"] == ["/dev/null"] and
            previous["RANDOM_DEVICE_REQUIREMENT"] == "NONE", "DEVICE_CONTRACT_NOT_QUALIFIED")
    archive = read(BASE / "g3a-work-redirection/ARCHIVE_EXECUTABILITY.json")
    require(archive["STAGED_EXECUTABILITY_CENSUS"] == archive["EXEC_BUILD_ARCHIVE_SAFETY"] == "PASS",
            "ARCHIVE_CONTRACT_NOT_PASS")
    binding = read(CORE / "inputs/binding.json")
    for name, value in binding["inputs"].items():
        require(sha(CORE / "inputs" / name) == value["sha256"], "FROZEN_INPUT_CHANGED")
    fresh("AUTHORITY_BINDING.json", {
        "mission": "NZ-20261008-INFRA-001", "authorityPath": str(AUTHORITY),
        "authoritySha256": sha(AUTHORITY), "newLocalCoreAllowance": 1,
        "liveAuthorityConsumed": False, "protectedFileHashes": protected,
        "governanceMaxima": MAXIMA, "inputs": binding["inputs"],
        "reusedConstructorPath": str(BASE / "g3a-null-only/fixture.py"),
        "reusedConstructorSha256": sha(BASE / "g3a-null-only/fixture.py"),
    })
    fresh("CAPACITY_CONTRACT.json", {
        "CAPACITY_QUALIFICATION_MODEL": "ENFORCED_HARD_LIMIT", "capacity": MAXIMA,
        "governanceMaxima": MAXIMA, "priorObservedHighWater": {
            "buildBytes": 521621504, "buildRegularFiles": 18880,
            "tmpBytes": 117673984, "tmpRegularFiles": 1188},
        "contextRatiosOnlyNotQualification": {
            "BUILD_BYTE_HEADROOM_RATIO": MAXIMA["buildRootBytes"] / 521621504,
            "BUILD_FILE_HEADROOM_RATIO": MAXIMA["buildRootInodes"] / 18880,
            "TMP_BYTE_HEADROOM_RATIO": MAXIMA["tmpBytes"] / 117673984,
            "TMP_FILE_HEADROOM_RATIO": MAXIMA["tmpInodes"] / 1188},
        "deviceAllowlist": ["/dev/null"], "procfs": "NONE",
        "peakSamplingAcceptanceRetired": True, "neverExpandOnFailure": True,
        "STAGED_EXECUTABILITY_CENSUS": "PASS", "EXEC_BUILD_ARCHIVE_SAFETY": "PASS",
    })
    print("CAPACITY_QUALIFICATION_MODEL=ENFORCED_HARD_LIMIT")


if __name__ == "__main__":
    main()
