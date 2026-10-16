"""Offline qualification and preservation checks; never calls Azure resources."""

import datetime
import gzip
import hashlib
import io
import ipaddress
import json
import re
import subprocess
import sys
import tarfile
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
EVIDENCE = ROOT / ".azure" / "evidence"
DESIGN = ROOT / ".azure" / "g3-design"
G2_SOURCE = ROOT / "infrastructure" / "landing-zone" / "g2-builder"
G2_HASH = "ed29f65fc52a89a707d76bf553a24f579e1542ddf439245edcf0cde3ccc0f499"
DESIGN_HASH = "97ca2e560611a93c0f676fd421fa5c79292c2366a5e9b4beec14cad18c66c572"
HEAD = "7bec20aad11d43eeae8099c14e021b3074154b27"
AUTHORITY = Path(
    r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData"
    r"\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments"
    r"\5594d01e-aa22-4276-b051-112a48a3d2b4\Pasted text #1.txt"
)
OUTPUTS = {
    "SOURCE_AND_CONCURRENCY.json",
    "LOCAL_CONTRACT_VERIFICATION.json",
    "READINESS_FINAL_VERIFICATION.json",
}


def require(condition, detail):
    if not condition:
        raise RuntimeError(detail)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def sha(path):
    return digest(path.read_bytes())


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def command(args):
    result = subprocess.run(args, capture_output=True, text=True, check=False)
    require(result.returncode == 0, f"{args}: {result.stdout}\n{result.stderr}")
    return result


def snapshot(root):
    return {
        "path": str(root),
        "head": command(["git", "-C", str(root), "rev-parse", "HEAD"]).stdout.strip(),
        "branch": command(["git", "-C", str(root), "branch", "--show-current"]).stdout.strip(),
        "status": command(["git", "-C", str(root), "status", "--short"]).stdout.splitlines(),
    }


def verify_hashes(base, values):
    for name, expected in values.items():
        require(sha(base / name) == expected.removeprefix("sha256:").lower(), str(base / name))
    return len(values)


def preservation():
    terminal_path = EVIDENCE / "G2_TERMINAL_FINAL_VERIFICATION.json"
    require(sha(terminal_path) == G2_HASH, "G2 terminal root changed")
    terminal = read(terminal_path)
    count = sum(
        verify_hashes(EVIDENCE, terminal[key])
        for key in ("evidenceHashes", "completePriorEvidenceHashes", "stageRootHashes")
    )
    count += verify_hashes(G2_SOURCE, terminal["sourceHashes"])
    for key, name in (
        ("currentPlanSha256", "deployment-plan.md"),
        ("missionStatusSha256", "mission-gate-status.json"),
        ("validationWorkflowSha256", "validate-status.json"),
    ):
        require(sha(ROOT / ".azure" / name) == terminal[key], name)
        count += 1
    plan = (ROOT / ".azure" / "deployment-plan.md").read_bytes()
    header = plan[:plan.index(b"\r\n\r\n") + 4]
    suffixes = {
        digest(header + plan[match.start():])
        for match in re.finditer(br"(?m)^## Current slice: ([^\r\n]+)", plan)
    }
    for name in terminal["stageRootHashes"]:
        stage = read(EVIDENCE / name)
        for key in ("currentPlanSha256", "deploymentPlanSha256"):
            if key in stage:
                require(stage[key].lower() in suffixes, f"historical plan suffix: {name}")
        source_base = G2_SOURCE if name.startswith("G2_STAGE2B") else G2_SOURCE / "stage2a"
        for key in ("evidenceHashes", "priorEvidenceHashes", "sourceHashes", "priorSourceHashes"):
            base = EVIDENCE if key in ("evidenceHashes", "priorEvidenceHashes") else source_base
            count += verify_hashes(base, stage.get(key, {}))
    design_path = DESIGN / "DESIGN_VERIFICATION.json"
    require(sha(design_path) == DESIGN_HASH, "G3 historical design root changed")
    count += verify_hashes(DESIGN, read(design_path)["designFileHashes"])
    inventory = read(DESIGN / "SOURCE_INVENTORY.json")
    count += verify_hashes(ROOT, inventory["protectedHistoricalDocumentHashes"])
    count += verify_hashes(ROOT, inventory["worktrees"]["isolated"]["reviewedFileHashes"])
    foreign = inventory["worktrees"]["sharedForeign"]
    foreign_changes = [
        name for name, expected in foreign["reviewedFileHashes"].items()
        if sha(Path(foreign["path"]) / name) != expected
    ]
    return {
        "status": "PASS",
        "hashReferencesVerified": count,
        "g2TerminalRootSha256": G2_HASH,
        "priorG3DesignRootSha256": DESIGN_HASH,
        "historicalPlanSuffixes": "PASS",
        "foreignReviewedFilesChangedSinceDesign": foreign_changes,
        "foreignDisposition": "NONE_READ_ONLY",
    }


def image():
    directory = HERE / "local-image-qualification"
    qualification = read(directory / "LOCAL_IMAGE_QUALIFICATION.json")
    smoke = read(directory / "LOCAL_CONTAINER_SMOKE.json")
    verify_hashes(HERE / "runtime", qualification["sourceFileHashes"])
    require(sha(directory / "source.tar") == qualification["sourceAuthoritySha256"], "source archive")
    with tarfile.open(directory / "source.tar") as archive:
        members = archive.getmembers()
        require({item.name for item in members} == set(qualification["sourceFileHashes"]), "source member census")
        for member in members:
            require(member.isfile(), "source archive non-file")
            require(member.uid == member.gid == 0 and member.mtime == 946684800, "source metadata")
            data = archive.extractfile(member).read()
            require(data == (HERE / "runtime" / member.name).read_bytes(), member.name)
    observations = []
    executable = (directory / "g3-runtime").read_bytes()
    require(executable[:5] == b"\x7fELF\x02" and executable[18:20] == b"\x3e\x00", "ELF machine")
    require(digest(executable) == smoke["localExecutableSha256"], "ELF digest")
    for run in (1, 2):
        path = directory / f"image-run{run}.tar"
        with tarfile.open(path) as archive:
            members = archive.getmembers()
            require(len({item.name for item in members}) == len(members), "duplicate OCI entry")
            files = {
                item.name: archive.extractfile(item).read()
                for item in members if item.isfile()
            }
        require(json.loads(files["oci-layout"])["imageLayoutVersion"] == "1.0.0", "OCI layout")
        blobs = {name: data for name, data in files.items() if name.startswith("blobs/sha256/")}
        for name, data in blobs.items():
            require(name.split("/")[-1] == digest(data), f"OCI blob hash {name}")
        index = json.loads(files["index.json"])
        require(len(index["manifests"]) == 1, "image manifest count")
        descriptor = index["manifests"][0]

        def blob(desc):
            data = blobs["blobs/sha256/" + desc["digest"].removeprefix("sha256:")]
            require(len(data) == desc["size"], "OCI descriptor size")
            return data

        manifest = json.loads(blob(descriptor))
        config_bytes = blob(manifest["config"])
        config = json.loads(config_bytes)
        layers = [blob(item) for item in manifest["layers"]]
        uncompressed = [gzip.decompress(data) for data in layers]
        require(config["os"] == "linux" and config["architecture"] == "amd64", "platform")
        require(config["config"]["User"] == "65532:65532", "non-root image")
        require(config["config"]["Entrypoint"] == ["/g3-runtime"], "entrypoint")
        require(config["created"] == "2000-01-01T00:00:00Z", "OCI creation timestamp")
        diff_ids = ["sha256:" + digest(data) for data in uncompressed]
        require(config["rootfs"]["diff_ids"] == diff_ids, "diff IDs")
        found = []
        for data in uncompressed:
            with tarfile.open(fileobj=io.BytesIO(data)) as layer:
                for member in layer.getmembers():
                    if member.isfile() and member.name.lstrip("./") == "g3-runtime":
                        found.append(layer.extractfile(member).read())
        require(found == [executable], "image executable vs extracted proof")
        actual = {
            "configDigest": manifest["config"]["digest"],
            "manifestDigest": descriptor["digest"],
            "indexDigest": "sha256:" + digest(files["index.json"]),
            "platform": "linux/amd64",
            "imageBlobBytes": sum(len(data) for data in blobs.values()),
            "ociArchiveBytes": path.stat().st_size,
            "layerDigests": [item["digest"] for item in manifest["layers"]],
            "uncompressedLayerDigests": diff_ids,
            "config": config,
        }
        require(actual == qualification["observations"][run - 1], f"raw OCI run{run} mismatch")
        observations.append(actual)
    require(observations[0] == observations[1], "independent build mismatch")
    require(smoke["imageManifestDigest"] == observations[0]["manifestDigest"], "smoke image")
    require(smoke["status"] == "PASS" and smoke["gracefulStopExitCode"] == 0, "local smoke")
    require(smoke["network"] == "none" and smoke["publishedPorts"] == [], "local isolation")
    require(smoke["transactionContainerResiduals"] == [], "transaction container teardown")
    observed = [(x["path"], x["authenticated"], x["observedHttpStatus"]) for x in smoke["observations"]]
    require(observed == [
        ("/health", True, 200), ("/health", False, 401), ("/ready", True, 503),
        ("/probes/live", False, 200), ("/probes/ready", False, 503),
    ], "smoke output shape")
    return {"status": "PASS", "sourceAuthority": qualification["sourceAuthoritySha256"], **observations[0]}


def resources(template):
    for item in template["resources"]:
        yield item
        if item["type"] == "Microsoft.Resources/deployments":
            yield from resources(item["properties"]["template"])


def bicep():
    executable = Path(r"C:\Users\AubertNungisa\.azure\bin\bicep.exe")
    schemas = read(HERE / "API_SCHEMA_REFERENCES.json")["schemaSources"]
    formats = {
        (x["provider"] + "/" + x["type"]).lower() + "@" + x["apiVersion"]: x["resourceSyntax"]
        for x in schemas
    }
    require(len(formats) == 16, "official schema census")
    checks = []
    compiled = {}
    for source in sorted((HERE / "bicep").glob("*.bicep")):
        reference_dir = (
            "bicep-registry-condition-validation" if source.stem == "registry-roles"
            else "bicep-local-validation-final"
        )
        expected = read(HERE / reference_dir / (source.stem + ".json"))
        build = command([str(executable), "build", str(source), "--stdout"])
        require(not build.stderr.strip(), f"build diagnostics: {source.name}")
        current = json.loads(build.stdout.lstrip("\ufeff"))
        require(current == expected, f"source/compiled ARM mismatch: {source.name}")
        lint = command([str(executable), "lint", str(source)])
        require(not lint.stderr.strip() and not lint.stdout.strip(), f"lint diagnostics: {source.name}")
        for item in resources(current):
            if item["type"] != "Microsoft.Resources/deployments":
                key = item["type"].lower() + "@" + item["apiVersion"]
                require(key in formats, f"unbound resource schema: {key}")
                require(all(
                    re.search(r"\b" + re.escape(field) + r"\s*:", formats[key])
                    for field in item.get("properties", {}) if field != "copy"
                ), f"undocumented top-level properties: {key}")
        compiled[source.stem] = current
        checks.append({
            "source": source.name, "sourceSha256": sha(source),
            "compiledReference": reference_dir + "/" + source.stem + ".json",
            "compiledSha256": sha(HERE / reference_dir / (source.stem + ".json")),
            "build": "PASS", "lint": "PASS", "sourceMatchesCompiledEvidence": True,
        })
    require(len(checks) == 7, "seven candidate modules required")
    runtime = compiled["runtime"]
    env = next(x for x in runtime["resources"] if x["type"] == "Microsoft.App/managedEnvironments")
    app = next(x for x in runtime["resources"] if x["type"] == "Microsoft.App/containerApps")
    props = env["properties"]
    require(props["publicNetworkAccess"] == "Disabled" and props["vnetConfiguration"]["internal"], "internal ACA")
    require(props["workloadProfiles"] == [{"name": "Consumption", "workloadProfileType": "Consumption"}], "profile")
    cfg = app["properties"]["configuration"]
    require(cfg["identitySettings"] == [
        {"identity": "[parameters('pullIdentityId')]", "lifecycle": "None"},
        {"identity": "[parameters('runtimeIdentityId')]", "lifecycle": "Main"},
    ], "identity lifecycles")
    require(len(app["identity"]["userAssignedIdentities"]) == 2, "attached identity census")
    require(cfg["registries"][0]["identity"] == "[parameters('pullIdentityId')]", "pull binding")
    require(cfg["ingress"]["external"] and not cfg["ingress"]["allowInsecure"], "private HTTPS ingress semantics")
    require(app["properties"]["template"]["scale"] == {"minReplicas": 1, "maxReplicas": 1}, "replica bounds")
    container = app["properties"]["template"]["containers"][0]
    require(container["resources"] == {"cpu": "[json('0.25')]", "memory": "0.5Gi"}, "compute bound")
    require("g3-synthetic-runtime@sha256:" in container["image"] and ":latest" not in container["image"], "image digest contract")
    require({x["name"] for x in container["env"]} == {
        "G3_ENVIRONMENT", "G3_SOURCE_AUTHORITY", "G3_SECRET_URI",
        "G3_PROOF_MODE", "G3_PROBE_PUBLIC_KEY", "AZURE_CLIENT_ID",
    }, "config census")
    all_types = {x["type"] for x in resources(compiled["foundation"])}
    require(not any(x in all_types for x in {
        "Microsoft.Network/natGateways", "Microsoft.Network/azureFirewalls",
        "Microsoft.Network/routeTables", "Microsoft.Network/publicIPAddresses",
    }), "unselected network resource")
    foundation = compiled["foundation"]
    variables = foundation["variables"]
    cidrs = [ipaddress.ip_network(x) for x in variables["prefixes"]]
    vnet = ipaddress.ip_network("10.91.0.0/16")
    require(all(x.subnet_of(vnet) for x in cidrs), "subnet containment")
    require(all(not a.overlaps(b) for i, a in enumerate(cidrs) for b in cidrs[i + 1:]), "local overlap")
    require(cidrs[0].prefixlen == 27, "minimum ACA subnet")
    require(variables["denyOutbound"]["properties"]["access"] == "Deny", "outbound deny")
    require(variables["denyOutbound"]["properties"]["priority"] == 4096, "deny priority")
    require(variables["platformTags"] == [
        "MicrosoftContainerRegistry", "AzureFrontDoor.FirstParty", "AzureActiveDirectory",
        "AzureMonitor", "Storage.CanadaCentral",
    ], "bounded platform tags")
    network = next(x for x in foundation["resources"] if x["type"] == "Microsoft.Network/virtualNetworks")
    require("NetworkSecurityGroupEnabled" in json.dumps(network), "PE NSG policy")
    vault = next(x for x in foundation["resources"] if x["type"] == "Microsoft.KeyVault/vaults")
    vp = vault["properties"]
    require(vp["enableRbacAuthorization"] and vp["enablePurgeProtection"], "vault controls")
    require(vp["publicNetworkAccess"] == "Disabled" and vp["networkAcls"]["bypass"] == "None", "vault network")
    roles = compiled["registry-roles"]
    role = roles["resources"][0]["properties"]
    require(role["conditionVersion"] == "2.0" and "@Request[" in role["condition"], "ACR ABAC")
    require("@Resource[" not in role["condition"] and "StringEqualsIgnoreCase" in role["condition"], "exact repo condition")
    require(roles["variables"]["actions"].startswith("[if(equals(parameters('slice'), 'G3A'),"), "slice-scoped role")
    secret = compiled["secret-role"]["resources"][0]
    require("substrate-proof" in secret["scope"], "named secret scope")
    require(compiled["secret-role"]["variables"]["roleId"] == "4633458b-17de-408a-b874-0445c86b69e6", "secret reader")
    app_schema = formats["microsoft.app/containerapps@2025-07-01"]
    require("identitySettings:" in app_schema and "lifecycle:" in app_schema, "lifecycle API schema")
    return {"status": "PASS", "modules": checks, "staticContractChecks": "PASS", "azureProviderValidation": "NOT_EXECUTED"}


def docs_and_disposition():
    disposition = read(HERE / "READINESS_DISPOSITION.json")
    for key, expected in {
        "G3_EXECUTION_READINESS": "BLOCKED",
        "G3_PRIVATE_APPLICATION_SUBSTRATE": "NOT_EXECUTED",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "APPLICATION_ROLLOUT_AUTHORIZED": "NO",
        "PRODUCTION_DATA_AUTHORIZED": "NO",
        "AZURE_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0, "AZURE_RESOURCE_CALLS": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES",
        "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "G3_PROOF_COST_CEILING_CAD": "UNRESOLVED",
        "G3_CANDIDATE_IDLE_MONTHLY_COST_CAD": "UNRESOLVED",
    }.items():
        require(disposition[key] == expected, f"incorrect ruling field {key}")
    qualification = read(HERE / "local-image-qualification" / "LOCAL_IMAGE_QUALIFICATION.json")
    for key in ("G3_IMAGE_REPOSITORY", "G3_IMAGE_TAG"):
        require(disposition[key] == qualification[key], key)
    require(disposition["G3_IMAGE_MANIFEST_DIGEST"] == qualification["observations"][0]["manifestDigest"], "ruling digest")
    require(len(disposition["blockers"]) == 6, "blocker census")
    links = []
    for file in sorted(HERE.glob("*.md")):
        text = file.read_text()
        for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", text):
            if target.startswith(("https:", "http:", "#")):
                continue
            path = (file.parent / target.split("#")[0]).resolve()
            require(path.exists(), f"broken local link: {file.name} -> {target}")
            links.append({"from": file.name, "target": target})
    checked = []
    for file in sorted(HERE.rglob("*")):
        if file.is_file() and (
            file.suffix in {".py", ".md", ".bicep", ".json", ".go", ".mod"}
            or file.name in {"Dockerfile", ".dockerignore"}
        ):
            result = subprocess.run([
                "git", "-c", "core.safecrlf=false", "diff", "--no-index", "--check", "--", "NUL", str(file),
            ], capture_output=True, text=True, check=False)
            require(result.returncode in (0, 1) and not result.stdout.strip() and not result.stderr.strip(),
                    f"whitespace: {file}: {result.stdout}\n{result.stderr}")
            checked.append(str(file.relative_to(HERE)))
    return {"status": "PASS", "links": links, "whitespaceCheckedFiles": checked}


def write_new(name, value):
    with (HERE / name).open("x", encoding="utf-8", newline="\n") as output:
        json.dump(value, output, indent=2)
        output.write("\n")


def main():
    seal = sys.argv[1:] == ["--seal"]
    require(not sys.argv[1:] or seal, "usage: verify_readiness.py [--seal]")
    if seal:
        require(not any((HERE / name).exists() for name in OUTPUTS), "seal files already exist; do not overwrite")
    before = snapshot(ROOT)
    require(before["head"] == HEAD, "isolated HEAD drift")
    require(before["status"] == ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"], "isolated status drift")
    shared = snapshot(Path(r"C:\APPS\nzila-os"))
    protected = preservation()
    local_image = image()
    local_bicep = bicep()
    local_docs = docs_and_disposition()
    after = snapshot(ROOT)
    require(before == after, "concurrency changed during checks")
    captured = datetime.datetime.now(datetime.timezone.utc).isoformat()
    source = {
        "capturedAtUtc": captured,
        "mission": "NZ-20261008-INFRA-001",
        "authority": {"path": str(AUTHORITY), "sha256": sha(AUTHORITY)},
        "worktrees": {"isolated": after, "sharedReadOnly": shared},
        "preservation": protected,
        "writesConfinedTo": str(HERE),
        "foreignWorkDisposition": "NONE",
        "azureResourceCalls": 0,
    }
    contract = {
        "capturedAtUtc": captured, "scope": "OFFLINE_LOCAL_QUALIFICATION_NOT_AZURE_RUNTIME",
        "status": "PASS", "preservation": protected, "rawImageVerification": local_image,
        "localBicepRebuildAndContract": local_bicep, "documentationChecks": local_docs,
        "readinessRuling": "BLOCKED",
    }
    if seal:
        write_new("SOURCE_AND_CONCURRENCY.json", source)
        write_new("LOCAL_CONTRACT_VERIFICATION.json", contract)
        hashes = {
            str(path.relative_to(HERE)): sha(path)
            for path in sorted(HERE.rglob("*")) if path.is_file()
        }
        write_new("READINESS_FINAL_VERIFICATION.json", {
            "capturedAtUtc": captured, "mission": "NZ-20261008-INFRA-001",
            "G3_EXECUTION_READINESS": "BLOCKED", "G3_PRIVATE_APPLICATION_SUBSTRATE": "NOT_EXECUTED",
            "scope": "NO_AZURE_EXECUTION_LOCAL_READINESS_CLOSURE_ONLY",
            "g2TerminalRootSha256": G2_HASH, "priorG3DesignRootSha256": DESIGN_HASH,
            "authoritySha256": sha(AUTHORITY), "readinessFileHashes": hashes,
            "AZURE_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0, "AZURE_RESOURCE_CALLS": 0,
            "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
            "APPLICATION_ROLLOUT_AUTHORIZED": "NO", "PRODUCTION_DATA_AUTHORIZED": "NO",
            "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        })
    print(json.dumps({
        "status": "PASS", "ruling": "BLOCKED", "preservedHashReferences": protected["hashReferencesVerified"],
        "rawImageRuns": 2, "bicepModules": len(local_bicep["modules"]),
        "links": len(local_docs["links"]), "sealed": seal,
        "rootSha256": sha(HERE / "READINESS_FINAL_VERIFICATION.json") if seal else None,
    }, indent=2))


if __name__ == "__main__":
    main()
