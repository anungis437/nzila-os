"""Direct-byte architecture verification without importing/executing the sealer."""

import datetime
import hashlib
import json
from pathlib import Path
import re
import sys
import tarfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def ensure(value, message):
    if not value:
        raise RuntimeError(message)


def sha(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def main():
    ensure(len(sys.argv) == 2 and re.fullmatch("[0-9a-f]{64}", sys.argv[1]), "exact expected root SHA required")
    root_path = HERE / "EXECUTION_LANE_VERIFICATION.json"
    ensure(sha(root_path) == sys.argv[1], "architecture root hash mismatch")
    root = load(root_path)
    census = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*") if path.is_file()
              and path != root_path}
    ensure(census == root["executionLaneFileHashes"], "architecture file census mismatch")
    count = len(census) + 1
    for relative, expected in root["preservedPacketHashes"].items():
        ensure(sha(ROOT / relative) == expected, "previous packet bytes changed")
        count += 1
    for relative, expected in root["priorPreservation"]["rootHashes"].items():
        ensure(sha(ROOT / relative) == expected, "historic root hash mismatch")
        count += 1
    terminal = load(HERE.parent / "evidence" / "G2_TERMINAL_FINAL_VERIFICATION.json")
    for key, base in (
        ("evidenceHashes", HERE.parent / "evidence"), ("completePriorEvidenceHashes", HERE.parent / "evidence"),
        ("stageRootHashes", HERE.parent / "evidence"),
        ("sourceHashes", ROOT / "infrastructure" / "landing-zone" / "g2-builder"),
    ):
        for relative, expected in terminal[key].items():
            ensure(sha(base / relative) == expected.lower(), "G2 evidence/source byte change")
            count += 1
    ensure(sha(Path(root["authorityPath"])) == root["authoritySha256"], "active authority byte mismatch")
    output = load(HERE / "EXECUTION_LANE_DISPOSITION.json")
    ensure(output["G3_EXECUTION_READINESS"] == "BLOCKED" and
           len(output["remainingArchitecturalBlockers"]) == 3, "unsupported readiness claim")
    ensure(output["G3_EXISTING_STAGING_PRINCIPAL_REUSED"] == "NO" and
           output["executorContract"]["subject"] == "repo:anungis437/nzila-os:environment:g3-proof",
           "executor governance mismatch")
    for key in ("G3A_CONTROLLER", "G3B_CONTROLLER", "G3A_BICEP_PACKAGE", "G3B_BICEP_PACKAGE"):
        ensure(output[key] == "INCOMPLETE", "unsupported completeness")
    for key in ("AZURE_MUTATIONS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS"):
        ensure(root[key] == output[key] == 0, "mutation disposition")
    for key in ("G3_TECHNICAL_EXECUTION_AUTHORIZED", "APPLICATION_ROLLOUT_AUTHORIZED", "PRODUCTION_DATA_AUTHORIZED"):
        ensure(output[key] == "NO", "execution authorized unexpectedly")
    ensure(output["UE_INFRA"] == output["CORA_INFRA"] == "INFRA_NO_GO", "product disposition")
    frozen = load(HERE.parent / "g3-final-readiness" / "FINAL_READINESS_DISPOSITION.json")
    for key in ("G3_IMAGE_MANIFEST_DIGEST", "G3_SOURCE_AUTHORITY", "G3_EGRESS_ARCHITECTURE",
                "G3_MANAGED_IDENTITY_QUOTA", "G3_CONSUMPTION_QUOTA_GATE"):
        ensure(output[key] == frozen[key], "frozen decision changed")
    inputs = load(HERE / "INPUT_INVENTORY.json")
    for name in ("sourceBundle", "compilerArchive", "finalQualifiedOCIArtifact",
                 "fixedRuntimeProofImplementation", "localDesignGuardsNotControllers"):
        entry = inputs[name]
        ensure(sha(Path(entry["path"])) == entry["sha256"] and Path(entry["path"]).stat().st_size == entry["bytes"],
               "exact input hash/size mismatch")
    for name in ("portableToolingBundle", "G3AController", "G3BController", "privateProofScripts"):
        ensure(inputs[name]["status"] == "NOT_PRODUCED" and inputs[name]["bytes"] is None and
               inputs[name]["sha256"] is None, "fabricated missing artifact")
    with tarfile.open(HERE / "compiler-dockerarchive.tar") as archive:
        index = json.load(archive.extractfile("index.json"))
        descriptor = index["manifests"][0]
        raw = archive.extractfile("blobs/sha256/" + descriptor["digest"].split(":")[1]).read()
        ensure("sha256:" + hashlib.sha256(raw).hexdigest() == descriptor["digest"] ==
               inputs["compilerArchive"]["upstreamOCIManifest"], "compiler OCI authority mismatch")
        manifest = json.loads(raw)
        for item in [manifest["config"], *manifest["layers"]]:
            raw = archive.extractfile("blobs/sha256/" + item["digest"].split(":")[1]).read()
            ensure("sha256:" + hashlib.sha256(raw).hexdigest() == item["digest"] and len(raw) == item["size"],
                   "compiler raw blob mismatch")
    events = [json.loads(line) for line in (HERE / "AZURE_READ_ONLY_LEDGER.jsonl").read_text().splitlines()]
    ensure(len(events) == 4, "read invocation census")
    for start, end in zip(events[::2], events[1::2]):
        ensure(start["name"] == end["name"] and start["command"][1:3] in (["account", "show"], ["resource", "list"]) and
               start["mutations"] == end["mutations"] == 0 and end["exitCode"] == 0, "read-only ledger violation")
    ensure(len(load(HERE / "PROTECTED_G2_RESOURCES.json")["response"]) == 16, "protected resources changed")
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", (HERE / "EXECUTION_LANE_ARCHITECTURE.md").read_text()):
        path = (HERE / target).resolve()
        ensure(path.exists() or path == HERE / "EXECUTION_LANE_INDEPENDENT_VERIFICATION.json", "broken report link")
    record = {
        "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "PASS", "scope": "DIRECT_BYTE_ARCHITECTURE_VERIFICATION_NOT_RUNTIME_READINESS",
        "rootSha256": sys.argv[1], "hashReferencesVerified": count,
        "rawCompilerOCIContentVerified": True, "sealerImportedOrExecuted": False,
        "G3_EXECUTION_READINESS": "BLOCKED", "additionalAzureCalls": 0,
    }
    with (HERE / "EXECUTION_LANE_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8", newline="\n") as file:
        json.dump(record, file, indent=2)
        file.write("\n")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
