import socket
import unittest

from public_observer import ObserverFailure, observe


class ObserverTests(unittest.TestCase):
    def test_nxdomain_requires_bound_target_and_private_control(self):
        host = "nzila-g3-test-001-health.bound.canadacentral.azurecontainerapps.io"

        def absent(*args, **kwargs):
            raise socket.gaierror(socket.EAI_NONAME, "fixture")
        self.assertEqual(observe(host, host, True, True, absent)["status"], "DENIED")
        for args in [(host, "foreign", True, True), (host, host, False, True), (host, host, True, False)]:
            with self.assertRaises(ObserverFailure):
                observe(*args, absent)

    def test_dns_infrastructure_failure_or_public_ip_not_denial(self):
        host = "nzila-g3-test-001-health.bound.canadacentral.azurecontainerapps.io"

        def temporary(*args, **kwargs):
            raise socket.gaierror(socket.EAI_AGAIN, "fixture")
        with self.assertRaises(ObserverFailure):
            observe(host, host, True, True, temporary)
        with self.assertRaises(ObserverFailure):
            observe(host, host, True, True, lambda *args, **kwargs: [(2, 1, 6, "", ("8.8.8.8", 443))])


if __name__ == "__main__":
    unittest.main()
