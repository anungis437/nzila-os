"""Independent parent acceptance of exact outputs under pre-dispatch kernel hard limits."""

import subprocess
import time

from policy import MAXIMA, effective
from prepare import BASE, CORE, HERE, fresh, prior, read, require, sha
from run_local import IMAGE


def main():
    fresh("CONCURRENCY_ACCEPTANCE.json", prior.baseline())
    raw = read(HERE / "rehearsal-resume/GUEST_OFFLINE_RAW.json")
    require(raw["childExitCode"] == 0 and raw["records"][1]["exitCode"] == 0 and
            raw["cleanup"]["status"] == "PASS", "BOUNDED_TRANSACTION_NOT_PASS")
    limits = read(HERE / "EFFECTIVE_LIMITS.json")
    effective(MAXIMA, limits["observed"])
    require(limits["beforeCoreInvocation"] is True and limits["automaticExpansion"] is False,
            "PRE_DISPATCH_ENFORCEMENT_NOT_ESTABLISHED")
    synthetics = limits["syntheticExhaustionTests"]
    require(len(synthetics) == 4 and
            {(test["resource"], test["kind"]) for test in synthetics} ==
            {("build", "bytes"), ("build", "inodes"), ("tmp", "bytes"), ("tmp", "inodes")} and
            all(test["errno"] == 28 and test["status"] == "PASS_DETERMINISTIC_ENOSPC" for test in synthetics),
            "RESOURCE_LIMIT_NEGATIVES_NOT_PASS")
    previous = read(BASE / "g3a-null-only/EXACT_IMAGE_ACCEPTANCE.json")
    output = HERE / "rehearsal-resume/output/transaction"
    gates = {}
    for name, value in previous["gates"].items():
        file = output / value["file"]
        require(sha(file) == value["sha256"] and file.stat().st_size == value["bytes"],
                "EXACT_GATE_FAILURE_" + name)
        gates[name] = dict(value)
    for path, value in raw["outputCensus"].items():
        file = HERE / "rehearsal-resume/output" / path
        require(sha(file) == value["sha256"] and file.stat().st_size == value["bytes"],
                "ACTUAL_GUEST_OUTPUT_CHANGED")
    ledger = read(HERE / "rehearsal-resume/output/LOCAL_CORE_DISPATCH.json")
    require(ledger["coreInvocations"] == 1, "CORE_ALLOWANCE_NOT_EXACT_ONE")
    fixture = raw["records"][0]
    require(fixture["deviceCensus"] == ["null"] and all(fixture["unauthorizedDevices"].values()) and
            fixture["capMknod"] == "ABSENT" and fixture["hostNegatives"]["/proc/self/fd"],
            "DEVICE_OR_PRIVILEGE_REGRESSION")
    acceptance = {
        "CAPACITY_QUALIFICATION_MODEL": "ENFORCED_HARD_LIMIT",
        "BUILD_LIMIT_EFFECTIVE": "PASS", "TMP_LIMIT_EFFECTIVE": "PASS",
        "HARD_BOUNDED_FROZEN_CORE_REHEARSAL": "PASS",
        "PRODUCTION_TMP_CONTRACT": "QUALIFIED",
        "BUILD_ROOT_HARD_BOUND": MAXIMA["buildRootBytes"],
        "BUILD_ROOT_INODE_HARD_BOUND": MAXIMA["buildRootInodes"],
        "TMP_HARD_BOUND": MAXIMA["tmpBytes"], "TMP_INODE_HARD_BOUND": MAXIMA["tmpInodes"],
        "kernelLimitEvidenceSha256": sha(HERE / "EFFECTIVE_LIMITS.json"),
        "kernelObserved": limits["observed"], "syntheticExhaustion": synthetics,
        "exactImageGates": gates, "goBuildVersion": "go1.27.2", "goCompressorVersion": "go1.25.6",
        "frozenCoreInvocations": 1, "coreSha256": sha(CORE / "inputs/portable-assembler"),
        "deviceAllowlist": ["/dev/null"], "randomDevices": "NONE", "procfs": "NONE",
        "OBSERVED_HIGH_WATER": raw["measurement"],
        "observationScope": "Non-authoritative sampling; readiness derives from hard enforcement plus exact success",
        "HARD_BOUNDED_REHEARSAL_CLEANUP": "PASS",
        "cleanup": raw["cleanup"], "offlineRunnerQualification": "NOT_ADJUDICATED_BY_CAPACITY_ALONE",
    }
    fresh("HARD_BOUND_ACCEPTANCE.json", acceptance)
    events = subprocess.run(["docker", "events", "--since", "45m", "--until", str(int(time.time())),
                  "--filter", "type=container", "--filter", "image=" + IMAGE, "--format", "{{json .}}"],
                  capture_output=True, text=True, timeout=30)
    require(events.returncode == 0, "LOCAL_EVENT_QUERY_FAILED")
    import json
    containers = {}
    for line in events.stdout.splitlines():
        event = json.loads(line)
        sources = [value for key, value in event["Actor"]["Attributes"].items() if key.endswith("/Source")]
        if not any(str(HERE).casefold() in str(source).casefold() for source in sources):
            continue
        containers.setdefault(event["Actor"]["ID"], []).append({
            "action": event["Action"], "timeNano": event["timeNano"],
            "exitCode": event["Actor"]["Attributes"].get("exitCode")})
    require(len(containers) == 2, "PROOF_CONTAINER_CENSUS_NOT_TWO")
    absence = {}
    for identity, history in containers.items():
        require(any(event["action"] == "destroy" for event in history), "DESTROY_EVENT_MISSING")
        observed = subprocess.run(["docker", "inspect", identity], capture_output=True, text=True, timeout=30)
        require(observed.returncode == 1 and ("no such object: " + identity) in observed.stderr.casefold(),
                "EXACT_CONTAINER_SURVIVED")
        absence[identity] = {"exitCode": observed.returncode, "stderr": observed.stderr}
    fresh("EXACT_LOCAL_CLEANUP.json", {"events": containers, "exactIdAbsence": absence,
                                     "remainingLocalTransactionState": "ZERO"})
    print("SEVEN_EXACT_IMAGE_GATES=PASS")
    print("PRODUCTION_TMP_CONTRACT=QUALIFIED")
    print("EXACT_LOCAL_RESIDUAL_STATE=ZERO")


if __name__ == "__main__":
    main()
