"""Direct-byte verification of the live closure, without executing its sealer."""

import datetime
import hashlib
import json
import re
import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def ensure(value, message):
    if not value:
        raise RuntimeError(message)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def main():
    ensure(len(sys.argv) == 2 and re.fullmatch("[0-9a-f]{64}", sys.argv[1]), "supply exact root SHA")
    root_file = HERE / "LIVE_READINESS_FINAL_VERIFICATION.json"
    root_hash = sha(root_file)
    ensure(root_hash == sys.argv[1], "root mismatch")
    output = HERE / "LIVE_READINESS_INDEPENDENT_VERIFICATION.json"
    ensure(not output.exists(), "independent verification already exists; do not overwrite")
    root = load(root_file)
    current = {
        str(path.relative_to(HERE)): sha(path)
        for path in HERE.rglob("*") if path.is_file() and path != root_file
    }
    ensure(current == root["liveReadinessFileHashes"], "live file census differs from seal")
    count = len(current) + 1
    for file, expected in root["preservation"]["rootHashes"].items():
        ensure(sha(ROOT / file) == expected, "preserved root changed")
        count += 1
    old = HERE.parent / "g3-readiness"
    old_root = load(old / "READINESS_FINAL_VERIFICATION.json")
    for file, expected in old_root["readinessFileHashes"].items():
        ensure(sha(old / file) == expected, "old readiness byte change: " + file)
        count += 1
    authority = Path(root["authorityPath"])
    ensure(sha(authority) == root["authoritySha256"], "active authority binding")
    count += 1
    events = [json.loads(line) for line in (HERE / "AZURE_READ_ONLY_LEDGER.jsonl").read_text().splitlines()]
    starts = [x for x in events if x["event"] == "START"]
    ends = [x for x in events if x["event"] == "COMPLETE"]
    ensure(len(events) == 2 * len(starts) and len(starts) == len(ends) == 71, "ledger invocation census")
    ensure(len({x["name"] for x in starts}) == len(starts), "duplicate CLI authority")
    posts = []
    for start, end in zip(starts, ends):
        ensure(start["name"] == end["name"], "uncorrelated ledger")
        cmd = start["command"]
        if cmd[1] == "rest":
            ensure(cmd[3] in {"GET", "POST"}, "mutation HTTP method")
            if cmd[3] == "POST":
                ensure("/Microsoft.KeyVault/checkNameAvailability?" in cmd[cmd.index("--url") + 1],
                       "unapproved POST")
                ensure(json.loads(cmd[cmd.index("--body") + 1]) ==
                       {"name": "nzl-g3-test-001-kv", "type": "Microsoft.KeyVault/vaults"}, "unapproved POST body")
                posts.append(start["name"])
        else:
            ensure(not any(x in cmd for x in [
                "create", "update", "delete", "set", "register", "login", "push", "import",
                "assign", "run-command", "what-if", "validate",
            ]), "mutation CLI verb")
        ensure(start["mutations"] == end["mutations"] == 0, "ledger mutation")
        record = load(HERE / end["responseFile"])
        ensure(record["name"] == end["name"] and record["exitCode"] == end["exitCode"], "response correlation")
        ensure(record["azureMutationCount"] == 0, "response mutation")
    ensure(posts == ["VAULT_NAME_AVAILABILITY"], "name-check census")
    ensure(sum(x["exitCode"] != 0 for x in ends) == 13, "failure history not preserved")
    facts = load(HERE / "LIVE_ACCOUNT_ASSESSMENT.json")
    outputs = facts["outputs"]
    for key in ("G3_EXECUTION_READINESS", "G3_QUOTA_STATUS", "G3_FIREWALL_UDR_MODEL",
                "G3_SECRET_PROOF_CONTRACT", "G3A_PRODUCTION_SUBSTRATE"):
        ensure(outputs[key] == "BLOCKED", "unsupported readiness success: " + key)
    for key in ("G3_PROVIDER_REGISTRATION", "G3_REGION_AVAILABILITY", "G3_RESOURCE_GROUP_COLLISION",
                "G3_NAME_COLLISION_CHECK", "G3_NETWORK_ADDRESS_PLAN"):
        ensure(outputs[key] == "PASS", "account disposition changed")
    ensure(facts["environmentQuota"] == {"currentUse": 4, "limit": 20, "proofRequirement": 1, "headroom": 16},
           "environment quota evidence shape")
    ensure(facts["environmentCoreQuota"]["value"] == "UNRESOLVED", "substituted environment quota")
    ensure(facts["protectedLiveEstate"]["resourceCount"] == 16, "protected estate count")
    ensure(len(facts["survivingBlockers"]) == 5, "surviving blocker census")
    ensure(outputs["TARGET_REGISTRY_IMAGE_PRESENT"] == "NOT_PROVEN", "unproven remote image claim")
    ensure(outputs["G3_PLATFORM_EGRESS_BREADTH"] == "ACCEPTED_FOR_SYNTHETIC_PROOF", "governance decision missing")
    for key in ("G3_TECHNICAL_EXECUTION_AUTHORIZED", "APPLICATION_ROLLOUT_AUTHORIZED", "PRODUCTION_DATA_AUTHORIZED"):
        ensure(root[key] == outputs[key] == "NO", key)
    for key in ("AZURE_MUTATIONS", "REGISTRY_MUTATIONS"):
        ensure(root[key] == outputs[key] == 0, key)
    ensure(outputs["G3_PRIVATE_APPLICATION_SUBSTRATE"] == "NOT_EXECUTED", "false runtime proof")
    ensure(outputs["UE_INFRA"] == outputs["CORA_INFRA"] == "INFRA_NO_GO", "product disposition")
    value = {
        "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "PASS", "scope": "DIRECT_BYTE_LEDGER_AND_DISPOSITION_VERIFICATION_NOT_AZURE_EXECUTION",
        "liveReadinessRootSha256": root_hash, "hashReferencesVerified": count,
        "exactLiveReadinessFileCensus": len(current), "ledgerInvocations": len(starts),
        "failedReadAttemptsRetained": 13, "documentedNonMutatingPosts": posts,
        "G3_EXECUTION_READINESS": "BLOCKED", "G3_PRIVATE_APPLICATION_SUBSTRATE": "NOT_EXECUTED",
        "controllerImportedOrExecuted": False, "additionalAzureCalls": 0,
    }
    with output.open("x", encoding="utf-8", newline="\n") as file:
        json.dump(value, file, indent=2)
        file.write("\n")
    print(json.dumps({"status": "PASS", "rootSha256": root_hash, "hashReferencesVerified": count}, indent=2))


if __name__ == "__main__":
    main()
