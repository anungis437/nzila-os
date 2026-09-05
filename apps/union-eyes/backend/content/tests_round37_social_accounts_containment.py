"""
Round 37 wiring-lock tests: social_accounts OAuth credential authority
Django containment.

Evidence chain (see db/rls-storage-authority/finance.ts for the full
reasoning): SocialAccountsViewSet is a full ModelViewSet with
queryset=SocialAccounts.objects.all(), permission_classes=[IsAuthenticated]
only, and filterset_fields=['organization_id'] (query-filterable, not
queryset-scoped) — router-registered at api/content/social-accounts/ (REAL,
not theoretical reachability). The generated Django model maps only
`organization` (BaseModel id/created_at/updated_at + the FK) — none of the
canonical access_token/refresh_token/token_expires_at/platform/
platform_user_id/username fields exist on the model, so the DRF serializer
(fields='__all__') cannot itself leak credential values. However Django
DELETE/UPDATE/PATCH still operate on the real physical `social_accounts`
row (unmapped columns and all): an authenticated user of ANY organization
could reassign `organization_id` via PATCH/PUT (org-takeover of another
org's OAuth-connected account, including its real access_token/
refresh_token columns once "owned"), or DELETE any org's row outright — no
queryset filter restricts either operation to the caller's own
organization. No real TS or Django consumer of the REST endpoint was found
anywhere in the app (only the auto-generated SocialAccountsModelTest in
content/tests.py). Contained with a local DenyAllPermission per
the "no legitimate Django consumer" branch — same disposition as
ai_budgets (round 35) and reward_wallet_ledger/reward_budget_envelopes
(round 36).

Run via: python -m unittest content.tests_round37_social_accounts_containment -v
"""

from __future__ import annotations

import os
import unittest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from content import views  # noqa: E402
from content.models import SocialAccounts  # noqa: E402
from rest_framework import viewsets  # noqa: E402


class SocialAccountsContainmentTests(unittest.TestCase):
    """SocialAccountsViewSet must be fail-closed: no operation is authorized."""

    def test_viewset_uses_deny_permission(self):
        self.assertEqual(
            views.SocialAccountsViewSet.permission_classes,
            [views.DenyAllPermission],
        )

    def test_viewset_is_not_plain_is_authenticated(self):
        # Regression tripwire: a future edit must not silently revert the
        # ViewSet to permissions.IsAuthenticated (the pre-round-37 exposure).
        from rest_framework import permissions

        self.assertNotIn(permissions.IsAuthenticated, views.SocialAccountsViewSet.permission_classes)

    def test_viewset_remains_a_model_viewset(self):
        # Containment is via permission denial, not via narrowing the
        # viewset class — matches the ai_budgets/round-36 rewards precedent.
        self.assertTrue(issubclass(views.SocialAccountsViewSet, viewsets.ModelViewSet))

    def test_deny_permission_rejects_every_request(self):
        permission = views.DenyAllPermission()
        self.assertFalse(permission.has_permission(request=None, view=None))
        self.assertFalse(permission.has_object_permission(request=None, view=None, obj=None))

    def test_deny_permission_rejects_regardless_of_request_shape(self):
        # No client-supplied context (authenticated user, claimed org, or
        # object state) can bypass the deny — required test #8 (Django
        # cannot be used to reassign organization_id): even a request that
        # already "authenticates" as a member of the target row's own org
        # is still denied outright, so no PATCH/reassignment path exists.
        permission = views.DenyAllPermission()

        class FakeAuthenticatedRequest:
            user = object()
            organization_id = "11111111-1111-1111-1111-111111111111"

        class FakeSocialAccountRow:
            organization_id = "11111111-1111-1111-1111-111111111111"

        self.assertFalse(permission.has_permission(request=FakeAuthenticatedRequest(), view=None))
        self.assertFalse(
            permission.has_object_permission(
                request=FakeAuthenticatedRequest(), view=None, obj=FakeSocialAccountRow()
            )
        )


class SocialAccountsSchemaParityTests(unittest.TestCase):
    """Locks the proven schema drift between the Django model and the real
    physical `social_accounts` table (db/schema/social-media-schema.ts). If
    this starts failing because the model gained the missing OAuth/platform
    columns, the containment reasoning above must be re-evaluated — a
    schema fix does not by itself prove a legitimate consumer or
    organization-ownership enforcement exists.
    """

    STALE_FIELDS = {"id", "created_at", "updated_at", "organization"}
    MISSING_FROM_MODEL = {
        "platform",
        "platform_user_id",
        "username",
        "display_name",
        "access_token",
        "refresh_token",
        "token_expires_at",
        "status",
    }

    def test_model_field_set_matches_known_stale_snapshot(self):
        actual_fields = {f.name for f in SocialAccounts._meta.get_fields()}
        self.assertEqual(actual_fields, self.STALE_FIELDS)

    def test_model_is_missing_required_oauth_credential_columns(self):
        actual_fields = {f.name for f in SocialAccounts._meta.get_fields()}
        missing = self.MISSING_FROM_MODEL - actual_fields
        self.assertEqual(missing, self.MISSING_FROM_MODEL)

    def test_no_django_response_can_expose_credential_fields(self):
        # Even if permission were ever loosened, the serializer's fields='__all__'
        # can only ever emit the model's own mapped fields — never the raw
        # access_token/refresh_token columns, since those are entirely unmapped.
        actual_fields = {f.name for f in SocialAccounts._meta.get_fields()}
        self.assertNotIn("access_token", actual_fields)
        self.assertNotIn("refresh_token", actual_fields)


if __name__ == "__main__":
    unittest.main()
