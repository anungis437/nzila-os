import unittest

from policy import MAXIMA, authorize, capacity, digest, effective, production_entrypoint


class CapacityTests(unittest.TestCase):
    def test_exact_and_lower_limits(self):
        self.assertEqual(capacity(MAXIMA), MAXIMA)
        lower = dict(MAXIMA, buildRootBytes=4096, tmpBytes=4096, buildRootInodes=1, tmpInodes=1)
        self.assertEqual(capacity(lower), lower)

    def test_all_invalid_value_classes_denied(self):
        for field in MAXIMA:
            missing = dict(MAXIMA)
            del missing[field]
            with self.subTest(field=field, value="missing"), self.assertRaises(RuntimeError):
                capacity(missing)
            for value in (0, -1, MAXIMA[field] + 1, 1.0, True, None, "100"):
                with self.subTest(field=field, value=value), self.assertRaises(RuntimeError):
                    capacity(dict(MAXIMA, **{field: value}))

    def test_observed_mount_mismatch_denied(self):
        observed = {
            name: {"filesystemType": "TMPFS", "totalBytes": MAXIMA[prefix + "Bytes"],
                   "totalInodes": MAXIMA[prefix + "Inodes"], "rw": True, "exec": True,
                   "nosuid": True, "nodev": True}
            for name, prefix in (("build", "buildRoot"), ("tmp", "tmp"))
        }
        self.assertEqual(effective(MAXIMA, observed), MAXIMA)
        for name in observed:
            for field in ("totalBytes", "totalInodes", "filesystemType", "rw", "exec", "nosuid", "nodev"):
                modified = {key: dict(value) for key, value in observed.items()}
                modified[name][field] = 0 if field != "filesystemType" else "EXT4"
                with self.subTest(resource=name, field=field), self.assertRaises(RuntimeError):
                    effective(MAXIMA, modified)


class AuthorityTests(unittest.TestCase):
    def setUp(self):
        self.authority = {
            "schema": "g3a-execution-authority/v1", "mission": "NZ-20261008-INFRA-001",
            "transaction": "OFFLINE_FIXTURE_ONLY", "payloadSha256": "a" * 64,
            "capacity": dict(MAXIMA), "consumed": False,
        }
        self.kwargs = dict(expected_digest=digest(self.authority), transaction="OFFLINE_FIXTURE_ONLY",
                           payload_digest="a" * 64, config=MAXIMA, consumed=False)

    def test_valid_fixture_validation_does_not_execute(self):
        self.assertEqual(authorize(self.authority, **self.kwargs), MAXIMA)
        with self.assertRaisesRegex(RuntimeError, "NO_RUNNER_DISPATCH"):
            production_entrypoint(self.authority)

    def test_missing_malformed_wrong_digest_consumed_wrong_identity_payload_capacity(self):
        for authority in (None, {}, "invalid", dict(self.authority, extra=True),
                          dict(self.authority, consumed=True), dict(self.authority, consumed=0),
                          dict(self.authority, transaction="WRONG"),
                          dict(self.authority, payloadSha256="b" * 64),
                          dict(self.authority, capacity=dict(MAXIMA, tmpInodes=1))):
            with self.subTest(authority=authority), self.assertRaises(RuntimeError):
                authorize(authority, **self.kwargs)
        for field, value in (("expected_digest", None), ("expected_digest", "bad"),
                             ("expected_digest", "0" * 64), ("consumed", True)):
            with self.subTest(field=field, value=value), self.assertRaises(RuntimeError):
                authorize(self.authority, **dict(self.kwargs, **{field: value}))


if __name__ == "__main__":
    unittest.main()
