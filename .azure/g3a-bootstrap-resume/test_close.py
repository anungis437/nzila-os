import unittest

from close_resume import elapsed_hours, terminal_status


class CloseObservation(unittest.TestCase):
    def test_suffixed_failure_is_terminal(self):
        status = {"code": "ProvisioningState/failed/0", "message": "download failed"}
        self.assertEqual(terminal_status([status]), status)

    def test_success_and_unsuffixed_failure_are_terminal(self):
        for code in ("ProvisioningState/succeeded", "ProvisioningState/succeeded/0", "ProvisioningState/failed"):
            self.assertEqual(terminal_status([{"code": code}])["code"], code)

    def test_unknown_or_ambiguous_status_never_infers_success(self):
        for values in ([], [{"code": "ProvisioningState/transitioning"}],
                       [{"code": "ProvisioningState/failed/0"}, {"code": "ProvisioningState/succeeded"}]):
            with self.assertRaises(RuntimeError):
                terminal_status(values)

    def test_lifetimes_and_negative_bounds(self):
        self.assertEqual(elapsed_hours("2026-10-12T17:00:00+00:00", "2026-10-12T18:00:00+00:00"), 1)
        with self.assertRaises(RuntimeError):
            elapsed_hours("2026-10-12T18:00:00+00:00", "2026-10-12T17:00:00+00:00")


if __name__ == "__main__":
    unittest.main()
