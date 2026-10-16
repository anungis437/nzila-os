import unittest

from lane_contract import (
    ContractError, G2_TARGET, SUBJECT, federation, input_phase, input_rights, public_denial,
)


class LaneContract(unittest.TestCase):
    def test_exact_federation_and_actual_named_owners_required(self):
        owner = ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"]
        args = [SUBJECT, ["api://AzureADTokenExchange"], "https://token.actions.githubusercontent.com", [], owner]
        self.assertEqual(federation(*args), "READY")
        for index, replacement in [
            (0, SUBJECT.replace("g3-proof", "staging")), (0, SUBJECT.replace("g3-proof", "production")),
            (0, "repo:anungis437/nzila-os:*"), (1, ["wrong"]),
            (3, [{"secret": "synthetic"}]), (4, []), (4, ["BOUND"]), (4, owner * 2),
        ]:
            invalid = args.copy()
            invalid[index] = replacement
            with self.assertRaises(ContractError):
                federation(*invalid)

    def test_staging_is_new_registry_specific_and_approval_gated(self):
        result = input_phase("nzilag3inputs001", "PRODUCER_STAGING", "8.8.8.8/32", True)
        self.assertFalse(result["builderExecutionAllowed"])
        self.assertEqual(result["defaultAction"], "Deny")
        for registry, ip, approved in [
            (G2_TARGET, "8.8.8.8/32", True), ("nzilag3inputs001", "8.8.8.8/32", False),
            ("nzilag3inputs001", "0.0.0.0/0", True), ("nzilag3inputs001", "8.8.8.0/24", True),
            ("nzilag3inputs001", "10.91.3.4/32", True), ("nzilag3inputs001", "2001:db8::1/128", True),
        ]:
            with self.assertRaises(ContractError):
                input_phase(registry, "PRODUCER_STAGING", ip, approved)

    def test_private_execution_needs_lock_and_private_readback(self):
        for locked, private in [(False, False), (True, False), (False, True), (True, True)]:
            result = input_phase("nzilag3inputs001", "PRIVATE_LOCKED", "", False, locked, private)
            self.assertEqual(result["publicNetworkAccess"], "Disabled")
            self.assertEqual(result["ipRules"], [])
            self.assertEqual(result["builderExecutionAllowed"], locked and private)
        with self.assertRaises(ContractError):
            input_phase("nzilag3inputs001", "PRIVATE_LOCKED", "8.8.8.8/32", True)

    def test_build_push_identity_has_no_input_repo_permission(self):
        grants = input_rights("push", "reader", "probe", "input-id", "target-id")
        self.assertEqual([value["repository"] for value in grants if value["principal"] == "push"],
                         ["g3-synthetic-runtime"])
        for args in [("push", "push", "probe", "input-id", "target-id"),
                     ("push", "reader", "probe", "target-id", "target-id")]:
            with self.assertRaises(ContractError):
                input_rights(*args)

    def test_public_denial_is_not_an_rbac_or_generic_network_claim(self):
        self.assertEqual(public_denial(True, True, None, True, True, True)["status"], "DENIED")
        for args in [(False, True, None, True, True, True), (True, False, None, True, True, True),
                     (True, True, 401, False, True, True), (True, True, None, True, False, True),
                     (True, True, None, True, True, False)]:
            with self.assertRaises(ContractError):
                public_denial(*args)


if __name__ == "__main__":
    unittest.main()
