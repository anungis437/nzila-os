"""Verify the final candidate binding and rerun source denial/primitive checks."""

import subprocess

from prepare import BASE, fresh, prior, read, require, sha


def main():
    fresh("CONCURRENCY_CANDIDATE_VERIFY.json", prior.baseline())
    directory = BASE / "g3a-hard-runner-candidate"
    path = directory / "PARENT_CANDIDATE_REPORT.json"
    require(sha(path) == "9a81d8b3c623e156bf92140288bd26fdd35880b65b2ed2fcf0342efcc4f15093",
            "FINAL_CANDIDATE_REPORT_CHANGED")
    report = read(path)
    require(report["PRODUCTION_RUNNER_OFFLINE_QUALIFICATION"] == "PASS" and
            report["QUALIFIED_PRIMITIVES_UNCHANGED"] == "YES" and
            report["expectedExecutionAuthorityDigest"] == "" and
            report["trustedExecutionAuthoritySHA256"] == "" and
            report["frozenCoreInvocations"] == 0 and
            not report["productionFutureAuthorityIssued"], "FINAL_CANDIDATE_GOVERNANCE_GATE")
    runner = directory / "production-runner"
    require(sha(runner) == report["PRODUCTION_RUNNER_SHA256"] and
            runner.stat().st_size == report["PRODUCTION_RUNNER_BYTES"], "FINAL_RUNNER_BYTES_CHANGED")
    require(sha(directory / "SOURCE_BINDING.json") == report["SOURCE_BINDING_SHA256"],
            "FINAL_RUNNER_SOURCE_BINDING_CHANGED")
    for component in report["PRODUCTION_RUNNER_COMPONENT_CENSUS"]:
        path = directory / component["name"]
        require(sha(path) == component["sha256"] and path.stat().st_size == component["bytes"],
                "FINAL_RUNNER_COMPONENT_CHANGED_" + component["name"])
    commands = read(directory / report["exactValidationResultsFile"])["results"]
    results = []
    for index in (1, 2, 3):
        item = commands[index]
        result = subprocess.run(item["command"], cwd=item["cwd"],
                                capture_output=True, text=True, timeout=180)
        results.append({"command": item["command"], "cwd": item["cwd"],
                        "exitCode": result.returncode, "stdout": result.stdout,
                        "stderr": result.stderr})
        require(result.returncode == 0, "PARENT_CANDIDATE_CHECK_FAILED_" + str(index))
    fresh("PARENT_FINAL_CANDIDATE_CHECKS.json", {"status": "PASS", "results": results,
          "reportSha256": sha(directory / "PARENT_CANDIDATE_REPORT.json"),
          "runnerSHA256": sha(runner), "runnerBytes": runner.stat().st_size,
          "sourceSHA256": report["PRODUCTION_RUNNER_SOURCE_SHA256"],
          "coreInvocations": 0, "AzureCalls": 0, "candidateRebuilds": 0})
    print("PARENT_FINAL_CANDIDATE_CHECKS=PASS_NO_REBUILD_NO_CORE")


if __name__ == "__main__":
    main()
