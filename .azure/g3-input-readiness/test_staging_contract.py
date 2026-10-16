import unittest

from staging_contract import Staging, StagingFailure, assignment_id, grants


class StagingTests(unittest.TestCase):
    def test_exact_order_one_use_lockdown_before_build(self):
        stage = Staging("source", "tooling")
        stage.begin(True, True, True, 1)
        self.assertFalse(stage.build_allowed())
        with self.assertRaises(StagingFailure):
            stage.push_once("g3-build-tooling", lambda: None, lambda: "tooling")
        stage.push_once("g3-build-source", lambda: None, lambda: "source")
        stage.push_once("g3-build-tooling", lambda: None, lambda: "tooling")
        for args in [(True, False, True, True, True), (True, True, False, True, True),
                     (True, True, True, False, True), (True, True, True, True, False)]:
            with self.assertRaises(StagingFailure):
                stage.close(*args)
        stage.close(True, True, True, True, True)
        self.assertTrue(stage.build_allowed())
        with self.assertRaises(StagingFailure):
            stage.begin(True, True, True, 1)

    def test_failed_push_terminal_no_retry(self):
        stage = Staging("source", "tooling")
        stage.begin(True, True, True, 1)
        calls = []

        def fail():
            calls.append("attempt")
            raise StagingFailure("PUSH_FAILED")
        with self.assertRaises(StagingFailure):
            stage.push_once("g3-build-source", fail, lambda: "source")
        with self.assertRaises(StagingFailure):
            stage.push_once("g3-build-source", fail, lambda: "source")
        self.assertEqual(calls, ["attempt"])
        self.assertFalse(stage.build_allowed())

    def test_manifest_mismatch_terminal(self):
        stage = Staging("source", "tooling")
        stage.begin(True, True, True, 1)
        with self.assertRaises(StagingFailure):
            stage.push_once("g3-build-source", lambda: None, lambda: "foreign")
        self.assertEqual(stage.phase, "FAILED")

    def test_repository_grants_distinct_deterministic_no_final_runtime(self):
        entries = grants("/new/input", "producer", "reader", "transaction")
        self.assertEqual(len({entry["assignmentId"] for entry in entries}), 4)
        self.assertEqual({entry["repository"] for entry in entries}, {"g3-build-source", "g3-build-tooling"})
        self.assertEqual(assignment_id("/new/input", "producer", entries[0]["roleDefinitionId"],
                                       "g3-build-source", "transaction"), entries[0]["assignmentId"])


if __name__ == "__main__":
    unittest.main()
