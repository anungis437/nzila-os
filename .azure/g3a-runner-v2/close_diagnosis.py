"""Additive correction: CLI rejection alone did not prove each denial stage."""

from prepare import HERE, baseline, fresh, load, protected, require, sha


def main():
    fresh("CONCURRENCY_DIAGNOSIS_CLOSURE.json", baseline())
    protected()
    prior = HERE / "FINAL_VERIFICATION.json"
    require(sha(prior) == "d9dae250bb5c4bda8c9acbb96846844ed7070e1ad65a4a29e74178266f6d4885",
            "FAILURE_SEAL_CHANGED")
    fresh("READ_ONLY_DIAGNOSIS_AND_TEST_INTERPRETATION.json", {
        "rootCause": "CROSS_LANGUAGE_INPUT_CENSUS_SERIALIZATION_MISMATCH",
        "agent": "d6f382ad-804f-4060-bb96-268a65dccf60",
        "evidenceBasis": "RETAINED_LOCAL_FAILURE_AND_READ_ONLY_SOURCE_AGENT_DIAGNOSIS",
        "suppliedInputCensusSHA256":
            "65cb9700fc1445a45f9688900c57591c87f1c2aa2125a935a2d4572e6db07cd9",
        "runnerExpectedInputCensusSHA256":
            "855cdca196309428269dd76d6385ca3f6ab2dc862adb4495af19cc5e93434062",
        "censusEncodingBytesEach": 1842,
        "generatorNestedFieldOrder": ["bytes", "mode", "sha256"],
        "GoEntryStructFieldOrder": ["sha256", "bytes", "mode"],
        "generatorLocation": "g3a-runner-v2-source/generate_authority.py:12",
        "validatorComparisonLocation": "g3a-runner-v2-source/runtime_authority_linux.go:108",
        "failureBeforeDispatchLocation": "g3a-runner-v2-source/runtime_authority_linux.go:254",
        "inputRootHashMatched": True, "payloadHashMatched": True,
        "expectedManifestHashMatched": True,
        "expectedManifestSHA256":
            "82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7",
        "sourceTestResult": "PASS_USING_GO_FIXTURE_SHARED_WITH_VALIDATOR",
        "actualCLINegativeResult": "PROCESS_DENIAL_OBSERVED_LATER_FIELD_STAGES_NOT_PROVEN",
        "retiredInterpretation": "ALL_40_REAL_CLI_DENIALS_PROVE_INTENDED_VALIDATION_STAGES",
        "reasonTestsMissedDefect":
            "GO_FIXTURE_SHARED_VALIDATOR_ENCODING_AND_EXTERNAL_CLI_ASSERTED_ONLY_NONZERO",
        "requiredFutureRepair":
            "CANONICAL_CENSUS_CONTRACT_PLUS_GENERATOR_TO_RUNNER_POSITIVE_AND_STAGE_SPECIFIC_NEGATIVE_TESTS",
        "repairPerformed": False, "candidateRebuilt": False, "qualificationRetried": False,
        "singleUseGateScope": "GO_SOURCE_TESTS_ONLY_NOT_EXTERNAL_GENERATOR_POSITIVE_ACCEPTANCE",
        "targetRegistry": "nzilag2tzo75uuozprbo.azurecr.io",
        "targetRepository": "g3-synthetic-runtime",
        "targetRegistryConfirmedAgainstExistingTargetContracts": True,
        "LOCAL_FULL_TRANSACTION_ALLOWANCE_REMAINING": 1,
        "RUNNER_V2_PROOF_AUTHORITY_CONSUMED": "NO",
        "G3A_PRODUCTION_COMPATIBLE_RUNNER": "BLOCKED",
    })
    previous = load(prior)
    references = dict(previous["fileHashes"])
    references[str(prior)] = sha(prior)
    for name in ("CONCURRENCY_DIAGNOSIS_CLOSURE.json",
                 "READ_ONLY_DIAGNOSIS_AND_TEST_INTERPRETATION.json", "close_diagnosis.py"):
        references[str(HERE / name)] = sha(HERE / name)
    fresh("TERMINAL_VERIFICATION.json", {
        "status": "VERIFIED_BLOCKED_NOT_QUALIFIED", "fileHashes": references,
        "protectedFileHashes": previous["protectedFileHashes"],
        "additiveDiagnosisSupersedesCLIDenialInterpretation": True,
        "sourceGateCommandExitsPreservedNotRewritten": True,
        "outerAllowanceRemaining": 1, "cloudAuthorityConsumed": False,
    })
    terminal = load(HERE / "TERMINAL_VERIFICATION.json")
    for key in ("fileHashes", "protectedFileHashes"):
        for path, expected in terminal[key].items():
            require(sha(path) == expected, "TERMINAL_REFERENCE_CHANGED_" + path)
    print("TERMINAL_VERIFICATION_ROOT=" + sha(HERE / "TERMINAL_VERIFICATION.json"))
    print("REFERENCES_VERIFIED=" + str(sum(len(terminal[k]) for k in
          ("fileHashes", "protectedFileHashes"))))
    print("STOP_NO_REPAIR_NO_RETRY_NO_CLOUD_OUTER_ALLOWANCE_1")


if __name__ == "__main__":
    main()
