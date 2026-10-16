"""Offline assertions of captured source and fail-closed candidate contracts."""

from decimal import Decimal
import unittest

from collect import HERE, CURRENT, TAGGED, load, sha
from contracts import qualify, source, text_page, validate_version_uri


class FirstByteContracts(unittest.TestCase):
    def test_current_direct_execution_without_chmod(self):
        result = qualify("CURRENT")
        self.assertEqual(result["commit"], CURRENT)
        self.assertEqual(result["downloadedFileCreationMode"], "0500")
        self.assertFalse(result["externalChmodRequired"])

    def test_tagged_direct_execution_without_chmod(self):
        result = qualify("V2_1_17")
        self.assertEqual(result["commit"], TAGGED)
        self.assertEqual(result["command"], "/bin/sh -c")
        self.assertEqual(result["workingDirectory"], "/var/lib/waagent/custom-script/download/<seqnum>")

    def test_binary_preservation_and_query_independent_filename(self):
        for label in ("CURRENT", "V2_1_17"):
            result = qualify(label)
            self.assertTrue(result["skipDos2UnixRequired"])
            self.assertEqual(result["filename"], "LAST_URL_PATH_SEGMENT_QUERY_EXCLUDED")
            self.assertIn("os.O_WRONLY|os.O_TRUNC|os.O_CREATE", source(label, "pkg/download/save.go"))

    def test_versionid_requirement_is_authoritative(self):
        self.assertRegex(text_page("GET_BLOB.html"), r"versionid.{0,100}2019-12-12 and later")
        for label in ("CURRENT", "V2_1_17"):
            self.assertEqual(qualify(label)["msiStorageApi"], "2018-03-28")

    def test_versioned_uri_must_stop_for_actual_source_api(self):
        uri = "https://nzilag3bootstrap001.blob.core.windows.net/bootstrap/g3a-bootstrap?versionid=fixture-version"
        for label in ("CURRENT", "V2_1_17"):
            with self.assertRaisesRegex(RuntimeError, "CSE_MSI_VERSIONID_NOT_DOCUMENTED"):
                validate_version_uri(uri, qualify(label)["msiStorageApi"])

    def test_uri_validator_positive_is_synthetic_not_handler_qualification(self):
        uri = "https://nzilag3bootstrap001.blob.core.windows.net/bootstrap/g3a-bootstrap?versionid=fixture-version"
        self.assertEqual(validate_version_uri(uri, "2019-12-12"), "g3a-bootstrap")

    def test_no_sas_public_host_current_blob_or_duplicate_version(self):
        base = "https://nzilag3bootstrap001.blob.core.windows.net/bootstrap/g3a-bootstrap"
        for uri in (base, base + "?sig=fake", base + "?versionid=x&sig=fake",
                    base + "?versionid=x&versionid=y", base + "?versionid=",
                    base.replace("nzilag3bootstrap001", "foreign") + "?versionid=x",
                    base.replace("https:", "http:") + "?versionid=x"):
            with self.subTest(uri=uri), self.assertRaises(RuntimeError):
                validate_version_uri(uri, "2019-12-12")

    def test_protected_settings_and_single_transaction(self):
        for label in ("CURRENT", "V2_1_17"):
            cfg = source(label, "main/handlersettings.go")
            self.assertIn("errUsingBothKeyAndMsi", cfg)
            self.assertIn("errUsingBothClientIdAndObjectId", cfg)
            self.assertIn('json:"managedIdentity"', cfg)
            self.assertIn("checkAndSaveSeqNum", source(label, "main/cmds.go"))
        cse = load(HERE / "BOOTSTRAP_CANDIDATE_CONTRACTS.json")["CSE"]
        self.assertFalse(cse["settingsExecutable"])
        self.assertEqual(cse["publicSettingsCandidate"], {"skipDos2Unix": True})
        self.assertTrue(cse["failedExtensionConsumesAttempt"])
        self.assertEqual(cse["timestamp"], "PROHIBITED")

    def test_blob_only_first_byte_and_ownership(self):
        candidate = load(HERE / "BOOTSTRAP_CANDIDATE_CONTRACTS.json")
        storage = candidate["storage"]
        self.assertEqual(storage["kind"], "StorageV2")
        self.assertEqual(storage["location"], "canadacentral")
        self.assertFalse(storage["sharedKeyAllowed"])
        self.assertFalse(storage["publicBlobAccessAllowed"])
        self.assertEqual(storage["publicNetworkDuringConsumption"], "Disabled")
        self.assertTrue(storage["noSourceCompilerImageCustomerData"])
        self.assertEqual(candidate["roles"]["producerScope"], "EXACT_BOOTSTRAP_CONTAINER")
        self.assertEqual(candidate["roles"]["builder"], "Storage Blob Data Reader")
        self.assertEqual(candidate["roles"]["producerPostVerification"], "REVOKE_BEFORE_VM_CONSUMPTION")
        self.assertTrue(candidate["ownership"]["deleteOnlyPositiveCreationReceipts"])
        self.assertEqual(storage["postState"], "DELETE")

    def test_no_false_closure_or_execution_authority(self):
        d = load(HERE / "FIRST_BYTE_DISPOSITION.json")
        self.assertEqual(d["G3A_CSE_DOWNLOADED_BINARY_EXECUTION"], "PROVEN")
        self.assertEqual(d["G3A_FIRST_BYTE_BOOTSTRAP"], "REQUIRES_LIVE_BOOTSTRAP_PROOF")
        for key in ("G3_EXECUTION_READINESS", "G3A_TRANSACTION_READINESS", "G3A_CSE_CONTRACT"):
            self.assertEqual(d[key], "BLOCKED")
        for key in ("G3A_CONTROLLER", "G3A_BICEP_PACKAGE"):
            self.assertEqual(d[key], "INCOMPLETE")
        for key in ("G3A_EXECUTION_AUTHORIZED", "G3B_EXECUTION_AUTHORIZED", "G3_TECHNICAL_EXECUTION_AUTHORIZED"):
            self.assertEqual(d[key], "NO")
        for key in ("AZURE_MUTATIONS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS"):
            self.assertEqual(d[key], 0)
        self.assertEqual(d["G3A_BOOTSTRAP_BINARY_BYTES"], "UNRESOLVED")
        self.assertEqual(d["G3A_BOOTSTRAP_PRODUCER_ROLE_CONTRACT"], "READY")

    def test_proof_cost_separate_and_ceiling_at_least_150_percent(self):
        model = load(HERE / "BOOTSTRAP_PROOF_COST_MODEL.json")
        total = sum(Decimal(value) for value in model["amountsCAD"].values())
        self.assertEqual(total, Decimal(model["conservativeExpectedProofCAD"]))
        self.assertGreaterEqual(Decimal(model["candidateProofCeilingCAD"]), total * Decimal("1.5"))
        self.assertEqual(model["G3A_EXPECTED_COST_CAD"], "UNRESOLVED")
        self.assertEqual(model["G3A_COST_CEILING_CAD"], "UNRESOLVED")
        for binding in model["rates"].values():
            path = HERE / binding["source"] if not binding["source"].startswith("C:") else binding["source"]
            from pathlib import Path
            path = Path(path)
            self.assertEqual(sha(path), binding["sourceSha256"])
            items = [item for item in load(path)["Items"] if item["meterId"] == binding["meterId"] and
                     item["meterName"] == binding["meterName"] and item["unitOfMeasure"] == binding["unit"] and
                     item["tierMinimumUnits"] == 0 and item["isPrimaryMeterRegion"]]
            self.assertEqual(len(items), 1)
            self.assertEqual(Decimal(str(items[0]["retailPrice"])), Decimal(binding["rateCAD"]))
            self.assertEqual(items[0]["currencyCode"], "CAD")


if __name__ == "__main__":
    unittest.main()
