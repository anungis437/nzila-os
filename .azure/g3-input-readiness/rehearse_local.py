"""Staged-payload deterministic component rehearsal, not a portable guest proof."""

import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tarfile

from private_reader import Binding, parse_manifest, safe_extract_source, stream_verified
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
FROZEN = HERE.parent / "g3-final-readiness" / "local-image-frozen"


def command(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=180)
    if result.returncode:
        raise RuntimeError("REHEARSAL_COMMAND_FAILURE: " + result.stderr)
    return result.stdout


def main():
    if len(sys.argv) != 2 or not sys.argv[1].startswith("offline-component-rehearsal"):
        raise RuntimeError("SUPPLY_NEW_EXCLUSIVE_REHEARSAL_DIRECTORY")
    root = HERE / sys.argv[1]
    if root.parent != HERE:
        raise RuntimeError("REHEARSAL_DIRECTORY_OUT_OF_SCOPE")
    root.mkdir()
    record = json.loads((FROZEN / "LOCAL_IMAGE_QUALIFICATION.json").read_text())
    contracts = json.loads((HERE / "OCI_INPUT_CONTRACT.json").read_text())["contracts"]
    verified = []
    for name, entry in contracts.items():
        binding = Binding(
            "nzilag3inputs001.azurecr.io", "nzilag3inputs001.canadacentral.data.azurecr.io",
            "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", entry["repository"], entry["manifestDigest"],
            entry["sha256"], entry["bytes"],
        )
        parse_manifest(Path(entry["manifestPath"]).read_bytes(), "application/vnd.oci.image.manifest.v1+json",
                       entry["manifestDigest"], binding)
        destination = root / (name + ".tar")
        with Path(entry["payloadPath"]).open("rb") as payload:
            class FileResponse:
                status = 200

                def read(self, size):
                    return payload.read(size)

                def getheader(self, name):
                    return str(entry["bytes"]) if name == "Content-Length" else None
            verified.append(stream_verified(FileResponse(), destination, binding))
    source_members = {}
    with tarfile.open(FROZEN / "source.tar") as archive:
        for member in archive:
            source_members[member.name] = {"bytes": member.size,
                                           "sha256": record["sourceFileHashes"][member.name].removeprefix("sha256:")}
    source = root / "source"
    extracted = safe_extract_source(root / "source.tar", source, source_members)
    compiler_load = command(["docker", "load", "--input", str(root / "compiler.tar")])
    with (root / "COMPILER_LOAD_OUTPUT.txt").open("x", encoding="utf-8") as file:
        file.write(compiler_load)
    inspected = json.loads(command(["docker", "image", "inspect", record["BASE_IMAGE_REFERENCE"]]))[0]
    if record["BASE_IMAGE_REFERENCE"] not in inspected["RepoDigests"]:
        raise RuntimeError("REHEARSAL_COMPILER_INSPECT_REFERENCE")
    spec = importlib.util.spec_from_file_location("frozen_algorithm", HERE.parent / "g3-readiness" / "qualify_local.py")
    qualifier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(qualifier)
    qualifier.ROOT, qualifier.SOURCE = root, source
    old_args = sys.argv
    try:
        sys.argv = ["qualify", "two-builds"]
        qualifier.main()
    finally:
        sys.argv = old_args
    rebuilt = json.loads((root / "two-builds" / "LOCAL_IMAGE_QUALIFICATION.json").read_text())
    match = rebuilt["observations"][0]["manifestDigest"] == record["observations"][0]["manifestDigest"]
    result = {
        "status": "PASS_COMPONENT_REHEARSAL" if match else "FAIL_FROZEN_MANIFEST_MISMATCH_STOP",
        "frozenManifestDigest": record["observations"][0]["manifestDigest"],
        "rehearsedManifestDigest": rebuilt["observations"][0]["manifestDigest"],
        "sourceAuthorityMatches": rebuilt["sourceAuthoritySha256"] == record["sourceAuthoritySha256"],
        "payloadsSHAAndSizeVerified": verified, "safeSourceExtraction": extracted,
        "offlineNoCacheBuilds": 2, "compilerLoadedFromStagedPayload": True,
        "hostDependencies": ["PREEXISTING_LOCAL_DOCKER_29.2.0", "PREEXISTING_LOCAL_BUILDX_v0.31.1-desktop.1",
                             "PREEXISTING_LOCAL_BUILDKIT_v0.27.0", "LOCAL_PYTHON"],
        "portableToolingEstablishedByPayloads": False,
        "G3A_OFFLINE_BUILD_REHEARSAL": "FAIL",
        "fullRehearsalFailureReason": "REQUIRES_UNSTAGED_HOST_ENGINE_AND_EXPORTER_NOT_PINNED_VM_BASE",
        "scope": "EXACT_DIGEST_COMPONENT_BUILD_NOT_COMPLETE_PRIVATE_VM_BOOTSTRAP",
        "guestExecution": False, "azureCalls": 0, "registryMutations": 0,
        "cleanup": "EXCLUSIVE_LOCAL_EVIDENCE_RETAINED_NO_GUEST_RESOURCES_CREATED",
    }
    with (HERE / "OFFLINE_REHEARSAL_RESULT.json").open("x", encoding="utf-8") as file:
        json.dump(result, file, indent=2)
        file.write("\n")
    if not match or not result["sourceAuthorityMatches"]:
        raise RuntimeError("FROZEN_IMAGE_MISMATCH_STOP")
    print("FROZEN_MANIFEST_COMPONENT_REPRODUCTION = PASS; COMPLETE_GUEST_REHEARSAL = FAIL_UNSTAGED_TOOLING")


if __name__ == "__main__":
    main()
