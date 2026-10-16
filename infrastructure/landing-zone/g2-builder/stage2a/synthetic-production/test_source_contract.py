import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("contract", pathlib.Path(__file__).with_name("source_contract.py"))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


class SourceContractTests(unittest.TestCase):
    def test_deterministic_bytes_and_tag(self):
        first = c.source_binding()
        self.assertEqual(first, c.source_binding())
        _, payload, binding = first
        self.assertEqual(binding["SYNTHETIC_SOURCE_SHA256"], hashlib.sha256(payload).hexdigest())
        self.assertEqual(binding["LOCAL_PAYLOAD_OCI_DIGEST"], "sha256:" + hashlib.sha256(payload).hexdigest())
        self.assertEqual(binding["TARGET_TAG"], "stage2a-" + hashlib.sha256(payload).hexdigest())
        self.assertLessEqual(len(binding["TARGET_TAG"]), 128)

    def test_source_relationship_is_nonrecursive(self):
        contract, payload, binding = c.source_binding()
        self.assertEqual(json.loads(payload)["source_authority_digest"], "sha256:" + hashlib.sha256(contract).hexdigest())
        self.assertEqual(binding["SOURCE_CONTRACT_SHA256"], hashlib.sha256(contract).hexdigest())
        self.assertNotIn("source_authority_digest", json.loads(contract))

    def test_payload_has_only_fixed_synthetic_fields(self):
        _, payload, _ = c.source_binding()
        value = json.loads(payload)
        self.assertEqual(set(value), {"schema", "mission", "gate", "slice", "classification",
                                      "logical_artifact_version", "source_authority_digest"})
        self.assertEqual(value["classification"], "SYNTHETIC_ONLY")
        self.assertEqual(value["schema"], "nzila.g2.synthetic-health.v1")
        self.assertNotIn("timestamp", payload.decode())

    def test_binding_is_not_execution_authority(self):
        binding = c.source_binding()[2]
        self.assertTrue(binding["bindingOnly"])
        self.assertFalse(binding["executionSourceAuthorityCreated"])
        self.assertFalse(binding["executionAuthorityConsumed"])

    def test_bound_outputs_are_exact_and_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            with patch("builtins.print"):
                c.bind(root)
            original = {v.name: v.read_bytes() for v in root.iterdir()}
            self.assertEqual(original["G2_SYNTHETIC_PRODUCTION_PAYLOAD.json"], c.source_binding()[1])
            with self.assertRaises(FileExistsError):
                c.bind(root)
            self.assertEqual(original, {v.name: v.read_bytes() for v in root.iterdir()})

    def test_canonical_encoding_ignores_key_order(self):
        self.assertEqual(c.canonical({"b": 2, "a": 1}), c.canonical({"a": 1, "b": 2}))
        self.assertEqual(c.canonical({"a": 1}), b'{"a":1}\n')


if __name__ == "__main__":
    unittest.main()
