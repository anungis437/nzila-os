"""Negative identity-binding tests for organization context resolution.

These are DB-free (the ORM is mocked) so they prove the *decision logic*:
the active organization is never inferred from the identity-provider tenant,
and a token's organization claim is honoured only with an active internal
membership. They are not a substitute for a credentialed integration run.
"""

from unittest import mock

from django.core.cache import cache
from django.test import SimpleTestCase
from rest_framework import exceptions

from auth_core import authentication as auth


class _Org:
    id = "11111111-1111-4111-8111-111111111111"


def _orgs(found):
    qs = mock.Mock()
    qs.filter.return_value.first.return_value = _Org() if found else None
    return qs


def _members(is_member):
    qs = mock.Mock()
    qs.filter.return_value.exists.return_value = is_member
    return qs


class ExtractOrgTests(SimpleTestCase):
    def test_tenant_id_is_never_an_organization(self):
        self.assertEqual(auth._extract_org({"sub": "u", "tid": "entra-tenant"}), (None, None))

    def test_explicit_org_claim_is_returned_as_a_claim_only(self):
        self.assertEqual(
            auth._extract_org({"org_id": "org_x", "org_role": "admin", "tid": "t"}),
            ("org_x", "admin"),
        )

    def test_legacy_nested_org_format_is_not_honoured(self):
        self.assertEqual(auth._extract_org({"o": {"id": "org_x", "rol": "admin"}}), (None, None))


class ResolveOrganizationContextTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def _resolve(self, org_found, is_member, org_id="org_x", user_id="user_1"):
        with mock.patch("auth_core.models.Organizations.objects", _orgs(org_found)), mock.patch(
            "auth_core.models.OrganizationMembers.objects", _members(is_member)
        ):
            return auth.resolve_organization_context(org_id, user_id)

    def test_no_claim_means_no_organization_context(self):
        self.assertEqual(auth.resolve_organization_context(None, "user_1"), (None, None))

    def test_active_member_of_claimed_org_is_accepted(self):
        org, org_id = self._resolve(True, True)
        self.assertEqual(org_id, _Org.id)

    def test_valid_org_claim_without_membership_is_rejected(self):
        with self.assertRaises(exceptions.AuthenticationFailed):
            self._resolve(True, False)

    def test_unknown_organization_is_rejected(self):
        with self.assertRaises(exceptions.AuthenticationFailed):
            self._resolve(False, True)

    def test_missing_principal_is_rejected_before_any_lookup(self):
        with mock.patch("auth_core.models.Organizations.objects") as orgs:
            with self.assertRaises(exceptions.AuthenticationFailed):
                auth.resolve_organization_context("org_x", None)
            orgs.filter.assert_not_called()

    def test_membership_is_rechecked_on_every_call_never_cached(self):
        with mock.patch("auth_core.models.Organizations.objects", _orgs(True)), mock.patch(
            "auth_core.models.OrganizationMembers.objects", _members(True)
        ):
            auth.resolve_organization_context("org_x", "user_1")
        # Membership is revoked/suspended after the first request: the next one must fail
        # even if the organization row itself is served from cache.
        with mock.patch("auth_core.models.Organizations.objects", _orgs(True)), mock.patch(
            "auth_core.models.OrganizationMembers.objects", _members(False)
        ):
            with self.assertRaises(exceptions.AuthenticationFailed):
                auth.resolve_organization_context("org_x", "user_1")

    def test_membership_query_requires_active_and_not_deleted(self):
        members = _members(True)
        with mock.patch("auth_core.models.Organizations.objects", _orgs(True)), mock.patch(
            "auth_core.models.OrganizationMembers.objects", members
        ):
            auth.resolve_organization_context("org_x", "user_1")
        kwargs = members.filter.call_args.kwargs
        self.assertEqual(kwargs["status"], "active")
        self.assertIs(kwargs["deleted_at__isnull"], True)
        self.assertEqual(kwargs["user_id"], "user_1")
        self.assertEqual(kwargs["organization_id"], _Org.id)


class LegacyCompatibilityTests(SimpleTestCase):
    """The pre-rename webhook URL stays reachable (and logged) until its sender is verified."""

    def test_deprecated_webhook_alias_resolves(self):
        from django.urls import reverse

        self.assertEqual(reverse("auth_core:deprecated_clerk_webhook"), "/api/auth_core/webhooks/clerk/")

    def test_deprecated_alias_applies_the_same_signature_check(self):
        from django.test import RequestFactory

        from auth_core import views

        request = RequestFactory().post(
            "/api/auth_core/webhooks/clerk/", data=b"{}", content_type="application/json"
        )
        with self.assertLogs("auth_core.views", level="WARNING") as logs:
            response = views.deprecated_clerk_webhook(request)
        self.assertEqual(response.status_code, 401)
        self.assertTrue(any("Deprecated webhook URL" in line for line in logs.output))

    def test_legacy_service_header_is_not_honoured(self):
        from django.test import RequestFactory, override_settings

        request = RequestFactory().get("/", HTTP_X_CLERK_SECRET_KEY="anything")
        with override_settings(AUTH_SECRET="a-real-service-secret"):
            self.assertIsNone(auth.APIKeyAuthentication().authenticate(request))
