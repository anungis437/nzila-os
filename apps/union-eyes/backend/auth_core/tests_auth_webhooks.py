"""
Tests for the auth provider webhook handler in auth_core/views.py.

Covers:
- HMAC signature verification (base64, multi-sig, whsec_ prefix)
- Replay protection (timestamp freshness)
- User create / update / delete handlers
- Organization create / update handlers
- Membership create / update / delete handlers
- End-to-end webhook endpoint tests with signed payloads
"""


import base64
import hashlib
import hmac
import json
import time

from auth_core.models import OrganizationMembers, Organizations
from auth_core.views import (
    _handle_membership_created,
    _handle_membership_deleted,
    _handle_membership_updated,
    _handle_organization_created,
    _handle_organization_updated,
    _handle_user_created,
    _handle_user_deleted,
    _handle_user_updated,
    _verify_auth_webhook,
)
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.test.client import RequestFactory

User = get_user_model()

# A well-known test secret — whsec_ prefix + base64 payload
TEST_WEBHOOK_SECRET = "whsec_dGVzdC1zZWNyZXQtZm9yLXVuaXQtdGVzdHM="


def _build_svix_headers(body: bytes, secret: str = TEST_WEBHOOK_SECRET):
    """Build valid Svix headers for a webhook payload."""
    svix_id = "msg_test_abc123"
    svix_timestamp = str(int(time.time()))
    signed_content = f"{svix_id}.{svix_timestamp}.{body.decode('utf-8')}"

    if secret.startswith("whsec_"):
        secret_bytes = base64.b64decode(secret[len("whsec_") :])
    else:
        secret_bytes = secret.encode("utf-8")

    signature = base64.b64encode(
        hmac.new(secret_bytes, signed_content.encode("utf-8"), hashlib.sha256).digest()
    ).decode("utf-8")

    return {
        "HTTP_SVIX_ID": svix_id,
        "HTTP_SVIX_TIMESTAMP": svix_timestamp,
        "HTTP_SVIX_SIGNATURE": f"v1,{signature}",
    }


def _make_webhook_request(factory, body: bytes, headers: dict):
    """Create a Django HttpRequest mimicking an auth provider webhook POST.

    ``body`` must be the exact raw bytes that were signed — callers should
    pass the same bytes used with ``_build_svix_headers`` so the HMAC matches.
    """
    request = factory.post(
        "/api/auth_core/webhooks/clerk/",
        data=body,
        content_type="application/json",
        **headers,
    )
    request._body = body
    return request


# ============================================================================
# 1. Signature Verification Tests
# ============================================================================


@override_settings(CLERK_WEBHOOK_SECRET=TEST_WEBHOOK_SECRET)
class AuthWebhookVerificationTest(TestCase):
    """Test _verify_auth_webhook HMAC-SHA256 base64 verification."""

    def setUp(self):
        self.factory = RequestFactory()

    def test_valid_signature_passes(self):
        body = b'{"type":"user.created","data":{}}'
        headers = _build_svix_headers(body)
        request = _make_webhook_request(self.factory, body, headers)
        self.assertTrue(_verify_auth_webhook(request))

    def test_invalid_signature_rejected(self):
        body = b'{"type":"user.created","data":{}}'
        headers = _build_svix_headers(body)
        headers["HTTP_SVIX_SIGNATURE"] = "v1,bm90LWEtdmFsaWQtc2lnbmF0dXJl"
        request = _make_webhook_request(self.factory, body, headers)
        self.assertFalse(_verify_auth_webhook(request))

    def test_missing_svix_headers_rejected(self):
        body = b'{"type":"user.created","data":{}}'
        request = _make_webhook_request(self.factory, body, {})
        self.assertFalse(_verify_auth_webhook(request))

    def test_missing_svix_id_rejected(self):
        body = b'{"type":"user.created","data":{}}'
        headers = _build_svix_headers(body)
        del headers["HTTP_SVIX_ID"]
        request = _make_webhook_request(self.factory, body, headers)
        self.assertFalse(_verify_auth_webhook(request))

    def test_stale_timestamp_rejected(self):
        """Events older than 5 minutes should be rejected (replay protection)."""
        body = b'{"type":"user.created","data":{}}'
        headers = _build_svix_headers(body)
        # Override to 10 minutes ago
        headers["HTTP_SVIX_TIMESTAMP"] = str(int(time.time()) - 600)
        # Re-sign with the stale timestamp
        svix_id = headers["HTTP_SVIX_ID"]
        signed = f"{svix_id}.{headers['HTTP_SVIX_TIMESTAMP']}.{body.decode()}"
        secret_bytes = base64.b64decode(TEST_WEBHOOK_SECRET[len("whsec_") :])
        sig = base64.b64encode(
            hmac.new(secret_bytes, signed.encode(), hashlib.sha256).digest()
        ).decode()
        headers["HTTP_SVIX_SIGNATURE"] = f"v1,{sig}"
        request = _make_webhook_request(self.factory, body, headers)
        self.assertFalse(_verify_auth_webhook(request))

    def test_multi_signature_accepted(self):
        """Svix sends space-separated sigs; accept if any matches."""
        body = b'{"type":"user.created","data":{}}'
        headers = _build_svix_headers(body)
        real_sig = headers["HTTP_SVIX_SIGNATURE"]
        headers["HTTP_SVIX_SIGNATURE"] = f"v1,aW52YWxpZC1zaWduYXR1cmU= {real_sig}"
        request = _make_webhook_request(self.factory, body, headers)
        self.assertTrue(_verify_auth_webhook(request))

    @override_settings(CLERK_WEBHOOK_SECRET="")
    def test_missing_secret_rejected(self):
        body = b'{"type":"user.created","data":{}}'
        headers = _build_svix_headers(body)
        request = _make_webhook_request(self.factory, body, headers)
        self.assertFalse(_verify_auth_webhook(request))

    def test_non_whsec_prefix_fallback(self):
        """Secrets without whsec_ prefix use raw UTF-8 bytes."""
        raw_secret = "my-raw-test-secret"
        body = b'{"type":"user.created","data":{}}'

        svix_id = "msg_test_raw"
        svix_timestamp = str(int(time.time()))
        signed = f"{svix_id}.{svix_timestamp}.{body.decode()}"
        sig = base64.b64encode(
            hmac.new(
                raw_secret.encode("utf-8"),
                signed.encode("utf-8"),
                hashlib.sha256,
            ).digest()
        ).decode()

        headers = {
            "HTTP_SVIX_ID": svix_id,
            "HTTP_SVIX_TIMESTAMP": svix_timestamp,
            "HTTP_SVIX_SIGNATURE": f"v1,{sig}",
        }

        with self.settings(CLERK_WEBHOOK_SECRET=raw_secret):
            request = _make_webhook_request(self.factory, body, headers)
            self.assertTrue(_verify_auth_webhook(request))


# ============================================================================
# 2. User Handler Tests
# ============================================================================


class AuthUserHandlerTest(TestCase):
    """Test user.created / updated / deleted handlers."""

    def test_handle_user_created(self):
        data = {
            "id": "user_test_create_001",
            "email_addresses": [{"email_address": "alice@example.com", "id": "idn_1"}],
            "first_name": "Alice",
            "last_name": "Smith",
        }
        _handle_user_created(data)

        user = User.objects.get(username="user_test_create_001")
        self.assertEqual(user.email, "alice@example.com")
        self.assertEqual(user.first_name, "Alice")
        self.assertEqual(user.last_name, "Smith")
        self.assertTrue(user.is_active)

    def test_handle_user_created_idempotent(self):
        """Duplicate user.created events should not raise."""
        data = {
            "id": "user_test_idem",
            "email_addresses": [{"email_address": "dup@example.com"}],
            "first_name": "Dup",
            "last_name": "User",
        }
        _handle_user_created(data)
        _handle_user_created(data)  # no error
        self.assertEqual(User.objects.filter(username="user_test_idem").count(), 1)

    def test_handle_user_created_no_email(self):
        """Missing email_addresses array should default to empty string."""
        data = {"id": "user_test_noemail", "first_name": "NoEmail"}
        _handle_user_created(data)
        user = User.objects.get(username="user_test_noemail")
        self.assertEqual(user.email, "")

    def test_handle_user_updated(self):
        User.objects.create_user(
            username="user_test_update",
            email="old@example.com",
            first_name="Old",
            last_name="Name",
        )
        data = {
            "id": "user_test_update",
            "email_addresses": [{"email_address": "new@example.com"}],
            "first_name": "New",
            "last_name": "Name",
        }
        _handle_user_updated(data)

        user = User.objects.get(username="user_test_update")
        self.assertEqual(user.email, "new@example.com")
        self.assertEqual(user.first_name, "New")

    def test_handle_user_updated_no_changes(self):
        """No-op if nothing changed — should not error."""
        User.objects.create_user(
            username="user_test_noop",
            email="same@example.com",
            first_name="Same",
            last_name="Person",
        )
        data = {
            "id": "user_test_noop",
            "email_addresses": [{"email_address": "same@example.com"}],
            "first_name": "Same",
            "last_name": "Person",
        }
        _handle_user_updated(data)  # should not raise

    def test_handle_user_updated_missing_user(self):
        """user.updated for non-existent user should log warning, not crash."""
        data = {
            "id": "user_nonexistent",
            "email_addresses": [{"email_address": "x@x.com"}],
            "first_name": "X",
            "last_name": "X",
        }
        _handle_user_updated(data)  # should not raise

    def test_handle_user_deleted(self):
        User.objects.create_user(
            username="user_test_delete",
            email="del@example.com",
        )
        _handle_user_deleted({"id": "user_test_delete"})

        user = User.objects.get(username="user_test_delete")
        self.assertFalse(user.is_active)

    def test_handle_user_deleted_missing_user(self):
        """Deleting non-existent user should log warning, not crash."""
        _handle_user_deleted({"id": "user_ghost"})


# ============================================================================
# 3. Organization Handler Tests
# ============================================================================


class AuthOrganizationHandlerTest(TestCase):
    """Test organization.created / updated handlers."""

    def test_handle_organization_created(self):
        data = {
            "id": "org_test_create_001",
            "name": "CUPE Local 1000",
            "slug": "cupe-local-1000",
            "public_metadata": {"organization_type": "local"},
        }
        _handle_organization_created(data)

        org = Organizations.objects.get(auth_provider_org_id="org_test_create_001")
        self.assertEqual(org.name, "CUPE Local 1000")
        self.assertEqual(org.slug, "cupe-local-1000")
        self.assertEqual(org.organization_type, "local")
        self.assertEqual(org.status, "active")

    def test_handle_organization_created_idempotent(self):
        """Second create event should update, not duplicate."""
        data = {
            "id": "org_test_idem",
            "name": "CUPE 2000",
            "slug": "cupe-2000",
            "public_metadata": {},
        }
        _handle_organization_created(data)
        data["name"] = "CUPE 2000 Updated"
        _handle_organization_created(data)

        self.assertEqual(
            Organizations.objects.filter(auth_provider_org_id="org_test_idem").count(),
            1,
        )
        org = Organizations.objects.get(auth_provider_org_id="org_test_idem")
        self.assertEqual(org.name, "CUPE 2000 Updated")

    def test_handle_organization_created_no_slug(self):
        """Missing slug should derive from name."""
        data = {"id": "org_test_noslug", "name": "My Union"}
        _handle_organization_created(data)

        org = Organizations.objects.get(auth_provider_org_id="org_test_noslug")
        self.assertEqual(org.slug, "my-union")

    def test_handle_organization_created_missing_id(self):
        """Missing org id should return early without creating."""
        data = {"name": "No ID Org"}
        _handle_organization_created(data)
        self.assertFalse(Organizations.objects.filter(name="No ID Org").exists())

    def test_handle_organization_updated(self):
        Organizations.objects.create(
            auth_provider_org_id="org_test_update",
            name="Old Name",
            slug="old-name",
            organization_type="union",
        )
        data = {
            "id": "org_test_update",
            "name": "New Name",
            "slug": "new-name",
        }
        _handle_organization_updated(data)

        org = Organizations.objects.get(auth_provider_org_id="org_test_update")
        self.assertEqual(org.name, "New Name")
        self.assertEqual(org.slug, "new-name")
        self.assertEqual(org.display_name, "New Name")

    def test_handle_organization_updated_missing_creates(self):
        """Update for unknown org should fall back to create."""
        data = {
            "id": "org_test_fallback",
            "name": "Fallback Org",
            "slug": "fallback-org",
            "public_metadata": {"organization_type": "federation"},
        }
        _handle_organization_updated(data)

        self.assertTrue(
            Organizations.objects.filter(
                auth_provider_org_id="org_test_fallback"
            ).exists()
        )


# ============================================================================
# 4. Membership Handler Tests
# ============================================================================


class AuthMembershipHandlerTest(TestCase):
    """Test organizationMembership.created / updated / deleted handlers."""

    def setUp(self):
        self.org = Organizations.objects.create(
            auth_provider_org_id="org_mem_test",
            name="Test Org",
            slug="test-org-membership",
            organization_type="union",
        )

    def _membership_data(self, user_id="user_mem_001", role="member"):
        return {
            "public_user_data": {"user_id": user_id},
            "organization": {"id": "org_mem_test"},
            "role": role,
        }

    def test_handle_membership_created(self):
        data = self._membership_data()
        _handle_membership_created(data)

        mem = OrganizationMembers.objects.get(
            user_id="user_mem_001", organization=self.org
        )
        self.assertEqual(mem.role, "member")
        self.assertEqual(mem.status, "active")
        self.assertTrue(mem.is_primary)

    def test_handle_membership_created_idempotent(self):
        """Duplicate created events should update, not duplicate."""
        data = self._membership_data(role="member")
        _handle_membership_created(data)

        data["role"] = "admin"
        _handle_membership_created(data)

        self.assertEqual(
            OrganizationMembers.objects.filter(
                user_id="user_mem_001", organization=self.org
            ).count(),
            1,
        )
        mem = OrganizationMembers.objects.get(
            user_id="user_mem_001", organization=self.org
        )
        self.assertEqual(mem.role, "admin")

    def test_handle_membership_created_missing_org(self):
        """Membership for unknown org should log warning, not crash."""
        data = {
            "public_user_data": {"user_id": "user_orphan"},
            "organization": {"id": "org_does_not_exist"},
            "role": "member",
        }
        _handle_membership_created(data)  # should not raise
        self.assertFalse(
            OrganizationMembers.objects.filter(user_id="user_orphan").exists()
        )

    def test_handle_membership_created_missing_fields(self):
        """Missing user or org id should return early."""
        _handle_membership_created({"public_user_data": {}, "organization": {}})

    def test_handle_membership_updated(self):
        """Role change should be synced."""
        _handle_membership_created(self._membership_data(role="member"))

        _handle_membership_updated(self._membership_data(role="admin"))

        mem = OrganizationMembers.objects.get(
            user_id="user_mem_001", organization=self.org
        )
        self.assertEqual(mem.role, "admin")

    def test_handle_membership_updated_creates_if_missing(self):
        """Update for non-existent membership should fall back to create."""
        data = self._membership_data(user_id="user_new_via_update", role="admin")
        _handle_membership_updated(data)

        self.assertTrue(
            OrganizationMembers.objects.filter(
                user_id="user_new_via_update", organization=self.org
            ).exists()
        )

    def test_handle_membership_updated_missing_org(self):
        """Update for unknown org should log warning, not crash."""
        data = {
            "public_user_data": {"user_id": "user_noorg"},
            "organization": {"id": "org_ghost"},
            "role": "member",
        }
        _handle_membership_updated(data)  # should not raise

    def test_handle_membership_deleted(self):
        """Soft-delete should set status to inactive."""
        _handle_membership_created(self._membership_data(role="member"))
        _handle_membership_deleted(self._membership_data())

        mem = OrganizationMembers.objects.get(
            user_id="user_mem_001", organization=self.org
        )
        self.assertEqual(mem.status, "inactive")

    def test_handle_membership_deleted_missing_org(self):
        """Delete for unknown org should not crash."""
        data = {
            "public_user_data": {"user_id": "user_del_noorg"},
            "organization": {"id": "org_nonexistent"},
        }
        _handle_membership_deleted(data)  # should not raise

    def test_handle_membership_deleted_missing_fields(self):
        """Missing user or org should return early."""
        _handle_membership_deleted({"public_user_data": {}, "organization": {}})


# ============================================================================
# 5. End-to-End Webhook Endpoint Tests
# ============================================================================


@override_settings(CLERK_WEBHOOK_SECRET=TEST_WEBHOOK_SECRET)
class AuthWebhookEndpointTest(TestCase):
    """Test the full webhook endpoint POST → handler → DB."""

    def _post_webhook(self, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        headers = _build_svix_headers(body)
        # Django test client uses HTTP_ prefix for extra headers
        return self.client.post(
            "/api/auth_core/webhooks/clerk/",
            data=body,
            content_type="application/json",
            **headers,
        )

    def test_user_created_end_to_end(self):
        payload = {
            "type": "user.created",
            "data": {
                "id": "user_e2e_create",
                "email_addresses": [{"email_address": "e2e@test.com"}],
                "first_name": "E2E",
                "last_name": "Test",
            },
        }
        resp = self._post_webhook(payload)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(User.objects.filter(username="user_e2e_create").exists())

    def test_organization_created_end_to_end(self):
        payload = {
            "type": "organization.created",
            "data": {
                "id": "org_e2e_create",
                "name": "E2E Org",
                "slug": "e2e-org",
                "public_metadata": {"organization_type": "union"},
            },
        }
        resp = self._post_webhook(payload)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(
            Organizations.objects.filter(
                auth_provider_org_id="org_e2e_create"
            ).exists()
        )

    def test_membership_created_end_to_end(self):
        Organizations.objects.create(
            auth_provider_org_id="org_e2e_mem",
            name="E2E Mem Org",
            slug="e2e-mem-org",
            organization_type="union",
        )
        payload = {
            "type": "organizationMembership.created",
            "data": {
                "public_user_data": {"user_id": "user_e2e_mem"},
                "organization": {"id": "org_e2e_mem"},
                "role": "member",
            },
        }
        resp = self._post_webhook(payload)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(
            OrganizationMembers.objects.filter(user_id="user_e2e_mem").exists()
        )

    def test_membership_updated_end_to_end(self):
        org = Organizations.objects.create(
            auth_provider_org_id="org_e2e_upd",
            name="E2E Upd Org",
            slug="e2e-upd-org",
            organization_type="union",
        )
        OrganizationMembers.objects.create(
            user_id="user_e2e_upd",
            organization=org,
            role="member",
            status="active",
        )
        payload = {
            "type": "organizationMembership.updated",
            "data": {
                "public_user_data": {"user_id": "user_e2e_upd"},
                "organization": {"id": "org_e2e_upd"},
                "role": "admin",
            },
        }
        resp = self._post_webhook(payload)
        self.assertEqual(resp.status_code, 200)

        mem = OrganizationMembers.objects.get(user_id="user_e2e_upd")
        self.assertEqual(mem.role, "admin")

    def test_invalid_signature_returns_401(self):
        payload = {"type": "user.created", "data": {"id": "user_bad_sig"}}
        body = json.dumps(payload).encode()
        resp = self.client.post(
            "/api/auth_core/webhooks/clerk/",
            data=body,
            content_type="application/json",
            HTTP_SVIX_ID="msg_bad",
            HTTP_SVIX_TIMESTAMP=str(int(time.time())),
            HTTP_SVIX_SIGNATURE="v1,aW52YWxpZC1zaWc=",
        )
        self.assertEqual(resp.status_code, 401)
        self.assertFalse(User.objects.filter(username="user_bad_sig").exists())

    def test_unhandled_event_returns_200(self):
        """Unknown event types should return 200 (acknowledged, not retried)."""
        payload = {"type": "some.unknown.event", "data": {}}
        resp = self._post_webhook(payload)
        self.assertEqual(resp.status_code, 200)

    def test_get_method_rejected(self):
        """Only POST is allowed."""
        resp = self.client.get("/api/auth_core/webhooks/clerk/")
        self.assertEqual(resp.status_code, 405)
