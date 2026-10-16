"""Source-bound first-byte qualification and non-executable proof preparation."""

from decimal import Decimal, ROUND_CEILING
from html.parser import HTMLParser
import re
from urllib.parse import parse_qs, urlsplit

from collect import HERE, CURRENT, TAGGED, baseline, ensure, fresh, load, sha


class PageText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def text_page(name):
    parser = PageText()
    parser.feed((HERE / "public" / name).read_text(encoding="utf-8"))
    return " ".join(" ".join(parser.parts).split())


def source(label, path):
    return (HERE / "public" / (label + "_" + path.replace("/", "_"))).read_text(encoding="utf-8")


def qualify(label):
    files = source(label, "main/files.go")
    save = source(label, "pkg/download/save.go")
    execute = source(label, "main/exec.go")
    cmds = source(label, "main/cmds.go")
    main = source(label, "main/main.go")
    msi = source(label, "pkg/download/blobwithmsitoken.go")
    ensure("const mode = 0500" in files and "download.SaveTo(ctx, dl, fp, mode)" in files,
           "DOWNLOADED_FILE_EXECUTE_MODE_UNPROVEN")
    ensure("os.OpenFile(dst, os.O_WRONLY|os.O_TRUNC|os.O_CREATE, mode)" in save, "MODE_NOT_APPLIED")
    ensure('exec.Command("/bin/sh", "-c", cmd)' in execute and "c.Dir = workdir" in execute,
           "COMMAND_EXECUTION_UNPROVEN")
    ensure("if cfg.SkipDos2Unix == false {" in files and "err = postProcessFile(fp)" in files,
           "BYTE_TRANSFORMATION_GUARD_UNPROVEN")
    ensure("fn, err := urlToFileName(url)" in files and "filepath.Join(downloadDir, fn)" in files and
           'strings.Split(u.Path, "/")' in files and "u, err := url.Parse(fileURL)" in files,
           "BASENAME_WITHOUT_QUERY_UNPROVEN")
    ensure('dataDir = "/var/lib/waagent/custom-script"' in main and 'downloadDir = "download"' in main and
           'filepath.Join(dataDir, downloadDir, fmt.Sprintf("%d", seqNum))' in cmds,
           "DOWNLOAD_WORKDIR_UNPROVEN")
    ensure("ExecCmdInDir(cmd, dir)" in cmds and "cfg.protectedSettings.CommandToExecute" in cmds,
           "PROTECTED_COMMAND_NOT_WIRED")
    ensure("download.IsAzureStorageBlobUri(fileURL) && managedIdentity != nil" in files and
           "download.NewBlobWithMsiDownload(fileURL, msiProvider)" in files and
           "download.NewURLDownload(fileURL)" in files, "MANAGED_BLOB_DOWNLOAD_UNPROVEN")
    ensure("http.NewRequest(http.MethodGet, self.url, nil)" in msi and
           "request.Header.Set(xMsVersionHeaderName, xMsVersionValue)" in msi,
           "MSI_REQUEST_URI_VERSION_UNPROVEN")
    api = re.search(r'xMsVersionValue\s*=\s*"([0-9-]+)"', msi)
    ensure(api is not None, "MSI_API_VERSION_UNBOUND")
    return {"label": label, "commit": CURRENT if label == "CURRENT" else TAGGED,
            "downloadedFileCreationMode": "0500", "externalChmodRequired": False,
            "workingDirectory": "/var/lib/waagent/custom-script/download/<seqnum>",
            "filename": "LAST_URL_PATH_SEGMENT_QUERY_EXCLUDED", "command": "/bin/sh -c",
            "skipDos2UnixLocation": "publicSettings", "skipDos2UnixRequired": True,
            "managedIdentityLocation": "protectedSettings", "msiStorageApi": api.group(1),
            "queryForwarding": "ORIGINAL_URL_PASSED_TO_HTTP_REQUEST",
            "anonymousAttempt": "SAME_PRIVATE_BLOB_URI_BEFORE_MSI_NOT_A_PUBLIC_FALLBACK",
            "readDownloadRetries": "HANDLER_INTERNAL_READ_RETRIES_EXIST",
            "transactionRetries": "NOT_AUTHORIZED",
            "proofScope": "SOURCE_BOUND_NOT_INSTALLED_AZURE_HANDLER_OR_LIVE_VM"}


def validate_version_uri(uri, storage_api):
    parsed = urlsplit(uri)
    ensure(parsed.scheme == "https" and parsed.hostname == "nzilag3bootstrap001.blob.core.windows.net" and
           parsed.path == "/bootstrap/g3a-bootstrap" and not parsed.fragment and
           parsed.username is None and parsed.password is None and parsed.port in (None, 443),
           "BOOTSTRAP_URI_BOUNDARY")
    query = parse_qs(parsed.query, keep_blank_values=True)
    ensure(set(query) == {"versionid"} and len(query["versionid"]) == 1 and query["versionid"][0],
           "EXACT_VERSION_IDENTIFIER_REQUIRED_NO_SAS")
    ensure(storage_api >= "2019-12-12", "CSE_MSI_VERSIONID_NOT_DOCUMENTED_FOR_2018_API")
    return parsed.path.rsplit("/", 1)[1]


def price_binding(meter_name):
    path = HERE / "public" / "PRICE_BLOB_PAGE1.json"
    candidates = [item for item in load(path)["Items"] if item["productName"] == "Blob Storage" and
                  item["meterName"] == meter_name and item["skuName"] == "Hot LRS" and
                  item["isPrimaryMeterRegion"] and item["tierMinimumUnits"] == 0]
    ensure(len(candidates) == 1, "PRIMARY_STORAGE_PRICE_BINDING_NOT_UNIQUE")
    item = candidates[0]
    v2path = HERE / "public" / "PRICE_STORAGE_V2_PAGE1.json"
    aliases = [entry for entry in load(v2path)["Items"] if entry["productName"] == "General Block Blob v2" and
               entry["skuName"] == "Hot LRS" and entry["meterId"] == item["meterId"] and
               entry["tierMinimumUnits"] == 0 and entry["unitOfMeasure"] == item["unitOfMeasure"] and
               entry["retailPrice"] == item["retailPrice"]]
    ensure(aliases and item["currencyCode"] == "CAD" and item["armRegionName"] == "canadacentral",
           "STORAGEV2_PRIMARY_SHARED_METER_NOT_PROVEN")
    return {"source": str(path), "sourceSha256": sha(path), "meterId": item["meterId"],
            "meterName": item["meterName"], "unit": item["unitOfMeasure"],
            "rateCAD": str(item["retailPrice"]), "region": item["armRegionName"],
            "primaryMeter": True, "StorageV2AliasSource": str(v2path),
            "StorageV2AliasSourceSha256": sha(v2path),
            "aliasBasis": "SAME_METER_ID_RATE_UNIT_ZERO_TIER_GP_V2_NONPRIMARY_ALIAS_TO_PRIMARY"}


def proof_cost():
    prior = load(HERE.parent / "g3a-transaction" / "G3A_COST_MODEL.json")
    rates = {name: prior["rates"][name] for name in
             ("pe", "vm", "disk", "diskIO", "dnsZone", "dnsQuery", "peIngress", "peEgress",
              "trafficConservative")}
    for name, meter in (("blobStorage", "Hot LRS Data Stored"), ("blobWrite", "Hot LRS Write Operations"),
                        ("blobRead", "Hot Read Operations"), ("blobOther", "All Other Operations")):
        rates[name] = price_binding(meter)
    value = {name: Decimal(item["rateCAD"]) for name, item in rates.items()}
    amounts = {
        "onePE4Hours": value["pe"] * 4,
        "oneB2s2Hours": value["vm"] * 2,
        "oneE10DiskOneDay": value["disk"] / 30,
        "diskOperations100000": value["diskIO"] * 10,
        "onePrivateDnsZoneConservativeFullMonth": value["dnsZone"],
        "dnsQueries10000": value["dnsQuery"] / 100,
        "blobStorage0_1GBConservativeFullMonth": value["blobStorage"] / 10,
        "blobWriteAndContainerOps10000": value["blobWrite"],
        "blobReads10000": value["blobRead"],
        "blobOtherOps10000": value["blobOther"],
        "privateLinkIngress0_1GB": value["peIngress"] / 10,
        "privateLinkEgress0_1GB": value["peEgress"] / 10,
        "conservativeTransfer0_1GB": value["trafficConservative"] / 10,
    }
    total = sum(amounts.values())
    ceiling = (total * Decimal("1.5")).to_integral_value(rounding=ROUND_CEILING)
    return {"status": "SEPARATE_BOOTSTRAP_PROOF_CONSERVATIVE_SCENARIO_NOT_AUTHORIZED",
            "currency": "CAD", "rates": rates, "amountsCAD": {key: str(value) for key, value in amounts.items()},
            "conservativeExpectedProofCAD": str(total), "candidateProofCeilingCAD": str(ceiling),
            "minimumCeilingMultiplier": "1.5",
            "quantityBounds": {"VMHours": 2, "PEHours": 4, "maxProofHours": 4, "producerWindowHours": 2,
                               "probeBinaryBytesMaximum": 10485760, "measuredProbeBinaryBytes": "UNRESOLVED",
                               "storageIncludingVersionsGBMaximum": "0.1", "storageBilledMonthsBound": 1,
                               "DNSZones": 1, "DNSQueriesMaximum": 10000,
                               "writeAndContainerOpsMaximum": 10000, "readOpsMaximum": 10000,
                               "otherOpsMaximum": 10000, "diskOperationsMaximum": 100000,
                               "trafficGBEachDirectionMaximum": "0.1"},
            "includes": ["PUBLIC_PRODUCER_STAGING_INSIDE_FOUR_HOUR_PE_BOUND",
                         "VM_AGENT_CSE_TIME_INSIDE_TWO_HOUR_VM_BOUND",
                         "VERSIONS_STORAGE_WITHIN_0_1GB_BOUND"],
            "excluded": {"ACR": "NO_REGISTRY_CREATED_OR_CONTACTED", "G3AImageBuild": "PROHIBITED",
                         "G3B": "PROHIBITED", "publicIP": "NOT_CREATED", "LAW": "NOT_USED",
                         "NIC_NSG_UAMI_RBAC": "NO_SEPARATE_HOURLY_METER_SELECTED",
                         "preexistingNetwork": "CONTROL_PLANE_BOOTSTRAP_PREREQUISITE_NOT_MUTATED",
                         "taxAndCurrencyVariance": "NOT_RETAIL_RESOURCE_METERS"},
            "conditions": ["PREEXISTING_APPROVED_PRIVATE_NETWORK_REQUIRED",
                           "MEASURE_AND_BIND_ACTUAL_PROBE_BYTES_BEFORE_ISSUING_AUTHORITY",
                           "NO_EXTRA_RESOURCE_OR_DIAGNOSTIC_SERVICE_WITHOUT_REPRICE",
                           "STOP_AT_DURATION_OR_QUANTITY_BOUNDS",
                           "CLEANUP_FAILURE_NOT_A_LICENSE_FOR_UNBOUNDED_RETENTION"],
            "G3A_EXPECTED_COST_CAD": "UNRESOLVED", "G3A_COST_CEILING_CAD": "UNRESOLVED"}


def main():
    fresh("CONCURRENCY_CONTRACTS.json", baseline())
    proofs = [qualify(label) for label in ("CURRENT", "V2_1_17")]
    docs = text_page("GET_BLOB.html")
    ensure(re.search(r"versionid.{0,100}2019-12-12 and later", docs), "OFFICIAL_VERSIONID_SUPPORT_NOT_BOUND")
    cse = text_page("CSE_LINUX.html")
    ensure("256 KB" in cse and "Azure Storage private blobs" in cse and "/bin/sh" in cse,
           "OFFICIAL_CSE_CONTRACT_NOT_BOUND")
    ensure(any(item["name"] == "v2.1.17" and item["commit"]["sha"] == TAGGED
               for item in load(HERE / "public" / "TAGS.json")), "TAG_SOURCE_BINDING_CHANGED")
    ensure(load(HERE / "public" / "CURRENT_COMMIT.json")["sha"] == CURRENT, "CURRENT_SOURCE_BINDING_CHANGED")
    fresh("CSE_SOURCE_QUALIFICATION.json", {
        "G3A_CSE_DOWNLOADED_BINARY_EXECUTION": "PROVEN", "scope": "DIRECT_EXECUTION_SOURCE_SEMANTICS_ONLY",
        "sources": proofs, "directCommandCandidate": "exec ./g3a-bootstrap",
        "freshDownloadDirectoryRequired": True, "existingFileModeNotCorrectedByOpenFile": True,
        "guestFilesystemMustPermitExecution": True, "externalChmodRequired": False,
        "noPythonCurlJqTarOpenSSLAssumption": True, "wrapperNeededForPermissions": False,
        "firstBootstrapPreExecutionShaValidationClaimed": False,
        "currentSourceOptionalAllowlist": "NOT_CONFIGURED_NOT_CLAIMED_FOR_TAGGED_CANDIDATE",
        "documentedVersionIdMinimumStorageApi": "2019-12-12",
        "candidateManagedDownloaderStorageApi": "2018-03-28",
        "immutableVersionedManagedDownload": "UNPROVEN_API_VERSION_CONTRACT_MISMATCH",
        "serverWouldRejectOrIgnoreVersionId": "NOT_TESTED_NOT_ASSERTED",
        "sourceTagIsInstalledAzurePackageProof": False,
        "immutableSnapshotAlternative": "NOT_SELECTED_OR_QUALIFIED_DO_NOT_SILENTLY_SUBSTITUTE",
        "firstByteOutcome": "REQUIRES_LIVE_BOOTSTRAP_PROOF",
    })
    fresh("BOOTSTRAP_CANDIDATE_CONTRACTS.json", {
        "status": "DESIGN_ONLY_NOT_COMPLETE_EXECUTABLE_PACKAGE",
        "storage": {"accountNameCandidate": "nzilag3bootstrap001", "kind": "StorageV2",
                    "sku": "Standard_LRS", "accessTier": "Hot", "location": "canadacentral",
                    "httpsOnly": True, "minimumTLS": "TLS1_2", "sharedKeyAllowed": False,
                    "publicBlobAccessAllowed": False, "publicNetworkDuringConsumption": "Disabled",
                    "container": "bootstrap", "containerPublicAccess": "None", "versioning": True,
                    "object": "g3a-bootstrap", "objectPurpose": "FIRST_EXECUTABLE_ONLY",
                    "postState": "DELETE", "exactImmutableIdentifierStatus": "UNPROVEN",
                    "scopeReady": False, "noSourceCompilerImageCustomerData": True},
        "object": {"architecture": "linux/amd64", "formatRequired": "STATIC_ELF_NO_INTERPRETER",
                   "bytes": "UNRESOLVED", "sha256": "UNRESOLVED", "sourceArchiveSha256": "UNRESOLVED",
                   "toolchainSha256": "UNRESOLVED", "blobVersionIdentifier": "UNRESOLVED",
                   "contentType": "application/octet-stream", "binaryPrepared": False,
                   "responsibilities": ["BOUNDED_PROVENANCE", "IMDS_BOUND_UAMI",
                                        "PRIVATE_ACR_INPUT_TOKEN", "HASH_BOUND_CONTROLLER_PAYLOAD",
                                        "VERIFY_BEFORE_EXEC", "NO_TOKEN_EVIDENCE"]},
        "privatePath": {"subnet": "10.91.3.0/24", "builderSubnet": "10.91.4.0/28",
                        "dnsZone": "privatelink.blob.core.windows.net", "groupId": "blob",
                        "VNet": "nzila-g3-001-vnet", "PE": "nzila-g3-bootstrap-001-pe",
                        "link": "nzila-g3-bootstrap-001-link",
                        "publicFallbackAllowed": False, "guestResolutionProven": False,
                        "exactResourceDeploymentBindings": "NOT_GENERATED_STOP_BOUNDARY"},
        "roles": {"builder": "Storage Blob Data Reader", "builderScope": "EXACT_BOOTSTRAP_CONTAINER",
                  "producer": "Storage Blob Data Contributor", "producerScope": "EXACT_BOOTSTRAP_CONTAINER",
                  "producerPostVerification": "REVOKE_BEFORE_VM_CONSUMPTION",
                  "builderMustNeverWrite": True, "storageKeysOrNormalSAS": "PROHIBITED",
                  "G2Identity": "PROHIBITED"},
        "staging": ["CREATE", "AUTHENTICATED_WRITE", "VERIFY", "LOCKDOWN", "PRIVATE_CONSUME"],
        "ownership": {"classification": "G3A_TRANSACTION_OWNED",
                      "deleteOnlyPositiveCreationReceipts": True,
                      "ownedResources": ["STORAGE_ACCOUNT", "CONTAINER", "BLOB_PE", "NEW_DNS_ZONE",
                                         "NEW_DNS_LINK_RECORDS_ZONE_GROUP", "PRODUCER_ROLE", "BUILDER_READER_ROLE"],
                      "existingSharedNetworkOrDnsDeletion": "PROHIBITED"},
        "CSE": {"publisher": "Microsoft.Azure.Extensions", "type": "CustomScript",
                "handlerSourceCandidate": "v2.1.17", "sourceCommit": TAGGED,
                "publishedAzureHandlerVersionBinding": "UNPROVEN_NO_AZURE_QUERY",
                "autoUpgradeMinorVersion": False, "automaticUpgradeEnabled": False,
                "publicSettingsCandidate": {"skipDos2Unix": True},
                "protectedSettingsCandidate": {"fileUris": "EXACT_IMMUTABLE_BLOB_URI_UNRESOLVED",
                                              "managedIdentity": "EXACT_ONE_CLIENT_ID_UNRESOLVED",
                                              "commandToExecute": "exec ./g3a-bootstrap"},
                "settingsExecutable": False, "timestamp": "PROHIBITED",
                "script": "NOT_USED", "inlineBinary": "PROHIBITED",
                "failedExtensionConsumesAttempt": True},
        "tagsRequired": ["product", "environment", "service", "owner", "cost_center", "data_classification"],
        "platformTransportTrust": ["STORAGE_TLS", "PRIVATE_ENDPOINT", "PRIVATE_DNS", "UAMI_RBAC",
                                   "PROVEN_IMMUTABLE_OBJECT_IDENTIFIER", "CSE_MANAGED_DOWNLOAD"],
        "applicationSupplyChainTrust": "EVERY_SUBSEQUENT_CONTROLLER_INPUT_SHA_VERIFIED_BEFORE_USE",
    })
    fresh("BOOTSTRAP_PROOF_COST_MODEL.json", proof_cost())
    fresh("FIRST_BYTE_DISPOSITION.json", {
        "G3_EXECUTION_READINESS": "BLOCKED", "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED",
        "G3A_BUILD_CONTROLLER_CORE": "QUALIFIED",
        "G3A_PRIVATE_INPUT_READER_INTEGRATION": "QUALIFIED", "G3A_REGISTRY_UPLOADER": "QUALIFIED",
        "G3A_UPLOADER_NO_RETRY": "PASS", "G3A_COLLISION_GUARD": "PASS",
        "G3A_MANIFEST_UPLOAD_BYTES_EXACT": "PASS",
        "G3A_FIRST_BYTE_BOOTSTRAP_MODEL": "CSE_MANAGED_IDENTITY_PRIVATE_BLOB",
        "G3A_BOOTSTRAP_STORAGE_CONTRACT": "BLOCKED", "G3A_BOOTSTRAP_BINARY_CONTRACT": "BLOCKED",
        "G3A_FIRST_BYTE_TRUST_MODEL": "PLATFORM_TRANSPORT_BOUND",
        "G3A_FIRST_BYTE_TRUST_MODEL_SCOPE": "DESIGN_ONLY_IMMUTABLE_OBJECT_BINDING_NOT_QUALIFIED",
        "G3A_CSE_DOWNLOADED_BINARY_EXECUTION": "PROVEN",
        "G3A_CSE_DOWNLOADED_BINARY_EXECUTION_SCOPE": "PINNED_SOURCE_SEMANTICS_NOT_LIVE_GUEST",
        "G3A_FIRST_BYTE_BOOTSTRAP": "REQUIRES_LIVE_BOOTSTRAP_PROOF",
        "G3A_BOOTSTRAP_PRIVATE_PATH": "BLOCKED", "G3A_BOOTSTRAP_PRODUCER_ROLE_CONTRACT": "READY",
        "G3A_BOOTSTRAP_PRODUCER_ROLE_CONTRACT_SCOPE": "EXACT_CONTAINER_LEAST_PRIVILEGE_DESIGN_ONLY",
        "G3A_CSE_CONTRACT": "BLOCKED", "G3A_CSE_SETTINGS_CONTRACT": "BLOCKED",
        "G3A_BOOTSTRAP_BINARY_BYTES": "UNRESOLVED", "G3A_BOOTSTRAP_WRAPPER_BYTES": "NOT_USED",
        "G3A_BOOTSTRAP_INLINE_BINARY": "PROHIBITED", "G3A_INLINE_SCRIPT_BYTES": "NOT_USED",
        "G3A_INLINE_SCRIPT_SIZE_MARGIN": "NOT_USED", "G3A_BOOTSTRAP_POSTSTATE": "DELETE",
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3A_EXPECTED_COST_CAD": "UNRESOLVED", "G3A_COST_CEILING_CAD": "UNRESOLVED",
        "G3A_TRANSACTION_READINESS": "BLOCKED", "G3A_EXECUTION_AUTHORIZED": "NO",
        "G3B_EXECUTION_AUTHORIZED": "NO", "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "controllerPackageCostConditionalWork": "NOT_STARTED_FIRST_BYTE_STOP_BOUNDARY",
        "survivingFirstByteBlocker": "CSE_MSI_IMMUTABLE_VERSIONED_BLOB_READ_NOT_PROVEN_2018_API_VS_2019_VERSIONID",
        "publishedHandlerIdentity": "UNBOUND_LOCAL_SOURCE_NOT_AZURE_PACKAGE_PROOF",
        "proofAuthorityStatus": "PREPARED_NOT_ISSUED_NOT_EXECUTABLE",
    })
    print("DIRECT_EXECUTION_SOURCE_PROVEN_IMMUTABLE_FIRST_BYTE_REQUIRES_PROOF", flush=True)


if __name__ == "__main__":
    main()
