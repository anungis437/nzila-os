import importlib.util
import json
import pathlib
import unittest

D = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("guard", D / "validator.py")
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
HOST = guard.DATA_HOST


def consumed_redirect(location):
    url = guard.urllib.parse.urlsplit(location)
    metadata = {
        "SCHEME": "https" if url.scheme == "https" else "UNAPPROVED",
        "HOST": HOST if url.hostname == HOST else "UNAPPROVED",
        "PORT": url.port, "QUERY_PRESENT": bool(url.query),
        "PATH_CATEGORY": "OPAQUE_BLOB_DOWNLOAD",
    }
    rejected = bool(url.username or url.password or url.fragment
                    or not url.path.startswith("/") or url.path.startswith("//"))
    return metadata, rejected


class ValidatorTests(unittest.TestCase):
    def check_rejection(self, location, predicate):
        evidence = {}
        with self.assertRaises(guard.RedirectRejected) as caught:
            guard.validate_redirect(location, evidence)
        self.assertEqual(caught.exception.predicate, predicate)
        self.assertEqual(str(caught.exception), predicate)
        self.assertNotIn("placeholder-signature", json.dumps(evidence))
        self.assertNotIn("private-value", json.dumps(evidence))

    def test_sanitized_observed_shape_with_signed_query(self):
        evidence = {}
        path = guard.validate_redirect("https://" + HOST + "/opaque?sig=placeholder-signature", evidence)
        self.assertEqual(path, "/opaque?sig=placeholder-signature")
        self.assertTrue(evidence["REDIRECT_QUERY_PRESENT"])
        self.assertEqual(evidence["REDIRECT_VALIDATION"], "PASS")
        self.assertNotIn("sig", json.dumps(evidence))

    def test_no_query_free_contract_invented(self):
        self.assertEqual(guard.validate_redirect("https://" + HOST + "/opaque", {}), "/opaque")

    def test_https_scheme_required(self):
        self.check_rejection("http://" + HOST + "/opaque", "REDIRECT_SCHEME_INVALID")

    def test_exact_hostname_rejects_aliases_and_ip_literals(self):
        for host in ("evil.invalid", "sibling.canadacentral.data.azurecr.io", "data.azurecr.io",
                     "10.90.2.4", "127.0.0.1", "localhost", "[::1]", HOST + ".",
                     HOST + ".evil.invalid", "storage.blob.core.windows.net"):
            with self.subTest(host=host):
                self.check_rejection("https://" + host + "/opaque", "REDIRECT_HOST_INVALID")

    def test_hostname_case_normalization_only(self):
        self.assertEqual(guard.validate_redirect("https://" + HOST.upper() + "/opaque", {}), "/opaque")
        self.check_rejection("https://" + HOST + "./opaque", "REDIRECT_HOST_INVALID")

    def test_empty_hostname(self):
        self.check_rejection("https:///opaque", "REDIRECT_HOST_INVALID")

    def test_userinfo_including_empty_components(self):
        for userinfo in ("private-value@", ":private-value@", "@"):
            self.check_rejection("https://" + userinfo + HOST + "/opaque", "REDIRECT_USERINFO_PRESENT")

    def test_fragment_including_empty_delimiter(self):
        for fragment in ("#private-value", "#"):
            self.check_rejection("https://" + HOST + "/opaque" + fragment, "REDIRECT_FRAGMENT_PRESENT")

    def test_ports(self):
        self.assertEqual(guard.validate_redirect("https://" + HOST + ":443/opaque", {}), "/opaque")
        self.check_rejection("https://" + HOST + ":444/opaque", "REDIRECT_PORT_INVALID")
        self.check_rejection("https://" + HOST + ":bad/opaque", "REDIRECT_PARSE_FAILED")
        self.check_rejection("https://" + HOST + ":65536/opaque", "REDIRECT_PARSE_FAILED")

    def test_malformed_uri_and_missing_location(self):
        self.check_rejection("https://[bad/opaque", "REDIRECT_PARSE_FAILED")
        self.check_rejection("", "REDIRECT_LOCATION_MISSING")
        self.check_rejection("https://" + HOST + "/opaque\nprivate-value", "REDIRECT_CONTROL_CHARACTER_PRESENT")
        self.check_rejection("https://" + HOST + "/opaque\x7f", "REDIRECT_CONTROL_CHARACTER_PRESENT")
        self.check_rejection("https://" + HOST + "/opaque\\private-value", "REDIRECT_BACKSLASH_PRESENT")

    def test_nonempty_path_without_storage_internal_shape_assumption(self):
        self.check_rejection("https://" + HOST + "?sig=placeholder-signature", "REDIRECT_PATH_INVALID")
        for path in ("/", "//opaque", "/opaque%2Fblob", "/unknown-storage-shape"):
            self.assertEqual(guard.validate_redirect("https://" + HOST + path, {}), path)

    def test_saved_metadata_cannot_identify_consumed_predicate(self):
        fixtures = (
            "https://private-value@" + HOST + "/opaque?sig=placeholder-signature",
            "https://:private-value@" + HOST + "/opaque?sig=placeholder-signature",
            "https://" + HOST + "/opaque?sig=placeholder-signature#private-value",
            "https://" + HOST + "?sig=placeholder-signature",
            "https://" + HOST + "//opaque?sig=placeholder-signature",
        )
        observations = [consumed_redirect(fixture) for fixture in fixtures]
        self.assertTrue(all(rejected for _, rejected in observations))
        self.assertTrue(all(metadata == observations[0][0] for metadata, _ in observations))


if __name__ == "__main__":
    unittest.main()
