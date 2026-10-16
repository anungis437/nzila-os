"""Deterministic future graph and explicit bootstrap-dependent dispositions."""

from decimal import Decimal
import json

from controller import PHASES
from prepare import HERE, ROOT, baseline, ensure, fresh, load, sha

SUBSCRIPTION = "5d819f33-d16f-429c-a3c0-5b0e94740ba3"
RG = "nzila-shared-test-g3-001-rg"


def price(filename, meter, name, unit, tier=0):
    path = HERE / "public" / filename
    value = load(path)
    ensure(not value.get("NextPageLink"), "PRICE_PAGINATION_REQUIRED_" + filename)
    values = [entry for entry in value["Items"] if entry["meterId"] == meter and
              entry["meterName"] == name and entry["unitOfMeasure"] == unit and
              entry["tierMinimumUnits"] == tier and entry["isPrimaryMeterRegion"]]
    ensure(len(values) == 1 and values[0]["currencyCode"] == "CAD", "EXACT_PRICE_BINDING_" + name)
    chosen = values[0]
    return {"source": str(path), "sourceSha256": sha(path), "meterId": meter, "meterName": name,
            "unit": unit, "rateCAD": str(chosen["retailPrice"]), "region": chosen["armRegionName"]}


def main():
    fresh("CONCURRENCY_CONTRACTS.json", baseline())
    prefix = "/subscriptions/" + SUBSCRIPTION + "/resourceGroups/" + RG
    resources = []
    def resource(name, kind, owner="G3A_TRANSACTION_OWNED", life="TRANSIENT", delete=True, location="canadacentral"):
        types, names = kind.split("/"), name.split("/")
        resource_id = prefix + "/providers/" + types[0]
        for resource_type, resource_name in zip(types[1:], names):
            resource_id += "/" + resource_type + "/" + resource_name
        resources.append({"name": name, "type": kind, "resourceIdExpression": resource_id,
                          "location": location, "ownership": owner, "lifecycle": life,
                          "create": owner == "G3A_TRANSACTION_OWNED", "update": owner == "G3A_TRANSACTION_OWNED",
                          "deleteByG3A": delete and owner == "G3A_TRANSACTION_OWNED",
                          "creationReceiptRequiredBeforeCleanup": True})
    resource(RG, "Microsoft.Resources/resourceGroups", "CONTROL_PLANE_BOOTSTRAP_OWNED", "RETAINED_FOR_G3B", False)
    resources[-1]["resourceIdExpression"] = prefix
    resource("nzila-g3-001-vnet", "Microsoft.Network/virtualNetworks",
             "CONTROL_PLANE_BOOTSTRAP_OWNED", "RETAINED_FOR_G3B", False)
    for subnet, cidr in (("apps", "10.91.0.0/27"), ("private-endpoints", "10.91.3.0/24"),
                         ("builders", "10.91.4.0/28"), ("probes", "10.91.5.0/28")):
        resource("nzila-g3-001-vnet/" + subnet, "Microsoft.Network/virtualNetworks/subnets",
                 "CONTROL_PLANE_BOOTSTRAP_OWNED", "RETAINED_FOR_G3B", False)
        resources[-1]["addressPrefix"] = cidr
    resource("nzilag3inputs001", "Microsoft.ContainerRegistry/registries")
    resource("nzila-g3-input-001-pe", "Microsoft.Network/privateEndpoints")
    resource("nzila-g3-target-001-pe", "Microsoft.Network/privateEndpoints")
    for name in ("nzila-g3-input-001-pe", "nzila-g3-target-001-pe"):
        resource(name + "/default", "Microsoft.Network/privateEndpoints/privateDnsZoneGroups")
    resource("privatelink.azurecr.io", "Microsoft.Network/privateDnsZones", location="global")
    resource("privatelink.azurecr.io/nzila-g3-001-link", "Microsoft.Network/privateDnsZones/virtualNetworkLinks",
             location="global")
    for name in ("nzila-g3-input-reader-001", "nzila-g3-build-push-001"):
        resource(name, "Microsoft.ManagedIdentity/userAssignedIdentities")
    resource("nzila-g3-builder-001-nsg", "Microsoft.Network/networkSecurityGroups")
    resource("nzila-g3-builder-001-nic", "Microsoft.Network/networkInterfaces")
    resource("nzila-g3-builder-001-osdisk", "Microsoft.Compute/disks")
    resource("nzila-g3-builder-001", "Microsoft.Compute/virtualMachines")
    resource("nzila-g3-builder-001/g3-bootstrap", "Microsoft.Compute/virtualMachines/extensions")
    resources[-1]["qualification"] = "BLOCKED_FIRST_BYTE_RUNTIME_AND_HANDLER_DELIVERY"
    for role in ("input-source-reader", "input-tooling-reader", "target-runtime-writer"):
        resource("guid(scope,principal,role,repository,NZ-20261008-INFRA-001-G3A):" + role,
                 "Microsoft.Authorization/roleAssignments")
        resources[-1]["nameIsDeterministicBicepExpression"] = True
        resources[-1]["scope"] = "EXISTING_TARGET_ACR" if role.startswith("target") else "G3_INPUT_ACR"
    fresh("G3A_RESOURCE_GRAPH.json", {
        "status": "DETERMINISTIC_DESIGN_NOT_DEPLOYED_NOT_COMPLETE_EXECUTABLE_PACKAGE",
        "resources": resources, "targetRegistry": "EXISTING_G2_ACR_NEVER_UPDATE_OR_DELETE",
        "targetApprovalConnectionOwnership": "CONTROL_PLANE_BOOTSTRAP_OWNED_DO_NOT_DELETE_EXISTING_CONNECTIONS",
        "identityBoundary": "SEPARATE_INPUT_READER_AND_BUILD_PUSH_UAMIS_PRESERVED",
        "vmImage": "Canonical:ubuntu-24_04-lts:server:24.04.202609040", "vmSku": "Standard_B2s",
        "disk": "StandardSSD_LRS_64GiB", "publicIp": None, "sshIngress": False,
        "namesMustBeProvenAbsentBeforeCreate": True, "targetPeExpectedSubnet": "10.91.3.0/24",
        "inputRegistryLifecycle": "G3A_CREATE_STAGE_LOCK_PRIVATE_READ_RETIRE_ON_G3A_SUCCESS",
        "producerStageMaximumHours": 2, "builderMaximumHours": 2, "transactionMaximumHours": 4,
        "inputRegistryPostState": "RETIRE", "G3A_FINAL_IMAGE_RETENTION": "RETAIN_IMMUTABLE",
        "existingG3NetworkPrecondition": "BOOTSTRAP_CREATES_AND_READBACK_PROVES_BEFORE_G3A_NO_G3A_MODIFICATION",
        "allDeletion": "ONLY_POSITIVE_CREATION_RECEIPTS_AND_EXACT_OWNED_IDS_NO_RG_CASCADE",
        "completeBicepMissing": "BOOTSTRAP_DEPENDENT_VM_CSE_AND_GUEST_CHANNEL_NO_PLACEHOLDER_TOP_LEVEL_EMITTED",
    })
    reader = "b93aa761-3e63-49ed-ac28-beffa264f7ac"
    writer = "2a1e307c-b015-4ebd-883e-5b7698a07328"
    fresh("G3A_ROLE_CONTRACT.json", {
        "conditionVersion": "2.0", "repositoryAttribute": "@Request[Microsoft.ContainerRegistry/registries/repositories:name]",
        "assignments": [
            {"module": "bicep/repository-reader.bicep", "principal": "inputReaderPrincipalId",
             "role": reader, "repository": "g3-build-source", "ownership": "G3A_TRANSACTION_OWNED"},
            {"module": "bicep/repository-reader.bicep", "principal": "inputReaderPrincipalId",
             "role": reader, "repository": "g3-build-tooling", "ownership": "G3A_TRANSACTION_OWNED"},
            {"module": "bicep/repository-writer.bicep", "principal": "finalPushPrincipalId",
             "role": writer, "repository": "g3-synthetic-runtime", "ownership": "G3A_TRANSACTION_OWNED"},
        ],
        "stagingProducerWriter": "G3A_TRANSACTION_OWNED_EXACT_TWO_INPUT_REPOSITORIES_REVOKE_BEFORE_BUILDER",
        "bootstrapDelegation": "CONTROL_PLANE_BOOTSTRAP_OWNED_G3A_NEVER_REMOVES",
        "registryWideFallback": False, "catalogReadGrant": False,
        "realGrantOperatorCapability": "UNPROVEN_SEPARATE_CONTROL_PLANE_GATE",
        "conditionLiveEnforcement": "NOT_RUN_FIXTURE_ONLY_NOT_RBAC_PROOF",
    })
    bootstrap = {
        "status": "BLOCKED", "firstByteModel": "BLOCKED",
        "pinnedImage": "Canonical:ubuntu-24_04-lts:server:24.04.202609040",
        "publisher": "Microsoft.Azure.Extensions", "type": "CustomScript", "handlerVersionCandidate": "2.1",
        "publicSettings": None, "protectedSettings": None, "inlineBytes": "UNRESOLVED", "exactCommand": None,
        "documentedScriptParameterLimit": "256_KB", "conservativeGuardLimitBytes": 256000,
        "requiredMaximumFraction": "0.5", "source": "public/CSE_LINUX.txt",
        "documentedManagedIdentityDownloader": "AZURE_BLOB_STORAGE_NOT_PROVEN_ACR_OAUTH_EXCHANGE",
        "pinnedVmPythonCurlRuntimeProof": "NOT_ON_FILE",
        "candidate": "CSE_INLINE_SHELL_TO_HASH_BOUND_SELF_CONTAINED_PRIVATE_ACR_READER",
        "candidateQualified": False,
        "remainingDependency": "A first executable/runtime delivery channel using only pinned VM-agent/CSE guarantees "
                               "and explicitly staged dependencies, with private ACR authentication, TLS CA trust, "
                               "handler delivery and inline size qualified; no Python/curl availability inferred.",
        "notClaimedImpossible": True, "newBlobStoreOrPublicUriChosen": False,
        "coreBinaryInlineNotAllowed": True, "packageInstallation": False,
        "transitiveEffects": ["guest runtime integration", "complete live controller", "complete VM/CSE Bicep",
                              "final payload/transport byte census", "all-in cost ceiling"],
    }
    fresh("G3A_BOOTSTRAP_CONTRACT.json", bootstrap)
    fresh("G3A_CONTROLLER_PHASE_CONTRACT.json", {
        "status": "FIXTURE_STATE_MACHINE_QUALIFIED_LIVE_ADAPTER_INCOMPLETE",
        "phases": list(PHASES), "count": len(PHASES), "singleUseAuthorityMaxRuns": 1,
        "authorityConsumption": "DURABLE_EXCLUSIVE_MARKER_BEFORE_FIRST_AZURE_MUTATION",
        "inputRegistryProducerLifecycle": "REQUIRES_PREPARATION_MUTATION_PHASE_ADAPTER_NOT_IMPLEMENTED",
        "failure": "STOP_LATER_PHASES_CLEANUP_ONLY_PROVEN_CREATED_IDS_RECORD_FAILURE_NO_MUTATION_RETRIES",
        "partialProvisioningAmbiguity": "DO_NOT_ASSUME_OWNERSHIP_RECONCILE_ID_AND_TAG_RECEIPT_BEFORE_DELETE",
        "collisionConcurrency": "FUTURE_AUTHORITY_REQUIRES_SERIALIZED_EXCLUSIVE_WRITER_TRANSACTION_NOT_ATOMIC_API_PROOF",
        "guestPipeline": "ACTUAL_READER_AND_BUILD_INVOCATION_PRIMITIVES_FIXTURE_TESTED_NO_GUEST_EXECUTION",
        "survivingBlocker": bootstrap["remainingDependency"],
        "completeAdapter": False, "liveExecutionEntryPoint": "DISABLED",
    })
    rates = {
        "registry": price("PRICE_ACR.json", "2f8e1105-47d0-4105-a934-b2175c766a71", "Premium Registry Unit", "1/Day"),
        "storage": price("PRICE_ACR.json", "6331e61c-1b44-4a10-9fb1-e9c0b470c4d5", "Data Stored", "1 GB/Month"),
        "pe": price("PRICE_PE_CORRECTED.json", "e6ab7238-e433-4fe0-a2b2-2b2564df2cdb", "Standard Private Endpoint", "1 Hour"),
        "vm": price("PRICE_VM_BOUND.json", "f024f557-b908-4e28-9f51-212ae32b97a3", "B2s", "1 Hour"),
        "disk": price("PRICE_DISK.json", "972f1c97-23fc-4aca-a9fb-91263bc6ba5d", "E10 LRS Disk", "1/Month"),
        "diskIO": price("PRICE_DISK.json", "df249cf3-71c9-5327-8738-56f65fa3fcda", "Disk Transactions LRS Disk Operations", "10K"),
        "dnsZone": price("PRICE_DNS.json", "0b608a26-f611-4232-8192-ce81b6b57194", "Private Zone", "1"),
        "dnsQuery": price("PRICE_DNS.json", "46cff9cb-4b15-4af0-bf41-25143827fef8", "Private Queries", "1M"),
        "peIngress": price("PRICE_PE_PROCESSING.json", "10caa28b-6479-4852-9eb7-610870cb6417",
                           "Standard Data Processed - Ingress", "1 GB"),
        "peEgress": price("PRICE_PE_PROCESSING.json", "e7f162f6-7cb8-4cea-ad4f-12cdb5dda25b",
                          "Standard Data Processed - Egress", "1 GB"),
        "trafficConservative": price("PRICE_BANDWIDTH_PAGE2.json", "b9668c9e-b531-5273-b220-9bb4bbdfe268",
                                     "Standard Data Transfer Out", "1 GB"),
    }
    amounts = {
        "inputRegistryConservativeOneDay": Decimal(rates["registry"]["rateCAD"]),
        "inputStorage0_5GBOneDayUpperBound": Decimal(rates["storage"]["rateCAD"]) * Decimal("0.5") / 30,
        "twoPrivateEndpoints4Hours": Decimal(rates["pe"]["rateCAD"]) * 2 * 4,
        "builderTwoHours": Decimal(rates["vm"]["rateCAD"]) * 2,
        "osDiskOneDayUpperBound": Decimal(rates["disk"]["rateCAD"]) / 30,
        "diskOperations100000": Decimal(rates["diskIO"]["rateCAD"]) * 10,
        "oneDnsZoneConservativeFullMonth": Decimal(rates["dnsZone"]["rateCAD"]),
        "dns10000Queries": Decimal(rates["dnsQuery"]["rateCAD"]) / 100,
        "finalImageOneMonthIncrementalStorage": Decimal(rates["storage"]["rateCAD"]) * Decimal(3309418) / Decimal(10**9),
        "peIngress2GBBound": Decimal(rates["peIngress"]["rateCAD"]) * 2,
        "peEgress2GBBound": Decimal(rates["peEgress"]["rateCAD"]) * 2,
        "artifactTransfer2GBConservativeBound": Decimal(rates["trafficConservative"]["rateCAD"]) * 2,
    }
    fresh("G3A_COST_MODEL.json", {
        "currency": "CAD", "status": "PRICED_COMPONENT_SUBTOTAL_NOT_ALL_IN",
        "rates": rates, "amountsCAD": {name: str(value) for name, value in amounts.items()},
        "knownComponentSubtotalCAD": str(sum(amounts.values())),
        "G3A_EXPECTED_COST_CAD": "UNRESOLVED", "G3A_COST_CEILING_CAD": "UNRESOLVED",
        "minimumCeilingMultiplier": "1.5",
        "maximumHours": {"stageAndLock": 2, "builder": 2, "G3ATransaction": 4},
        "resourceQuantityBounds": {"inputBytes": 265080538, "provisionalInputStorageGB": "0.5",
                                  "PEs": 2, "VMs": 1, "DNSZones": 1, "DNSQueries": 10000,
                                  "diskGiB": 64, "diskOperations": 100000, "finalImageBytes": 3309418,
                                  "trafficGBEachDirectionBound": 2},
        "notProvenEnoughToRun": True,
        "materialUnpriced": ["first-byte channel/bootstrap-dependent delivery bytes/resources"],
        "trafficRateTreatment": "CONSERVATIVE_NORTH_AMERICA_TRANSFER_OUT_BOUND_NOT_CLAIM_SAME_REGION_IS_BILLED",
        "excluded": {"G3B": True, "G2BaseFirewall": True, "LAW": "NOT_USED",
                     "PublicIP": "NOT_CREATED", "NIC_NSG_UAMI": "NO_STANDALONE_HOURLY_METER"},
        "inputRegistryTransactionMeter": "INCLUDED_REGISTRY_SKU_NO_SEPARATE_TASK_COMPUTE_SELECTED",
        "inputAllowanceAssumed": False, "retention": "INPUT_REGISTRY_RETIRE_FINAL_IMAGE_RETAIN_IMMUTABLE",
        "retainedImageMonthlyScope": "INCREMENTAL_IMAGE_ONLY_NOT_ENTIRE_ACR_BASE_FEE",
        "budgetEnforcement": "FUTURE_CONTROLLER_MUST_ENFORCE_QUANTITIES_AND_DURATIONS_BEFORE_FIRST_MUTATION",
    })
    print("BOOTSTRAP_BLOCKER_RECORDED_WITH_DEPENDENT_PACKAGE_CONTROLLER_AND_COST_LIMITS")


if __name__ == "__main__":
    main()
