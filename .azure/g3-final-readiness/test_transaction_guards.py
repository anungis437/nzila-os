from decimal import Decimal
import unittest

from transaction_guards import (
    ENVIRONMENT, G3_GROUP, GateFailure, OwnedResource, authorization_denied, ceiling,
    cleanup_ids, consumption_gate, invoke_once, retained_artifact_cost,
)


class Guards(unittest.TestCase):
    def test_quota_exact_threshold_and_headroom(self):
        def response(limit, used=0):
            return {"value": [{"name": {"value": "ManagedEnvironmentConsumptionCores"},
                               "unit": "Count", "currentValue": used, "limit": limit}]}
        self.assertEqual(consumption_gate(ENVIRONMENT, response(1))["requiredAvailableCores"], "1.0")
        for invalid in [response(0.999), response(1, 0.001), response("10"),
                        response(float("nan")), response(1, True), response(1, -1),
                        {"value": []}, {"value": response(1)["value"] * 2},
                        {**response(1), "nextLink": "unread-page"}]:
            with self.assertRaises(GateFailure):
                consumption_gate(ENVIRONMENT, invalid)
        with self.assertRaises(GateFailure):
            consumption_gate("foreign-environment", response(10))

    def test_delete_only_exact_new_g3_resources(self):
        transaction = "g3-" + "a" * 32
        owned = OwnedResource(ENVIRONMENT, "TRANSACTION_CREATED", transaction, True)
        g2 = OwnedResource("/subscriptions/x/resourceGroups/g2/providers/x/y",
                           "PREEXISTING_REFERENCED", "", False)
        self.assertEqual(cleanup_ids([owned, g2], transaction), [ENVIRONMENT])
        for invalid in [
            OwnedResource(g2.resource_id, "TRANSACTION_CREATED", transaction, True),
            OwnedResource(ENVIRONMENT, "TRANSACTION_CREATED", transaction, False),
            OwnedResource(ENVIRONMENT, "TRANSACTION_CREATED", "foreign", True),
            OwnedResource(G3_GROUP + "-foreign/providers/x/y", "TRANSACTION_CREATED", transaction, True),
            OwnedResource(G3_GROUP + "/providers/Microsoft.Authorization/roleAssignments/x",
                          "TRANSACTION_CREATED", transaction, True),
        ]:
            with self.assertRaises(GateFailure):
                cleanup_ids([invalid], transaction)
        with self.assertRaises(GateFailure):
            cleanup_ids([owned, owned], transaction)

    def test_error_is_terminal_without_retry(self):
        calls = []

        def operation():
            calls.append("attempt")
            raise GateFailure("TRANSACTION_FAILED")
        with self.assertRaises(GateFailure):
            invoke_once(operation)
        self.assertEqual(calls, ["attempt"])

    def test_denial_not_transport_or_missing_object(self):
        for code in (401, 403):
            self.assertEqual(authorization_denied(code, True, True, True), "DENIED")
        for code in (200, 202, 307, 400, 404, 429, 500):
            with self.assertRaises(GateFailure):
                authorization_denied(code, True, True, True)
        for args in [(403, False, True, True), (403, True, False, True),
                     (403, True, True, False), (403, True, True, True, "DNS_FAILED")]:
            with self.assertRaises(GateFailure):
                authorization_denied(*args)

    def test_cost_contingency_and_storage_units(self):
        self.assertEqual(ceiling(Decimal("10"), Decimal("15")), Decimal("15"))
        with self.assertRaises(GateFailure):
            ceiling(Decimal("10"), Decimal("14.99"))
        self.assertEqual(retained_artifact_cost(10**9), Decimal("0.141655"))
        with self.assertRaises(GateFailure):
            retained_artifact_cost(True)


if __name__ == "__main__":
    unittest.main()
