import unittest

from live import classify_status


V1 = "a" * 64
V2 = "b" * 64


class Classification(unittest.TestCase):
    def test_exact_v1_success(self):
        self.assertEqual(classify_status("G3A_BOOTSTRAP_REQUESTED_V1\nSELF_SHA256=" + V1, V1, V2, True), "PROVEN")

    def test_v2_nonzero_is_ignored_version(self):
        self.assertEqual(classify_status("G3A_BOOTSTRAP_CURRENT_V2\nSELF_SHA256=" + V2, V1, V2, False),
                         "VERSION_IGNORED")

    def test_wrong_hash_missing_hash_or_nonzero_never_pass(self):
        for message, succeeded in (
            ("G3A_BOOTSTRAP_REQUESTED_V1\nSELF_SHA256=" + V2, True),
            ("G3A_BOOTSTRAP_REQUESTED_V1", True),
            ("G3A_BOOTSTRAP_REQUESTED_V1\nSELF_SHA256=" + V1, False),
            ("G3A_BOOTSTRAP_REQUESTED_V1\nG3A_BOOTSTRAP_CURRENT_V2\nSELF_SHA256=" + V1, True),
            ("G3A_BOOTSTRAP_REQUESTED_V1\nSELF_SHA256=" + V1 + "\nSELF_SHA256=" + V1, True),
        ):
            with self.subTest(message=message):
                self.assertEqual(classify_status(message, V1, V2, succeeded), "CSE_FAILURE_OTHER")

    def test_version_failure_needs_specific_evidence(self):
        self.assertEqual(classify_status("UnsupportedQueryParameter: versionid", V1, V2, False),
                         "VERSION_UNSUPPORTED")
        self.assertEqual(classify_status("download returned 400", V1, V2, False), "CSE_FAILURE_OTHER")

    def test_identity_and_private_path_not_version_semantics(self):
        self.assertEqual(classify_status("AuthorizationPermissionMismatch", V1, V2, False), "IDENTITY_AUTH_FAILURE")
        self.assertEqual(classify_status("dial tcp: no such host", V1, V2, False), "PRIVATE_PATH_FAILURE")


if __name__ == "__main__":
    unittest.main()
