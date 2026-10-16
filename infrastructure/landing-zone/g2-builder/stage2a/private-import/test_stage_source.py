import hashlib
import importlib.util
import json
import pathlib
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("stage", pathlib.Path(__file__).with_name("stage_source.py"))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)


class StagingTests(unittest.TestCase):
    def test_existing_source_tag_stops_before_download(self):
        with patch.object(s, "authentication", return_value="memory"), patch.object(s, "request", return_value=(200, b"{}", None, None)), patch.object(s, "download") as download:
            with self.assertRaises(ValueError):
                s.stage()
            download.assert_not_called()

    def test_unresolved_404_not_absence(self):
        with patch.object(s, "authentication", return_value="memory"), patch.object(s, "request", return_value=(404, b'{"errors":[{"code":"DENIED"}]}', None, None)):
            with self.assertRaises(ValueError):
                s.stage()

    def test_generic_manifest_exact_roundtrip(self):
        saved = {}
        def request(method, path, data=None, headers=None):
            if method == "PUT":
                saved["body"] = data
                return 201, b"", None, "sha256:" + hashlib.sha256(data).hexdigest()
            if "body" in saved:
                return 200, saved["body"], None, "sha256:" + hashlib.sha256(saved["body"]).hexdigest()
            return 404, b'{"errors":[{"code":"NAME_UNKNOWN"}]}', None, None
        with patch.object(s, "authentication", return_value="memory"), patch.object(s, "request", side_effect=request), patch.object(s, "download", return_value=b"approved-mocked-archive"), patch.object(s, "blob"):
            result = s.stage()
        manifest = json.loads(saved["body"])
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(manifest["artifactType"], "application/vnd.nzila.g2.tooling.oras.v1")
        self.assertEqual(manifest["layers"][0]["digest"], "sha256:" + s.EXPECTED)
        self.assertEqual(manifest["config"]["mediaType"], "application/vnd.oci.empty.v1+json")
        self.assertNotIn("platform", manifest)

    def test_registry_path_guard(self):
        with self.assertRaises(ValueError):
            s.request("PUT", "/v2/synthetic-health/manifests/a")

    def test_workflow_only_stages_source(self):
        source = pathlib.Path(__file__).with_name("stage-source-workflow.yml").read_text()
        self.assertIn("environment: build", source)
        self.assertIn("persist-credentials: false", source)
        self.assertNotIn("acr import", source)
        self.assertNotIn("docker", source)


if __name__ == "__main__":
    unittest.main()
