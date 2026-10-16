"""Bounded CAD component scenario, expressly not an all-in execution estimate."""

from decimal import Decimal
import hashlib
import json
from pathlib import Path

from transaction_guards import retained_artifact_cost

HERE = Path(__file__).resolve().parent
METERS = {
    "activeCPU": ("c064b5f6-a623-55d5-8f04-942be79fc8e7", "0.000048"),
    "activeMemory": ("4113d31b-2df1-5456-86de-3b5ef8ed27f4", "0.000006"),
    "requests": ("9d5ac783-0d6a-5ced-812a-e31662edde9e", "0.56662"),
    "vm": ("f024f557-b908-4e28-9f51-212ae32b97a3", "0.065728"),
    "disk": ("98ee9c79-09a8-4442-94d5-8208faf8c5ce", "7.479384"),
    "dnsZones": ("0b608a26-f611-4232-8192-ce81b6b57194", "0.708275"),
    "dnsQueries": ("46cff9cb-4b15-4af0-bf41-25143827fef8", "0.56662"),
    "lb": ("27827eb0-7f60-4928-940b-f5fe15e7a4cb", "0.035414"),
    "providerEgressIP": ("9c150bf9-2bad-430e-a53c-c213804f49ef", "0.007083"),
    "logs": ("6c00b68b-125b-42cf-9085-af9f4ab7a044", "3.909678"),
    "acrStorage": ("6331e61c-1b44-4a10-9fb1-e9c0b470c4d5", "0.141655"),
}


def rows(value):
    if isinstance(value, dict):
        if "meterId" in value:
            yield value
        for child in value.values():
            yield from rows(child)
    elif isinstance(value, list):
        for child in value:
            yield from rows(child)


def model():
    files = [HERE.parent / "g3-live-readiness" / name for name in (
        "PUBLIC_CAD_PRICING.json", "PUBLIC_CAD_PRICING_SUPPLEMENTAL.json",
        "PUBLIC_CAD_PRICING_INFRASTRUCTURE.json",
    )]
    files.append(HERE.parent / "g3-readiness" / "PUBLIC_CAD_PRICING_OBSERVATIONS.json")
    bindings = {}
    for name, (meter, expected) in METERS.items():
        matches = [
            (path, row) for path in files for row in rows(json.loads(path.read_text()))
            if row.get("meterId") == meter and row.get("currencyCode") == "CAD"
            and row.get("isPrimaryMeterRegion") is True
            and row.get("armRegionName") in ("canadacentral", "Global", "")
            and Decimal(str(row.get("retailPrice"))) == Decimal(expected)
        ]
        if not matches:
            raise RuntimeError("CAD_PRIMARY_METER_NOT_BOUND: " + name)
        path, row = matches[0]
        bindings[name] = {
            "source": str(path.relative_to(HERE.parent)),
            "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "meterId": meter, "meterName": row["meterName"],
            "unit": row["unitOfMeasure"], "region": row["armRegionName"], "rateCAD": expected,
        }
    rate = lambda name: Decimal(bindings[name]["rateCAD"])
    qualification = json.loads((HERE / "local-image-frozen" / "LOCAL_IMAGE_QUALIFICATION.json").read_text())
    image_bytes = qualification["observations"][0]["imageBlobBytes"]
    components = {
        "ACA_vCPU_4h_0.25": rate("activeCPU") * 4 * 3600 * Decimal(".25"),
        "ACA_memory_4h_0.5GiB": rate("activeMemory") * 4 * 3600 * Decimal(".5"),
        "ACA_10000_requests": rate("requests") * Decimal(".01"),
        "builder_B2s_2h_and_probe_B2s_4h": rate("vm") * 6,
        "two_E6_disks_6h_total_prorated_730h": rate("disk") * 6 / 730,
        "three_DNS_zones_full_month_budget": rate("dnsZones") * 3,
        "DNS_10000_queries": rate("dnsQueries") * Decimal(".01"),
        "one_provider_Standard_LB_4h": rate("lb") * 4,
        "one_provider_Standard_static_egress_IP_4h": rate("providerEgressIP") * 4,
        "logs_0.1GB": rate("logs") * Decimal(".1"),
        "ACR_image_one_full_month_billable_storage_bound": retained_artifact_cost(image_bytes),
    }
    return {
        "currency": "CAD", "status": "PARTIAL_NOT_ALL_IN",
        "scenario": {"G3A_hours": 2, "G3B_hours": 4, "totalSequentialHours": 6,
                     "builderVMs": 1, "probeVMs": 1, "proposedDiskGiBEach": 64,
                     "imageVersionAndInputDelivery": "UNBOUND_NOT_EXECUTABLE",
                     "noTaxesDiscountsOrFreeGrantAssumed": True},
        "meterBindings": bindings,
        "pricedComponentsCAD": {name: str(value) for name, value in components.items()},
        "pricedSubtotalNotTotalCAD": str(sum(components.values(), Decimal(0))),
        "unresolvedComponents": [
            "private source/compiler/artifact delivery channel resources, permissions and transfer bounds",
            "private probe/bootstrap runner transport and exact VM image contract",
            "Standard Key Vault secret operation meter mapping without substituting Premium label",
            "final counted private endpoint hours, ingress/egress bytes and LB processing",
            "ACR data transfer/transaction billing treatment for the selected delivery channel",
        ],
        "incrementalFirewallCAD": "0_NOT_SELECTED_OPTION_C",
        "G2BaselineCharges": "PREEXISTING_SUNK_EXCLUDED",
        "G3_EXPECTED_PROOF_COST_CAD": "UNRESOLVED",
        "G3_PROOF_COST_CEILING_CAD": "UNRESOLVED",
        "minimumFutureContingencyMultiplier": "1.5",
        "retainedStateCandidate": {
            "allTransactionCreatedG3ResourcesDeleted": "PROPOSED_NOT_EXECUTED",
            "registryArtifactRetained": "ONE_MANIFEST_CONFIG_AND_REFERENCED_LAYERS",
            "qualifiedBlobBytes": image_bytes,
            "newArtifactOnlyBillableUpperBoundCADPerMonth": str(retained_artifact_cost(image_bytes)),
            "unitConvention": "decimal_GB_conservative_relative_to_GiB",
            "includedACRStorageAllowanceAssumed": False,
            "softDeletedVaultTombstoneDays": 90,
            "additionalLiveVaultPE_DNS_LB_IP_VM_LAW_ACACharges": "0_ONLY_IF_EXACT_TEARDOWN_PROVEN",
            "notCurrentAzureSteadyState": True,
        },
    }


if __name__ == "__main__":
    value = model()
    with (HERE / "COST_MODEL.json").open("x", encoding="utf-8") as file:
        json.dump(value, file, indent=2)
        file.write("\n")
    print("COST_MODEL = PARTIAL_NOT_ALL_IN; no proof ceiling authorized")
