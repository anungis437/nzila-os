import base64
import copy
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

D = pathlib.Path(__file__).parent
E = D.parents[4] / ".azure" / "evidence"
spec = importlib.util.spec_from_file_location("contract", D / "validator.py")
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
BODY = (E / "G2_LOCAL_OCI_RUN1" / "manifest.json").read_bytes()
PAYLOAD = (E / "G2_SYNTHETIC_PRODUCTION_PAYLOAD.json").read_bytes()


class ContractTests(unittest.TestCase):
    def test_actual_oras_manifest_passes(self):
        value = c.validate_local_manifest(BODY, PAYLOAD, b"{}")
        self.assertEqual(value["config"]["data"], "e30=")
        self.assertEqual(base64.b64decode(value["config"]["data"]), b"{}")

    def test_both_actual_runs_and_layouts_pass(self):
        for number in (1, 2):
            root = E / ("G2_LOCAL_OCI_RUN" + str(number))
            body = (root / "manifest.json").read_bytes()
            manifest = c.validate_local_manifest(body, PAYLOAD, b"{}")
            self.assertEqual(body, BODY)
            index = json.loads((root / "layout" / "index.json").read_bytes())
            self.assertEqual(index["manifests"][0]["digest"], c.LOCAL_MANIFEST_DIGEST)
            for descriptor, expected in ((manifest["config"], b"{}"), (manifest["layers"][0], PAYLOAD)):
                blob = root / "layout" / "blobs" / "sha256" / descriptor["digest"].split(":")[1]
                self.assertEqual(blob.read_bytes(), expected)

    def test_required_negative_mutations(self):
        cases = (
            ("payload digest", lambda v: v["layers"][0].update(digest="sha256:" + "0" * 64)),
            ("config digest", lambda v: v["config"].update(digest="sha256:" + "0" * 64)),
            ("config media type", lambda v: v["config"].update(mediaType="application/json")),
            ("extra layer", lambda v: v["layers"].append(copy.deepcopy(v["layers"][0]))),
            ("artifact type", lambda v: v.update(artifactType="application/json")),
            ("manifest media type", lambda v: v.update(mediaType="application/json")),
            ("payload media type", lambda v: v["layers"][0].update(mediaType="application/json")),
            ("payload size", lambda v: v["layers"][0].update(size=327)),
            ("subject", lambda v: v.update(subject=copy.deepcopy(v["config"]))),
            ("timestamp", lambda v: v["annotations"].update({"org.opencontainers.image.created": "2026-10-11T23:00:00Z"})),
            ("config embedded data", lambda v: v["config"].update(data="W10=")),
            ("missing embedded data", lambda v: v["config"].pop("data")),
            ("extra annotation", lambda v: v["layers"][0]["annotations"].update(extra="unapproved")),
            ("schema", lambda v: v.update(schemaVersion=1)),
            ("config size", lambda v: v["config"].update(size=0)),
            ("config urls", lambda v: v["config"].update(urls=["https://unapproved.invalid"])),
        )
        for name, mutate in cases:
            with self.subTest(name=name):
                value = json.loads(BODY)
                mutate(value)
                with self.assertRaises(c.ManifestContractError):
                    c.validate_local_manifest(json.dumps(value).encode(), PAYLOAD, b"{}")

    def test_identical_model_different_bytes_rejected(self):
        with self.assertRaises(c.ManifestContractError) as caught:
            c.validate_local_manifest(json.dumps(json.loads(BODY), indent=2).encode(), PAYLOAD, b"{}")
        self.assertEqual(str(caught.exception), "LOCAL_MANIFEST_BYTE_DIGEST_MISMATCH")

    def test_duplicate_field_rejected(self):
        with self.assertRaises(c.ManifestContractError):
            c.validate_local_manifest(BODY.replace(b'"schemaVersion":2', b'"schemaVersion":2,"schemaVersion":2'), PAYLOAD, b"{}")

    def test_blob_bytes_independently_bound(self):
        for payload, config in ((PAYLOAD + b"\n", b"{}"), (PAYLOAD, b"[]")):
            with self.assertRaises(c.ManifestContractError):
                c.validate_local_manifest(BODY, payload, config)

    def test_prior_contract_reproduces_exact_descriptor_rejection(self):
        value = json.loads(BODY)
        expected = dict(c.EXPECTED_CONFIG)
        expected.pop("data")
        self.assertNotEqual(value["config"], expected)
        self.assertEqual({key: v for key, v in value["config"].items() if key != "data"}, expected)
        self.assertEqual(value["layers"], [c.EXPECTED_LAYER])

    def test_new_adapter_passes_actual_fixture_and_keeps_invocation(self):
        spec = importlib.util.spec_from_file_location("production", D.parent / "private-import" / "verifier.py")
        v = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(v)
        v.BOUND_PAYLOAD_BASE64 = base64.b64encode(PAYLOAD).decode()
        for path in (D.parent / "blob-readback" / "observer.py", D.parent / "empty-path" / "validator.py",
                     D.parent / "empty-path" / "observer.py", D.parent / "synthetic-revised" / "production.py",
                     D / "validator.py", D / "adapter.py"):
            exec(compile(path.read_bytes(), str(path), "exec"), v.__dict__)
        with tempfile.TemporaryDirectory() as temporary:
            directory = pathlib.Path(temporary)
            commands = []
            def local(arguments, cwd):
                commands.append(arguments)
                if arguments[1] == "version":
                    return b"Version:    1.3.4\n"
                (cwd / "manifest.json").write_bytes(BODY)
                blobs = cwd / "layout" / "blobs" / "sha256"
                blobs.mkdir(parents=True)
                for blob in (PAYLOAD, b"{}"):
                    (blobs / v.hashlib.sha256(blob).hexdigest()).write_bytes(blob)
                return b""
            result = {}
            with patch.object(v, "local_command", side_effect=local):
                self.assertEqual(v.create_local_artifact(directory / "oras", directory, result), BODY)
            self.assertEqual(result["localManifestDigest"], c.LOCAL_MANIFEST_DIGEST)
            self.assertIn("--oci-layout", commands[1])
            self.assertIn("org.opencontainers.image.created=2000-01-01T00:00:00Z", commands[1])


if __name__ == "__main__":
    unittest.main()
