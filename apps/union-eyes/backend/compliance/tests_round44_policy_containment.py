"""
Round 44 compliance app policy containment test.

policy_exceptions and policy_evaluations both have real, safe TypeScript
reachability through lib/services/policy-engine.ts (transitively org-scoped
via the caller's own already-filtered policy_rules query), but the
generated Django ViewSets exposed queryset=Model.objects.all() +
IsAuthenticated-only with NO organization filter of any kind and have
zero legitimate Django consumer — contained via DenyAllPermission,
independent of the TypeScript-side closure.

Run with:

    python -m unittest compliance.tests_round44_policy_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from compliance import views  # noqa: E402


class Round44PolicyContainmentTests(unittest.TestCase):
    def test_policy_exceptions_viewset_uses_deny_all(self):
        self.assertEqual(
            views.PolicyExceptionsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_policy_evaluations_viewset_uses_deny_all(self):
        self.assertEqual(
            views.PolicyEvaluationsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_deny_all_still_denies_authenticated_and_anonymous_requests(self):
        permission = views.DenyAllPermission()
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
