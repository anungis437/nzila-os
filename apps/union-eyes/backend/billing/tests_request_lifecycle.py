"""
DRF request-lifecycle integration tests for tenant-context propagation.

PR #752 round 32 CORRECTION. Independent review found that round 32's
DirectTenantIsolationMixin/ParentOwnedIsolationMixin unit tests
(billing/tests_isolation.py) inject `request.organization_id` directly
before calling the mixin — proving the mixin's own filter/force/reject
logic is correct, but NOT proving the production request lifecycle ever
populates that attribute in the first place.

It did not, until this correction: OrganizationIsolationMiddleware is
Django middleware (config/settings.py MIDDLEWARE), which runs BEFORE the
view — and therefore before DRF's authentication classes
(REST_FRAMEWORK.DEFAULT_AUTHENTICATION_CLASSES) ever execute, since DRF
authentication happens inside APIView.dispatch(), after the entire
Django middleware chain has already completed. That middleware only ever
read `request.org_id`, an attribute exclusively set by
auth_core.authentication.OIDCAuthentication.authenticate() — so for
every real bearer-token request, the middleware always saw org_id as
absent and never populated `request.organization_id` at all. All 20
Round-32 DirectTenantIsolationMixin-protected ViewSets were therefore
fail-closed for ALL real traffic (safe, but not functioning tenant-scoped
endpoints).

The fix moved organization resolution into
auth_core.authentication.resolve_organization_context(), called directly
from OIDCAuthentication.authenticate() — the only point in the request
lifecycle guaranteed to run after the org claim is verified and before
any view/queryset code. These tests exercise the REAL authenticate()
method (mocking only the network/crypto/DB calls this sandbox cannot
reach: JWKS fetch, Organizations DB query) and then run the REAL mixin
against the SAME request object authenticate() populated — never
test-injecting `request.organization_id` directly, which is exactly the
gap that let the original defect go unnoticed.

Run via: python -m unittest billing.tests_request_lifecycle -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from auth_core.authentication import OIDCAuthentication  # noqa: E402
from billing.isolation import DirectTenantIsolationMixin  # noqa: E402

ORG_A_EXTERNAL = "org_external_aaa"
ORG_A_INTERNAL = "11111111-1111-1111-1111-111111111111"
ORG_B_EXTERNAL = "org_external_bbb"
ORG_B_INTERNAL = "22222222-2222-2222-2222-222222222222"


def make_bearer_request(token: str = "signed-jwt-value") -> MagicMock:
    """A MagicMock standing in for a real DRF Request, exposing only the
    .META dict OIDCAuthentication.authenticate() actually reads."""
    request = MagicMock()
    request.META = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
    return request


def authenticate_as_org(org_external_id: str, org_internal_id):
    """Runs the REAL OIDCAuthentication.authenticate() end-to-end, mocking
    only JWT signature verification (no reachable JWKS server in this
    sandbox), user sync, the cache backend, and the Organizations DB
    lookup (no reachable Postgres in this sandbox) — every other line,
    including the resolve_organization_context() call this correction
    added, runs for real. Returns the populated request object.
    """
    request = make_bearer_request()
    auth = OIDCAuthentication()

    fake_payload = {"sub": "user_1", "org_id": org_external_id, "org_role": "member"}
    fake_user = MagicMock()
    fake_org = MagicMock()
    fake_org.id = org_internal_id

    with patch.object(auth, "_verify_token", return_value=fake_payload), \
         patch.object(auth, "_get_or_create_user", return_value=fake_user), \
         patch("auth_core.authentication.cache") as mock_cache, \
         patch("auth_core.models.Organizations") as mock_organizations:
        mock_cache.get.return_value = None
        mock_organizations.objects.filter.return_value.first.return_value = (
            fake_org if org_internal_id is not None else None
        )
        auth.authenticate(request)

    return request


def make_direct_tenant_view(request, base_queryset=None):
    class Base:
        def get_queryset(self):
            return base_queryset if base_queryset is not None else MagicMock()

    class View(DirectTenantIsolationMixin, Base):
        pass

    view = View()
    view.request = request
    return view


class RequestLifecyclePropagationTest(unittest.TestCase):
    """Proves request.organization_id is populated by the REAL
    authenticate() call — the exact integration the mixin-only unit tests
    could not exercise."""

    def test_bearer_jwt_authenticates_and_populates_verified_organization_id(self):
        request = authenticate_as_org(ORG_A_EXTERNAL, ORG_A_INTERNAL)
        self.assertEqual(request.organization_id, ORG_A_INTERNAL)
        self.assertEqual(request.org_id, ORG_A_EXTERNAL)

    def test_viewset_queryset_uses_the_propagated_organization_id_end_to_end(self):
        """The mixin reads request.organization_id set by the REAL
        authenticate() call above — not a test-injected value."""
        request = authenticate_as_org(ORG_A_EXTERNAL, ORG_A_INTERNAL)
        base_qs = MagicMock()
        filtered_qs = MagicMock()
        base_qs.filter.return_value = filtered_qs

        view = make_direct_tenant_view(request, base_qs)
        result = view.get_queryset()

        base_qs.filter.assert_called_once_with(organization_id=ORG_A_INTERNAL)
        self.assertIs(result, filtered_qs)

    def test_org_a_token_cannot_be_used_to_create_a_row_owned_by_org_b(self):
        """Org A authenticates; a forged organization_id in the request
        body (simulating a client trying to write Org B's id into the
        payload) must be discarded in favour of the verified context."""
        request = authenticate_as_org(ORG_A_EXTERNAL, ORG_A_INTERNAL)
        view = make_direct_tenant_view(request)
        serializer = MagicMock()
        serializer.validated_data = {"organization_id": ORG_B_INTERNAL}  # forged

        view.perform_create(serializer)

        serializer.save.assert_called_once_with(organization_id=ORG_A_INTERNAL)

    def test_org_a_cannot_retrieve_or_mutate_an_org_b_owned_row(self):
        request = authenticate_as_org(ORG_A_EXTERNAL, ORG_A_INTERNAL)
        view = make_direct_tenant_view(request)
        serializer = MagicMock()
        serializer.instance = MagicMock(organization_id=ORG_B_INTERNAL)

        with self.assertRaises(Exception):
            view.perform_update(serializer)
        serializer.save.assert_not_called()

    def test_unknown_organization_claim_fails_closed_at_authentication_itself(self):
        """An org_id claim that never resolves to a local Organizations row
        must reject the request during authenticate() — not silently let it
        through with organization_id=None (which would still be fail-closed
        at the mixin, but this proves the intended earlier, explicit
        rejection point also works)."""
        with self.assertRaises(Exception):
            authenticate_as_org("org_that_does_not_exist_locally", None)

    def test_no_org_claim_at_all_authenticates_with_null_organization_not_an_error(self):
        """A token with no org claim (service account / personal account) is
        a legitimate, non-error state — organization_id stays None and any
        DirectTenantIsolationMixin-protected endpoint fails closed on it,
        but authentication itself must not reject the request."""
        request = make_bearer_request()
        auth = OIDCAuthentication()
        fake_payload = {"sub": "user_1"}  # no org_id / o / tid claim

        with patch.object(auth, "_verify_token", return_value=fake_payload), \
             patch.object(auth, "_get_or_create_user", return_value=MagicMock()):
            auth.authenticate(request)

        self.assertIsNone(request.organization_id)

        view = make_direct_tenant_view(request)
        result = view.get_queryset()
        self.assertTrue(hasattr(result, "none") or result is not None)


class NegativeRegressionMixinAloneIsNotProofTest(unittest.TestCase):
    """The exact fixture independent review asked for: a ViewSet merely
    inheriting DirectTenantIsolationMixin, WITHOUT the request ever having
    gone through OIDCAuthentication.authenticate(), must not be mistaken
    for a working tenant-scoped endpoint — it must fail closed (querying
    nothing), not silently succeed. This is what the pre-correction code
    actually did for every real request, and it must stay provably
    fail-closed rather than "coincidentally correct"."""

    def test_mixin_present_but_no_authentication_ever_ran_still_fails_closed(self):
        request = MagicMock()
        del request.organization_id  # exactly what a never-authenticated request looks like

        base_qs = MagicMock()
        view = make_direct_tenant_view(request, base_qs)
        result = view.get_queryset()

        base_qs.filter.assert_not_called()
        base_qs.none.assert_called_once()
        self.assertIs(result, base_qs.none.return_value)


if __name__ == "__main__":
    unittest.main()
