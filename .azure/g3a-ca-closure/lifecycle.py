"""Receipt-bound controller skeleton. No live adapter is currently constructible."""

from dataclasses import dataclass
from decimal import Decimal
import hashlib
import json
from pathlib import Path
from typing import Protocol

PHASES = (
    "authority_verification", "live_baseline", "ownership_capture", "input_lockdown",
    "identity_rbac_verification", "builder_creation", "bootstrap_execution",
    "private_input_retrieval", "portable_exact_build", "target_collision_check",
    "one_bounded_registry_push", "immutable_readback", "negative_authorization",
    "token_hygiene", "builder_teardown", "temporary_grants_teardown",
    "final_reconciliation", "evidence_seal",
)

PARENT_COST_PATH = Path(__file__).resolve().parent.parent / "g3a-ca-live" / "FULL_G3A_COST_MODEL.json"
PARENT_COST_SHA256 = "65fa213d6df9fc6995ded1a636eed13eedd322c4238d02d81745bb4e7d57e83b"


@dataclass(frozen=True)
class Receipt:
    resource_id: str
    kind: str
    creation_operation_id: str
    authority_sha: str
    ownership: str
    parent_id: str | None = None


class ExactOwnership:
    def __init__(self, baseline: set[str], planned: set[str], authority_sha: str):
        normalize = lambda value: value.rstrip("/").lower()
        self.baseline = {normalize(x) for x in baseline}
        self.planned = {normalize(x) for x in planned}
        if self.baseline & self.planned:
            raise RuntimeError("BASELINE_IDS_CANNOT_BE_TRANSACTION_OWNED")
        self.authority_sha = authority_sha
        self.receipts: dict[str, Receipt] = {}
        self.attempted: set[str] = set()

    def capture(self, receipt: Receipt) -> None:
        key = receipt.resource_id.rstrip("/").lower()
        if (key not in self.planned or key in self.baseline or key in self.receipts or
                not receipt.creation_operation_id or receipt.authority_sha != self.authority_sha or
                receipt.ownership != "G3A_TRANSACTION_OWNED" or
                receipt.kind in {"resourceGroup", "baselineRegistry", "delegation", "baselineNetwork"}):
            raise RuntimeError("POSITIVE_EXACT_CREATION_OWNERSHIP_REQUIRED")
        self.receipts[key] = receipt

    def cleanup(self, delete_once) -> list[dict]:
        results = []
        # Child objects (extension/zone group/role) precede parent resources.
        ordered = sorted(self.receipts, key=lambda key: key.count("/"), reverse=True)
        for key in ordered:
            if key in self.attempted:
                continue
            self.attempted.add(key)
            try:
                delete_once(self.receipts[key])
                results.append({"id": key, "status": "DELETE_ATTEMPT_ACKNOWLEDGED"})
            except Exception as error:
                results.append({"id": key, "status": "RECONCILIATION_REQUIRED_NO_RETRY",
                                "errorType": type(error).__name__})
        return results


class Adapter(Protocol):
    fixture_only: bool

    def phase(self, name: str, ledger: ExactOwnership) -> dict: ...
    def delete_once(self, receipt: Receipt) -> None: ...


def bind_cost(path: Path, expected_sha: str) -> dict:
    if path.resolve() != PARENT_COST_PATH.resolve() or expected_sha != PARENT_COST_SHA256:
        raise RuntimeError("EXACT_PARENT_FULL_G3A_COST_MODEL_REQUIRED")
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected_sha:
        raise RuntimeError("PARENT_COST_BINDING_HASH_MISMATCH")
    value = json.loads(raw)
    if (value["currency"] != "CAD" or
            value["authorization"] != "LOCAL_SCENARIO_ONLY_NOT_EXECUTION_AUTHORITY_OR_BUDGET_EXPANSION"):
        raise RuntimeError("PARENT_COST_SCOPE_MISMATCH")
    expected = Decimal(str(value["G3A_EXPECTED_COST_CAD"]))
    ceiling = Decimal(str(value["G3A_COST_CEILING_CAD"]))
    if (not expected.is_finite() or not ceiling.is_finite() or expected <= 0 or
            ceiling < expected * Decimal("1.5")):
        raise RuntimeError("PARENT_COST_GATE_NOT_PASSING")
    return {"source": str(path.resolve()), "sourceSha256": expected_sha,
            "expectedCostCAD": str(expected), "ceilingCAD": str(ceiling),
            "bounds": value["bounds"], "runtimePayloadBinding": "REQUIRED_NOT_PROVEN",
            "executionAuthority": "NO"}


class Controller:
    def __init__(self, adapter: Adapter, ledger: ExactOwnership):
        if not getattr(adapter, "fixture_only", False):
            raise RuntimeError("LIVE_ADAPTER_INCOMPLETE_AND_NOT_AUTHORIZED")
        self.adapter, self.ledger = adapter, ledger
        self.started = False

    def run_local(self, cost_path: Path, cost_sha: str) -> dict:
        if self.started:
            raise RuntimeError("CONTROLLER_SINGLE_USE")
        self.started = True
        try:
            cost = bind_cost(cost_path, cost_sha)
        except Exception as error:
            return {"status": "FAIL_CLOSED", "failedPhase": "cost_binding_precondition",
                    "errorType": type(error).__name__, "events": [], "cleanup": [],
                    "laterPhasesExecuted": False}
        events = []
        for phase in PHASES:
            try:
                evidence = self.adapter.phase(phase, self.ledger)
                if (not isinstance(evidence, dict) or evidence.get("phase") != phase or
                        evidence.get("verified") is not True or not evidence.get("evidenceSha256")):
                    raise RuntimeError("PHASE_SPECIFIC_EVIDENCE_REQUIRED")
                events.append({"phase": phase, "evidence": evidence})
            except Exception as error:
                return {"status": "FAIL_CLOSED", "failedPhase": phase,
                        "errorType": type(error).__name__, "events": events,
                        "cleanup": self.ledger.cleanup(self.adapter.delete_once),
                        "laterPhasesExecuted": False}
        return {"status": "LOCAL_FIXTURE_ONLY", "events": events, "liveProof": False,
                "costBinding": cost}


def live_entrypoint(*_args, **_kwargs):
    raise RuntimeError("G3_CONTROL_PLANE_BOOTSTRAP_AND_FRESH_G3A_AUTHORITY_REQUIRED")
