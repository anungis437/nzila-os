"""Direct evidence verification; never imports or executes the sealer."""

from decimal import Decimal
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import sys
import unittest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CACHE = {}


def ensure(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(path):
    info = path.stat()
    key = (str(path), info.st_size, info.st_mtime_ns)
    if key not in CACHE:
        with path.open("rb") as file:
            CACHE[key] = hashlib.file_digest(file, "sha256").hexdigest()
        after = path.stat()
        ensure((info.st_size, info.st_mtime_ns) == (after.st_size, after.st_mtime_ns),
               "FILE_CHANGED_DURING_HASH")
    return CACHE[key]


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def census(base, exclude):
    return {str(path.relative_to(base)): sha(path) for path in base.rglob("*")
            if path.is_file() and path.name not in exclude}


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, value):
        self.parts.append(value)


def main():
    ensure(len(sys.argv) == 2 and re.fullmatch(r"[0-9a-f]{64}", sys.argv[1]), "EXPECTED_ROOT_REQUIRED")
    path = HERE / "FIRST_BYTE_VERIFICATION.json"
    ensure(sha(path) == sys.argv[1], "FIRST_BYTE_ROOT_CHANGED")
    root = load(path)
    actual = census(HERE, {"FIRST_BYTE_VERIFICATION.json", "FIRST_BYTE_INDEPENDENT_VERIFICATION.json"})
    ensure(actual == root["firstByteFileHashes"], "FIRST_BYTE_EXACT_CENSUS_CHANGED")
    references = len(actual) + 1
    for name, expected in root["protectedPacketHashes"].items():
        ensure(sha(ROOT / name) == expected, "PROTECTED_HISTORY_CHANGED")
        references += 1
    ensure(root["g2TerminalRootSha256"] ==
           "ed29f65fc52a89a707d76bf553a24f579e1542ddf439245edcf0cde3ccc0f499" and
           root["g2TerminalRootSha256"] in root["protectedPacketHashes"].values(), "G2_TERMINAL_NOT_PROTECTED")
    prior = HERE.parent / "g3a-transaction"
    ensure(sha(prior / "TRANSACTION_VERIFICATION.json") == root["priorTransactionRootSha256"] ==
           "0c216d4b17146236bf632640df6fef84c31deea7a9d814637e14714f6e0859a4",
           "PRIOR_TRANSACTION_ROOT")
    ensure(census(prior, {"TRANSACTION_VERIFICATION.json", "TRANSACTION_INDEPENDENT_VERIFICATION.json"}) ==
           load(prior / "TRANSACTION_VERIFICATION.json")["transactionFileHashes"], "PRIOR_EXACT_CENSUS")
    core = HERE.parent / "g3a-controller-repair"
    ensure(sha(core / "REPAIR_VERIFICATION.json") == root["qualifiedCoreRootSha256"] ==
           "3d155ebc2a739ff9c91fd7011e8497878f34fd3390c6d0ecbd0554c730313f81", "QUALIFIED_CORE_ROOT")
    ensure(census(core, {"REPAIR_VERIFICATION.json", "REPAIR_INDEPENDENT_VERIFICATION.json"}) ==
           load(core / "REPAIR_VERIFICATION.json")["repairFileHashes"], "QUALIFIED_CORE_EXACT_CENSUS")
    ensure(sha(Path(root["authorityPath"])) == root["authoritySha256"], "AUTHORITY_CHANGED")
    ledger = load(HERE / "PUBLIC_SOURCE_LEDGER.json")
    extra = load(HERE / "PUBLIC_STORAGE_V2_LEDGER.json")
    ensure(ledger["pricePaginationComplete"] and extra["paginationComplete"], "PRICE_PAGINATION_INCOMPLETE")
    for entry in ledger["sources"] + extra["sources"]:
        ensure(sha(Path(entry["path"])) == entry["sha256"], "PUBLIC_SOURCE_CHANGED")
    qualification = load(HERE / "CSE_SOURCE_QUALIFICATION.json")
    ensure(len(qualification["sources"]) == 2 and
           qualification["G3A_CSE_DOWNLOADED_BINARY_EXECUTION"] == "PROVEN", "SOURCE_PROOF_SCOPE")
    for label in ("CURRENT", "V2_1_17"):
        files = (HERE / "public" / (label + "_main_files.go")).read_text()
        save = (HERE / "public" / (label + "_pkg_download_save.go")).read_text()
        execute = (HERE / "public" / (label + "_main_exec.go")).read_text()
        msi = (HERE / "public" / (label + "_pkg_download_blobwithmsitoken.go")).read_text()
        ensure("const mode = 0500" in files and "download.SaveTo(ctx, dl, fp, mode)" in files and
               "os.OpenFile(dst, os.O_WRONLY|os.O_TRUNC|os.O_CREATE, mode)" in save, "DIRECT_FILE_MODE")
        ensure('exec.Command("/bin/sh", "-c", cmd)' in execute and "c.Dir = workdir" in execute and
               "if cfg.SkipDos2Unix == false {" in files, "DIRECT_EXECUTION_AND_PRESERVATION")
        ensure(re.search(r'xMsVersionValue\s*=\s*"2018-03-28"', msi) and
               "http.NewRequest(http.MethodGet, self.url, nil)" in msi, "MSI_VERSION_MISMATCH_EVIDENCE")
    parser = Text()
    parser.feed((HERE / "public" / "GET_BLOB.html").read_text())
    docs = " ".join(" ".join(parser.parts).split())
    ensure(re.search(r"versionid.{0,100}2019-12-12 and later", docs), "VERSIONID_MINIMUM_API")
    model = load(HERE / "BOOTSTRAP_PROOF_COST_MODEL.json")
    rates = {}
    for name, binding in model["rates"].items():
        price_path = Path(binding["source"])
        ensure(sha(price_path) == binding["sourceSha256"], "PRICE_SOURCE_CHANGED")
        entries = [item for item in load(price_path)["Items"] if item["meterId"] == binding["meterId"] and
                   item["meterName"] == binding["meterName"] and item["unitOfMeasure"] == binding["unit"] and
                   item["tierMinimumUnits"] == 0 and item["isPrimaryMeterRegion"]]
        ensure(len(entries) == 1 and entries[0]["currencyCode"] == "CAD" and
               Decimal(str(entries[0]["retailPrice"])) == Decimal(binding["rateCAD"]), "PRIMARY_PRICE_BINDING")
        if "StorageV2AliasSource" in binding:
            alias_path = Path(binding["StorageV2AliasSource"])
            ensure(sha(alias_path) == binding["StorageV2AliasSourceSha256"], "STORAGEV2_ALIAS_SOURCE")
            ensure(any(item["productName"] == "General Block Blob v2" and item["skuName"] == "Hot LRS" and
                       item["meterId"] == binding["meterId"] and item["tierMinimumUnits"] == 0 and
                       item["unitOfMeasure"] == binding["unit"] and
                       Decimal(str(item["retailPrice"])) == Decimal(binding["rateCAD"])
                       for item in load(alias_path)["Items"]), "STORAGEV2_PRIMARY_SHARED_METER")
        rates[name] = Decimal(binding["rateCAD"])
    amounts = {
        "onePE4Hours": rates["pe"] * 4, "oneB2s2Hours": rates["vm"] * 2,
        "oneE10DiskOneDay": rates["disk"] / 30, "diskOperations100000": rates["diskIO"] * 10,
        "onePrivateDnsZoneConservativeFullMonth": rates["dnsZone"],
        "dnsQueries10000": rates["dnsQuery"] / 100,
        "blobStorage0_1GBConservativeFullMonth": rates["blobStorage"] / 10,
        "blobWriteAndContainerOps10000": rates["blobWrite"],
        "blobReads10000": rates["blobRead"], "blobOtherOps10000": rates["blobOther"],
        "privateLinkIngress0_1GB": rates["peIngress"] / 10,
        "privateLinkEgress0_1GB": rates["peEgress"] / 10,
        "conservativeTransfer0_1GB": rates["trafficConservative"] / 10,
    }
    ensure(amounts == {key: Decimal(value) for key, value in model["amountsCAD"].items()} and
           sum(amounts.values()) == Decimal(model["conservativeExpectedProofCAD"]), "PROOF_COST_ARITHMETIC")
    ensure(Decimal(model["candidateProofCeilingCAD"]) >= sum(amounts.values()) * Decimal("1.5") and
           model["G3A_EXPECTED_COST_CAD"] == model["G3A_COST_CEILING_CAD"] == "UNRESOLVED",
           "COST_SCOPE_AND_150_PERCENT")
    d = load(HERE / "FIRST_BYTE_DISPOSITION.json")
    ensure(d["G3A_CSE_DOWNLOADED_BINARY_EXECUTION"] == "PROVEN" and
           d["G3A_FIRST_BYTE_BOOTSTRAP"] == "REQUIRES_LIVE_BOOTSTRAP_PROOF" and
           d["G3A_CONTROLLER"] == d["G3A_BICEP_PACKAGE"] == "INCOMPLETE" and
           d["G3_EXECUTION_READINESS"] == d["G3A_TRANSACTION_READINESS"] == "BLOCKED" and
           d["G3A_BOOTSTRAP_BINARY_BYTES"] == d["G3A_EXPECTED_COST_CAD"] ==
           d["G3A_COST_CEILING_CAD"] == "UNRESOLVED", "HONEST_STOP_BOUNDARY")
    for key in ("G3A_EXECUTION_AUTHORIZED", "G3B_EXECUTION_AUTHORIZED", "G3_TECHNICAL_EXECUTION_AUTHORIZED"):
        ensure(d[key] == "NO", "EXECUTION_NOT_AUTHORIZED")
    for key in ("AZURE_MUTATIONS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS"):
        ensure(d[key] == root[key] == 0, "MUTATION_BOUNDARY")
    ensure(d["UE_INFRA"] == d["CORA_INFRA"] == "INFRA_NO_GO", "PRODUCT_INFRA_BOUNDARY")
    draft = (HERE / "G3A_FIRST_BYTE_BOOTSTRAP_PROOF_AUTHORITY.md").read_text()
    ensure("PREPARED ONLY. NOT ISSUED. NOT EXECUTABLE." in draft and "distinct version A" in draft and
           "runtime image build, target ACR read/write, G3B" in draft and
           "Do not change `timestamp`" in draft and "No behavior is" in draft,
           "PROOF_DRAFT_BOUNDARY")
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream, verbosity=1).run(
        unittest.defaultTestLoader.loadTestsFromName("test_contracts"))
    ensure(result.wasSuccessful() and result.testsRun == 11, "INDEPENDENT_SOURCE_TESTS_FAILED")
    ensure(census(HERE, {"FIRST_BYTE_VERIFICATION.json", "FIRST_BYTE_INDEPENDENT_VERIFICATION.json"}) ==
           actual, "TEST_REPLAY_CHANGED_EVIDENCE")
    report = {
        "status": "PASS_DIRECT_SOURCE_EVIDENCE_WITH_FIRST_BYTE_STOP",
        "rootSha256": sys.argv[1], "hashReferencesVerified": references,
        "independentlyReplayedLocalSourceTests": result.testsRun,
        "directExecutionSourceSemanticsProven": True, "externalChmodAssumed": False,
        "managedIdentityVersionIdCompatibilityProven": False,
        "storageApiMismatchVerified": True, "serverBehaviorInferred": False,
        "priorQualifiedAndFailedBytesUnchanged": True, "g2TerminalRootUnchanged": True,
        "proofAuthorityIssued": False, "conservativeProofCostCAD": model["conservativeExpectedProofCAD"],
        "candidateProofCeilingCAD": model["candidateProofCeilingCAD"],
        "costArithmeticAndMinimum150PercentVerified": True,
        "G3A_FIRST_BYTE_BOOTSTRAP": "REQUIRES_LIVE_BOOTSTRAP_PROOF",
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3A_COST_CEILING_CAD": "UNRESOLVED", "G3_EXECUTION_READINESS": "BLOCKED",
        "sealerImportedOrExecuted": False, "qualifiedBuildOrUploaderTestsRerun": False,
        "additionalImageBuilds": 0, "guestExecutions": 0, "realAzureEntraRegistryCalls": 0,
    }
    with (HERE / "FIRST_BYTE_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8") as file:
        json.dump(report, file, indent=2)
        file.write("\n")
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
