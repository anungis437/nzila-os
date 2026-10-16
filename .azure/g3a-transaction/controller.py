"""Fixture-qualified transaction primitives; live execution remains fail-closed."""

import hashlib
import json
import os
from pathlib import Path
import subprocess
import tarfile

from registry import InputReader, Uploader, acquire_imds
from sealed_reader import require

PHASES = (
    "authority_verification", "live_baseline", "ownership_capture", "input_lockdown",
    "identity_rbac_verification", "builder_creation", "bootstrap_execution", "private_input_retrieval",
    "portable_exact_build", "target_collision_check", "one_bounded_registry_push", "immutable_readback", "negative_authorization",
    "token_hygiene", "builder_teardown", "temporary_grants_teardown", "final_reconciliation", "evidence_seal",
)
MUTATING_PHASES = {"builder_creation", "bootstrap_execution", "one_bounded_registry_push",
                   "builder_teardown", "temporary_grants_teardown"}


def safe_extract(archive_path, destination, expected):
    require(not destination.exists() and expected, "EXCLUSIVE_EXTRACTION_CONTRACT")
    with tarfile.open(archive_path) as archive:
        members, seen, files = archive.getmembers(), set(), {}
        for member in members:
            name = member.name.rstrip("/")
            require(name and not name.startswith("/") and "\\" not in name and
                    all(part not in ("", ".", "..") for part in name.split("/")) and
                    name not in seen and member.mode & ~0o777 == 0 and
                    (member.isfile() or member.isdir()), "ARCHIVE_PATH_TYPE_DUPLICATE")
            seen.add(name)
            if member.isdir():
                require(member.mode == 0o755 and any(key.startswith(name + "/") for key in expected),
                        "ARCHIVE_DIRECTORY_CONTRACT")
                continue
            require(name in expected, "ARCHIVE_UNEXPECTED_FILE")
            contract = expected[name]
            require(member.size == contract["bytes"] and member.mode == contract["mode"], "ARCHIVE_SIZE_MODE")
            raw = archive.extractfile(member).read(member.size + 1)
            require(len(raw) == contract["bytes"] and hashlib.sha256(raw).hexdigest() == contract["sha256"],
                    "ARCHIVE_FILE_HASH")
            files[name] = member
        require(set(files) == set(expected), "ARCHIVE_FILE_CENSUS")
        destination.mkdir(mode=0o700)
        for name, member in files.items():
            path = destination.joinpath(*name.split("/"))
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("xb") as file:
                source = archive.extractfile(member)
                while chunk := source.read(65536):
                    file.write(chunk)
            path.chmod(member.mode)


class GuestPipeline:
    def __init__(self, bindings, connection_factory, imds_factory, build_runner=subprocess.run):
        self.bindings, self.factory, self.imds_factory = bindings, connection_factory, imds_factory
        self.build_runner = build_runner

    def retrieve_inputs(self, workspace, members):
        require(not workspace.exists(), "FRESH_GUEST_WORKSPACE")
        workspace.mkdir(mode=0o700)
        evidence = []
        for binding in self.bindings:
            token = acquire_imds(binding.client_id, self.imds_factory)
            reader = InputReader(binding, self.factory)
            destination = workspace / (binding.payload_sha256 + ".payload")
            try:
                evidence.append(reader.retrieve(token, destination))
            finally:
                token = None
            if binding.payload_sha256 in members:
                safe_extract(destination, workspace / binding.payload_sha256, members[binding.payload_sha256])
        return evidence

    def build(self, executable, inputs, work, output, expected_binary_sha):
        require(executable.is_file() and not executable.is_symlink() and
                hashlib.sha256(executable.read_bytes()).hexdigest() == expected_binary_sha,
                "STAGED_CONTROLLER_SHA")
        require(not work.exists() and output.is_dir() and not any(output.iterdir()), "EXCLUSIVE_BUILD_WORKSPACE")
        result = self.build_runner([str(executable), str(inputs), str(work), str(output)],
                                   env={"PATH": "/unavailable", "DOCKER_HOST": ""},
                                   capture_output=True, timeout=5400)
        require(result.returncode == 0, "EXACT_BUILD_CONTROLLER_FAILURE")
        return {"status": "PASS", "controllerSha256": expected_binary_sha}


def verify_lockdown(state):
    require(state.get("publicNetworkAccess") == "Disabled" and state.get("networkRuleBypassOptions") == "None" and
            state.get("adminUserEnabled") is False and state.get("anonymousPullEnabled") is False and
            state.get("roleAssignmentMode") == "AbacRepositoryPermissions" and
            state.get("networkRuleSet", {}).get("defaultAction") == "Deny" and
            state.get("networkRuleSet", {}).get("ipRules") == [] and
            state.get("producerWriterRevoked") is True and
            state.get("privateEndpointApproved") is True, "INPUT_LOCKDOWN_NOT_PROVEN")


class SingleAuthority:
    def __init__(self, marker, mission, authority_sha):
        require(mission == "NZ-20261008-INFRA-001" and len(authority_sha) == 64 and
                all(char in "0123456789abcdef" for char in authority_sha), "AUTHORITY_BINDING")
        self.marker, self.mission, self.sha = marker, mission, authority_sha

    def consume_before_first_mutation(self):
        with self.marker.open("x", encoding="utf-8") as file:
            json.dump({"mission": self.mission, "authoritySha256": self.sha, "maximumRuns": 1,
                       "consumed": True}, file)
            file.flush()
            os.fsync(file.fileno())


class OwnershipLedger:
    def __init__(self, planned_ids, baseline_ids):
        require(set(planned_ids).isdisjoint(baseline_ids), "BASELINE_RESOURCE_REUSE_NOT_OWNED")
        self.allowed, self.baseline, self.created = set(planned_ids), set(baseline_ids), []

    def capture_created(self, resource_id, owner, operation_receipt):
        require(resource_id in self.allowed and resource_id not in self.baseline and
                resource_id not in self.created and owner == "G3A_TRANSACTION_OWNED" and
                operation_receipt.get("created") is True and operation_receipt.get("id") == resource_id,
                "CREATION_OWNERSHIP_UNPROVEN")
        self.created.append(resource_id)

    def cleanup(self, delete_once):
        attempts = []
        for resource_id in reversed(self.created):
            try:
                delete_once(resource_id)
                attempts.append({"id": resource_id, "result": "DELETED_ONCE"})
            except (OSError, RuntimeError):
                attempts.append({"id": resource_id, "result": "FAILED_NO_RETRY_RECONCILIATION_REQUIRED"})
        return attempts


class FixtureController:
    def __init__(self, authority, ledger, adapter):
        require(getattr(adapter, "fixture_only", False), "LIVE_CONTROLLER_NOT_AUTHORIZED_OR_COMPLETE")
        self.authority, self.ledger, self.adapter = authority, ledger, adapter

    def run(self):
        events, consumed = [], False
        for phase in PHASES:
            if phase in MUTATING_PHASES and not consumed:
                self.authority.consume_before_first_mutation()
                consumed = True
            try:
                proof = self.adapter.phase(phase, self.ledger)
                require(proof is True, "PHASE_PROOF_REQUIRED_" + phase)
                events.append({"phase": phase, "result": "PASS"})
            except (OSError, RuntimeError) as error:
                events.append({"phase": phase, "result": "FAIL", "errorType": type(error).__name__})
                cleanup = self.ledger.cleanup(self.adapter.delete_once) if consumed else []
                return {"result": "FAIL_CLOSED", "firstFailingPhase": phase, "events": events,
                        "cleanup": cleanup, "laterPhasesExecuted": False, "authorityConsumed": consumed}
        return {"result": "FIXTURE_PASS_NOT_LIVE_COMPLETE", "events": events, "authorityConsumed": consumed}


def bootstrap_size_guard(payload, limit=256000, fraction=0.5):
    require(isinstance(payload, bytes) and 0 < len(payload) <= limit * fraction, "BOOTSTRAP_INLINE_SIZE_MARGIN")
    return {"bytes": len(payload), "maximumDocumentedBytes": limit, "marginBytes": limit - len(payload)}


def cost_ceiling(components, multiplier):
    from decimal import Decimal, ROUND_CEILING
    require(multiplier >= Decimal("1.5") and components and
            all(isinstance(value, Decimal) and value.is_finite() and value >= 0 for value in components),
            "COST_ARITHMETIC_INPUTS")
    expected = sum(components, Decimal(0))
    ceiling = (expected * multiplier).quantize(Decimal("1"), rounding=ROUND_CEILING)
    return {"expected": str(expected), "ceiling": str(ceiling)}
