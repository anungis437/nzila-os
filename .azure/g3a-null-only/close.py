"""Close exact production-path device proof, without qualifying unresolved peak/capacity gates."""

import json
import subprocess
import time

from prepare import BASE, CORE, HERE, fresh, prior, read, require, sha

EXPECTED = {
    "APP_BINARY_EXACT": ("g3-runtime", "5a1ab8fdd71a8db76220de0d8867eea6c5a1fedd2889cfe9092f3e6f98d9f7b0", 7454844),
    "APP_LAYER_TAR_EXACT": ("layer1.tar", "000cdf8c38857aab9b5a16244b98eb8f6017bf251f064c124622633c8850fc38", 7456768),
    "CERT_LAYER_TAR_EXACT": ("layer2.tar", "622d4366d78c36ca5ca6086e93b66d93305e0e11b95941375c1c4ff1f51cdfa1", 184832),
    "APP_GZIP_EXACT": ("layer1.tar.gz", "e384c980a44e96f09d36cc4e6ffb44b4d7e03af6a75af1bd283c8cd9543aace7", 3201563),
    "CERT_GZIP_EXACT": ("layer2.tar.gz", "af22bfbdda5d1f2c63684516b52acd617cd5913c758d117c044121992d67bb2d", 105884),
    "CONFIG_EXACT": ("config.json", "905dccbd2a9da110a68dcbfb17704b205eb10dfb326e51ace2a7db9bc5d3801e", 1131),
    "MANIFEST_EXACT": ("manifest.json", "82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7", 840),
}


def cleanup_evidence():
    from run_local import IMAGE
    result = subprocess.run(["docker", "events", "--since", "45m", "--until", str(int(time.time())),
        "--filter", "type=container", "--filter", "image=" + IMAGE, "--format", "{{json .}}"],
        capture_output=True, text=True, timeout=30)
    require(result.returncode == 0, "LOCAL_CLEANUP_EVENT_QUERY_FAILED")
    containers = {}
    for line in result.stdout.splitlines():
        event = json.loads(line)
        attributes = event["Actor"]["Attributes"]
        if not any(str(HERE).casefold() in str(value).casefold() for key, value in attributes.items()
                   if key.endswith("/Source")):
            continue
        containers.setdefault(event["Actor"]["ID"], []).append({
            "action": event["Action"], "timeNano": event["timeNano"],
            "exitCode": attributes.get("exitCode")})
    require(len(containers) == 2, "NULL_ONLY_PROOF_CONTAINER_CENSUS_NOT_TWO")
    absence = {}
    for identity, events in containers.items():
        require(any(event["action"] == "destroy" for event in events), "PROOF_CONTAINER_NOT_DESTROYED")
        observed = subprocess.run(["docker", "inspect", identity], capture_output=True, text=True, timeout=30)
        require(observed.returncode == 1 and ("no such object: " + identity) in observed.stderr.casefold(),
                "EXACT_PROOF_CONTAINER_ABSENCE_NOT_PROVEN")
        absence[identity] = {"exitCode": observed.returncode, "stderr": observed.stderr}
    return {"events": containers, "exactIdAbsence": absence, "residualState": "ZERO"}


def main():
    baseline = prior.baseline()
    fresh("CONCURRENCY_CLOSE.json", baseline)
    binding = read(HERE / "AUTHORITY_BINDING.json")
    for path, expected in binding["protectedFileHashes"].items():
        require(sha(path) == expected, "PROTECTED_HISTORY_CHANGED")
    for name, expected in binding["inputs"].items():
        require(sha(CORE / "inputs" / name) == expected["sha256"], "FROZEN_INPUT_CHANGED")
    prior_failure = read(HERE / "rehearsal/GUEST_OFFLINE_RAW.json")
    require(prior_failure["outputCensus"] == {} and prior_failure["cleanup"]["status"] == "PASS" and
            prior_failure["records"][0]["type"] == "CHILD_EXPLICIT_FAILURE",
            "PRIOR_CONSTRUCTOR_FAILURE_NOT_PRE_CORE")
    report = read(HERE / "rehearsal-resume/GUEST_OFFLINE_RAW.json")
    fixture, rehearsal = report["records"]
    require(rehearsal["exitCode"] == 0 and fixture["status"] == "PASS", "NULL_ONLY_TRANSACTION_NOT_PASS")
    require(fixture["deviceCensus"] == ["null"] and all(fixture["unauthorizedDevices"].values()) and
            fixture["hostNegatives"]["/proc/self/fd"] and fixture["capMknod"] == "ABSENT",
            "DEVICE_CAP_PROC_CONTRACT_NOT_PASS")
    ledger = read(HERE / "rehearsal-resume/output/LOCAL_CORE_DISPATCH.json")
    require(ledger["coreInvocations"] == 1 and ledger["deviceCensus"] == ["null"], "ONE_CORE_LEDGER_NOT_EXACT")
    output = HERE / "rehearsal-resume/output/transaction"
    gates = {}
    for gate, (name, expected, size) in EXPECTED.items():
        require(sha(output / name) == expected and (output / name).stat().st_size == size,
                "EXACT_IMAGE_GATE_FAILED_" + gate)
        require(report["outputCensus"]["transaction/" + name]["sha256"] == expected,
                "GUEST_OUTPUT_CENSUS_DISAGREES")
        gates[gate] = {"status": "YES", "file": name, "sha256": expected, "bytes": size}
    compiler = (output / "compiler.log").read_text(encoding="utf-8")
    invocations = [line for line in compiler.splitlines() if line.startswith("STAGED_GO_INVOCATION")]
    require(len(invocations) == 3 and "[test -x ./...]" in invocations[0] and
            "[vet -x ./...]" in invocations[1] and "[build -x " in invocations[2],
            "FROZEN_GO_THREE_PHASES_NOT_OBSERVED")
    compressors = {}
    for raw_digest in ("000cdf8c38857aab9b5a16244b98eb8f6017bf251f064c124622633c8850fc38",
                       "622d4366d78c36ca5ca6086e93b66d93305e0e11b95941375c1c4ff1f51cdfa1"):
        log = output / (raw_digest + ".compressor.log")
        compressors[raw_digest] = {"sha256": sha(log), "output": log.read_text(encoding="utf-8")}
    result = read(output / "result.json")
    require(result["exactFrozenManifest"] and "STAGED_COMPRESSOR" in result["executablesUsed"],
            "FROZEN_COMPRESSOR_NOT_EXECUTED")
    fresh("EXACT_IMAGE_ACCEPTANCE.json", {"gates": gates, "manifest": result["manifestDigest"],
        "compilerInvocations": invocations, "compressorExecutions": compressors,
        "coreInvocations": 1, "noReplay": True})
    measured = report["measurement"]
    sample_capacities = {}
    for name in ("build", "tmp"):
        sampled = measured["sampledHighWater"][name]
        files = measured["sampledRegularFileHighWater"][name]["peakRegularFiles"]
        sample_capacities[name] = {
            "sampledAllocatedBytes": sampled["allocatedBytes"],
            "sampledAllocatedInodesIncludingDirectories": sampled["allocatedInodes"],
            "sampledRegularFiles": files,
            "illustrative150PercentBytesRoundedMiB":
                ((sampled["allocatedBytes"] * 3 + 1) // 2 + 1048575) // 1048576 * 1048576,
            "illustrative150PercentRegularFileCount": (files * 3 + 1) // 2,
            "capacityQualified": False,
        }
    fresh("SUCCESSFUL_USAGE_OBSERVATIONS.json", {
        "successfulFrozenRun": True, "measurement": measured, "sampleCapacities": sample_capacities,
        "qualifyingPeakBytes": "UNRESOLVED", "qualifyingPeakRegularFiles": "UNRESOLVED",
        "decision": "Sampled maxima are direct runtime observations but not lossless exact allocation/file high-water. Do not re-label directory-inclusive inodes as files.",
        "stop": "Capacity gate unresolved under retained true-peak requirement; no second local core invocation authorized.",
    })
    fresh("EXACT_CONTAINER_CLEANUP.json", cleanup_evidence())
    require(report["cleanup"]["status"] == "PASS" and
            not report["cleanup"]["remainingTransactionMounts"] and
            all(report["cleanup"]["execFilesystemsEmpty"].values()), "DEVICE_EXEC_CLEANUP_NOT_PASS")
    fresh("DEVICE_CONTRACT.json", {
        "FROZEN_DEVICE_PATH_CENSUS": "COMPLETE", "FINAL_REQUIRED_DEVICE_PATHS": ["/dev/null"],
        "MINIMAL_DEVICE_CONTRACT": "QUALIFIED", "RANDOM_DEVICE_REQUIREMENT": "NONE",
        "PROCFS_REQUIREMENT": "NONE", "HOST_DEV_TREE_EXPOSED": "NO",
        "goBuildVersion": "go1.27.2", "goCompressorVersion": "go1.25.6",
        "qualificationScope": "Governed exact frozen workload on pinned-compatible offline Linux; not a universal elimination of latent fallbacks or pinned-guest requalification",
        "fallbackDisposition": "LATENT_FALLBACKS_NOT_REQUIRED_BY_GOVERNED_TRANSACTION",
        "devNull": fixture["null"], "mountFlags": fixture["mountFlags"],
        "unauthorizedDeviceNegatives": fixture["unauthorizedDevices"],
        "priorProductionSemanticEvidenceSha256":
            sha(BASE / "g3a-native-semantics/EXACT_RUNTIME_SEMANTIC_FIXTURE.json"),
        "allSevenExactImageGates": "YES", "coreInvocations": 1,
    })
    disposition = {
        "G3_EXECUTION_READINESS": "BLOCKED",
        "SECRETS_PROBE_DISPOSITION": "NOT_PRODUCTION_REACHABLE", "PRODUCTION_SECRETS_DEPENDENCY": "NO",
        "CURRENT_BLOCKER": "NONE",
        "CURRENT_BLOCKER_SCOPE": "Minimal device question closed; remaining blocker is successful true peak/capacity qualification, followed by production dispatch/primitive-equivalence gates",
        "FINAL_REQUIRED_DEVICE_PATHS_CANDIDATE": ["/dev/null"], "HOST_DEV_TREE_EXPOSED": "NO",
        "ISOLATED_DEV_NULL": "PASS", "UNAUTHORIZED_DEVICE_NEGATIVES": "PASS",
        "PROCFS_REQUIREMENT": "NONE", "NULL_ONLY_FROZEN_CORE_REHEARSAL": "PASS",
        **{gate: "YES" for gate in gates},
        "GO1272_PRODUCTION_RANDOM_DEVICE_REQUIREMENT": "NONE",
        "GO1256_PRODUCTION_RANDOM_DEVICE_REQUIREMENT": "NONE",
        "CPYTHON_PRODUCTION_RANDOM_DEVICE_REQUIREMENT": "NONE",
        "OPENSSL_PRODUCTION_RANDOM_DEVICE_REQUIREMENT": "NONE",
        "RANDOM_DEVICE_REQUIREMENT": "NONE", "FINAL_REQUIRED_DEVICE_PATHS": ["/dev/null"],
        "FROZEN_DEVICE_PATH_CENSUS": "COMPLETE", "MINIMAL_DEVICE_CONTRACT": "QUALIFIED",
        "BUILD_ROOT_PEAK_BYTES": "UNRESOLVED", "BUILD_ROOT_PEAK_FILES": "UNRESOLVED",
        "TMP_PEAK_BYTES": "UNRESOLVED", "TMP_PEAK_FILES": "UNRESOLVED",
        "BUILD_ROOT_CAPACITY_BYTES": "UNRESOLVED", "BUILD_ROOT_CAPACITY_FILES": "UNRESOLVED",
        "TMP_CAPACITY_BYTES": "UNRESOLVED", "TMP_CAPACITY_FILES": "UNRESOLVED",
        "OBSERVED_SUCCESSFUL_SAMPLED_HIGH_WATER": sample_capacities,
        "PRODUCTION_TMP_CONTRACT": "BLOCKED", "DEVICE_AND_EXEC_MOUNT_CLEANUP": "PASS",
        "PRODUCTION_EXECUTION_FAIL_CLOSED": "NOT_RUN",
        "PRODUCTION_EXECUTION_FAIL_CLOSED_SCOPE": "No new production dispatch implemented after capacity STOP; previous disabled capsule unchanged",
        "QUALIFIED_PRIMITIVES_UNCHANGED": "YES",
        "QUALIFIED_PRIMITIVES_UNCHANGED_SCOPE": "Protected qualified capsule/source bytes unchanged; no new production candidate or claimed AST qualification",
        "PRODUCTION_RUNNER_OFFLINE_QUALIFICATION": "FAIL",
        "PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED": "NO",
        "G3A_PRODUCTION_COMPATIBLE_RUNNER": "BLOCKED", "G3A_TRANSACTION_READINESS": "BLOCKED",
        "G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED": "NO", "G3A_EXECUTION_AUTHORIZED": "NO",
        "G3B_EXECUTION_AUTHORIZED": "NO", "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "AZURE_READS": 0, "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
        "AZURE_MUTATING_DISPATCHES": 0, "AZURE_SUCCESSFUL_MUTATING_DISPATCHES": 0,
        "AZURE_REJECTED_MUTATING_DISPATCHES": 0, "AZURE_DELETE_DISPATCHES": 0,
        "ROLE_ASSIGNMENT_CREATES": 0, "ROLE_ASSIGNMENT_DELETES": 0, "UAMI_CREATES": 0, "UAMI_DELETES": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "FROZEN_CORE_INVOCATIONS": 1, "PRE_CORE_CONSTRUCTOR_FAILURES": 1,
        "LOCAL_REHEARSAL_ALLOWANCE_CONSUMED": "YES", "PRODUCTION_CANDIDATE_BUILDS": 0,
        "PRODUCTION_RUNNER_PROOF_COST_CEILING_CAD": 3.00,
        "PRODUCTION_RUNNER_PROOF_EXPECTED_COST_CAD": "UNRESOLVED",
        "PRODUCTION_RUNNER_PROOF_ACTUAL_COST_ESTIMATE_CAD": 0.00,
        "PRODUCTION_RUNNER_PROOF_RESIDUAL_STATE": "NOT_RUN",
        "LOCAL_RESIDUAL_STATE": "ZERO",
        "FOREIGN_CHANGES_OBSERVED": {"head": baseline[1]["head"], "statusCount": len(baseline[1]["status"]),
                                    "disposition": "OBSERVED_ONLY_NO_FOREIGN_WRITES"},
        "STOP_REASON": "Section34 capacity cannot be closed from sampled high-water alone. Preserve successful one-shot image/device proof; no rerun or Azure dispatch.",
        "FILES_CHANGED": "Fresh .azure/g3a-null-only lane only; no historical or product edits",
        "RUNTIME_CHANGES": "Two disposable local constructors, one successful frozen-core invocation, exact null bind, all mounts/container state disposed",
    }
    fresh("FINAL_DISPOSITION.json", disposition)
    excluded = {"NULL_ONLY_VERIFICATION.json", "INDEPENDENT_VERIFICATION.json"}
    files = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
             if path.is_file() and path.name not in excluded}
    fresh("NULL_ONLY_VERIFICATION.json", {
        "ruling": "EXACT_IMAGE_AND_NULL_ONLY_DEVICE_PASS_OFFLINE_RUNNER_BLOCKED_CAPACITY",
        "fileHashes": files, "protectedFileHashes": binding["protectedFileHashes"],
        "excludedOutputs": sorted(excluded),
    })
    print("NULL_ONLY_ROOT=" + sha(HERE / "NULL_ONLY_VERIFICATION.json"))
    print("NULL_ONLY_FROZEN_CORE_REHEARSAL=PASS")
    print("MINIMAL_DEVICE_CONTRACT=QUALIFIED")
    print("PRODUCTION_RUNNER_OFFLINE_QUALIFICATION=FAIL_CAPACITY_UNRESOLVED")


if __name__ == "__main__":
    main()
