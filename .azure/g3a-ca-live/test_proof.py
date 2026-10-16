import unittest
from unittest.mock import patch

from proof import HERE, OBJECT, SHA, ContentProof, classify, diagnostic_script, load, sha


class Contracts(unittest.TestCase):
    def test_frozen_binary_and_path(self):
        self.assertEqual(sha(HERE / "g3a-bootstrap"), SHA)
        self.assertEqual(OBJECT, "sha256/" + SHA + "/g3a-bootstrap")

    def test_no_versioning_or_query_contract(self):
        self.assertIn("isVersioningEnabled: false", (HERE / "infra" / "transport.bicep").read_text())
        cse = (HERE / "infra" / "cse.bicep").read_text()
        self.assertIn("typeHandlerVersion: '2.1'", cse)
        self.assertIn("./g3a-bootstrap", cse)
        self.assertNotIn("versionid", cse)

    def test_diagnostic_only_allowlisted_output(self):
        script = diagnostic_script("examplestorage.blob.core.windows.net")
        self.assertIn('index($0,"examplestorage.blob.core.windows.net")', script)
        self.assertIn("tail -n 120", script)
        for forbidden in ("print $0", "cat ", "curl ", "IMDS", "protectedSettings"):
            self.assertNotIn(forbidden, script)
        with self.assertRaises(RuntimeError):
            diagnostic_script("bad; cat /etc/passwd")

    def test_clarification72_not_token_failure(self):
        self.assertEqual(classify("CLARIFICATION=72 PHASE=FILE_DOWNLOAD"), "CSE_DOWNLOAD_OTHER")
        self.assertEqual(classify("HTTP_STATUS=400 CLARIFICATION=72"), "STORAGE_REQUEST_BAD_REQUEST")

    def test_specific_safe_diagnostic_classes(self):
        for message, expected in (
            ("HTTP_STATUS=404", "BLOB_NOT_FOUND"),
            ("CLARIFICATION=71", "IDENTITY_AUTH_FAILURE"),
            ("HTTP_STATUS=409", "STORAGE_CONFLICT"),
            ("dial tcp timeout", "NETWORK_TRANSPORT_FAILURE"),
        ):
            self.assertEqual(classify(message), expected)

    def test_collision_aborts_without_upload(self):
        proof = ContentProof()
        with patch.object(proof, "storage_token", return_value="fixture-token"), \
             patch.object(proof, "blob", return_value=(200, {}, b"")), \
             patch.object(proof, "object_request", return_value=(200, {}, b"")) as request:
            with self.assertRaisesRegex(RuntimeError, "NOT_CONFIRMED_ABSENT"):
                proof.stage()
            self.assertEqual([x.args[0] for x in request.call_args_list], ["HEAD"])


if __name__ == "__main__":
    unittest.main()
