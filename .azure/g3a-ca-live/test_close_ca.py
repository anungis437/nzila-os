"""Offline rejection fixtures over captured evidence, with no file mutation."""

from pathlib import Path
import unittest
from unittest.mock import patch

import independent_verify as verifier


class CloseoutTests(unittest.TestCase):
    def reject(self, filename, modify, reason):
        original = verifier.load

        def changed(path):
            value = original(path)
            if Path(path).name == filename:
                modify(value)
            return value

        with patch.object(verifier, "load", side_effect=changed):
            with self.assertRaisesRegex(RuntimeError, reason):
                verifier.audit()

    def test_real_evidence(self):
        self.assertEqual(verifier.audit(), 50)

    def test_wrong_runtime_hash(self):
        def modify(value):
            statuses = value["value"]["instanceView"]["statuses"]
            for status in statuses:
                status["message"] = status.get("message", "").replace(verifier.SHA, "0" * 64)

        self.reject("EVENT_036.json", modify, "MARKER_SELF_HASH_CHANGED")

    def test_producer_not_revoked(self):
        def modify(value):
            value["value"].append(dict(value["value"][0]))

        self.reject("EVENT_023.json", modify, "PRODUCER_REVOCATION_READER_SCOPE_CHANGED")

    def test_endpoint_not_approved(self):
        def modify(value):
            value["value"]["privateLinkServiceConnections"][0]["privateLinkServiceConnectionState"]["status"] = "Pending"

        self.reject("EVENT_024.json", modify, "PRIVATE_ENDPOINT_NOT_APPROVED")

    def test_dns_not_linked(self):
        def modify(value):
            value["value"][0]["virtualNetworkLinkState"] = "InProgress"

        self.reject("EVENT_025.json", modify, "PRIVATE_DNS_LINK_CHANGED")

    def test_public_storage(self):
        self.reject("EVENT_022.json", lambda x: x["value"].update(publicNetworkAccess="Enabled"),
                    "STORAGE_NOT_LOCKED")

    def test_versioning_dependency(self):
        self.reject("EVENT_027.json", lambda x: x["value"].update(isVersioningEnabled=True),
                    "VERSIONING_DEPENDENCY")

    def test_second_object_put(self):
        self.reject("EVENT_017.json", lambda x: x.update(method="PUT"),
                    "WRITE_ONCE_READBACK_CHANGED")

    def test_query_uri(self):
        def modify(value):
            value["parameters"]["blobObjectUri"]["value"] += "?versionid=retired"

        self.reject("CSE_PARAMETERS.json", modify, "URI_CONTRACT_CHANGED")

    def test_false_mutation_counter(self):
        self.reject("MUTATION_ACCOUNTING.json", lambda x: x.update(AZURE_MUTATING_DISPATCHES=0),
                    "MUTATION_ACCOUNTING_CHANGED")

    def test_missing_contingency(self):
        self.reject("FULL_G3A_COST_MODEL.json", lambda x: x.update(G3A_COST_CEILING_CAD="7.00"),
                    "FULL_COST_CONTINGENCY_CHANGED")


if __name__ == "__main__":
    unittest.main()
