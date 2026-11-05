"""
Tests for auth_core models.
"""

import uuid

from django.test import TestCase
from django.utils import timezone

from auth_core.models import (
    AddressChangeHistory,
    AddressValidationCache,
    CountryAddressFormats,
    CrossOrgAccessLog,
    FeatureFlags,
    InternationalAddresses,
    MemberConsents,
    MemberContactPreferences,
    MemberEmploymentDetails,
    MemberHistoryEvents,
    MfaConfigurations,
    OauthProviders,
    OrganizationMembers,
    Organizations,
    OrganizationSharingGrants,
    OrganizationSharingSettings,
    OrganizationUsers,
    PendingProfiles,
    Profiles,
    ScimConfigurations,
    ScimEventsLog,
    SsoProviders,
    SsoSessions,
    Users,
    UserSessions,
    UserUuidMapping,
)
from core.testing import create_valid


class OrganizationsModelTest(TestCase):
    """Test Organizations model — the central multi-org model."""

    def test_create(self):
        obj = create_valid(Organizations,
            name="CUPE Local 1000",
            slug="cupe-local-1000",
            organization_type="local",
            province_territory="ON",
            member_count=500,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.name, "CUPE Local 1000")
        self.assertEqual(obj.organization_type, "local")
        self.assertEqual(obj.status, "active")
        self.assertEqual(obj.member_count, 500)

    def test_str(self):
        obj = create_valid(Organizations,
            name="PSAC", slug="psac", organization_type="union"
        )
        self.assertEqual(str(obj), "PSAC")

    def test_hierarchy(self):
        parent = create_valid(Organizations,
            name="CLC", slug="clc", organization_type="congress"
        )
        child = create_valid(Organizations,
            name="CUPE",
            slug="cupe",
            organization_type="union",
            parent=parent,
            hierarchy_level=1,
        )
        self.assertEqual(child.parent, parent)
        self.assertEqual(child.hierarchy_level, 1)


class InternationalAddressesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(InternationalAddresses, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)

    def test_str(self):
        obj = create_valid(InternationalAddresses, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class CountryAddressFormatsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(CountryAddressFormats,
            country_code="CA",
            country_name="Canada",
            iso3_code="CAN",
            locality_label="City",
            administrative_area_label="Province",
            postal_code_label="Postal Code",
            address_format="{line1}\n{city}, {province} {postal_code}",
            postal_code_required=True,
            postal_code_pattern=r"^[A-Z]\d[A-Z]\s?\d[A-Z]\d$",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.country_code, "CA")
        self.assertEqual(obj.country_name, "Canada")
        self.assertTrue(obj.postal_code_required)

    def test_str(self):
        obj = create_valid(CountryAddressFormats,
            country_code="US",
            country_name="United States",
            address_format="{line1}\n{city}, {state} {zip}",
        )
        self.assertIsInstance(str(obj), str)


class AddressValidationCacheModelTest(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(AddressValidationCache,
            input_hash="abc123hash",
            country_code="CA",
            address_line1="123 Main St",
            locality="Toronto",
            administrative_area="ON",
            postal_code="M5V 2T6",
            is_valid=True,
            validated_by="google_maps",
            expires_at=now,
            last_hit_at=now,
            created_at=now,
        )
        self.assertIsNotNone(obj.id)
        self.assertTrue(obj.is_valid)
        self.assertEqual(obj.validated_by, "google_maps")

    def test_str(self):
        now = timezone.now()
        obj = create_valid(AddressValidationCache,
            input_hash="xyz456",
            country_code="US",
            address_line1="456 Oak Ave",
            locality="NYC",
            is_valid=False,
            validated_by="usps",
            expires_at=now,
            last_hit_at=now,
            created_at=now,
        )
        self.assertIsInstance(str(obj), str)


class AddressChangeHistoryModelTest(TestCase):
    def test_create(self):
        obj = create_valid(AddressChangeHistory, address_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(AddressChangeHistory, address_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class FeatureFlagsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(FeatureFlags,
            name="enable_sms_campaigns",
            type="boolean",
            enabled=True,
            description="Enable SMS campaign feature",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.name, "enable_sms_campaigns")
        self.assertTrue(obj.enabled)

    def test_str(self):
        obj = create_valid(FeatureFlags, name="dark_mode", enabled=False)
        self.assertEqual(str(obj), "dark_mode")


class OrganizationSharingSettingsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(OrganizationSharingSettings, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(OrganizationSharingSettings, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class CrossOrgAccessLogModelTest(TestCase):
    def test_create(self):
        obj = create_valid(CrossOrgAccessLog, user_id="user_789")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "user_789")

    def test_str(self):
        obj = create_valid(CrossOrgAccessLog, user_id="user_790")
        self.assertIsInstance(str(obj), str)


class OrganizationSharingGrantsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(OrganizationSharingGrants, grantor_org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(OrganizationSharingGrants, grantor_org_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class UserUuidMappingModelTest(TestCase):
    def test_create(self):
        obj = create_valid(UserUuidMapping,
            clerk_user_id="user_abc123",
            created_at=timezone.now(),
        )
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.user_uuid)
        self.assertEqual(obj.clerk_user_id, "user_abc123")

    def test_str(self):
        obj = create_valid(UserUuidMapping,
            clerk_user_id="user_xyz456",
            created_at=timezone.now(),
        )
        self.assertIsInstance(str(obj), str)


class PendingProfilesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(PendingProfiles,
            email="new.member@union.ca",
            token="invite-token-123",
            membership="pro",
            payment_provider="whop",
            usage_credits=100,
            created_at=timezone.now(),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.email, "new.member@union.ca")
        self.assertEqual(obj.membership, "pro")
        self.assertFalse(obj.claimed)

    def test_str(self):
        obj = create_valid(PendingProfiles,
            email="test@test.ca",
            created_at=timezone.now(),
        )
        self.assertEqual(str(obj), "test@test.ca")


class ProfilesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(Profiles,
            user_id="user_001",
            email="member@local1000.ca",
            membership="pro",
            payment_provider="stripe",
            created_at=timezone.now(),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.membership, "pro")
        self.assertEqual(obj.user_id, "user_001")

    def test_str(self):
        obj = create_valid(Profiles,
            user_id="user_002",
            email="p@test.ca",
            created_at=timezone.now(),
        )
        self.assertEqual(str(obj), "p@test.ca")


class UsersModelTest(TestCase):
    def test_create(self):
        obj = create_valid(Users, user_id="user_100")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "user_100")

    def test_str(self):
        obj = create_valid(Users, user_id="user_101")
        self.assertIsInstance(str(obj), str)


class OrganizationUsersModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="OU Org", slug="test-ou", organization_type="union"
        )
        obj = create_valid(OrganizationUsers, organization=org)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.organization_user_id)

    def test_str(self):
        org = create_valid(Organizations,
            name="OU Org 2", slug="test-ou-str", organization_type="union"
        )
        obj = create_valid(OrganizationUsers, organization=org)
        self.assertIsInstance(str(obj), str)


class UserSessionsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(UserSessions, user_id="user_200")
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.session_id)

    def test_str(self):
        obj = create_valid(UserSessions, user_id="user_201")
        self.assertIsInstance(str(obj), str)


class OauthProvidersModelTest(TestCase):
    def test_create(self):
        obj = create_valid(OauthProviders, user_id="user_300")
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.provider_id)

    def test_str(self):
        obj = create_valid(OauthProviders, user_id="user_301")
        self.assertIsInstance(str(obj), str)


class MemberContactPreferencesModelTest(TestCase):
    def test_create(self):
        uid = uuid.uuid4()
        obj = create_valid(MemberContactPreferences,
            user_id=uid,
            organization_id=uuid.uuid4(),
            preferred_contact_method="email",
            preferred_language="fr",
            email_opt_in=True,
            sms_opt_in=False,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, uid)
        self.assertEqual(obj.preferred_language, "fr")
        self.assertTrue(obj.email_opt_in)

    def test_str(self):
        obj = create_valid(MemberContactPreferences,
            user_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


class MemberEmploymentDetailsModelTest(TestCase):
    def test_create(self):
        uid = uuid.uuid4()
        obj = create_valid(MemberEmploymentDetails,
            user_id=uid,
            organization_id=uuid.uuid4(),
            classification="Clerk III",
            job_title="Senior Clerk",
            department="Administration",
            employment_status="active",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.classification, "Clerk III")
        self.assertEqual(obj.employment_status, "active")

    def test_str(self):
        obj = create_valid(MemberEmploymentDetails,
            user_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
            classification="Tech I",
        )
        self.assertIsInstance(str(obj), str)


class MemberConsentsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(MemberConsents,
            user_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
            consent_type="data_processing",
            consent_category="privacy",
            granted=True,
            granted_at=timezone.now(),
            created_at=timezone.now(),
        )
        self.assertIsNotNone(obj.id)
        self.assertTrue(obj.granted)
        self.assertEqual(obj.consent_type, "data_processing")

    def test_str(self):
        obj = create_valid(MemberConsents,
            user_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
            consent_type="marketing",
            consent_category="comms",
            created_at=timezone.now(),
        )
        self.assertIsInstance(str(obj), str)


class MemberHistoryEventsModelTest(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(MemberHistoryEvents,
            user_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
            event_type="status_change",
            event_category="membership",
            event_date=now,
            event_title="Member activated",
            created_at=now,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.event_type, "status_change")
        self.assertEqual(obj.event_title, "Member activated")

    def test_str(self):
        now = timezone.now()
        obj = create_valid(MemberHistoryEvents,
            user_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
            event_type="join",
            event_category="membership",
            event_date=now,
            event_title="Joined",
            created_at=now,
        )
        self.assertIsInstance(str(obj), str)


class OrganizationMembersModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="OM Org", slug="test-org-members", organization_type="union"
        )
        obj = create_valid(OrganizationMembers,
            user_id="user_500",
            organization=org,
            role="member",
            status="active",
            membership_number="M-10001",
            is_primary=True,
            member_category="full_member",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.role, "member")
        self.assertEqual(obj.membership_number, "M-10001")
        self.assertTrue(obj.is_primary)

    def test_str(self):
        org = create_valid(Organizations,
            name="OM Org 2", slug="test-org-members-str", organization_type="union"
        )
        obj = create_valid(OrganizationMembers,
            user_id="user_501",
            organization=org,
            role="steward",
            status="active",
        )
        self.assertIsInstance(str(obj), str)


class SsoProvidersModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="SSO Org", slug="test-sso", organization_type="union"
        )
        obj = create_valid(SsoProviders, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="SSO Org 2", slug="test-sso-str", organization_type="union"
        )
        obj = create_valid(SsoProviders, organization=org)
        self.assertIsInstance(str(obj), str)


class ScimConfigurationsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="SCIM Org", slug="test-scim", organization_type="union"
        )
        obj = create_valid(ScimConfigurations, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="SCIM Org 2", slug="test-scim-str", organization_type="union"
        )
        obj = create_valid(ScimConfigurations, organization=org)
        self.assertIsInstance(str(obj), str)


class SsoSessionsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="SSOSess Org", slug="test-sso-sess", organization_type="union"
        )
        provider = create_valid(SsoProviders, organization=org)
        obj = create_valid(SsoSessions, provider=provider)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="SSOSess Org 2", slug="test-sso-sess-str", organization_type="union"
        )
        provider = create_valid(SsoProviders, organization=org)
        obj = create_valid(SsoSessions, provider=provider)
        self.assertIsInstance(str(obj), str)


class ScimEventsLogModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="SCIMEv Org", slug="test-scim-ev", organization_type="union"
        )
        config = create_valid(ScimConfigurations, organization=org)
        obj = create_valid(ScimEventsLog, config=config)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="SCIMEv Org 2", slug="test-scim-ev-str", organization_type="union"
        )
        config = create_valid(ScimConfigurations, organization=org)
        obj = create_valid(ScimEventsLog, config=config)
        self.assertIsInstance(str(obj), str)


class MfaConfigurationsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="MFA Org", slug="test-mfa", organization_type="union"
        )
        obj = create_valid(MfaConfigurations,
            user_id=uuid.uuid4(),
            organization=org,
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="MFA Org 2", slug="test-mfa-str", organization_type="union"
        )
        obj = create_valid(MfaConfigurations, user_id=uuid.uuid4(), organization=org)
        self.assertIsInstance(str(obj), str)
