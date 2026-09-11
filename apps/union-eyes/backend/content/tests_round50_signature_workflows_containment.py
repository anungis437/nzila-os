"""
Round 50 content app signature_workflows containment test.

signature_workflows is CONTAINED_NO_AUTHORITY: its only real DB writer,
services/pki/workflow-engine.ts's createWorkflow(), has zero callers
anywhere, and every other export in that file reads from an always-empty
in-memory Map that only createWorkflow() populates — so the admin PKI
routes that do call them (recordSignature/advanceWorkflow/getWorkflow/
cancelWorkflow) are dead-in-practice against real data. The generated
Django ViewSet (content.SignatureWorkflowsViewSet) was IsAuthenticated-only
with no ownership/organization scoping — contained via a local
DenyAllPermission. The same table is also duplicate-exposed via
services.api.signature_service_views.SignatureServiceViewSet, contained
the same way in that module.

Run with:

    python -m unittest content.tests_round50_signature_workflows_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from content import views  # noqa: E402
from services.api import signature_service_views  # noqa: E402


class Round50SignatureWorkflowsContainmentTests(unittest.TestCase):
    def test_signature_workflows_viewset_uses_deny_all(self):
        self.assertEqual(
            views.SignatureWorkflowsViewSet.permission_classes,
            [views.DenyAllPermission],
        )

    def test_signature_service_viewset_uses_deny_all(self):
        self.assertEqual(
            signature_service_views.SignatureServiceViewSet.permission_classes,
            [signature_service_views.DenyAllPermission],
        )

    def test_content_deny_all_denies_authenticated_and_anonymous_requests(self):
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

    def test_signature_service_deny_all_denies_authenticated_and_anonymous_requests(self):
        permission = signature_service_views.DenyAllPermission()
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
