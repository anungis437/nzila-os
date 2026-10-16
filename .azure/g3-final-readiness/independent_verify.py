"""Separate direct-byte final-packet verification; does not import its sealer."""

import datetime
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import tarfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def ensure(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def main():
    ensure(len(sys.argv) == 2 and re.fullmatch("[0-9a-f]{64}", sys.argv[1]), "supply expected root SHA")
    root_path = HERE / "FINAL_READINESS_VERIFICATION.json"
    ensure(sha(root_path) == sys.argv[1], "final root mismatch")
    root = load(root_path)
    current = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
               if path.is_file() and path != root_path}
    ensure(current == root["finalReadinessFileHashes"], "exact final file census mismatch")
    count = len(current) + 1
    for relative, expected in root["preservation"]["rootHashes"].items():
        ensure(sha(ROOT / relative) == expected, "historic root byte change")
        count += 1
    live = HERE.parent / "g3-live-readiness"
    for relative, expected in root["preservation"]["liveFileHashes"].items():
        ensure(sha(live / relative) == expected, "historic live-readiness file change")
        count += 1
    ensure(sha(live / "LIVE_READINESS_INDEPENDENT_VERIFICATION.json") ==
           root["preservation"]["liveIndependentSha256"], "historic independent record change")
    old = HERE.parent / "g3-readiness"
    for relative, expected in load(old / "READINESS_FINAL_VERIFICATION.json")["readinessFileHashes"].items():
        ensure(sha(old / relative) == expected, "historic readiness file change")
        count += 1
    g2 = load(HERE.parent / "evidence" / "G2_TERMINAL_FINAL_VERIFICATION.json")
    for key, base in (
        ("evidenceHashes", HERE.parent / "evidence"), ("completePriorEvidenceHashes", HERE.parent / "evidence"),
        ("stageRootHashes", HERE.parent / "evidence"),
        ("sourceHashes", ROOT / "infrastructure" / "landing-zone" / "g2-builder"),
    ):
        for relative, expected in g2[key].items():
            ensure(sha(base / relative) == expected.lower(), "historic G2 evidence change")
            count += 1
    ensure(sha(Path(root["authorityPath"])) == root["authoritySha256"], "active authority byte change")
    disposition = load(HERE / "FINAL_READINESS_DISPOSITION.json")
    ensure(disposition["G3_EXECUTION_READINESS"] == "BLOCKED" and len(disposition["remainingBlockers"]) == 3,
           "readiness claim mismatch")
    for key in ("G3A_CONTROLLER", "G3B_CONTROLLER", "G3A_BICEP_PACKAGE", "G3B_BICEP_PACKAGE"):
        ensure(disposition[key] == "INCOMPLETE", "unsupported package-completeness claim")
    for key in ("G3_TECHNICAL_EXECUTION_AUTHORIZED", "APPLICATION_ROLLOUT_AUTHORIZED", "PRODUCTION_DATA_AUTHORIZED"):
        ensure(disposition[key] == "NO", "unauthorized execution claim")
    ensure(disposition["UE_INFRA"] == disposition["CORA_INFRA"] == "INFRA_NO_GO", "product disposition")
    ensure(disposition["AZURE_MUTATIONS"] == disposition["REGISTRY_MUTATIONS"] == 0, "mutation claim")

    folder = HERE / "local-image-frozen"
    image = load(folder / "LOCAL_IMAGE_QUALIFICATION.json")
    ensure(sha(folder / "source.tar") == image["sourceAuthoritySha256"], "source authority hash")
    with tarfile.open(folder / "source.tar") as archive:
        names = [item.name for item in archive if item.isfile()]
        ensure(set(names) == set(image["sourceFileHashes"]) and len(names) == 5, "source archive census")
        for name in names:
            ensure(archive.extractfile(name).read() == (HERE / "runtime" / name).read_bytes(), "source archive/current mismatch")
    manifests = []
    for number in (1, 2):
        with tarfile.open(folder / ("image-run" + str(number) + ".tar")) as archive:
            members = [item for item in archive if item.isfile()]
            ensure(len({item.name for item in members}) == len(members), "duplicate archive member")
            files = {item.name: archive.extractfile(item).read() for item in members}
        index = json.loads(files["index.json"])
        ensure(len(index["manifests"]) == 1, "image index census")
        reference = index["manifests"][0]
        ensure(reference["platform"] == {"architecture": "amd64", "os": "linux"}, "platform mismatch")
        manifest_data = files["blobs/sha256/" + reference["digest"].split(":")[1]]
        ensure("sha256:" + hashlib.sha256(manifest_data).hexdigest() == reference["digest"], "raw manifest digest")
        ensure(reference["digest"] == disposition["G3_IMAGE_MANIFEST_DIGEST"], "disposition digest")
        manifest = json.loads(manifest_data)
        payload = None
        total_bytes = len(manifest_data)
        for descriptor in [manifest["config"], *manifest["layers"]]:
            raw = files["blobs/sha256/" + descriptor["digest"].split(":")[1]]
            ensure("sha256:" + hashlib.sha256(raw).hexdigest() == descriptor["digest"] and
                   len(raw) == descriptor["size"], "raw content digest/length")
            total_bytes += len(raw)
            if descriptor == manifest["config"]:
                config = json.loads(raw)
                ensure(config["config"]["User"] == "65532:65532", "nonroot config")
                continue
            uncompressed = gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw
            with tarfile.open(fileobj=io.BytesIO(uncompressed)) as layer:
                for member in layer:
                    if member.isfile() and member.name.lstrip("./") == "g3-runtime":
                        payload = layer.extractfile(member).read()
        ensure(payload is not None and payload == (folder / "g3-runtime").read_bytes(), "executed ELF/OCI mismatch")
        ensure(payload[:5] == b"\x7fELF\x02" and payload[18:20] == b"\x3e\x00", "ELF platform")
        ensure(total_bytes == image["observations"][number-1]["imageBlobBytes"], "cost blob size")
        manifests.append(reference["digest"])
    ensure(manifests[0] == manifests[1], "independent manifest disagreement")
    events = [json.loads(line) for line in (HERE / "AZURE_READ_ONLY_LEDGER.jsonl").read_text().splitlines()]
    ensure(len(events) == 8, "read-only invocation count")
    for start, end in zip(events[::2], events[1::2]):
        ensure(start["name"] == end["name"] and start["mutations"] == end["mutations"] == 0, "ledger correlation")
        command = start["command"]
        ensure(command[1:4] == ["rest", "--method", "GET"] or command[1:3] == ["resource", "list"], "non-read command")
        ensure(end["exitCode"] == load(HERE / end["responseFile"])["exitCode"] == 0, "failed read")
    ensure(len(load(HERE / "PROTECTED_G2_RESOURCES.json")["response"]) == 16, "protected resource census")
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", (HERE / "FINAL_READINESS_CLOSURE.md").read_text()):
        path = (HERE / target).resolve()
        ensure(path.exists() or path == HERE / "FINAL_READINESS_INDEPENDENT_VERIFICATION.json", "broken report link")
    result = {
        "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "PASS", "scope": "SEPARATE_DIRECT_BYTE_VERIFICATION_NOT_AZURE_EXECUTION",
        "finalRootSha256": sys.argv[1], "hashReferencesVerified": count,
        "rawOCIArchivesVerified": 2, "executedELFMatchesBothArchives": True,
        "azureReadCalls": 4, "azureMutations": 0, "registryMutations": 0,
        "G3_EXECUTION_READINESS": "BLOCKED", "sealerImportedOrExecuted": False,
    }
    with (HERE / "FINAL_READINESS_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8", newline="\n") as file:
        json.dump(result, file, indent=2)
        file.write("\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
