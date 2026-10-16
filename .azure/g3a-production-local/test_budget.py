import hashlib
from pathlib import Path
import tempfile
import unittest

from budget import Budget, Payload, Quantities, cost_contract


class BudgetTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.payloads = []
        for kind in ("input", "bootstrap"):
            path = Path(self.directory.name) / kind
            raw = kind.encode()
            path.write_bytes(raw)
            self.payloads.append(Payload(path, hashlib.sha256(raw).hexdigest(), len(raw), kind))
        self.quantities = Quantities(1, 3, 2, 1, 64, 3309418)
        self.now = 10

    def budget(self):
        return Budget(self.quantities, tuple(self.payloads), lambda: self.now)

    def test_exact_priced_cost_contract(self):
        contract = cost_contract()
        self.assertEqual(contract["expectedCAD"], "4.8973042")
        self.assertEqual(contract["ceilingCAD"], "7.35")
        self.assertEqual(contract["authority"], "NONE_LOCAL_ONLY")

    def test_wrong_size_hash_or_duplicate_rejected(self):
        bad = Payload(self.payloads[0].path, self.payloads[0].sha256, 100, "input")
        with self.assertRaisesRegex(RuntimeError, "DRIFT"):
            Budget(self.quantities, (bad, self.payloads[1]))
        with self.assertRaisesRegex(RuntimeError, "CENSUS"):
            Budget(self.quantities, (*self.payloads, self.payloads[0]))

    def test_resource_quantity_ceiling(self):
        with self.assertRaisesRegex(RuntimeError, "QUANTITY_CEILING"):
            Budget(Quantities(2, 3, 2, 1, 64, 3309418), tuple(self.payloads))

    def test_transaction_hard_threshold(self):
        budget = self.budget()
        budget.before_transaction_mutation()
        self.now += 14399
        budget.before_transaction_mutation()
        self.now += 1
        with self.assertRaisesRegex(RuntimeError, "TRANSACTION_LIFETIME"):
            budget.before_transaction_mutation()

    def test_vm_hard_threshold_and_no_second_vm(self):
        budget = self.budget()
        budget.before_vm_creation()
        with self.assertRaisesRegex(RuntimeError, "SECOND_VM"):
            budget.before_vm_creation()
        self.now += 7200
        with self.assertRaisesRegex(RuntimeError, "VM_LIFETIME"):
            budget.before_transaction_mutation()

    def test_expired_budget_allows_owned_cleanup_only(self):
        budget = self.budget()
        budget.before_vm_creation()
        self.now += 20000
        budget.cleanup_permission("/owned/vm", {"/OWNED/VM"})
        with self.assertRaisesRegex(RuntimeError, "POSITIVE_EXACT_OWNERSHIP"):
            budget.cleanup_permission("/foreign/vm", {"/owned/vm"})


if __name__ == "__main__":
    unittest.main()
