"""Held reward/provider/automation REST handlers must deny before effects."""
from pathlib import Path
import re
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.viewsets import ModelViewSet

from content.urls import router as content_router
from core.urls import router as core_router
from unions.urls import router as unions_router


REWARD_TABLES = frozenset({
    "recognition_programs", "recognition_award_types", "recognition_awards",
    "reward_wallet_ledger", "reward_budget_envelopes", "reward_redemptions",
    "budget_pool", "budget_reservations", "award_templates", "award_history",
    "automation_rules", "automation_execution_log", "shopify_config", "webhook_receipts",
})
ROLES = ("member", "steward", "officer", "executive", "admin")
EXPOSED_ACTIONS = (
    ("get", "list"), ("post", "create"), ("get", "retrieve"),
    ("put", "update"), ("patch", "partial_update"), ("delete", "destroy"),
)


def collect_reward_endpoints():
    """Resolve exact source-owned models through their actual DRF registries.

    Shopify webhook secret versions is the fifteenth source table, declared
    only in Drizzle; it must never manufacture an extra Django endpoint.
    """
    contract_path = (
        Path(__file__).resolve().parents[2]
        / "scripts/bootstrap-v2/rewards-storage-contract.ts"
    )
    declaration = contract_path.read_text().split(
        "export const CURRENT_REWARDS_MODEL_OWNERS:", 1
    )[1].split("const reviewedDeclarations", 1)[0]
    entries = re.findall(
        r"^\s+(\w+): owner\('([a-z_]+)', '([A-Za-z]+)', ([a-z_]+)\),$",
        declaration, re.MULTILINE,
    )
    if len(entries) != 14 or {entry[0] for entry in entries} != REWARD_TABLES:
        raise AssertionError("Exact fourteen current-source reward models required")
    owners = {table: (app, model) for table, app, model, _ in entries}
    if any(app != source for _, app, _, source in entries):
        raise AssertionError("Reward model source must match its declared app")
    endpoints = {}
    for router in (unions_router, core_router, content_router):
        for _, endpoint, _ in router.registry:
            model = endpoint.queryset.model
            table = model._meta.db_table
            if table not in owners:
                continue
            if table in endpoints:
                raise AssertionError("Duplicate registered reward model: " + table)
            if (model._meta.app_label, model.__name__) != owners[table]:
                raise AssertionError("Registered reward model differs from source: " + table)
            if not issubclass(endpoint, ModelViewSet) or not all(
                hasattr(endpoint, action) for _, action in EXPOSED_ACTIONS
            ):
                raise AssertionError("Exact six-action reward ModelViewSet required: " + table)
            endpoints[table] = endpoint
    if set(endpoints) != REWARD_TABLES:
        raise AssertionError("Incomplete actual registered reward endpoint census")
    return [endpoints[table] for table in sorted(endpoints)]


class BaseReleaseRewardsBoundary(SimpleTestCase):
    def test_every_registered_held_reward_view_denies_every_role_and_action_without_effects(self):
        endpoints = collect_reward_endpoints()
        self.assertEqual(len(endpoints), 14)
        self.assertEqual(len(set(endpoints)), 14)
        factory = APIRequestFactory()
        for endpoint in endpoints:
            for role in ROLES:
                actor = SimpleNamespace(
                    is_authenticated=True, is_active=True,
                    organization_role=role, is_system_admin=role == "admin",
                )
                for method, action in EXPOSED_ACTIONS:
                    with self.subTest(endpoint=endpoint.__name__, role=role, action=action):
                        request = getattr(factory, method)(
                            "/synthetic-held-rewards-boundary/",
                            {"organization_id": "66666666-6666-4666-8666-666666666666",
                             "org_id": "66666666-6666-4666-8666-666666666666",
                             "amount": "99.00", "status": "approved",
                             "triggered_by": "synthetic-held-action"},
                            format="json",
                        )
                        force_authenticate(request, user=actor)
                        with patch(
                            "django.db.backends.utils.CursorWrapper.execute",
                            side_effect=AssertionError("Reward handler attempted SQL before denial"),
                        ) as sql, patch(
                            "django.db.backends.utils.CursorWrapper.executemany",
                            side_effect=AssertionError("Reward handler attempted bulk SQL before denial"),
                        ) as bulk_sql, patch(
                            "socket.socket.connect",
                            side_effect=AssertionError("Reward handler attempted provider connection before denial"),
                        ) as provider_connect:
                            response = endpoint.as_view({method: action})(
                                request, pk="77777777-7777-4777-8777-777777777777",
                            )
                        self.assertEqual(response.status_code, 403)
                        sql.assert_not_called()
                        bulk_sql.assert_not_called()
                        provider_connect.assert_not_called()
