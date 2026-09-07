"""
Round 44 billing app whiplash containment test.

whiplash_violations and whiplash_prevention_audit belong to the same
dead whiplash-prevention-service.ts cluster closed round 42
(account_balance_reconciliation, payment_routing_rules,
separated_payment_transactions) — the WhiplashPreventionService class
has zero real instantiations anywhere in the TypeScript app. The
generated Django ViewSets exposed queryset=Model.objects.all() +
IsAuthenticated-only with NO organization filter of any kind — contained
via the same SharedDenyAllPermission mixin used for the round-42 entries
in this cluster.

Run with:

    python -m unittest billing.tests_round44_whiplash_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from billing import views  # noqa: E402


class Round44WhiplashContainmentTests(unittest.TestCase):
    def test_whiplash_violations_viewset_uses_deny_all(self):
        self.assertEqual(
            views.WhiplashViolationsViewSet.permission_classes, [views.SharedDenyAllPermission]
        )

    def test_whiplash_prevention_audit_viewset_uses_deny_all(self):
        self.assertEqual(
            views.WhiplashPreventionAuditViewSet.permission_classes, [views.SharedDenyAllPermission]
        )

    def test_deny_all_still_denies_authenticated_and_anonymous_requests(self):
        permission = views.SharedDenyAllPermission()
        authenticated_request = MagicMock(user=MagicMock(is_authenticated=True))
        anonymous_request = MagicMock(user=MagicMock(is_authenticated=False))

        self.assertFalse(permission.has_permission(authenticated_request, MagicMock()))
        self.assertFalse(
            permission.has_object_permission(authenticated_request, MagicMock(), MagicMock())
        )
        self.assertFalse(permission.has_permission(anonymous_request, MagicMock()))
        self.assertFalse(
            permission.has_object_permission(anonymous_request, MagicMock(), MagicMock())
        )


if __name__ == "__main__":
    unittest.main()
