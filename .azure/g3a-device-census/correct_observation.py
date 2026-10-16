"""Append a concurrency-metadata correction without altering the prior seal."""

import census


def main():
    concurrency = census.prior.baseline()
    census.fresh("CONCURRENCY_CORRECTION.json", concurrency)
    original = census.load(census.HERE / "FINAL_DISPOSITION.json")
    actual_close = census.load(census.HERE / "CONCURRENCY_CLOSE.json")
    corrected = dict(original)
    corrected["FOREIGN_CHANGES_OBSERVED"] = {
        "head": concurrency[1]["head"],
        "initialStatusCount": 587,
        "previousReportedCount": original["FOREIGN_CHANGES_OBSERVED"]["latestStatusCount"],
        "originalCloseReceiptCount": len(actual_close[1]["status"]),
        "latestStatusCount": len(concurrency[1]["status"]),
        "disposition": "OBSERVED_ONLY_NO_FOREIGN_WRITES",
    }
    corrected["SUPERSEDES_REGISTER_ONLY"] = "FINAL_DISPOSITION.json"
    corrected["CORRECTION_REASON"] = "Foreign status changed during closure; use actual bound receipt, not pre-closure count."
    census.fresh("FINAL_DISPOSITION_CORRECTED.json", corrected)
    original_root = census.HERE / "DEVICE_CENSUS_VERIFICATION.json"
    census.require(census.sha(original_root) == "0e3f17baf3ccb655d835f71edb068deecc5927eca181571b1c457429840ca5f9",
                   "ORIGINAL_SEAL_CHANGED")
    excluded = {"CORRECTION_VERIFICATION.json", "CORRECTION_INDEPENDENT_VERIFICATION.json"}
    files = {str(path.relative_to(census.HERE)): census.sha(path) for path in census.HERE.rglob("*")
             if path.is_file() and path.name not in excluded}
    census.fresh("CORRECTION_VERIFICATION.json", {
        "ruling": "MANDATORY_STOP_REQUIRED_DEVICE_CENSUS_INCOMPLETE",
        "fileHashes": files,
        "protectedFileHashes": census.load(original_root)["protectedFileHashes"],
        "priorSealSha256": census.sha(original_root),
        "excludedOutputs": sorted(excluded),
    })
    print("CORRECTED_DEVICE_CENSUS_ROOT=" + census.sha(census.HERE / "CORRECTION_VERIFICATION.json"))


if __name__ == "__main__":
    main()
