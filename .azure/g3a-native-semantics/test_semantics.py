import ast
import contextlib
import io
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import probe
from prepare import require


class SemanticGuardTests(unittest.TestCase):
    def test_missing_secrets_is_explicit_failure_not_partial_success(self):
        context = SimpleNamespace(verify_mode=probe.ssl.CERT_REQUIRED, check_hostname=True,
                                  cert_store_stats=lambda: {"x509_ca": 121})
        output = io.StringIO()
        with patch.object(probe.sys, "argv", ["probe.py", "entropy"]), \
             patch.object(probe.os.path, "exists", return_value=False), \
             patch.object(probe.os, "getrandom", return_value=b"x" * 32, create=True), \
             patch.object(probe.os, "urandom", return_value=b"x" * 32), \
             patch.object(probe.ssl, "RAND_bytes", return_value=b"x" * 32), \
             patch.object(probe.ssl, "RAND_pseudo_bytes", return_value=(b"x" * 32, True), create=True), \
             patch.object(probe.ssl, "create_default_context", return_value=context), \
             patch.object(probe.importlib.util, "find_spec", return_value=None), \
             contextlib.redirect_stdout(output):
            self.assertEqual(probe.main(), 2)
        result = json.loads(output.getvalue())
        self.assertEqual(result["status"], "FAIL")
        self.assertEqual(result["operations"]["secrets.token_bytes"]["status"], "FAIL")
        self.assertFalse(result["operations"]["secrets.token_bytes"]["substitutedHostModule"])
        self.assertEqual(result["operations"]["ssl.RAND_bytes"]["status"], "PASS")

    def test_entropy_probe_rejects_exposed_random_or_proc_path(self):
        with patch.object(probe.sys, "argv", ["probe.py", "entropy"]), \
             patch.object(probe.os.path, "exists", return_value=True):
            with self.assertRaisesRegex(RuntimeError, "UNAUTHORIZED_RANDOM_PROC"):
                probe.main()

    def test_descriptor_probe_rejects_additional_device(self):
        with patch.object(probe.sys, "argv", ["probe.py", "descriptor"]), \
             patch.object(probe.os.path, "exists", return_value=False), \
             patch.object(probe.os, "listdir", return_value=["null", "urandom"]):
            with self.assertRaisesRegex(RuntimeError, "DEVICE_SURFACE_NOT_NULL_ONLY"):
                probe.main()

    def test_guard_surfaces_failure(self):
        with self.assertRaisesRegex(RuntimeError, "NOT_QUALIFIED"):
            require(False, "NOT_QUALIFIED")

    def test_mount_snapshot_is_taken_after_namespace_creation(self):
        source = (Path(__file__).parent / "fixture.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        main = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "main")
        self.assertIn("unshare", ast.unparse(main.body[0]))
        self.assertIn("inherited_mount_ids", ast.unparse(main.body[1]))
        self.assertIn("/proc/self/mountinfo", ast.unparse(main.body[1]))

    def test_final_fixture_not_given_host_module_search_path(self):
        source = (Path(__file__).parent / "fixture.py").read_text(encoding="utf-8")
        self.assertNotIn("PYTHONPATH", source)
        self.assertIn('"-I", "-B", "-S"', source)
        self.assertIn('"EXACT_EMBEDDED_MEMBER_CENSUS"', source)


if __name__ == "__main__":
    unittest.main()
