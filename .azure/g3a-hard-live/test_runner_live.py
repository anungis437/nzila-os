import copy
from decimal import Decimal
import unittest
from unittest.mock import patch

import runner_live as live


class CostTests(unittest.TestCase):
    def setUp(self):
        self.model = live.load(live.BASE / "g3a-firstbyte/BOOTSTRAP_PROOF_COST_MODEL.json")

    def test_delivery_and_disk_upper_bounds_with_contingency(self):
        result = live.expanded_cost(self.model)
        self.assertEqual(result["deliveryBytesMaximum"], 350000000)
        self.assertEqual(result["diskOperationsUpperBound"], 1000000)
        self.assertEqual(result["readBytesUpperBound"], 1000000000)
        self.assertLessEqual(Decimal(result["expectedWith50PercentContingencyCAD"]), Decimal(3))
        self.assertEqual(sum(map(Decimal, result["amountsCAD"].values())),
                         Decimal(result["conservativeExpectedCAD"]))
        self.assertFalse(result["tmpfsSeparatelyBilledStorage"])
        self.assertFalse(result["budgetExpansion"])

    def test_cost_does_not_mutate_historical_model(self):
        before = copy.deepcopy(self.model)
        live.expanded_cost(self.model)
        self.assertEqual(before, self.model)

    def test_unbound_cost_meter_fails_closed(self):
        del self.model["amountsCAD"]["conservativeTransfer0_1GB"]
        with self.assertRaisesRegex(RuntimeError, "COST_MODEL_COMPONENT_UNBOUND"):
            live.expanded_cost(self.model)


class DispatchTests(unittest.TestCase):
    def setUp(self):
        self.proof = object.__new__(live.RunnerProof)

    def test_authority_consumed_at_first_transport_dispatch(self):
        with patch.object(live.Path, "exists", return_value=False), \
                patch.object(live, "fresh") as receipt, \
                patch.object(live, "sha", return_value="bound"), \
                patch.object(live.historical.IsolationProof, "cli", return_value={"receipt": True}) as cli:
            result = self.proof.cli(["deployment", "sub", "create"], "CREATE_TRANSPORT", mutation=True)
            self.assertEqual(result, {"receipt": True})
            self.assertEqual(receipt.call_args.args[0], "PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED.json")
            self.assertEqual(receipt.call_args.args[1]["maxAttempts"], 1)
            cli.assert_called_once()

    def test_other_first_mutation_denied_without_authority_receipt(self):
        with patch.object(live.Path, "exists", return_value=False), patch.object(live, "fresh") as receipt:
            with self.assertRaisesRegex(RuntimeError, "UNEXPECTED_FIRST_RUNNER_MUTATION"):
                self.proof.cli(["vm", "create"], "CREATE_VM", mutation=True)
            receipt.assert_not_called()

    def test_read_does_not_consume_authority(self):
        with patch.object(live, "fresh") as receipt, \
                patch.object(live.historical.IsolationProof, "cli", return_value={"value": 1}):
            self.assertEqual(self.proof.cli(["group", "exists"], "READ"), {"value": 1})
            receipt.assert_not_called()

    def test_consumed_receipt_not_reissued(self):
        with patch.object(live.Path, "exists", return_value=True), patch.object(live, "fresh") as receipt, \
                patch.object(live.historical.IsolationProof, "cli", return_value={}):
            self.proof.cli(["group", "delete"], "DELETE_PROOF_RG_CASCADE", mutation=True)
            receipt.assert_not_called()

    def test_contingency_cannot_expand_authority(self):
        model = live.load(live.BASE / "g3a-firstbyte/BOOTSTRAP_PROOF_COST_MODEL.json")
        model["amountsCAD"]["oneB2s2Hours"] = "3"
        with self.assertRaisesRegex(RuntimeError, "PAYLOAD_COST_EXCEEDS_CAD3_WITH_CONTINGENCY"):
            live.expanded_cost(model)


if __name__ == "__main__":
    unittest.main()
