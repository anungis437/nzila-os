"""Prepare two offline static probes without image builds or tool installation."""

from decimal import Decimal
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
from urllib.request import Request, urlopen

from preflight import AUTHORITY, HERE, ROOT, baseline, ensure, fresh, read, sha

GO = Path(r"C:\Program Files\Go\bin\go.exe")
COMMIT = "4636e539a6a7137e9419100acc01887b98c4f269"


def elf(path):
    raw = path.read_bytes()
    ensure(raw[:6] == b"\x7fELF\x02\x01", "PROBE_NOT_64BIT_LITTLE_ENDIAN_ELF")
    ensure(struct.unpack_from("<H", raw, 18)[0] == 62, "PROBE_NOT_AMD64")
    offset = struct.unpack_from("<Q", raw, 32)[0]
    stride, count = struct.unpack_from("<HH", raw, 54)
    types = [struct.unpack_from("<I", raw, offset + index * stride)[0] for index in range(count)]
    ensure(3 not in types and 2 not in types, "PROBE_HAS_INTERPRETER_OR_DYNAMIC_SEGMENT")
    return {"ELF": "ELF64_LE_AMD64", "interpreter": "ABSENT", "dynamicSegment": "ABSENT",
            "runtimeDependencies": ["LINUX_KERNEL_PROC_SELF_EXE"],
            "sha256": sha(path), "bytes": len(raw)}


def main():
    fresh("CONCURRENCY_PROBE_FORMATTED.json" if sys.argv[1:] == ["--formatted"] else
          "CONCURRENCY_PROBE_PREPARE.json", baseline())
    prior = ROOT / ".azure" / "g3a-compressor" / "LOCAL_TOOLCHAIN_AVAILABILITY.json"
    inventory = json.loads(prior.read_text())
    ensure(any(item["name"] == "WINDOWS_GO_VERSION" and
               item["stdout"].strip() == "go version go1.27.0 windows/amd64"
               for item in inventory["observations"]), "NATIVE_COMPILER_NOT_IN_PRIOR_GOVERNED_INVENTORY")
    version = subprocess.run([str(GO), "version"], capture_output=True, text=True, check=True)
    ensure(version.stdout.strip() == "go version go1.27.0 windows/amd64", "EXISTING_TOOLCHAIN_CHANGED")
    source = HERE / "probe" / "main.go"
    fmt = subprocess.run([str(GO.parent / "gofmt.exe"), "-l", str(source)],
                         capture_output=True, text=True, check=True)
    ensure(not fmt.stdout.strip(), "PROBE_SOURCE_NOT_FORMATTED")
    toolchain = GO.parent.parent
    files = [path for base in ("bin", "pkg", "src") for path in (toolchain / base).rglob("*") if path.is_file()]
    tool_hashes = {str(path.relative_to(toolchain)): sha(path) for path in files}
    ensure(sha(GO) == "7d828191ba32519a9c9361789ab647486236ed45c660889196c7770a8ff1985c",
           "NATIVE_COMPILER_PREFLIGHT_HASH_CHANGED")
    fresh("PROBE_TOOLCHAIN_BINDING.json", {
        "version": version.stdout.strip(), "priorInventoryPath": str(prior), "priorInventorySha256": sha(prior),
        "toolchainPath": str(toolchain), "fileHashes": tool_hashes,
        "scope": "EXISTING_INVENTORIED_NATIVE_COMPILER_FOR_MINIMAL_PROBES_ONLY",
        "portableApplicationToolchainUnchanged": True, "installedOrDownloaded": False})
    env = dict(os.environ, GOOS="linux", GOARCH="amd64", CGO_ENABLED="0", GOTOOLCHAIN="local",
               GO111MODULE="off", GOPROXY="off", GOSUMDB="off", GOWORK="off",
               GOCACHE=str(HERE / "local-cache"), GOPATH=str(HERE / "local-gopath"), GOROOT=str(toolchain))
    builds = {}
    for name, marker in (("V1", "G3A_BOOTSTRAP_REQUESTED_V1"), ("V2", "G3A_BOOTSTRAP_CURRENT_V2")):
        output = HERE / ("g3a-bootstrap-proof-" + name)
        ensure(not output.exists(), "PROBE_OUTPUT_ALREADY_EXISTS")
        args = [str(GO), "build", "-trimpath", "-buildvcs=false",
                "-ldflags=-s -w -buildid= -X main.marker=" + marker, "-o", str(output), str(source)]
        result = subprocess.run(args, capture_output=True, text=True, env=env, timeout=300)
        ensure(result.returncode == 0, "PROBE_BUILD_FAILED_" + name + "_" + result.stderr)
        builds[name] = dict(elf(output), marker=marker, path=str(output), sourceSha256=sha(source),
                            buildCommand=args, stdout=result.stdout, stderr=result.stderr)
    ensure(builds["V1"]["sha256"] != builds["V2"]["sha256"] and
           sum(item["bytes"] for item in builds.values()) <= 10485760, "PROBE_DISCRIMINATOR_SIZE_GATE")
    fresh("PROBE_BINARIES.json", {"status": "PASS_STATIC_ELF_DISTINCT_PROBES", "binaries": builds,
          "imageBuilds": 0, "guestExecutions": 0, "DockerUsed": False})
    public = HERE / "public"
    public.mkdir(exist_ok=False)
    captured = []
    for path in ("main/files.go", "main/exec.go", "pkg/download/save.go", "pkg/download/blobwithmsitoken.go"):
        url = f"https://raw.githubusercontent.com/Azure/custom-script-extension-linux/{COMMIT}/{path}"
        with urlopen(Request(url, headers={"User-Agent": "Nzila-bootstrap-proof-preparation"}), timeout=120) as response:
            raw = response.read()
        target = public / path.replace("/", "_")
        with target.open("xb") as file:
            file.write(raw)
        captured.append({"url": url, "path": str(target), "sha256": sha(target)})
    source_msi = (public / "pkg_download_blobwithmsitoken.go").read_text()
    ensure('xMsVersionValue      = "2018-03-28"' in source_msi, "PUBLISHED_CANDIDATE_API_NOT_CONSISTENT")
    ensure("const mode = 0500" in (public / "main_files.go").read_text() and
           'exec.Command("/bin/sh", "-c", cmd)' in (public / "main_exec.go").read_text(),
           "PUBLISHED_CANDIDATE_EXECUTION_NOT_CONSISTENT")
    fresh("PUBLISHED_HANDLER_BINDING.json", {
        "version": "2.1.10", "sourceTag": "v2.1.10", "sourceCommit": COMMIT, "sources": captured,
        "CanadaCentralPublicationEvidence": "CSE_VERSIONS.json",
        "installedHandlerVersionMustMatch": True, "autoUpgradeMinorVersion": False,
        "enableAutomaticUpgrade": False, "sourceConsistency": "PASS",
        "initial2_1_17Candidate": "NOT_PUBLISHED_NO_EXECUTION_OR_MUTATION_OCCURRED",
        "exactAzurePackageByteIdentityToSource": "NOT_CLAIMED_LIVE_PACKAGE_AND_VERSION_ARE_RECORDED"})
    old_cost = HERE.parent / "g3a-firstbyte" / "BOOTSTRAP_PROOF_COST_MODEL.json"
    cost = json.loads(old_cost.read_text())
    for binding in cost["rates"].values():
        ensure(sha(Path(binding["source"])) == binding["sourceSha256"], "CURRENT_CAPTURED_METER_BYTES_CHANGED")
    total = sum(Decimal(value) for value in cost["amountsCAD"].values())
    ensure(total == Decimal("1.5363953") and total * Decimal("1.5") <= Decimal("3"), "CAD3_COST_GATE")
    fresh("CURRENT_COST_GATE.json", {
        "status": "PASS", "capturedMeterModel": str(old_cost), "modelSha256": sha(old_cost),
        "currency": "CAD", "conservativeExpectedCAD": str(total), "hardCeilingCAD": "3.00",
        "minimumContingency": "50_PERCENT_MET_WITHIN_HARD_CEILING",
        "actualProbeTotalBytes": sum(item["bytes"] for item in builds.values()),
        "maxVMHours": 2, "maxPEHours": 4, "maxProofHours": 4, "storageVersionsGBMaximum": "0.1",
        "dedicatedVNetNSGSubnets": "NO_SELECTED_STANDALONE_HOURLY_METER",
        "newAzureResourcesBeforeThisGate": 0,
        "meterCaptureFreshness": "SAME_DAY_PRIOR_PACKET_PUBLIC_SNAPSHOTS",
        "actualCostNotClaimed": True})
    network = read("NETWORK_USAGE.json", ["rest", "--method", "get", "--url",
                   "https://management.azure.com/subscriptions/5d819f33-d16f-429c-a3c0-5b0e94740ba3/"
                   "providers/Microsoft.Network/locations/canadacentral/usages?api-version=2024-05-01"])
    for name, delta in (("VirtualNetworks", 1), ("NetworkInterfaces", 2), ("NetworkSecurityGroups", 1),
                        ("PrivateEndpoints", 1)):
        matches = [item for item in network["value"] if item["name"]["value"].lower() == name.lower()]
        if matches:
            ensure(matches[0]["currentValue"] + delta <= matches[0]["limit"], "NETWORK_QUOTA_" + name)
    fresh("READ_PREFLIGHT_RESOLVED.json", {
        "status": "PASS_PENDING_IAC_POLICY_AND_KEY_VALIDATION",
        "authoritySha256": sha(AUTHORITY), "sourceHandler": "2.1.10",
        "CLIAndNumericPreflightErrors": "PRESERVED_CORRECTED_BEFORE_MUTATION",
        "scope": "NO_CLOUD_MUTATION_YET"})
    print("STATIC_V1_V2_PREPARED_COST_WITHIN_CAD3_HANDLER_2_1_10_BOUND", flush=True)


if __name__ == "__main__":
    main()
