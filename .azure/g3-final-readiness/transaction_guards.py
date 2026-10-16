"""Offline acceptance/ownership guards, not an executable Azure controller."""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import re

SUB = "5d819f33-d16f-429c-a3c0-5b0e94740ba3"
G3_GROUP = "/subscriptions/" + SUB + "/resourceGroups/nzila-shared-test-g3-001-rg"
ENVIRONMENT = G3_GROUP + "/providers/Microsoft.App/managedEnvironments/nzila-g3-test-001-env"
QUOTA_URL = "https://management.azure.com" + ENVIRONMENT + "/usages?api-version=2025-07-01"
REQUIRED_CORES = Decimal("1.0")


class GateFailure(RuntimeError):
    pass


def require(value, code):
    if not value:
        raise GateFailure(code)


def consumption_gate(environment_id, response):
    require(environment_id == ENVIRONMENT, "QUOTA_ENVIRONMENT_BINDING")
    require(isinstance(response, dict) and not response.get("nextLink"), "QUOTA_INCOMPLETE")
    rows = response.get("value")
    require(isinstance(rows, list), "QUOTA_SCHEMA")
    rows = [row for row in rows if isinstance(row, dict) and
            isinstance(row.get("name"), dict) and
            row["name"].get("value") == "ManagedEnvironmentConsumptionCores"]
    require(len(rows) == 1 and rows[0].get("unit") == "Count", "QUOTA_CONSUMPTION_COUNTER")
    row = rows[0]
    for field in ("limit", "currentValue"):
        require(type(row.get(field)) in (int, float), "QUOTA_NONNUMERIC")
    try:
        limit, used = Decimal(str(row["limit"])), Decimal(str(row["currentValue"]))
    except InvalidOperation as error:
        raise GateFailure("QUOTA_NONNUMERIC") from error
    require(limit.is_finite() and used.is_finite() and 0 <= used <= limit, "QUOTA_INVALID")
    require(limit - used >= REQUIRED_CORES, "QUOTA_INSUFFICIENT")
    return {"scope": environment_id, "status": "PASS", "requiredAvailableCores": str(REQUIRED_CORES),
            "headroomCores": str(limit - used), "workloadCores": "0.25", "reserveCores": "0.75"}


@dataclass(frozen=True)
class OwnedResource:
    resource_id: str
    classification: str
    transaction_id: str
    preflight_absent: bool


def cleanup_ids(resources, transaction_id):
    require(bool(re.fullmatch(r"g3-[0-9a-f]{32}", transaction_id)), "TRANSACTION_ID_INVALID")
    seen, owned = set(), []
    for resource in resources:
        normalized = resource.resource_id.lower()
        require(normalized not in seen, "OWNERSHIP_DUPLICATE")
        seen.add(normalized)
        require(resource.classification in {"TRANSACTION_CREATED", "PREEXISTING_REFERENCED"},
                "OWNERSHIP_UNKNOWN")
        if resource.classification == "PREEXISTING_REFERENCED":
            continue
        require(resource.transaction_id == transaction_id and resource.preflight_absent,
                "OWNERSHIP_NOT_PROVEN")
        require(normalized.startswith(G3_GROUP.lower() + "/providers/"), "OWNERSHIP_OUTSIDE_G3")
        require("/providers/microsoft.authorization/roleassignments/" not in normalized,
                "OWNERSHIP_ROLE_REQUIRES_SEPARATE_EXACT_LEDGER")
        owned.append(resource.resource_id)
    return sorted(owned, key=lambda value: (-value.count("/"), value))


def invoke_once(operation):
    """A terminal error never causes another transaction attempt."""
    return operation()


def authorization_denied(status, tls_verified, identity_bound, target_bound, transport_error=None):
    require(transport_error is None and tls_verified and identity_bound and target_bound,
            "NEGATIVE_TRANSPORT_OR_BINDING_INCONCLUSIVE")
    require(status in (401, 403), "NEGATIVE_NOT_AUTHORIZATION_DENIAL")
    return "DENIED"


def ceiling(expected, proposed):
    require(expected.is_finite() and proposed.is_finite() and expected >= 0, "COST_INVALID")
    require(proposed >= expected * Decimal("1.5"), "COST_CONTINGENCY_INSUFFICIENT")
    return proposed


def retained_artifact_cost(blob_bytes):
    require(type(blob_bytes) is int and blob_bytes > 0, "ARTIFACT_SIZE_INVALID")
    return Decimal(blob_bytes) / Decimal(10**9) * Decimal("0.141655")
