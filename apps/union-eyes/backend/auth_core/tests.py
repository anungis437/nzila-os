"""
Tests for auth_core models.
"""

import uuid

from django.test import TestCase
from django.utils import timezone

from .models import (
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


class OrganizationsModelTest(TestCase):
    """Test Organizations model — the central multi-tenant model."""

    def test_create(self):
        obj = Organizations.objects.create(
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
        obj = Organizations.objects.create(
            name="PSAC", slug="psac", organization_type="union"
        )
        self.assertEqual(str(obj), "PSAC")

    def test_hierarchy(self):
        parent = Organizations.objects.create(
            name="CLC", slug="clc", organization_type="congress"
        )
        child = Organizations.objects.create(
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
        obj = InternationalAddresses.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)

    def test_str(self):
        obj = InternationalAddresses.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class CountryAddressFormatsModelTest(TestCase):
    def test_create(self):
        obj = CountryAddressFormats.objects.create(
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
        obj = CountryAddressFormats.objects.create(
            country_code="US",
            country_name="United States",
            address_format="{line1}\n{city}, {state} {zip}",
        )
        self.assertIsInstance(str(obj), str)


class AddressValidationCacheModelTest(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = AddressValidationCache.objects.create(
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
        obj = AddressValidationCache.objects.create(
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
        obj = AddressChangeHistory.objects.create(address_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = AddressChangeHistory.objects.create(address_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class FeatureFlagsModelTest(TestCase):
    def test_create(self):
        obj = FeatureFlags.objects.create(
            name="enable_sms_campaigns",
            type="boolean",
            enabled=True,
            description="Enable SMS campaign feature",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.name, "enable_sms_campaigns")
        self.assertTrue(obj.enabled)

    def test_str(self):
        obj = FeatureFlags.objects.create(name="dark_mode", enabled=False)
        self.assertEqual(str(obj), "dark_mode")


class OrganizationSharingSettingsModelTest(TestCase):
    def test_create(self):
        obj = OrganizationSharingSettings.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = OrganizationSharingSettings.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class CrossOrgAccessLogModelTest(TestCase):
    def test_create(self):
        obj = CrossOrgAccessLog.objects.create(user_id="clerk_user_789")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "clerk_user_789")

    def test_str(self):
        obj = CrossOrgAccessLog.objects.create(user_id="clerk_user_790")
        self.assertIsInstance(str(obj), str)


class OrganizationSharingGrantsModelTest(TestCase):
    def test_create(self):
        obj = OrganizationSharingGrants.objects.create(grantor_org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = OrganizationSharingGrants.objects.create(grantor_org_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class UserUuidMappingModelTest(TestCase):
    def test_create(self):
        obj = UserUuidMapping.objects.create(
            clerk_user_id="clerk_abc123",
            created_at=timezone.now(),
        )
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.user_uuid)
        self.assertEqual(obj.clerk_user_id, "clerk_abc123")

    def test_str(self):
        obj = UserUuidMapping.objects.create(
            clerk_user_id="clerk_xyz456",
            created_at=timezone.now(),
        )
        self.assertIsInstance(str(obj), str)


class PendingProfilesModelTest(TestCase):
    def test_create(self):
        obj = PendingProfiles.objects.create(
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
        obj = PendingProfiles.objects.create(
            email="test@test.ca",
            created_at=timezone.now(),
        )
        self.assertEqual(str(obj), "test@test.ca")


class ProfilesModelTest(TestCase):
    def test_create(self):
        obj = Profiles.objects.create(
            user_id="clerk_user_001",
            email="member@local1000.ca",
            membership="pro",
            payment_provider="stripe",
            created_at=timezone.now(),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.membership, "pro")
        self.assertEqual(obj.user_id, "clerk_user_001")

    def test_str(self):
        obj = Profiles.objects.create(
            user_id="clerk_002",
            email="p@test.ca",
            created_at=timezone.now(),
        )
        self.assertEqual(str(obj), "p@test.ca")


class UsersModelTest(TestCase):
    def test_create(self):
        obj = Users.objects.create(user_id="clerk_user_100")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "clerk_user_100")

    def test_str(self):
        obj = Users.objects.create(user_id="clerk_user_101")
        self.assertIsInstance(str(obj), str)


class OrganizationUsersModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="OU Org", slug="test-ou", organization_type="union"
        )
        obj = OrganizationUsers.objects.create(organization=org)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.organization_user_id)

    def test_str(self):
        org = Organizations.objects.create(
            name="OU Org 2", slug="test-ou-str", organization_type="union"
        )
        obj = OrganizationUsers.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class UserSessionsModelTest(TestCase):
    def test_create(self):
        obj = UserSessions.objects.create(user_id="clerk_user_200")
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.session_id)

    def test_str(self):
        obj = UserSessions.objects.create(user_id="clerk_user_201")
        self.assertIsInstance(str(obj), str)


class OauthProvidersModelTest(TestCase):
    def test_create(self):
        obj = OauthProviders.objects.create(user_id="clerk_user_300")
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.provider_id)

    def test_str(self):
        obj = OauthProviders.objects.create(user_id="clerk_user_301")
        self.assertIsInstance(str(obj), str)


class MemberContactPreferencesModelTest(TestCase):
    def test_create(self):
        uid = uuid.uuid4()
        obj = MemberContactPreferences.objects.create(
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
        obj = MemberContactPreferences.objects.create(
            user_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


class MemberEmploymentDetailsModelTest(TestCase):
    def test_create(self):
        uid = uuid.uuid4()
        obj = MemberEmploymentDetails.objects.create(
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
        obj = MemberEmploymentDetails.objects.create(
            user_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
            classification="Tech I",
        )
        self.assertIsInstance(str(obj), str)


class MemberConsentsModelTest(TestCase):
    def test_create(self):
        obj = MemberConsents.objects.create(
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
        obj = MemberConsents.objects.create(
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
        obj = MemberHistoryEvents.objects.create(
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
        obj = MemberHistoryEvents.objects.create(
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
        org = Organizations.objects.create(
            name="OM Org", slug="test-org-members", organization_type="union"
        )
        obj = OrganizationMembers.objects.create(
            user_id="clerk_user_500",
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
        org = Organizations.objects.create(
            name="OM Org 2", slug="test-org-members-str", organization_type="union"
        )
        obj = OrganizationMembers.objects.create(
            user_id="clerk_501",
            organization=org,
            role="steward",
            status="active",
        )
        self.assertIsInstance(str(obj), str)


class SsoProvidersModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="SSO Org", slug="test-sso", organization_type="union"
        )
        obj = SsoProviders.objects.create(organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="SSO Org 2", slug="test-sso-str", organization_type="union"
        )
        obj = SsoProviders.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class ScimConfigurationsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="SCIM Org", slug="test-scim", organization_type="union"
        )
        obj = ScimConfigurations.objects.create(organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="SCIM Org 2", slug="test-scim-str", organization_type="union"
        )
        obj = ScimConfigurations.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class SsoSessionsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="SSOSess Org", slug="test-sso-sess", organization_type="union"
        )
        provider = SsoProviders.objects.create(organization=org)
        obj = SsoSessions.objects.create(provider=provider)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="SSOSess Org 2", slug="test-sso-sess-str", organization_type="union"
        )
        provider = SsoProviders.objects.create(organization=org)
        obj = SsoSessions.objects.create(provider=provider)
        self.assertIsInstance(str(obj), str)


class ScimEventsLogModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="SCIMEv Org", slug="test-scim-ev", organization_type="union"
        )
        config = ScimConfigurations.objects.create(organization=org)
        obj = ScimEventsLog.objects.create(config=config)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="SCIMEv Org 2", slug="test-scim-ev-str", organization_type="union"
        )
        config = ScimConfigurations.objects.create(organization=org)
        obj = ScimEventsLog.objects.create(config=config)
        self.assertIsInstance(str(obj), str)


class MfaConfigurationsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="MFA Org", slug="test-mfa", organization_type="union"
        )
        obj = MfaConfigurations.objects.create(
            user_id=uuid.uuid4(),
            organization=org,
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="MFA Org 2", slug="test-mfa-str", organization_type="union"
        )
        obj = MfaConfigurations.objects.create(user_id=uuid.uuid4(), organization=org)
        self.assertIsInstance(str(obj), str)
