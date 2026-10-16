import unittest

from status_parser import parse_terminal


class TerminalParserTests(unittest.TestCase):
    def test_success_terminal_state(self):
        for code in ("ProvisioningState/succeeded", "ProvisioningState/succeeded/0"):
            self.assertEqual(parse_terminal([{"code": code}]), {"state": "succeeded", "code": code})

    def test_failed_zero_suffix_from_live_evidence(self):
        self.assertEqual(parse_terminal([{"code": "ProvisioningState/failed/0"}]),
                         {"state": "failed", "code": "ProvisioningState/failed/0"})

    def test_transitioning_is_not_terminal(self):
        with self.assertRaisesRegex(ValueError, "UNRESOLVED"):
            parse_terminal([{"code": "ProvisioningState/transitioning"}])

    def test_unknown_terminal_suffix_fails_explicitly(self):
        for code in ("ProvisioningState/failed/unknown", "ProvisioningState/succeeded/0/extra"):
            with self.subTest(code=code):
                with self.assertRaisesRegex(ValueError, "UNSUPPORTED"):
                    parse_terminal([{"code": code}])

    def test_ambiguous_terminal_states_fail_explicitly(self):
        with self.assertRaisesRegex(ValueError, "UNRESOLVED"):
            parse_terminal([{"code": "ProvisioningState/succeeded"}, {"code": "ProvisioningState/failed/0"}])

    def test_empty_status_is_not_success(self):
        with self.assertRaisesRegex(ValueError, "UNRESOLVED"):
            parse_terminal([])


if __name__ == "__main__":
    unittest.main()
