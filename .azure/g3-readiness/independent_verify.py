"""Verify the sealed local packet by direct bytes, without importing its controller."""

import datetime
import hashlib
import json
import re
import sys
import tarfile
from pathlib import Path


BASE = Path(__file__).resolve().parent
REPO = BASE.parent.parent


def ensure(value, message):
    if not value:
        raise RuntimeError(message)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def main():
    ensure(len(sys.argv) == 2 and re.fullmatch("[0-9a-f]{64}", sys.argv[1]), "supply sealed root SHA")
    root_path = BASE / "READINESS_FINAL_VERIFICATION.json"
    root_hash = sha(root_path)
    ensure(root_hash == sys.argv[1], "sealed root differs from expected SHA")
    root = load(root_path)
    output = BASE / "READINESS_INDEPENDENT_VERIFICATION.json"
    ensure(not output.exists(), "independent proof already exists; do not overwrite")
    current = {
        str(path.relative_to(BASE)): sha(path)
        for path in BASE.rglob("*") if path.is_file() and path != root_path
    }
    ensure(current == root["readinessFileHashes"], "missing, extra or changed readiness deliverable")
    count = len(current) + 1
    old_roots = [
        (REPO / ".azure" / "evidence" / "G2_TERMINAL_FINAL_VERIFICATION.json",
         "ed29f65fc52a89a707d76bf553a24f579e1542ddf439245edcf0cde3ccc0f499"),
        (REPO / ".azure" / "g3-design" / "DESIGN_VERIFICATION.json",
         "97ca2e560611a93c0f676fd421fa5c79292c2366a5e9b4beec14cad18c66c572"),
    ]
    for path, expected in old_roots:
        ensure(sha(path) == expected, f"historical seal changed: {path}")
        count += 1
    terminal = load(old_roots[0][0])
    evidence = old_roots[0][0].parent
    for key, directory in [
        ("evidenceHashes", evidence), ("completePriorEvidenceHashes", evidence),
        ("stageRootHashes", evidence),
        ("sourceHashes", REPO / "infrastructure" / "landing-zone" / "g2-builder"),
    ]:
        for relative, expected in terminal[key].items():
            ensure(sha(directory / relative) == expected.lower(), relative)
            count += 1
    for key, file in [
        ("currentPlanSha256", "deployment-plan.md"),
        ("missionStatusSha256", "mission-gate-status.json"),
        ("validationWorkflowSha256", "validate-status.json"),
    ]:
        ensure(sha(REPO / ".azure" / file) == terminal[key], file)
        count += 1
    for file, expected in load(old_roots[1][0])["designFileHashes"].items():
        ensure(sha(old_roots[1][0].parent / file) == expected, file)
        count += 1
    concurrency = load(BASE / "SOURCE_AND_CONCURRENCY.json")
    authority = concurrency["authority"]
    ensure(sha(Path(authority["path"])) == root["authoritySha256"] == authority["sha256"], "authority binding")
    ensure(concurrency["preservation"]["foreignReviewedFilesChangedSinceDesign"] == [], "foreign architecture changed")
    count += 1
    qualification = load(BASE / "local-image-qualification" / "LOCAL_IMAGE_QUALIFICATION.json")
    for file, expected in qualification["sourceFileHashes"].items():
        ensure(sha(BASE / "runtime" / file) == expected.split(":")[1], file)
        count += 1
    reference = qualification["observations"][0]
    manifests = []
    for run in (1, 2):
        with tarfile.open(BASE / "local-image-qualification" / f"image-run{run}.tar") as archive:
            entries = {
                item.name: archive.extractfile(item).read()
                for item in archive.getmembers() if item.isfile()
            }
        for file, data in entries.items():
            if file.startswith("blobs/sha256/"):
                ensure(hashlib.sha256(data).hexdigest() == file[13:], file)
                count += 1
        index = json.loads(entries["index.json"])
        ensure("sha256:" + hashlib.sha256(entries["index.json"]).hexdigest() == reference["indexDigest"], "index")
        ensure(len(index["manifests"]) == 1, "single executable manifest")
        descriptor = index["manifests"][0]
        ensure(descriptor["digest"] == reference["manifestDigest"], "manifest digest")
        manifest_bytes = entries["blobs/sha256/" + descriptor["digest"][7:]]
        ensure(len(manifest_bytes) == descriptor["size"], "manifest descriptor")
        manifest = json.loads(manifest_bytes)
        ensure(manifest["config"]["digest"] == reference["configDigest"], "config")
        config = json.loads(entries["blobs/sha256/" + manifest["config"]["digest"][7:]])
        ensure((config["os"], config["architecture"]) == ("linux", "amd64"), "platform")
        ensure(config["config"]["User"] == "65532:65532", "non-root")
        ensure(config["config"]["Entrypoint"] == ["/g3-runtime"], "executable entrypoint")
        ensure([x["digest"] for x in manifest["layers"]] == reference["layerDigests"], "layers")
        manifests.append(manifest_bytes)
    ensure(manifests[0] == manifests[1], "independent manifest byte equivalence")
    validation = load(BASE / "LOCAL_CONTRACT_VERIFICATION.json")
    ensure(validation["status"] == "PASS", "local validation not PASS")
    modules = validation["localBicepRebuildAndContract"]["modules"]
    ensure(len(modules) == 7, "seven prepared modules")
    for module in modules:
        ensure(sha(BASE / "bicep" / module["source"]) == module["sourceSha256"], "current Bicep source")
        ensure(sha(BASE / module["compiledReference"]) == module["compiledSha256"], "compiled evidence")
        ensure(module["build"] == module["lint"] == "PASS", "Bicep result")
        count += 2
    runtime = load(BASE / "bicep-local-validation-final" / "runtime.json")
    app = next(x for x in runtime["resources"] if x["type"] == "Microsoft.App/containerApps")
    identities = app["properties"]["configuration"]["identitySettings"]
    ensure({x["identity"]: x["lifecycle"] for x in identities} == {
        "[parameters('pullIdentityId')]": "None", "[parameters('runtimeIdentityId')]": "Main",
    }, "separate identity lifecycle")
    disposition = load(BASE / "READINESS_DISPOSITION.json")
    required = [
        "G3_EXECUTION_READINESS", "G3_RUNTIME", "G3_ENVIRONMENT_TYPE",
        "G3_WORKLOAD_PROFILE", "G3_ENVIRONMENT_ACCESSIBILITY", "G3_ACA_PRIVATE_ENDPOINT",
        "G3_IMAGE_REPOSITORY", "G3_IMAGE_TAG", "G3_IMAGE_MANIFEST_DIGEST",
        "G3_IMAGE_PULL_IDENTITY_MODEL", "G3_RUNTIME_IDENTITY_MODEL",
        "G3_ARTIFACT_EXECUTION_SPLIT", "G3_RESOURCE_GROUP", "G3_PROOF_COST_CEILING_CAD",
        "G3_CANDIDATE_IDLE_MONTHLY_COST_CAD", "G3_BICEP_LOCAL_BUILD",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED", "APPLICATION_ROLLOUT_AUTHORIZED",
        "PRODUCTION_DATA_AUTHORIZED", "AZURE_MUTATIONS", "REGISTRY_MUTATIONS",
        "G2_TERMINAL_ROOT_UNCHANGED", "UE_INFRA", "CORA_INFRA",
    ]
    ensure(all(key in disposition for key in required), "required packet outputs missing")
    ensure(disposition["G3_EXECUTION_READINESS"] == "BLOCKED", "false readiness PASS")
    ensure(disposition["G3_PRIVATE_APPLICATION_SUBSTRATE"] == "NOT_EXECUTED", "false execution claim")
    ensure(disposition["G3_PROOF_COST_CEILING_CAD"] == "UNRESOLVED", "fabricated budget")
    ensure(disposition["G3_CANDIDATE_IDLE_MONTHLY_COST_CAD"] == "UNRESOLVED", "fabricated idle total")
    for key in ("G3_TECHNICAL_EXECUTION_AUTHORIZED", "APPLICATION_ROLLOUT_AUTHORIZED", "PRODUCTION_DATA_AUTHORIZED"):
        ensure(disposition[key] == root[key] == "NO", key)
    for key in ("AZURE_MUTATIONS", "REGISTRY_MUTATIONS", "AZURE_RESOURCE_CALLS"):
        ensure(disposition[key] == root[key] == 0, key)
    ensure(disposition["UE_INFRA"] == disposition["CORA_INFRA"] == "INFRA_NO_GO", "product disposition")
    ensure(all(value.startswith("NOT_EXECUTED") for value in disposition["negativeProofs"].values()), "unrun negative PASS")
    with output.open("x", encoding="utf-8", newline="\n") as file:
        json.dump({
            "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "status": "PASS", "scope": "OFFLINE_SEAL_INTEGRITY_NOT_AZURE_EXECUTION",
            "readinessRootSha256": root_hash, "hashReferencesVerified": count,
            "exactReadinessFileCensus": len(current),
            "requiredOutputFields": len(required), "G3_EXECUTION_READINESS": "BLOCKED",
            "G3_PRIVATE_APPLICATION_SUBSTRATE": "NOT_EXECUTED",
            "controllerImportedOrExecuted": False, "azureResourceCalls": 0,
        }, file, indent=2)
        file.write("\n")
    print(json.dumps({"status": "PASS", "rootSha256": root_hash, "hashReferencesVerified": count}, indent=2))


if __name__ == "__main__":
    main()
