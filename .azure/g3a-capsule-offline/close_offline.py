"""Persist blocked offline closure without changing proven components."""

import ast
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

import isolation_gate
import prepare

HERE = prepare.HERE


def main():
    baseline = prepare.baseline("CONCURRENCY_CLOSE_OFFLINE.json")
    references = prepare.preserved()
    gate_result = prepare.command([sys.executable, "-B", "-m", "unittest", "-v", "test_gate"])
    prepare.save("FINAL_ISOLATION_GATE_FIXTURES.json", gate_result)
    prepare.require(gate_result["exitCode"] == 0, "FINAL_GATE_FIXTURES_FAILED")
    for name in ("assemble.py", "entry.py", "prepare.py", "isolation_gate.py",
                 "test_gate.py", "close_offline.py", "independent_offline.py"):
        ast.parse((HERE / name).read_text())
    observed = isolation_gate.pinned_evidence(prepare.BASE)
    gate = isolation_gate.qualify(observed)
    prepare.require(gate["status"] == "BLOCKED", "UNEXPECTED_PINNED_GUEST_QUALIFICATION")
    candidate = prepare.load(HERE / "CANDIDATE_BINDING.json")
    prepare.require(prepare.sha(HERE / "g3a-guest-candidate") == candidate["binarySha256"], "CANDIDATE_BINARY_CHANGED")
    for name, expected in candidate["sourceFileHashes"].items():
        prepare.require(prepare.sha(HERE / name) == expected, "BOUND_CANDIDATE_SOURCE_CHANGED")
    selftest = prepare.load(HERE / "CANDIDATE_SELFTEST.json")
    detail = json.loads(selftest["stdout"])
    prepare.require(selftest["exitCode"] == 0 and detail["status"] == "PASS_OFFLINE_IMPORT_ONLY" and
                    detail["networkRequests"] == 0 and detail["transactionQualified"] is False,
                    "CANDIDATE_SELFTEST_CHANGED")
    prepare.save("ISOLATION_DISPOSITION.json", {
        "observedEvidence": observed, "gate": gate,
        "ISOLATION_MECHANISM": "PROPOSED_PRIVATE_MOUNT_PID_NETWORK_NAMESPACES_PIVOT_ROOT_DROP_UID_SECCOMP",
        "implementation": "NOT_CREATED_STOPPED_AT_UNPROVEN_PINNED_GUEST_DEPENDENCY",
        "REQUIRED_CAPABILITIES": sorted(isolation_gate.CAPABILITIES),
        "REQUIRED_SYSCALLS": sorted(isolation_gate.SYSCALLS),
        "REQUIRED_MOUNTS": {
            "inputs": "READ_ONLY_HASH_BOUND_STAGED_INPUTS",
            "work": "DEDICATED_WRITABLE_TRANSACTION_OWNED",
            "output": "DEDICATED_WRITABLE_TRANSACTION_OWNED",
            "proc": "ONLY_NEW_PID_NAMESPACE_IF_REQUIRED_NO_HOST_PROCESS_ROOT",
            "hostRootDockerCacheCompilerCredentials": "NEVER_MOUNTED",
        },
        "NETWORK_NAMESPACE_MODEL": "BUILD_CHILD_NO_NETWORK; REGISTRY_PARENT_EXPLICIT_PRIVATE_HOST_PE_ALLOWLIST",
        "FILESYSTEM_BOUNDARY": "PROPOSED_PIVOT_ROOT_OLD_ROOT_UNMOUNT_NO_INHERITED_DIRECTORY_FDS",
        "UID_GID_MODEL": "INHERITED_CSE_PRIVILEGES_FOR_BOUNDARY_SETUP_ONLY_THEN_UID_GID65532_NO_CAPS_NO_NEW_PRIVS",
        "guestCapabilityFailure": "NOT_CLAIMED_EVIDENCE_ABSENT",
        "localDockerDoesNotProvePinnedAzureGuest": True,
        "newDaemon": False,
    })
    witness_source = prepare.BASE / "g3a-live-bootstrap" / "probe" / "main.go"
    prepare.save("HANDOFF_DISPOSITION.json", {
        "BOOTSTRAP_TO_CAPSULE_HANDOFF": "BLOCKED",
        "witness": "QUALIFIED_TRANSPORT_WITNESS_ONLY",
        "witnessSource": str(witness_source), "witnessSourceSha256": prepare.sha(witness_source),
        "witnessBinarySha256": "5f82bd226a27fd1d066a211bb527049097c049181eae92ebf9b3fae3e16683d8",
        "observedBehavior": "SELF_HASH_AND_MARKER_THEN_EXIT",
        "capsuleRetrievalHashVerificationExecPath": "ABSENT_FROM_UNCHANGED_WITNESS",
        "separateHandoffMachinery": "NOT_QUALIFIED_NOT_SUBSTITUTED",
        "witnessModifiedOrRebuilt": False,
        "candidateCannotBeStagedAsWitness": True,
        "candidateBytesExceedAcceptedBootstrapByteCap": True,
        "intendedCapsuleTransport": "IMMUTABLE_PRIVATE_OCI_NOT_PUBLIC_BLOB_FALLBACK",
    })
    previous = prepare.load(prepare.BASE / "g3a-ca-live" / "FULL_G3A_COST_MODEL.json")
    known = prepare.load(prepare.BASE / "g3a-ca-closure" / "CLOSURE_DISPOSITION.json")["knownFrozenBytes"]
    prepare.save("CANDIDATE_PAYLOAD_CENSUS.json", {
        "status": "INCOMPLETE_PRODUCTION_TRANSACTION_CENSUS",
        "candidate": candidate,
        "candidateEmbeddedRuntime": "RUNTIME_CENSUS.json",
        "candidateInnerArchiveBytes": prepare.load(HERE / "RUNTIME_CENSUS.json")["archiveBytes"],
        "knownFrozenInputMembers": known,
        "classification": {
            "candidateLauncherInterpreterLibrariesFrozenRegistryModules": "CAPSULE_EMBEDDED",
            "portableCoreCompilerSourceEnvelopeCACompressorFrozenTemplates": "STAGED_INPUT",
            "linuxAMD64KernelProcSelfExeAndVmAgentCSE21BinSh": "PINNED_PLATFORM_CONTRACT",
        },
        "unqualified": {
            "namespaceCapabilitiesKernelRestrictions": "NOT_HOST_ASSUMED_STOP",
            "productionHandoff": "NOT_QUALIFIED",
            "runtimeClosureBeyondImportTest": "NOT_PROVEN",
            "futureAuthorityConfigAndOCIEnvelopes": "NOT_FINALIZED",
        },
        "fullProductionTotalBytes": "UNRESOLVED",
        "extractedFrozenInputMembersAreNotOCITransportBytes": True,
        "candidateArchiveIsNotProductionToolingOCIManifest": True,
        "compilerTreesProductSourceRuntimeOCIAndFinalImageEmbedded": False,
    })
    disposition = {
        "G3_EXECUTION_READINESS": "BLOCKED",
        "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED",
        "G3A_REGISTRY_UPLOADER": "QUALIFIED",
        "G3A_CONTENT_ADDRESSED_FIRST_BYTE": "PROVEN",
        "FIRST_BYTE_BOOTSTRAP": "QUALIFIED_TRANSPORT_WITNESS",
        "PRODUCTION_GUEST_CAPSULE": "SEPARATE_ARTIFACT_NOT_QUALIFIED",
        "G3A_GUEST_CAPSULE_SHA256": "UNRESOLVED",
        "G3A_GUEST_CAPSULE_SOURCE_SHA256": "UNRESOLVED",
        "G3A_GUEST_CAPSULE_BINARY_SHA256": "UNRESOLVED",
        "G3A_GUEST_CAPSULE_BYTES": "UNRESOLVED",
        "G3A_GUEST_CAPSULE_ARCH": "linux/amd64",
        "G3A_GUEST_CAPSULE_STATIC": "UNRESOLVED",
        "G3A_GUEST_CAPSULE_INTERPRETER": "UNRESOLVED",
        "G3A_GUEST_CAPSULE_RUNTIME_DEPENDENCIES": "PRODUCTION_UNRESOLVED_CANDIDATE_EXACT_CENSUS_ON_FILE",
        "G3A_GUEST_CAPSULE_SELF_CONTAINED": "FAIL",
        "G3A_ISOLATED_ROOT_RUNNER": "BLOCKED",
        "BOOTSTRAP_TO_CAPSULE_HANDOFF": "BLOCKED",
        "G3A_GUEST_CAPSULE_INPUT_CONTRACT": "UNRESOLVED_NO_PRODUCTION_MANIFEST_BOUND",
        "G3A_LIVE_INPUT_ADAPTER": "INCOMPLETE",
        "G3A_LIVE_BUILD_ADAPTER": "INCOMPLETE",
        "G3A_LIVE_UPLOAD_ADAPTER": "INCOMPLETE",
        "G3A_LIVE_AUTH_NEGATIVE_ADAPTER": "INCOMPLETE",
        "G3A_VM_LIFECYCLE_ADAPTER": "INCOMPLETE",
        "G3A_CSE_LIFECYCLE_ADAPTER": "INCOMPLETE",
        "G3A_TRANSACTION_STATE_MACHINE": "INCOMPLETE",
        "G3A_PRODUCTION_PAYLOAD_CENSUS": "INCOMPLETE",
        "G3A_TOTAL_PRIVATE_INPUT_BYTES": "UNRESOLVED",
        "G3A_BOOTSTRAP_BYTES": 1802364,
        "G3A_TOOLING_BYTES": "UNRESOLVED",
        "G3A_SOURCE_BYTES": "UNRESOLVED",
        "G3A_BUILD_TOOLCHAIN_BYTES": "UNRESOLVED",
        "G3A_OTHER_INPUT_BYTES": "UNRESOLVED",
        "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3A_ROLE_OWNERSHIP_MATRIX": "INCOMPLETE",
        "G3A_RESOURCE_OWNERSHIP_MATRIX": "INCOMPLETE",
        "G3A_EXPECTED_COST_CAD": previous["G3A_EXPECTED_COST_CAD"],
        "G3A_COST_CEILING_CAD": previous["G3A_COST_CEILING_CAD"],
        "G3ACostScope": "PREVIOUS_ACCEPTED_BOUNDED_SCENARIO_ONLY_NOT_FINAL_PAYLOAD_PRICE_OR_ENFORCEMENT",
        "G3A_COST_GATE_ENFORCED": "FAIL",
        "G3A_LIFETIME_BOUNDS_ENFORCED": "FAIL",
        "G3A_FAILURE_CLEANUP_MATRIX": "FAIL",
        "G3A_TRANSACTION_READINESS": "BLOCKED",
        "G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED": "NO",
        "G3A_EXECUTION_AUTHORIZED": "NO",
        "G3B_EXECUTION_AUTHORIZED": "NO",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
        "cloudMetadataReads": 0, "cloudPricingReads": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES",
        "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "G3A_EXECUTION_AUTHORITY_MAX_RUNS": 1,
        "futureAuthorityConsumption": "FIRST_G3A_AZURE_MUTATION_NEVER_RESET",
        "newG3AExecutionAuthorityIssuedOrConsumed": False,
        "candidateBinarySha256": candidate["binarySha256"],
        "candidateBinaryBytes": candidate["binaryBytes"],
        "candidateSourceSha256": candidate["sourceSha256"],
        "candidateOuterELFStatic": True,
        "candidateEmbeddedRuntimeStatic": False,
        "candidateEmbeddedRuntimeInterpreter": candidate["embeddedInterpreter"],
        "candidateQualification": "OFFLINE_IMPORT_PACKAGING_ONLY_PRODUCTION_ENTRYPOINT_DISABLED",
        "stopReason": "AUTHORITY_SECTIONS7_AND34_PINNED_GUEST_ISOLATION_DEPENDENCY_NOT_ON_FILE",
        "smallestRuntimeDependency": gate["missing"],
        "additionalHandoffBlocker": "UNCHANGED_MARKER_WITNESS_HAS_NO_CAPSULE_VERIFY_OR_EXEC_PATH",
        "controllerOrTopLevelBicepModified": False,
        "frozenComponentsRequalified": False,
        "nextAuthorizedAction": "NONE_STOP_NO_CONTROL_PLANE_AUTHORITY_PREPARED",
    }
    prepare.save("FINAL_DISPOSITION.json", disposition)
    report = """# Offline G3A production capsule readiness

## Disposition

**G3A_TRANSACTION_READINESS = BLOCKED**.
Stopped at the pinned-guest isolation evidence gate required by sections
7 and 34 of the new local/offline authority. No controller or top-level
Bicep changes were made. No control-plane bootstrap authority was issued.

## Measured local progress

Constructed a separate, fail-closed runtime-packaging candidate from the
already-qualified registry/controller primitives and their exact frozen
sources. The first-byte witness was not changed or executed again.

- Candidate SHA-256: `{sha}`.
- Candidate bytes: **{bytes}**.
- Candidate source-binding digest: `{source}`.
- Outer launcher: static Linux/amd64 ELF, no PT_INTERP or PT_DYNAMIC.
- Inner runtime: embedded CPython 3.11.17, explicit dynamic loader and
  native dependencies. It is **not** described as an all-static runtime.
- Exact candidate dependency census: 141 files, 22,570,298 member bytes.
- Cached preparation image pinned by full digest; no pull or installation.
- Offline import test: 128 modules resolved inside the extracted package,
  PATH `/unavailable`, no capabilities, no-new-privileges, network disabled.
- Six candidate archive/disabled-entrypoint fixtures PASS.
- Eight isolation evidence-gate fixtures PASS.

The import test is not a full transaction, exhaustive runtime-dependency
qualification, isolated-root build proof, or production handoff proof.
Candidate entrypoints reject production execution unconditionally.
Compiler trees, product build source, runtime OCI payload, final image
and credentials are not embedded.

Two initial preparation failures (Windows separator handling and cached
site initialization) were explicit, preserved, and corrected before any
candidate was built. No cloud retry or proof replay occurred.

## Exact stop boundary

The sealed VM model proves only the pinned image identity:
`Canonical:ubuntu-24_04-lts:server:24.04.202609040`.
It contains no observation of inherited CAP_SYS_ADMIN, CAP_SYS_CHROOT,
CAP_SETUID or CAP_SETGID, namespace/mount restrictions, syscall filters,
privilege-drop behavior, or host-filesystem/network boundary negatives.

The proposed lowest-state runner uses Linux kernel mount/PID/network
namespaces, a private root, read-only staged inputs and dedicated writable
work/output, followed by credential/capability drop and no-new-privileges.
It adds no daemon. This is a **proposed contract**, not an implemented or
qualified runner. A Docker Desktop kernel and container capabilities
cannot establish those properties for the pinned Azure guest.
Absence of evidence is not a claim that Azure or Ubuntu cannot support it.

The unchanged witness additionally emits its marker and self-hash, then
exits. It has no capsule retrieval, capsule SHA check, or capsule exec
path. No new shim or public fallback was silently substituted. A separate
hash-bound handoff must be qualified without changing the witness in place.
The 25.8 MB candidate is not substituted for the 1.8 MB Blob witness or
for its accepted bootstrap-byte cap.

## Payload and cost boundaries

The candidate artifact/dependencies are exactly inventoried. The complete
future private OCI envelope, handoff payload, configuration and staged-input
census remain unresolved, so no estimated byte total is presented as exact.
Known extracted frozen input-member sizes are not OCI transport sizes.

The accepted CAD 4.8973042 expected / CAD 7.35 ceiling scenario is preserved
only as the prior bounded scenario. It is not a final new-payload cost
claim. Pricing freshness, quantitative lifetime enforcement and full
failure-cleanup coverage are not complete and are marked FAIL, not PASS.

## Preservation and concurrency

Latest first-byte root remains
`96dced437ec2cddb1ec000db7e337ba02eb676caac667e106fc0104f8fbeeda8`.
Verified {references} prior root/file references unchanged, including G2
and all directly protected builder/uploader/first-byte packet bytes.
There was no builder, compressor, frozen image, uploader, parser or
first-byte requalification.

Active worktree HEAD: `{active}`.
Foreign HEAD: `{foreign}`; observed status entries: {foreign_count}.
Foreign work was observed only; nothing was edited, staged, reverted or
dispositioned. Candidate compiler cache was removed after local checks.

**AZURE_MUTATIONS = 0; ENTRA_MUTATIONS = 0; REGISTRY_MUTATIONS = 0.**
No Azure metadata/pricing call, deployment, VM, CSE, Blob upload, ACR upload
or role assignment was performed under this authority.
All execution authorizations remain NO; UE and Cora remain INFRA_NO_GO.

## Deliverables

- [Full requested disposition](FINAL_DISPOSITION.json)
- [Candidate provenance](CANDIDATE_BINDING.json)
- [Exact embedded dependency census](RUNTIME_CENSUS.json)
- [Candidate versus unresolved production payload census](CANDIDATE_PAYLOAD_CENSUS.json)
- [Isolation gate](ISOLATION_DISPOSITION.json)
- [Handoff boundary](HANDOFF_DISPOSITION.json)
- [Offline import test](CANDIDATE_SELFTEST.json)
- [Archive fixtures](LAUNCHER_FIXTURES.json)
- [Isolation gate fixtures](FINAL_ISOLATION_GATE_FIXTURES.json)
- [Seal](OFFLINE_VERIFICATION.json)
- [Independent verification](OFFLINE_INDEPENDENT_VERIFICATION.json)
""".format(sha=candidate["binarySha256"], bytes=candidate["binaryBytes"],
           source=candidate["sourceSha256"], references=references,
           active=baseline[0]["head"], foreign=baseline[1]["head"],
           foreign_count=len(baseline[1]["status"]))
    with (HERE / "OFFLINE_CAPSULE_REPORT.md").open("x", encoding="utf-8") as stream:
        stream.write(report)
    prepare.save("OFFLINE_VERIFICATION.json", {
        "status": "SEALED_LOCAL_CANDIDATE_BLOCKED_AT_PINNED_GUEST_ISOLATION",
        "utc": datetime.now(timezone.utc).isoformat(),
        "authorityPath": str(prepare.AUTHORITY), "authoritySha256": prepare.sha(prepare.AUTHORITY),
        "fileHashes": {str(path.relative_to(HERE)): prepare.sha(path) for path in HERE.rglob("*")
                       if path.is_file() and path.name not in {
                           "OFFLINE_VERIFICATION.json", "OFFLINE_INDEPENDENT_VERIFICATION.json"}},
        "previousProofPath": str(prepare.BASE / "g3a-ca-live" / "CONTENT_PROOF_VERIFICATION.json"),
        "previousProofSha256": prepare.ROOT_SHA, "previousProtectedReferencesVerified": references,
        "previousIndependentVerificationPath": str(prepare.BASE / "g3a-ca-live" / "CONTENT_INDEPENDENT_VERIFICATION.json"),
        "previousIndependentVerificationSha256": prepare.sha(
            prepare.BASE / "g3a-ca-live" / "CONTENT_INDEPENDENT_VERIFICATION.json"),
        "stopAtDependencyNoControllerBicepChange": True,
        "productionQualification": "BLOCKED",
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
    })
    print("OFFLINE_ROOT_SHA256=" + prepare.sha(HERE / "OFFLINE_VERIFICATION.json"))


if __name__ == "__main__":
    main()
