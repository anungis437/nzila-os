"""One-shot LOCAL/OFFLINE packaging. Refuses candidate rebuilds, never calls Azure."""

import copy
import difflib
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tarfile
from datetime import datetime, timezone

from parse_guest_output import CHECKS, inspect_proof, require_guest_pass

LANE = Path(__file__).resolve().parent
ROOT = LANE.parent.parent
FOREIGN = Path(r"C:\APPS\nzila-os")
OLD = LANE.parent / "g3a-capsule-offline"
GO = Path(r"C:\Program Files\Go\bin\go.exe")
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\9b96285d-c12b-4504-b760-08826bdd0064\Pasted text #1.txt")
IMAGE = "sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce"
OLD_SHA = "b41226ceb1488a68f18e013faa4dab7a13a2d8d55a582579b7dc9a601cb738b2"
OLD_SEAL = "ec22b7bbcb7c81f78701be704ef732c8240ed5223111e24cf30ac0ddbf22bb35"
COMPILER_SHA = "7d828191ba32519a9c9361789ab647486236ed45c660889196c7770a8ff1985c"
SOURCES = ["launcher.go", "proof_linux.go", "census.go", "payload.tar"]
observations = []
commands = []


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def file_sha(path):
    return sha(Path(path).read_bytes())


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def observe():
    def git(path, *args):
        return subprocess.check_output(["git", "-C", str(path), *args], text=True).strip()
    result = {
        "utc": datetime.now(timezone.utc).isoformat(),
        "activeHead": git(ROOT, "rev-parse", "HEAD"),
        "activeStatus": git(ROOT, "status", "--short").splitlines(),
        "foreignHead": git(FOREIGN, "rev-parse", "HEAD"),
        "foreignEntryCount": len(git(FOREIGN, "status", "--short").splitlines()),
        "foreignDisposition": "OBSERVE_ONLY",
    }
    assert result["activeHead"] == "7bec20aad11d43eeae8099c14e021b3074154b27"
    assert set(result["activeStatus"]) == {"?? .azure/", "?? infrastructure/landing-zone/g2-builder/"}
    observations.append(result)
    return result


def write(name, value, raw=False):
    observe()
    path = LANE / name
    assert path.parent == LANE
    path.write_bytes(value if raw else json.dumps(value, indent=2, sort_keys=True).encode() + b"\n")


def run(command, env=None, expected=0):
    observe()
    process = subprocess.run(command, cwd=LANE, env=env, capture_output=True, text=True,
                             encoding="utf-8", errors="replace", timeout=180)
    result = {"command": list(map(str, command)), "exitCode": process.returncode,
              "stdout": process.stdout, "stderr": process.stderr}
    commands.append(result)
    if expected is not None:
        assert process.returncode == expected, result
    return result


def elf_contract(path):
    raw = Path(path).read_bytes()
    assert raw[:6] == b"\x7fELF\x02\x01"
    assert struct.unpack_from("<H", raw, 18)[0] == 62
    offset = struct.unpack_from("<Q", raw, 32)[0]
    size, count = struct.unpack_from("<HH", raw, 54)
    types = [struct.unpack_from("<I", raw, offset + i * size)[0] for i in range(count)]
    assert 3 not in types and 2 not in types, "outer dynamic interpreter/dependency found"
    return {"architecture": "linux/amd64", "staticOuter": True, "PT_INTERP": False, "PT_DYNAMIC": False}


def docker(entry, args, positive=False):
    command = ["docker", "run", "--rm", "--pull", "never", "--network", "none",
               "--read-only", "--cap-drop", "ALL"]
    if positive:
        for cap in ("SYS_ADMIN", "SETUID", "SETGID", "SETPCAP", "CHOWN", "DAC_OVERRIDE", "FOWNER", "SYS_CHROOT"):
            command.extend(["--cap-add", cap])
        command.extend(["--security-opt", "seccomp=unconfined"])
    else:
        command.extend(["--security-opt", "no-new-privileges"])
    command.extend(["--env", "PATH=/unavailable", "--env", "HOME=/unavailable",
                    "--mount", f"type=bind,source={LANE},target=/artifacts,readonly",
                    "--mount", f"type=bind,source={LANE / 'buildcache'},target=/artifacts/buildcache",
                    "--workdir", "/artifacts/buildcache", "--entrypoint", entry, IMAGE, *args])
    return run(command, expected=None)


def parser_fixtures():
    binding = {"candidateSha256": "a" * 64, "candidateBytes": 10, "shimSha256": "b" * 64,
               "shimBytes": 20, "embeddedCensusSha256": "e" * 64}
    proof = {"schema": "g3a-isolation-proof/v1", "mode": "--guest-isolation-proof",
             "candidateSha256": "a" * 64, "candidateBytes": 10, "outcome": "PASS",
             "checks": {key: "PASS" for key in CHECKS}, "embeddedFileCount": 141,
             "baselineSha256": "c" * 64, "evidenceSha256": "d" * 64, "embeddedCensusSha256": "e" * 64,
             "runtimeEvidenceSha256": "f" * 64, "runtimeCensusCount": 100,
             "evidenceFile": ".g3a-isolation-proof-123/proof.json"}
    handoff = {"schema": "g3a-handoff/v1", "mode": "--guest-isolation-proof", "outcome": "PASS",
               "capsuleExit": 0, **binding}
    def text(p, h=handoff):
        return "G3A_ISOLATION_PROOF_V1 " + json.dumps(p) + "\nG3A_HANDOFF_V1 " + json.dumps(h)
    require_guest_pass(text(proof), binding, 0)
    negatives = [
        text(proof) + "\n" + text(proof), text(proof).replace('"baseline": "PASS"', '"baseline": "FAIL"'),
        text(proof).replace(".g3a-isolation-proof-123/proof.json", "../etc/shadow"),
        text(proof).replace('"outcome": "PASS"', '"outcome": "FAIL"'),
        text(proof).replace("a" * 64, "0" * 64), "G3A_ISOLATION_PROOF_V1 {",
        text(proof).replace("e" * 64, "0" * 64),
    ]
    partial = copy.deepcopy(proof)
    del partial["checks"]["hostFSNegative"]
    negatives.append(text(partial))
    for bad in negatives:
        try:
            require_guest_pass(bad, binding, 0)
        except (ValueError, json.JSONDecodeError):
            continue
        raise AssertionError("parser accepted incomplete/invalid proof")
    try:
        require_guest_pass(text(proof), binding, 1)
    except ValueError:
        pass
    else:
        raise AssertionError("parser accepted nonzero exit")
    return {"status": "PASS", "positive": 1, "negative": len(negatives) + 1}


def payload_contract():
    assert file_sha(LANE / "payload.tar") == file_sha(OLD / "payload.tar")
    with tarfile.open(LANE / "payload.tar") as archive:
        census_raw = archive.extractfile("census.json").read()
        census = json.loads(census_raw)
        assert len(census) == 141 and len(archive.getmembers()) == 142
        assert {m.name for m in archive.getmembers()} == set(census) | {"census.json"}
        for name, member in census.items():
            metadata = archive.getmember(name)
            data = archive.extractfile(name).read()
            assert metadata.isreg() and metadata.size == member["bytes"]
            assert metadata.mode == member["mode"] and sha(data) == member["sha256"]
    return {"embeddedFileCount": 141, "archiveMembersIncludingCensus": 142,
            "embeddedCensusSha256": sha(census_raw), "payloadTarSha256": file_sha(LANE / "payload.tar"),
            "embeddedCensus": census, "classification": "CAPSULE_EMBEDDED",
            "nativeLoaderAliases": "FOUR_PROOF_ROOT_HARDLINKS_FROM_EMBEDDED_SONAMES"}


def main():
    os.chdir(LANE)
    assert not (LANE / "CANDIDATE_BUILD_ONCE.json").exists(), "STOP: candidate build already attempted"
    assert not (LANE / "g3a-proof-capsule").exists(), "STOP: candidate exists"
    assert file_sha(GO) == COMPILER_SHA
    assert file_sha(OLD / "g3a-guest-candidate") == OLD_SHA
    assert (OLD / "g3a-guest-candidate").stat().st_size == 25800828
    assert file_sha(OLD / "OFFLINE_VERIFICATION.json") == OLD_SEAL
    historical_manifest = {p.name: file_sha(p) for p in OLD.iterdir() if p.is_file()}
    historical_seal = json.loads((OLD / "OFFLINE_VERIFICATION.json").read_text())
    for name, expected in historical_seal["fileHashes"].items():
        assert historical_manifest[name] == expected, "historical sealed member drift"
    old_launcher = (OLD / "launcher.go").read_text()
    new_launcher = (LANE / "launcher.go").read_text()
    dispatch = '\tif len(os.Args) == 2 && os.Args[1] == "--guest-isolation-proof" {\n\t\tos.Exit(guestProof())\n\t}\n\tif len(os.Args) == 2 && os.Args[1] == "--_isolated-proof-child" {\n\t\tos.Exit(isolatedProofChild())\n\t}\n'
    assert new_launcher.replace(dispatch, "", 1) == old_launcher
    diff = "".join(difflib.unified_diff(old_launcher.splitlines(True), new_launcher.splitlines(True),
                                      fromfile="HISTORICAL/launcher.go", tofile="NEW/launcher.go"))
    write("SOURCE_DIFF.patch", diff.encode(), raw=True)
    source_hashes = {name: file_sha(LANE / name) for name in SOURCES}
    source_sha = sha(canonical(source_hashes))
    write("SOURCE_BINDING.json", {
        "definition": "SHA256_OF_CANONICAL_SORTED_FILENAME_TO_SHA256_MAP_UTF8_NO_WHITESPACE",
        "candidateSourceSha256": source_sha, "sourceFileHashes": source_hashes,
        "testSourceSha256": file_sha(LANE / "proof_test.go"),
        "shimSourceSha256": file_sha(LANE / "handoff.go"),
        "delta": "ISOLATION_PROOF_ONLY", "historicalLauncherFunctionsIdentical": True,
        "reviewedNewFiles": ["proof_linux.go", "census.go", "handoff.go"],
        "readerUploaderPortableCoreChanged": False, "productionEntryPoint": "DISABLED",
        "threadSafety": "CLONE_BEFORE_RUNTIME_THREADS_NOT_THREAD_LOCAL_UNSHARE",
    })
    write("EMBEDDED_CENSUS.json", payload_contract())
    fixture_names = ["SOURCE_FIXTURES_DROPPED_CAPS_FINAL.json", "SOURCE_FIXTURE_ISOLATED_ROOT_FINAL.json",
                     "SOURCE_FIXTURE_INHERITED_ROOT_NNP_ZERO.json"]
    for name in fixture_names:
        assert json.loads((LANE / name).read_text(encoding="utf-8-sig"))["exitCode"] == 0
    parser = parser_fixtures()
    write("PARSER_FIXTURES.json", parser)
    env = dict(os.environ, GOOS="linux", GOARCH="amd64", GOAMD64="v1", CGO_ENABLED="0",
               GO111MODULE="off", GOTOOLCHAIN="local", GOPROXY="off", GOSUMDB="off",
               GOCACHE=str(LANE / "buildcache" / "gocache"), GOTMPDIR=str(LANE / "buildcache" / "gotmp"),
               PYTHONDONTWRITEBYTECODE="1")
    assert run([str(GO.with_name("gofmt.exe")), "-l", "launcher.go", "proof_linux.go", "census.go",
                "proof_test.go", "handoff.go"], env)["stdout"] == ""
    run([str(GO), "vet", "launcher.go", "proof_linux.go", "census.go", "proof_test.go"], env)
    run([str(GO), "vet", "handoff.go"], env)
    build = [str(GO), "build", "-trimpath", "-buildvcs=false", "-ldflags=-s -w -buildid=",
             "-o", str(LANE / "g3a-proof-capsule"), "launcher.go", "proof_linux.go", "census.go"]
    write("CANDIDATE_BUILD_ONCE.json", {"command": build, "candidateBuildAttempts": 1,
                                     "preBuildSourceSha256": source_sha, "sourceFixturesPassed": fixture_names})
    run(build, env)
    candidate_sha = file_sha(LANE / "g3a-proof-capsule")
    candidate_size = (LANE / "g3a-proof-capsule").stat().st_size
    capsule_elf = elf_contract(LANE / "g3a-proof-capsule")
    run([str(GO), "version", "-m", str(LANE / "g3a-proof-capsule")], env)
    shim_build = [str(GO), "build", "-trimpath", "-buildvcs=false",
                  f"-ldflags=-s -w -buildid= -X main.expectedSHA={candidate_sha} -X main.expectedBytes={candidate_size}",
                  "-o", str(LANE / "g3a-handoff"), "handoff.go"]
    run(shim_build, env)
    shim_sha, shim_size = file_sha(LANE / "g3a-handoff"), (LANE / "g3a-handoff").stat().st_size
    shim_elf = elf_contract(LANE / "g3a-handoff")
    binding = {"candidateSha256": candidate_sha, "candidateBytes": candidate_size,
               "shimSha256": shim_sha, "shimBytes": shim_size,
               "embeddedCensusSha256": payload_contract()["embeddedCensusSha256"]}
    tests = {}
    selftest = docker("/artifacts/g3a-proof-capsule", ["--self-test", "/artifacts/buildcache/historical-selftest"])
    assert selftest["exitCode"] == 0 and not selftest["stderr"], selftest
    selftest_data = json.loads(selftest["stdout"])
    assert selftest_data["status"] == "PASS_OFFLINE_IMPORT_ONLY"
    assert selftest_data["liveExecution"] == "DISABLED" and selftest_data["networkRequests"] == 0
    assert not selftest_data["transactionQualified"]
    assert not (LANE / "buildcache" / "historical-selftest").exists()
    tests["historicalSelfTestNetworkNoneNoAmbientPATH"] = "PASS"
    for mode in ("--transaction", "--production", "--run"):
        result = docker("/artifacts/g3a-proof-capsule", [mode])
        assert result["exitCode"] == 1 and "PRODUCTION_TRANSACTION_DISABLED" in result["stderr"], result
    tests["productionTransactionDisabled"] = "PASS"
    unsupported = docker("/artifacts/g3a-handoff", ["/artifacts/g3a-proof-capsule"])
    assert unsupported["exitCode"] == 1 and len(unsupported["stdout"].encode()) < 4096, unsupported
    fail_result = inspect_proof(unsupported["stdout"], candidate_sha, candidate_size)
    assert fail_result["outcome"] == "FAIL" and fail_result["failedPrimitive"] == "namespaceClone"
    assert fail_result["checks"]["mountNamespace"] == "UNSUPPORTED" and fail_result["checks"]["baseline"] == "PASS"
    handoff = json.loads(next(line.removeprefix("G3A_HANDOFF_V1 ") for line in unsupported["stdout"].splitlines()
                             if line.startswith("G3A_HANDOFF_V1 ")))
    assert handoff["shimSha256"] == shim_sha and handoff["candidateSha256"] == candidate_sha
    assert handoff["capsuleExit"] == 1 and handoff["outcome"] == "FAIL"
    failed_evidence = (LANE / "buildcache" / fail_result["evidenceFile"]).read_bytes()
    assert sha(failed_evidence) == fail_result["evidenceSha256"]
    failed_baseline = LANE / "buildcache" / Path(fail_result["evidenceFile"]).parent / "baseline.json"
    assert file_sha(failed_baseline) == fail_result["baselineSha256"]
    write("OFFLINE_UNSUPPORTED_PROOF.json", {
        "marker": fail_result, "fullEvidence": json.loads(failed_evidence),
        "qualification": "EXPECTED_FAIL_CLOSED_OFFLINE_DISPATCH_NOT_GUEST_QUALIFICATION",
    })
    tests["proofDispatchDroppedCapabilitiesBaselineStructuredFailure"] = "PASS_EXPECTED_UNSUPPORTED"
    tests["shimVerifiesIdentityInvokesProofPropagatesExit"] = "PASS"
    positive = docker("/artifacts/g3a-handoff", ["/artifacts/g3a-proof-capsule"], positive=True)
    proof, _ = require_guest_pass(positive["stdout"], binding, positive["exitCode"])
    assert len(positive["stdout"].encode()) < 4096
    positive_evidence = (LANE / "buildcache" / proof["evidenceFile"]).read_bytes()
    assert sha(positive_evidence) == proof["evidenceSha256"]
    positive_baseline = LANE / "buildcache" / Path(proof["evidenceFile"]).parent / "baseline.json"
    assert file_sha(positive_baseline) == proof["baselineSha256"]
    full = json.loads(positive_evidence)
    assert full["baseline"]["status"]["Uid"] == "0\t0\t0\t0"
    assert full["baseline"]["status"]["NoNewPrivs"] == "0"
    assert len(full["details"]["runtimeSONAMEAliases"]) == 4
    assert full["details"]["privilegeState"]["uidRealEffectiveSaved"] == [65532] * 3
    assert full["details"]["privilegeState"]["gidRealEffectiveSaved"] == [65532] * 3
    assert full["details"]["runtimeSelfTest"]["status"] == "PASS_OFFLINE_IMPORT_ONLY"
    for name in ("mnt", "net"):
        assert full["details"]["isolatedNamespaces"][name] != full["baseline"]["namespaces"][name]
    write("OFFLINE_ROOT_FIXTURE_PROOF.json", {
        "marker": proof, "fullEvidence": full,
        "qualification": "DOCKER_ROOT_FIXTURE_ONLY_NOT_PINNED_CANONICAL_GUEST",
    })
    tests["rootInheritedNNPZeroReadOnlyInputsNetworkPrivRegainEmbeddedRuntime"] = "PASS_OFFLINE_FIXTURE_ONLY"
    tests["compactCSEMarkerCombinedBytes"] = {"unsupported": len(unsupported["stdout"].encode()),
                                           "positive": len(positive["stdout"].encode()), "maximum": 4095}
    observe()
    bad = LANE / "buildcache" / "tampered-capsule"
    raw = bytearray((LANE / "g3a-proof-capsule").read_bytes())
    raw[-1] ^= 1
    bad.write_bytes(raw)
    negative = docker("/artifacts/g3a-handoff", ["/artifacts/buildcache/tampered-capsule"])
    assert negative["exitCode"] == 1 and "CAPSULE_SHA_SIZE_MISMATCH" in negative["stdout"]
    assert "G3A_ISOLATION_PROOF_V1 " not in negative["stdout"]
    observe()
    bad.write_bytes(bytes(raw[:-1]))
    negative_size = docker("/artifacts/g3a-handoff", ["/artifacts/buildcache/tampered-capsule"])
    assert negative_size["exitCode"] == 1 and "CAPSULE_SHA_SIZE_MISMATCH" in negative_size["stdout"]
    assert "G3A_ISOLATION_PROOF_V1 " not in negative_size["stdout"]
    tests["shimHashAndSizeNegativesNoDispatch"] = "PASS"
    assert {name: file_sha(LANE / name) for name in SOURCES} == source_hashes
    assert file_sha(LANE / "g3a-proof-capsule") == candidate_sha
    assert file_sha(LANE / "g3a-handoff") == shim_sha
    assert historical_manifest == {p.name: file_sha(p) for p in OLD.iterdir() if p.is_file()}
    write("BUILD_AND_OFFLINE_COMMANDS.json", {
        "environment": {key: env[key] for key in ("GOOS", "GOARCH", "GOAMD64", "CGO_ENABLED", "GO111MODULE",
                        "GOTOOLCHAIN", "GOPROXY", "GOSUMDB", "GOCACHE", "GOTMPDIR")},
        "commands": commands, "compilerSha256": COMPILER_SHA,
        "fixtureExecutableSha256": file_sha(LANE / "buildcache" / "proof-fixtures"),
        "candidateBuildAttempts": 1, "shimBuildAttempts": 1,
    })
    write("ARTIFACT_BINDING.json", {
        **binding, "candidateSourceSha256": source_sha, "candidatePath": str(LANE / "g3a-proof-capsule"),
        "shimPath": str(LANE / "g3a-handoff"), "shimSourceSha256": file_sha(LANE / "handoff.go"),
        "embeddedFileCount": 141, "offlineQualification": "PASS",
        "purpose": "LIVE_ISOLATION_PROOF_ARTIFACT_NOT_PRODUCTION_CAPSULE",
        "candidateArch": "linux/amd64", "candidateStaticOuter": True,
        "capsuleELF": capsule_elf, "shimELF": shim_elf,
        "candidateObjectPath": f"sha256/{candidate_sha}/g3a-proof-capsule",
        "shimObjectPath": f"sha256/{shim_sha}/g3a-handoff",
        "historicalCandidateSha256": OLD_SHA, "historicalCandidateBytes": 25800828,
        "historicalOfflineSealSha256": OLD_SEAL, "historicalCandidateUnchanged": True,
        "historicalSealedMembersVerified": len(historical_seal["fileHashes"]),
        "historicalDirectoryFileHashes": historical_manifest,
        "payloadTarSha256": file_sha(LANE / "payload.tar"),
        "embeddedCensusSha256": payload_contract()["embeddedCensusSha256"],
        "sourceBinding": "SOURCE_BINDING.json", "sourceDiffReview": "SOURCE_DIFF.patch",
        "sourceDelta": "ISOLATION_PROOF_ONLY", "proofRootEmbeddedSONAMEAliases": 4,
        "readerUploaderPortableCoreChanged": False,
        "authorityPath": str(AUTHORITY), "authoritySha256": file_sha(AUTHORITY),
        "compiler": {"path": str(GO), "sha256": COMPILER_SHA, "version": "go1.27.0 windows/amd64"},
        "dockerImage": IMAGE, "pullPolicy": "never", "buildAttempts": 1,
        "sourceFixtures": fixture_names, "tests": tests, "parserFixtures": parser,
        "preFinalSourceFixtureIterations": "Only test executables were rebuilt; failed initial capability/route/native-closure fixture logs remain as historical local diagnostics",
        "guestMarkerPrefix": "G3A_ISOLATION_PROOF_V1 ", "handoffMarkerPrefix": "G3A_HANDOFF_V1 ",
        "guestOutputContract": "README.md", "guestParser": "parse_guest_output.py",
        "guestParserSha256": file_sha(LANE / "parse_guest_output.py"),
        "guestParserUse": "require_guest_pass(cse_stdout, artifact_binding, actual_exit_code)",
        "guestQualification": "NOT_RUN_NOT_CLAIMED", "pinnedGuestBinding": "PARENT_MUST_SEAL",
        "G3_EXECUTION_READINESS": "BLOCKED", "G3A_ISOLATED_ROOT_RUNNER": "BLOCKED_PENDING_PINNED_GUEST",
        "G3A_TRANSACTION_READINESS": "BLOCKED", "PRODUCTION_TRANSACTION_DISABLED": "PASS",
        "G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED": "NO", "G3A_EXECUTION_AUTHORIZED": "NO",
        "G3B_EXECUTION_AUTHORIZED": "NO", "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "laneAzureCommands": 0, "laneCloudCalls": 0, "laneAzureMutations": 0,
        "laneEntraMutations": 0, "laneRegistryMutations": 0, "productionExecutions": 0,
        "liveAuthorityConsumedByArtifactLane": False, "parentOwnsAllLiveActions": True,
        "repositoryWideChecks": "NOT_APPLICABLE_LOCAL_ARTIFACT_LANE_NO_TRACKED_SOURCE_OR_PR_CHANGES",
        "noFurtherCandidateRebuild": True,
    })
    write("CONCURRENCY_PACKAGING.json", observations)
    observe()
    shutil.rmtree(LANE / "buildcache")
    assert not (LANE / "buildcache").exists()
    assert file_sha(LANE / "g3a-proof-capsule") == candidate_sha
    assert file_sha(LANE / "g3a-handoff") == shim_sha
    print(json.dumps({**binding, "candidateSourceSha256": source_sha,
                      "offlineQualification": "PASS", "historicalCandidateUnchanged": True}))


if __name__ == "__main__":
    main()
