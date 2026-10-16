"""Seal the one proven experiment without promoting self-test-only code to production."""

from datetime import datetime, timezone
import io
import json
from pathlib import Path
import sys
import unittest

import independent_verify as verify
import isolation_live as live

LOCAL = live.BASE / "g3a-production-local"


def main():
    live.fresh("CONCURRENCY_FINAL_CLOSURE.json", live.baseline())
    protected = verify.prior()
    event_count = verify.audit()
    guest = live.read("GUEST_PROOF_RESULT.json")
    live.ensure(guest["allPassed"] and guest["evidenceComplete"] and guest["extensionSucceeded"],
                "LIVE_ISOLATION_NOT_PROVEN")
    live.ensure(live.load(LOCAL / "LIVE_PRIMITIVES_INDEPENDENT.json")["status"] == "PASS",
                "INDEPENDENT_LIVE_PRIMITIVES_NOT_PASS")
    sys.path.insert(0, str(LOCAL))
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(
        unittest.defaultTestLoader.loadTestsFromName("test_budget"))
    live.fresh("LOCAL_CONTINUATION_TESTS.json", {
        "status": "PASS" if result.wasSuccessful() else "FAIL", "tests": result.testsRun,
        "output": stream.getvalue(), "cloudCalls": 0,
        "scope": "Standalone cost/lifetime primitives; not wired or promoted to complete production controller.",
    })
    live.ensure(result.wasSuccessful() and result.testsRun == 6, "LOCAL_CONTINUATION_FIXTURES_FAIL")
    blocker = {
        "status": "BLOCKED_STOP_BEFORE_PRODUCTION_BUILD",
        "liveProof": "PROVEN_PRIVATE_HANDOFF_AND_IMPORT_ONLY_ISOLATION",
        "productionCapsuleLineage": "QUALIFIED_NOT_AUTOMATIC_PRODUCTION_PROMOTION",
        "candidateSourceSha256": guest["provenance"]["candidateSourceSha256"],
        "review": {
            "reviewer": "guest-isolation-capsule retained-context implementation agent",
            "scope": "Read-only feasibility of byte-equivalent production execution component",
            "source": str(live.ARTIFACTS / "launcher.go"),
            "run": {"line": 125, "contract": "--self-test only"},
            "guestProof": {"line": 221, "contract": "{evidence,cwd} plan and fixed --_isolated-proof-child"},
            "isolatedProofChild": {
                "line": 328, "contract": "No parameters or callback; closes plan FD3 at line369",
                "executionLines": [568, 569],
                "executionContract": "Embedded loader/Python /runtime/app/entry.py /runtime, not staged assembler",
                "acceptanceLines": [610, 611],
                "acceptanceContract": "PASS_OFFLINE_IMPORT_ONLY, liveExecution DISABLED, networkRequests0, transactionQualified false",
            },
        },
        "blockers": [
            {
                "id": "SELFTEST_ONLY_QUALIFIED_EXECUTION_COMPONENT",
                "requiredChange": "Staged-input handoff, production command dispatch/arguments and result validation.",
                "whyCallerArgumentsCannotFix": "The qualified child has no dispatch hook and hardcodes import-only Python execution.",
            },
            {
                "id": "NOEXEC_WORKSPACE_VS_FROZEN_PORTABLE_COMPILER_EXECUTION",
                "actualGuestWorkMountFlags": guest["isolationEvidence"]["isolatedMountFlags"]["/work"],
                "actualGuestOutputMountFlags": guest["isolationEvidence"]["isolatedMountFlags"]["/output"],
                "MS_NOEXEC": 8,
                "frozenBuildRequirement": "Portable assembler extracts and executes work/go/bin/go.",
                "requiredChange": "Qualified workspace mount/execution contract; cannot be repaired by caller path.",
                "independentBuildFailureReproduced": False,
                "basis": "Bound source feasibility review and independently verified actual guest NOEXEC flags, not a second build/proof.",
            },
        ],
        "governance": {
            "newProofAuthorityIssued": False, "secondLiveAttempt": False,
            "isolationMechanismChanged": False, "newProductionBuild": False,
            "qualifiedKernelRuntimeComponentModified": False, "newGuestProof": False,
            "AzureMutationsAfterProofCleanup": 0, "registryMutations": 0,
        },
        "whyStop": "Current authority requires relevant component byte-equivalence; required production changes do not satisfy it.",
        "standaloneBudgetPrimitives": "6 offline tests PASS; final controller integration absent, gates remain FAIL.",
    }
    live.fresh("PRODUCTION_CONTINUATION_BLOCKER.json", blocker)
    disposition = live.read("PROOF_CLOSE_DISPOSITION.json")
    disposition.update({
        "G3A_PRODUCTION_CAPSULE_LINEAGE": "QUALIFIED",
        "FINAL_PRODUCTION_CAPSULE": "NOT_CREATED",
        "G3A_EXPECTED_COST_CAD": "UNRESOLVED",
        "G3A_COST_CEILING_CAD": "UNRESOLVED",
        "priorBoundedScenarioExpectedCAD": "4.8973042",
        "priorBoundedScenarioCeilingCAD": "7.35",
        "productionCostScope": "FINAL_PRODUCTION_PAYLOAD_AND_CONTROLLER_NOT_BOUND",
        "conditionalLocalContinuation": "ATTEMPTED_STOP_COMPONENT_EQUIVALENCE_BLOCKER",
        "blockers": [item["id"] for item in blocker["blockers"]],
        "newExecutionAuthority": False, "AzureMutationsAfterProofCleanup": 0,
        "productionCapsuleBuilt": False,
        "G3A_CONTENT_ADDRESSED_FIRST_BYTE": "PROVEN",
        "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED",
        "G3A_REGISTRY_UPLOADER": "QUALIFIED",
        "lineageInterpretation": "Successful architecture/candidate lineage, not completed final production artifact.",
    })
    live.fresh("FINAL_DISPOSITION.json", disposition)
    for name, expected in live.read("PINNED_GUEST_PROOF_BINDING.json")["artifactFileHashes"].items():
        live.ensure(live.sha(Path(name)) == expected, "SEALED_PROOF_ARTIFACT_CHANGED")
    live.fresh("ISOLATION_VERIFICATION.json", {
        "status": "LIVE_PROOF_PROVEN_PRODUCTION_TRANSACTION_BLOCKED",
        "UTC": datetime.now(timezone.utc).isoformat(), "eventCount": event_count,
        "fileHashes": verify.census(live.HERE, {"ISOLATION_VERIFICATION.json", "ISOLATION_INDEPENDENT_VERIFICATION.json"}),
        "artifactPath": str(live.ARTIFACTS), "artifactFileHashes": verify.census(live.ARTIFACTS, set()),
        "protectedFileHashes": {
            **protected,
            **{str(path): live.sha(path) for path in LOCAL.rglob("*") if path.is_file()},
        },
        "authorityConsumed": True, "oneCSEAttempt": True,
        "productionBlocker": disposition["blockers"], "productionExecutionAuthorized": False,
        "closeoutCloudMutations": 0,
    })
    print("ISOLATION_VERIFICATION_ROOT=" + live.sha(live.HERE / "ISOLATION_VERIFICATION.json"))


if __name__ == "__main__":
    main()
