"""
Round 45 content app signature containment test.

signature_documents is TENANT_RLS_REQUIRED; document_signers is
PARENT_OWNED_RLS_REQUIRED via signature_documents. Their real Next.js
consumers (lib/signature/signature-service.ts + app/api/signatures/**)
enforce access via SignatureService.verifyDocumentAccess(), and this round
fixed a signature-forgery IDOR in SignatureService.recordSignature() (it
previously updated document_signers by id alone with no check that the
authenticated caller was the actual signer). The generated Django
ViewSets exposed queryset=Model.objects.all() + IsAuthenticated-only with
NO ownership/organization scoping of any kind — contained via the
existing Round40DenyAllPermission already used elsewhere in this file.

Run with:

    python -m unittest content.tests_round45_signature_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from content import views  # noqa: E402


class Round45SignatureContainmentTests(unittest.TestCase):
    def test_signature_documents_viewset_uses_deny_all(self):
        self.assertEqual(
            views.SignatureDocumentsViewSet.permission_classes,
            [views.Round40DenyAllPermission],
        )

    def test_document_signers_viewset_uses_deny_all(self):
        self.assertEqual(
            views.DocumentSignersViewSet.permission_classes,
            [views.Round40DenyAllPermission],
        )

    def test_deny_all_still_denies_authenticated_and_anonymous_requests(self):
        permission = views.Round40DenyAllPermission()
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
