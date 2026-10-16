"""Independent offline seal check; imports no preparation or capsule module."""

import hashlib
import json
from pathlib import Path
import re
import struct
import sys
import tarfile

HERE = Path(__file__).resolve().parent


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def main():
    require(len(sys.argv) == 2, "EXPECTED_ROOT_SHA_REQUIRED")
    root_path = HERE / "OFFLINE_VERIFICATION.json"
    require(digest(root_path) == sys.argv[1], "OFFLINE_SEAL_CHANGED")
    root = load(root_path)
    actual = {str(path.relative_to(HERE)): digest(path) for path in HERE.rglob("*")
              if path.is_file() and path.name not in {
                  "OFFLINE_VERIFICATION.json", "OFFLINE_INDEPENDENT_VERIFICATION.json"}}
    require(actual == root["fileHashes"], "OFFLINE_EXACT_FILE_CENSUS_CHANGED")
    require(digest(root["authorityPath"]) == root["authoritySha256"], "LOCAL_AUTHORITY_CHANGED")
    prior_path = Path(root["previousProofPath"])
    require(digest(prior_path) == root["previousProofSha256"] ==
            "96dced437ec2cddb1ec000db7e337ba02eb676caac667e106fc0104f8fbeeda8", "PREVIOUS_PROOF_CHANGED")
    prior = load(prior_path)
    count = 1
    for name, expected in prior["fileHashes"].items():
        require(digest(prior_path.parent / name) == expected, "PREVIOUS_PROOF_FILE_CHANGED_" + name)
        count += 1
    for name, expected in prior["closureFileHashes"].items():
        require(digest(Path(prior["closurePath"]) / name) == expected, "PREVIOUS_CLOSURE_FILE_CHANGED_" + name)
        count += 1
    for name, expected in prior["protectedFileHashes"].items():
        require(digest(name) == expected, "QUALIFIED_COMPONENT_CHANGED_" + name)
        count += 1
    require(count == root["previousProtectedReferencesVerified"], "PRESERVATION_REFERENCE_COUNT")
    require(digest(root["previousIndependentVerificationPath"]) == root["previousIndependentVerificationSha256"],
            "PREVIOUS_INDEPENDENT_VERIFICATION_CHANGED")
    candidate = load(HERE / "CANDIDATE_BINDING.json")
    binary = (HERE / "g3a-guest-candidate").read_bytes()
    require(hashlib.sha256(binary).hexdigest() == candidate["binarySha256"] and
            len(binary) == candidate["binaryBytes"] and binary[:6] == b"\x7fELF\x02\x01" and
            struct.unpack_from("<H", binary, 18)[0] == 62, "CANDIDATE_SHA_SIZE_ARCH")
    offset = struct.unpack_from("<Q", binary, 32)[0]
    stride, number = struct.unpack_from("<HH", binary, 54)
    require(stride >= 56 and offset + stride * number <= len(binary), "ELF_SEGMENT_CENSUS")
    segment_types = [struct.unpack_from("<I", binary, offset + index * stride)[0] for index in range(number)]
    require(2 not in segment_types and 3 not in segment_types, "OUTER_LAUNCHER_DYNAMIC")
    for name, expected in candidate["sourceFileHashes"].items():
        require(digest(HERE / name) == expected, "CANDIDATE_SOURCE_CHANGED")
    source = hashlib.sha256(json.dumps(candidate["sourceFileHashes"], sort_keys=True,
                                      separators=(",", ":")).encode()).hexdigest()
    require(source == candidate["sourceSha256"], "CANONICAL_SOURCE_BINDING_CHANGED")
    archive_path = HERE / "payload.tar"
    require(digest(archive_path) == candidate["payloadArchiveSha256"] and
            archive_path.read_bytes() in binary, "EMBEDDED_PAYLOAD_NOT_BOUND")
    runtime = load(HERE / "RUNTIME_CENSUS.json")
    require(digest(HERE / "RUNTIME_CENSUS.json") == candidate["runtimeCensusSha256"] and
            archive_path.stat().st_size == runtime["archiveBytes"], "RUNTIME_CENSUS_CHANGED")
    total = 0
    with tarfile.open(archive_path) as archive:
        members = archive.getmembers()
        require(len(members) == len(runtime["files"]) + 1 and
                {item.name for item in members} == {*runtime["files"], "census.json"}, "ARCHIVE_MEMBER_CENSUS")
        for member in members:
            require(member.isfile() and not member.name.startswith("/") and
                    "\\" not in member.name and all(x not in {"", ".", ".."} for x in member.name.split("/")),
                    "UNSAFE_ARCHIVE_MEMBER")
            if member.name == "census.json":
                embedded = json.loads(archive.extractfile(member).read())
                require(embedded == runtime["files"], "EMBEDDED_CENSUS_CHANGED")
                continue
            expected = runtime["files"][member.name]
            raw = archive.extractfile(member).read()
            require(len(raw) == member.size == expected["bytes"] and member.mode == expected["mode"] and
                    hashlib.sha256(raw).hexdigest() == expected["sha256"], "RUNTIME_MEMBER_CHANGED")
            total += len(raw)
    require(total == runtime["embeddedMemberBytes"], "RUNTIME_BYTE_SUM_MISMATCH")
    selftest = load(HERE / "CANDIDATE_SELFTEST.json")
    response = json.loads(selftest["stdout"])
    require(selftest["exitCode"] == 0 and response["status"] == "PASS_OFFLINE_IMPORT_ONLY" and
            response["networkRequests"] == 0 and response["transactionQualified"] is False and
            response["liveExecution"] == "DISABLED", "FALSE_CANDIDATE_QUALIFICATION")
    command = selftest["command"]
    require(command[command.index("--network") + 1] == "none" and
            command[command.index("--pull") + 1] == "never" and "--read-only" in command and
            command[command.index("--cap-drop") + 1] == "ALL" and "--self-test" in command,
            "OFFLINE_HARNESS_BOUNDARY_CHANGED")
    tests = load(HERE / "LAUNCHER_FIXTURES.json")
    require(tests["exitCode"] == 0 and len(re.findall(r"--- PASS:", tests["stdout"])) == 6,
            "ARCHIVE_FIXTURES_FAILED")
    tests = load(HERE / "FINAL_ISOLATION_GATE_FIXTURES.json")
    require(tests["exitCode"] == 0 and "Ran 8 tests" in tests["stderr"] and "OK" in tests["stderr"],
            "ISOLATION_FIXTURES_FAILED")
    isolation = load(HERE / "ISOLATION_DISPOSITION.json")
    require(isolation["gate"]["status"] == "BLOCKED" and
            isolation["observedEvidence"]["source"] == "SEALED_ARM_VM_MODEL_ONLY", "FALSE_PINNED_GUEST_PROOF")
    disposition = load(HERE / "FINAL_DISPOSITION.json")
    require(disposition["G3A_TRANSACTION_READINESS"] == disposition["G3_EXECUTION_READINESS"] == "BLOCKED" and
            disposition["G3A_GUEST_CAPSULE_SHA256"] == disposition["G3A_TOTAL_PRIVATE_INPUT_BYTES"] == "UNRESOLVED",
            "FALSE_PRODUCTION_COMPLETENESS")
    require(disposition["candidateBinarySha256"] == candidate["binarySha256"] and
            disposition["candidateBinaryBytes"] == len(binary), "CANDIDATE_FINAL_BINDING")
    for name in ("G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED", "G3A_EXECUTION_AUTHORIZED",
                 "G3B_EXECUTION_AUTHORIZED", "G3_TECHNICAL_EXECUTION_AUTHORIZED"):
        require(disposition[name] == "NO", "AUTHORIZATION_RELAXED")
    for name in ("AZURE_MUTATIONS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS", "cloudMetadataReads", "cloudPricingReads"):
        require(disposition[name] == 0, "LOCAL_ONLY_BOUNDARY_RELAXED")
    require(disposition["G2_TERMINAL_ROOT_UNCHANGED"] == "YES" and
            disposition["UE_INFRA"] == disposition["CORA_INFRA"] == "INFRA_NO_GO" and
            disposition["controllerOrTopLevelBicepModified"] is False, "PROTECTED_GATE_CHANGED")
    output = {
        "status": "PASS_SEALED_BLOCKED_OFFLINE_DISPOSITION",
        "rootSha256": sys.argv[1], "protectedPriorReferences": count,
        "localFileReferences": len(actual), "candidateEmbeddedFiles": len(runtime["files"]),
        "candidateEmbeddedMemberBytes": total, "launcherFixturesPassed": 6, "gateFixturesPassed": 8,
        "preparationOrDeploymentModulesImported": False, "cloudCalls": 0,
        "productionQualification": "BLOCKED_NOT_INFERRED_FROM_PACKAGING",
    }
    with (HERE / "OFFLINE_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8") as stream:
        json.dump(output, stream, indent=2)
        stream.write("\n")
    print("OFFLINE_INDEPENDENT_VERIFICATION=PASS_ROOT=" + sys.argv[1])


if __name__ == "__main__":
    main()
