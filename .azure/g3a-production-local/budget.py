"""Local production quantity/lifetime guard; this grants no execution authority."""

from dataclasses import dataclass
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import time
from typing import Callable, Literal

BASE = Path(__file__).resolve().parent.parent
MODEL = BASE / "g3a-ca-live" / "FULL_G3A_COST_MODEL.json"
MODEL_SHA = "65fa213d6df9fc6995ded1a636eed13eedd322c4238d02d81745bb4e7d57e83b"


def require(condition: bool, reason: str) -> None:
    if not condition:
        raise RuntimeError(reason)


@dataclass(frozen=True)
class Payload:
    path: Path
    sha256: str
    bytes: int
    kind: Literal["input", "bootstrap"]

    def verify(self) -> None:
        require(self.kind in {"input", "bootstrap"} and type(self.bytes) is int and self.bytes > 0,
                "EXACT_PAYLOAD_KIND_SIZE")
        require(len(self.sha256) == 64 and all(x in "0123456789abcdef" for x in self.sha256),
                "EXACT_PAYLOAD_HASH")
        require(self.path.is_file() and not self.path.is_symlink(), "EXACT_PAYLOAD_REGULAR_FILE")
        with self.path.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        require(self.path.stat().st_size == self.bytes and digest == self.sha256, "EXACT_PAYLOAD_DRIFT")


@dataclass(frozen=True)
class Quantities:
    vm_count: int
    pe_count: int
    dns_zone_count: int
    input_registry_count: int
    disk_gib: int
    final_image_bytes: int

    def verify(self) -> None:
        require(all(type(value) is int for value in (
            self.vm_count, self.pe_count, self.dns_zone_count, self.input_registry_count,
            self.disk_gib, self.final_image_bytes)), "INTEGER_RESOURCE_QUANTITIES")
        require(self.vm_count == self.input_registry_count == 1 and 1 <= self.pe_count <= 3 and
                1 <= self.dns_zone_count <= 2 and self.disk_gib == 64 and
                0 < self.final_image_bytes <= 3309418, "PRICED_RESOURCE_QUANTITY_CEILING")


def cost_contract() -> dict:
    raw = MODEL.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == MODEL_SHA, "SEALED_COST_MODEL_CHANGED")
    model = json.loads(raw)
    expected = sum(Decimal(value) for value in model["amountsCAD"].values())
    expected = expected.quantize(Decimal("0.0000001"))
    ceiling = Decimal("7.35")
    require(model["currency"] == "CAD" and
            expected == Decimal(model["G3A_EXPECTED_COST_CAD"]) and
            ceiling == Decimal(model["G3A_COST_CEILING_CAD"]) and
            ceiling >= expected * Decimal("1.5"), "EXACT_PRICED_CAD_ARITHMETIC")
    return {
        "sourceSha256": MODEL_SHA, "currency": "CAD", "expectedCAD": str(expected),
        "ceilingCAD": str(ceiling), "authority": "NONE_LOCAL_ONLY",
        "bootstrapBytesMaximum": 100000000,
        "priorBootstrapBytesMaximum": model["bounds"]["bootstrapBinaryBytesMaximum"],
        "bootstrapChangeBasis": "0.1GB-month already priced; all actual bootstrap payloads must fit 100MB.",
        "totalPrivateBytesMaximum": 500000000,
        "transactionSecondsMaximum": 14400, "vmSecondsMaximum": 7200,
        "productionPayloadBinding": "REQUIRED_NOT_IMPLIED_BY_THIS_CONTRACT",
    }


class Budget:
    def __init__(self, quantities: Quantities, payloads: tuple[Payload, ...],
                 clock: Callable[[], float] = time.monotonic):
        quantities.verify()
        require(payloads and {p.kind for p in payloads} == {"input", "bootstrap"} and
                len({p.path.resolve() for p in payloads}) == len(payloads), "COMPLETE_PRIVATE_PAYLOAD_CENSUS")
        for payload in payloads:
            payload.verify()
        self.contract = cost_contract()
        self.total_bytes = sum(p.bytes for p in payloads)
        bootstrap_bytes = sum(p.bytes for p in payloads if p.kind == "bootstrap")
        require(bootstrap_bytes <= self.contract["bootstrapBytesMaximum"] and
                self.total_bytes <= self.contract["totalPrivateBytesMaximum"], "PRICED_PRIVATE_BYTES_CEILING")
        self.clock, self.started, self.vm_started = clock, None, None

    def before_transaction_mutation(self) -> None:
        now = self.clock()
        if self.started is None:
            self.started = now
        require(0 <= now - self.started < self.contract["transactionSecondsMaximum"],
                "TRANSACTION_LIFETIME_EXHAUSTED_CLEANUP_ONLY")
        if self.vm_started is not None:
            require(0 <= now - self.vm_started < self.contract["vmSecondsMaximum"],
                    "VM_LIFETIME_EXHAUSTED_CLEANUP_ONLY")

    def before_vm_creation(self) -> None:
        self.before_transaction_mutation()
        require(self.vm_started is None, "SECOND_VM_PROHIBITED")
        self.vm_started = self.clock()

    def cleanup_permission(self, resource_id: str, positively_owned_ids: set[str]) -> None:
        require(resource_id.lower() in {value.lower() for value in positively_owned_ids},
                "CLEANUP_REQUIRES_POSITIVE_EXACT_OWNERSHIP")
        # Time exhaustion stops forward work, never deletion of positively owned state.
