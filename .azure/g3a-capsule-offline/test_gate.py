import unittest

from isolation_gate import CAPABILITIES, PINNED_IMAGE, SYSCALLS, qualify


class GateTests(unittest.TestCase):
    def fixture(self):
        return {"image": PINNED_IMAGE, "source": "RECORDED_PINNED_GUEST",
                "effectiveCapabilities": sorted(CAPABILITIES), "successfulSyscalls": sorted(SYSCALLS),
                "credentialAndCapabilityDropVerified": True, "boundaryNegativeTestsVerified": True}

    def test_absent_evidence_blocks(self):
        self.assertEqual(qualify({})["status"], "BLOCKED")

    def test_local_container_cannot_substitute_guest(self):
        evidence = self.fixture()
        evidence["source"] = "LOCAL_DOCKER_KERNEL"
        self.assertIn("PINNED_GUEST_CAPABILITY_EVIDENCE", qualify(evidence)["missing"])

    def test_missing_mount_privilege_blocks(self):
        evidence = self.fixture()
        evidence["effectiveCapabilities"].remove("CAP_SYS_ADMIN")
        self.assertEqual(qualify(evidence)["status"], "BLOCKED")

    def test_missing_network_boundary_blocks(self):
        evidence = self.fixture()
        evidence["successfulSyscalls"].remove("unshare_network")
        self.assertEqual(qualify(evidence)["status"], "BLOCKED")

    def test_privilege_drop_required(self):
        evidence = self.fixture()
        evidence["credentialAndCapabilityDropVerified"] = False
        self.assertEqual(qualify(evidence)["status"], "BLOCKED")

    def test_host_process_root_escape_boundary_required(self):
        evidence = self.fixture()
        evidence["successfulSyscalls"].remove("unshare_pid")
        self.assertEqual(qualify(evidence)["status"], "BLOCKED")

    def test_host_boundaries_required(self):
        evidence = self.fixture()
        evidence["boundaryNegativeTestsVerified"] = False
        self.assertEqual(qualify(evidence)["status"], "BLOCKED")

    def test_contract_sufficiency_fixture_only(self):
        self.assertEqual(qualify(self.fixture())["status"], "QUALIFIED")


if __name__ == "__main__":
    unittest.main()
