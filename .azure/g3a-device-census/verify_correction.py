import hashlib
import json
from pathlib import Path


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    here = Path(__file__).resolve().parent
    seal = load(here / "CORRECTION_VERIFICATION.json")
    for name, digest in seal["fileHashes"].items():
        if sha(here / name) != digest:
            raise RuntimeError("CORRECTED_PACKET_CHANGED_" + name)
    for name, digest in seal["protectedFileHashes"].items():
        if sha(Path(name)) != digest:
            raise RuntimeError("HISTORICAL_REFERENCE_CHANGED")
    result = load(here / "FINAL_DISPOSITION_CORRECTED.json")
    baseline = load(here / "CONCURRENCY_CORRECTION.json")
    observation = result["FOREIGN_CHANGES_OBSERVED"]
    if observation["head"] != baseline[1]["head"] or observation["latestStatusCount"] != len(baseline[1]["status"]):
        raise RuntimeError("CORRECTED_FOREIGN_OBSERVATION_NOT_EXACT")
    original = load(here / "FINAL_DISPOSITION.json")
    changed = {key for key in original if result[key] != original[key]}
    if changed != {"FOREIGN_CHANGES_OBSERVED"}:
        raise RuntimeError("CORRECTION_CHANGED_GATE_RULING_OR_COUNTERS")
    if sha(here / "DEVICE_CENSUS_VERIFICATION.json") != seal["priorSealSha256"]:
        raise RuntimeError("ORIGINAL_SEAL_NOT_PRESERVED")
    report = {
        "verification": "PASS_FOR_APPEND_ONLY_CONCURRENCY_CORRECTION_AND_UNCHANGED_STOP",
        "root": sha(here / "CORRECTION_VERIFICATION.json"),
        "localFiles": len(seal["fileHashes"]),
        "protectedHistoricalReferences": len(seal["protectedFileHashes"]),
        "foreignObservationExact": True,
        "priorSealUnchanged": True,
        "gateRulingsAndCountersUnchanged": True,
    }
    with (here / "CORRECTION_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
