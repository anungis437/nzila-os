"""
Round 42 alert_recipients containment test.

The census's TS references to 'alertRecipients' were all false positives —
a jsonb field/prop name on unrelated KPI/target records in
actions/analytics-actions.ts, components/analytics/kpi-builder-dialog.tsx,
and components/targets/targets-console.tsx — not an import of the actual
alertRecipients Drizzle table export. The generated Django AlertRecipients
ViewSet had zero legitimate consumer and previously exposed
queryset=Model.objects.all() + IsAuthenticated-only with a client-controlled,
unenforced alert_rule_id filterset field — contained via DenyAllPermission.

Run with:

    python -m unittest core.tests_round42_alert_recipients_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from core import views  # noqa: E402


class Round42AlertRecipientsContainmentTests(unittest.TestCase):
    def test_alert_recipients_viewset_uses_deny_all(self):
        self.assertEqual(
            views.AlertRecipientsViewSet.permission_classes, [views.DenyAllPermission]
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
