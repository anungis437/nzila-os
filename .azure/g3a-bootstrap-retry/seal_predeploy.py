"""Seal the unconsumed, validated retry at its explicit tooling stop."""

import json
from pathlib import Path
import sys

from retry import AUTHORITY, HERE, PRIOR, baseline, ensure, fresh, load, p, sha, v


def main():
    fresh("CONCURRENCY_PREDEPLOY_SEAL.json", baseline())
    ensure(not (HERE / "AUTHORITY_CONSUMED.json").exists() and
           not (HERE / "CSE_EXECUTION_CONSUMED.json").exists(), "AUTHORITY_UNEXPECTEDLY_CONSUMED")
    absent = v.cli("FINAL_PREDEPLOY_RG_ABSENCE.json", ["group", "exists", "--name",
                   load("AUTHORITY_BINDING.json")["resourceGroupCandidate"], "--subscription", p.SUB])
    ensure(absent is False, "RETRY_RG_UNEXPECTEDLY_PRESENT")
    for name, expected in load("EXECUTION_BINDING.json")["fileHashes"].items():
        ensure(sha(HERE / name) == expected, "BOUND_INPUT_CHANGED_" + name)
    protected = {}
    prior_root_path = PRIOR / "LIVE_BOOTSTRAP_VERIFICATION.json"
    prior_root = json.loads(prior_root_path.read_text())
    ensure(sha(prior_root_path) == "4ea8368db85b45ca3f33e0bdb91a40f9b10b350f5f1646ed5f9ec3b1c131a9d1",
           "PREVIOUS_ROOT_CHANGED")
    for name, expected in prior_root["fileHashes"].items():
        ensure(sha(PRIOR / name) == expected, "PREVIOUS_PACKET_CHANGED_" + name)
        protected[str(PRIOR / name)] = expected
    protected[str(prior_root_path)] = sha(prior_root_path)
    independent = PRIOR / "LIVE_BOOTSTRAP_INDEPENDENT_VERIFICATION.json"
    protected[str(independent)] = sha(independent)
    roots = load("PROTECTED_ROOT_BINDING.json")
    for path, expected in (
        (Path(roots["g2Path"]), roots["g2Sha256"]),
        (Path(roots["historicPlan"]), roots["historicPlanSha256"]),
        (HERE.parent / "g3a-firstbyte" / "FIRST_BYTE_VERIFICATION.json", roots["priorFirstByteRoot"]),
        (HERE.parent / "g3a-transaction" / "TRANSACTION_VERIFICATION.json", roots["priorTransactionRoot"]),
        (HERE.parent / "g3a-controller-repair" / "REPAIR_VERIFICATION.json", roots["qualifiedCoreRoot"]),
    ):
        ensure(sha(path) == expected, "PROTECTED_ROOT_CHANGED")
        protected[str(path)] = expected
    bins = load("PROBE_BINARIES.json")["binaries"]
    fresh("RETRY_DISPOSITION.json", {
        "G3_EXECUTION_READINESS": "BLOCKED",
        "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED", "G3A_REGISTRY_UPLOADER": "QUALIFIED",
        "PREVIOUS_BOOTSTRAP_PROOF_AUTHORITY": "CONSUMED", "BOOTSTRAP_RETRY_AUTHORITY_CONSUMED": "NO",
        "BOOTSTRAP_RETRY_AUTHORITY_MAX_RUNS": 1,
        "BOOTSTRAP_RETRY_RESOURCE_GROUP": load("AUTHORITY_BINDING.json")["resourceGroupCandidate"],
        "BOOTSTRAP_RETRY_RESOURCE_GROUP_CREATED": False,
        "CSE_HANDLER_SELECTOR": "2.1", "CSE_2_1_FAMILY_AVAILABLE": "YES",
        "CSE_CANADACENTRAL_AVAILABLE_VERSIONS": load("PUBLISHED_HANDLER_BINDING.json")["availableVersions"],
        "CSE_EFFECTIVE_HANDLER_VERSION": "NOT_CREATED",
        "BOOTSTRAP_RETRY_EXPECTED_COST_CAD": "1.5363953",
        "BOOTSTRAP_RETRY_COST_CEILING_CAD": "3.00",
        "BOOTSTRAP_RETRY_ACTUAL_COST_ESTIMATE_CAD": "0.0000000",
        "BOOTSTRAP_RETRY_ACTUAL_COST_SCOPE": "NO_RETRY_RESOURCE_CREATED",
        "PREVIOUS_PROOF_COST_ESTIMATE_CAD": "1.3567668",
        "BOOTSTRAP_STORAGE_LOCKDOWN": "NOT_RUN", "V1_VERSION_ID": "NOT_CREATED",
        "V1_BINARY_SHA256": bins["V1"]["sha256"], "V2_BINARY_SHA256": bins["V2"]["sha256"],
        "CSE_VERSIONID_SELECTION": "NOT_RUN",
        "G3A_FIRST_BYTE_BOOTSTRAP": "BLOCKED", "BOOTSTRAP_RETRY_RESIDUAL_STATE": "NOT_RUN",
        "RETRY_RG_ABSENCE_CONFIRMED": True,
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3A_EXPECTED_COST_CAD": "UNRESOLVED", "G3A_COST_CEILING_CAD": "UNRESOLVED",
        "G3A_TRANSACTION_READINESS": "BLOCKED",
        "G3A_EXECUTION_AUTHORIZED": "NO", "G3B_EXECUTION_AUTHORIZED": "NO",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO", "REGISTRY_MUTATIONS": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "AZURE_MUTATING_DISPATCHES": 0, "AZURE_SUCCESSFUL_MUTATING_DISPATCHES": 0,
        "AZURE_REJECTED_MUTATING_DISPATCHES": 0, "AZURE_DELETE_DISPATCHES": 0,
        "ROLE_ASSIGNMENT_CREATES": 0, "ROLE_ASSIGNMENT_DELETES": 0, "UAMI_CREATES": 0, "UAMI_DELETES": 0,
        "ENTRA_MUTATIONS": "NO_RETRY_UAMI_OR_DIRECTORY_MUTATION_DISPATCHED",
        "stopReason": "PREDEPLOY_SKILL_TOOL_HOOK_ERROR",
    })
    hashes = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*") if path.is_file()}
    fresh("RETRY_PREDEPLOY_VERIFICATION.json", {
        "status": "SEALED_VALIDATED_UNCONSUMED_TOOLING_BLOCK",
        "authorityPath": str(AUTHORITY), "authoritySha256": sha(AUTHORITY),
        "fileHashes": hashes, "protectedFileHashes": protected,
        "protectedScope": "Previous live packet exact bytes plus protected ancestor roots; no claim of a fresh full ancestor leaf replay.",
    })
    print("RETRY_PREDEPLOY_ROOT_SHA256=" + sha(HERE / "RETRY_PREDEPLOY_VERIFICATION.json"))


if __name__ == "__main__":
    main()
