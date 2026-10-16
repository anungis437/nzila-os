import importlib.util
import io
import json
import pathlib
import unittest
from unittest.mock import Mock, patch

D = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("corrected", D.parent / "private-import" / "verifier.py")
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)
for path in (D.parent / "blob-readback" / "observer.py", D.parent / "redirect-guard" / "validator.py", D / "adapter.py"):
    exec(compile(path.read_bytes(), str(path), "exec"), v.__dict__)


class AdapterTests(unittest.TestCase):
    def test_current_failure_predicate_is_exact(self):
        for url, predicate in (("http://" + v.DATA_HOST + "/opaque", "REDIRECT_SCHEME_INVALID"),
                               ("https://" + v.DATA_HOST + "/opaque#placeholder", "REDIRECT_FRAGMENT_PRESENT")):
            trace = {}
            with self.assertRaisesRegex(v.ReadbackFailure, "REDIRECT_VALIDATION_" + predicate + "_FAILED"):
                v.approved_redirect(url, trace)
            self.assertEqual(trace["CURRENT_REDIRECT_VALIDATION"], "FAIL")
            self.assertEqual(trace["CURRENT_REDIRECT_FAILURE_PREDICATE"], predicate)
            self.assertNotIn("placeholder", json.dumps(trace))

    def test_success_stream_uses_exact_signed_target_on_pinned_host(self):
        trace = {"BLOB_REGISTRY": {}, "REDIRECT": {}, "DATA_ENDPOINT": {}, "REDIRECT_COUNT": 0}
        registry, data = Mock(), Mock()
        registry.getresponse.return_value.status = 307
        registry.getresponse.return_value.getheader.return_value = "https://" + v.DATA_HOST + "//opaque?sig=placeholder"
        data.getresponse.return_value.status = 200
        data.getresponse.return_value.getheader.return_value = "3"
        data.getresponse.return_value.read.side_effect = io.BytesIO(b"abc").read
        expected = v.hashlib.sha256(b"abc").hexdigest()
        with patch.object(v, "ObservedConnection", side_effect=[registry, data]) as factory, patch.object(v, "ARCHIVE_SHA", expected):
            v.stream_blob("memory-only", {"digest": "sha256:" + expected, "size": 3}, trace)
        self.assertEqual(factory.call_args_list[1].args[0], v.DATA_HOST)
        self.assertEqual(data.request.call_args.args, ("GET", "//opaque?sig=placeholder"))
        self.assertEqual(data.request.call_args.kwargs["headers"], {})
        self.assertEqual(trace["REDIRECT"]["CURRENT_REDIRECT_VALIDATION"], "PASS")
        self.assertEqual(trace["TARGET_ARCHIVE_SHA256"], expected)
        self.assertNotIn("placeholder", json.dumps(trace))

    def test_failure_emits_corrected_marker_without_secret_text(self):
        def failure(result):
            result["ACTIVE_STAGE"] = "REDIRECT_VALIDATION"
            v.approved_redirect("https://userinfo@" + v.DATA_HOST + "/opaque?sig=placeholder", result["REDIRECT"])

        with patch.object(v, "configuration_digest", return_value="unchanged"), patch.object(v, "collect_readback", side_effect=failure), patch("builtins.print") as output:
            self.assertEqual(v.run_readback(), 78)
        marker = output.call_args.args[0]
        self.assertTrue(marker.startswith(v.CORRECTED_MARKER))
        self.assertIn("REDIRECT_USERINFO_PRESENT", marker)
        self.assertNotIn("userinfo@", marker)
        self.assertNotIn("placeholder", marker)
        self.assertNotIn("BLOB_REDIRECT_INVALID", marker)

    def test_template_loads_adapter_after_frozen_observer(self):
        source = (D / "observer-extension.bicep").read_text()
        self.assertLess(source.index("blob-readback/observer.py"), source.index("adapter.py"))
        self.assertIn("redirect-guard/validator.py", source)
        self.assertNotIn("roleAssignments", source)


if __name__ == "__main__":
    unittest.main()
