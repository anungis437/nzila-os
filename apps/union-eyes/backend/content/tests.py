"""
Tests for content models.
"""

import uuid

from auth_core.models import Organizations
from django.test import TestCase
from django.utils import timezone

from .models import (
    BoardPacketDistributions,
    BoardPackets,
    BoardPacketSections,
    BoardPacketTemplates,
    CaseStudies,
    CmsBlocks,
    CmsMediaLibrary,
    CmsNavigationMenus,
    CmsPages,
    CmsTemplates,
    DataAggregationConsent,
    DocumentFolders,
    Documents,
    DocumentSigners,
    EventCheckIns,
    EventRegistrations,
    ImpactMetrics,
    JobApplications,
    JobPostings,
    JobSaved,
    MemberDocuments,
    MovementTrends,
    OrganizerImpacts,
    PilotApplications,
    PilotMetrics,
    PublicContent,
    PublicEvents,
    ShopifyConfig,
    SignatureAuditLog,
    SignatureAuditTrail,
    SignatureDocuments,
    SignatureTemplates,
    SignatureVerification,
    SignatureWebhooksLog,
    SignatureWorkflows,
    Signers,
    SocialAccounts,
    SocialAnalytics,
    SocialCampaigns,
    SocialEngagement,
    SocialFeeds,
    SocialPosts,
    Testimonials,
    WebhookReceipts,
    WebsiteSettings,
)
from core.testing import create_valid

# ---------------------------------------------------------------------------
# Board packets
# ---------------------------------------------------------------------------


class BoardPacketsModelTest(TestCase):
    """__str__ = title."""

    def test_create(self):
        obj = create_valid(BoardPackets, title="Q1 Board Packet")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.title, "Q1 Board Packet")

    def test_str(self):
        obj = create_valid(BoardPackets, title="Q2 Board Packet")
        self.assertEqual(str(obj), "Q2 Board Packet")


class BoardPacketSectionsModelTest(TestCase):
    def test_create(self):
        pkt = create_valid(BoardPackets, title="BPS Packet")
        obj = create_valid(BoardPacketSections, packet=pkt)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.packet, pkt)

    def test_str(self):
        pkt = create_valid(BoardPackets, title="BPS Packet 2")
        obj = create_valid(BoardPacketSections, packet=pkt)
        self.assertIsInstance(str(obj), str)


class BoardPacketDistributionsModelTest(TestCase):
    def test_create(self):
        pkt = create_valid(BoardPackets, title="BPD Packet")
        obj = create_valid(BoardPacketDistributions, packet=pkt)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        pkt = create_valid(BoardPackets, title="BPD Packet 2")
        obj = create_valid(BoardPacketDistributions, packet=pkt)
        self.assertIsInstance(str(obj), str)


class BoardPacketTemplatesModelTest(TestCase):
    """__str__ = name."""

    def test_create(self):
        obj = create_valid(BoardPacketTemplates, name="Standard Template")
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(BoardPacketTemplates, name="Standard Template")
        self.assertEqual(str(obj), "Standard Template")


# ---------------------------------------------------------------------------
# CMS models (FK → Organizations)
# ---------------------------------------------------------------------------


class CmsTemplatesModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Org", slug="cms-tpl", organization_type="union"
        )
        obj = create_valid(CmsTemplates, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="Org", slug="cms-tpl-s", organization_type="union"
        )
        obj = create_valid(CmsTemplates, organization=org)
        self.assertIsInstance(str(obj), str)


class CmsPagesModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Org", slug="cms-pg", organization_type="union"
        )
        obj = create_valid(CmsPages, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="Org", slug="cms-pg-s", organization_type="union"
        )
        obj = create_valid(CmsPages, organization=org)
        self.assertIsInstance(str(obj), str)


class CmsBlocksModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Org", slug="cms-blk", organization_type="union"
        )
        obj = create_valid(CmsBlocks, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="Org", slug="cms-blk-s", organization_type="union"
        )
        obj = create_valid(CmsBlocks, organization=org)
        self.assertIsInstance(str(obj), str)


class CmsNavigationMenusModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Org", slug="cms-nav", organization_type="union"
        )
        obj = create_valid(CmsNavigationMenus, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="Org", slug="cms-nav-s", organization_type="union"
        )
        obj = create_valid(CmsNavigationMenus, organization=org)
        self.assertIsInstance(str(obj), str)


class CmsMediaLibraryModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Org", slug="cms-ml", organization_type="union"
        )
        obj = create_valid(CmsMediaLibrary, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="Org", slug="cms-ml-s", organization_type="union"
        )
        obj = create_valid(CmsMediaLibrary, organization=org)
        self.assertIsInstance(str(obj), str)


class PublicEventsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Org", slug="pub-ev", organization_type="union"
        )
        obj = create_valid(PublicEvents, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="Org", slug="pub-ev-s", organization_type="union"
        )
        obj = create_valid(PublicEvents, organization=org)
        self.assertIsInstance(str(obj), str)


class EventRegistrationsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Org", slug="ev-reg", organization_type="union"
        )
        obj = create_valid(EventRegistrations, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="ev-reg-s", organization_type="union"
        )
        obj = create_valid(EventRegistrations, organization=org)
        self.assertIsInstance(str(obj), str)


class EventCheckInsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Org", slug="ev-ci", organization_type="union"
        )
        obj = create_valid(EventCheckIns, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="ev-ci-s", organization_type="union"
        )
        obj = create_valid(EventCheckIns, organization=org)
        self.assertIsInstance(str(obj), str)


class JobPostingsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Org", slug="job-p", organization_type="union"
        )
        obj = create_valid(JobPostings, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="job-p-s", organization_type="union"
        )
        obj = create_valid(JobPostings, organization=org)
        self.assertIsInstance(str(obj), str)


class JobApplicationsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Org", slug="job-a", organization_type="union"
        )
        obj = create_valid(JobApplications, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="job-a-s", organization_type="union"
        )
        obj = create_valid(JobApplications, organization=org)
        self.assertIsInstance(str(obj), str)


class JobSavedModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Org", slug="job-sv", organization_type="union"
        )
        obj = create_valid(JobSaved, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="job-sv-s", organization_type="union"
        )
        obj = create_valid(JobSaved, organization=org)
        self.assertIsInstance(str(obj), str)


class WebsiteSettingsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Org", slug="web-st", organization_type="union"
        )
        obj = create_valid(WebsiteSettings, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="web-st-s", organization_type="union"
        )
        obj = create_valid(WebsiteSettings, organization=org)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


class DocumentFoldersModelTest(TestCase):
    def test_create(self):
        obj = create_valid(DocumentFolders, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(DocumentFolders, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class DocumentsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(Documents, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(Documents, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class PublicContentModelTest(TestCase):
    def test_create(self):
        obj = create_valid(PublicContent)
        self.assertIsNotNone(obj.id)

    def test_create_with_org(self):
        org = create_valid(Organizations,
            name="O", slug="pub-cnt", organization_type="union"
        )
        obj = create_valid(PublicContent, organization=org)
        self.assertEqual(obj.organization, org)

    def test_str(self):
        obj = create_valid(PublicContent)
        self.assertIsInstance(str(obj), str)


class MemberDocumentsModelTest(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(MemberDocuments,
            user_id="user_1",
            file_name="resume.pdf",
            file_url="https://storage.example.com/resume.pdf",
            file_size=102400,
            file_type="application/pdf",
            uploaded_at=now,
            updated_at=now,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.file_name, "resume.pdf")
        self.assertEqual(obj.file_size, 102400)

    def test_str(self):
        now = timezone.now()
        obj = create_valid(MemberDocuments,
            user_id="user_2",
            file_name="doc.pdf",
            file_url="https://storage.example.com/doc.pdf",
            file_size=5000,
            file_type="application/pdf",
            uploaded_at=now,
            updated_at=now,
        )
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Signatures
# ---------------------------------------------------------------------------


class SignatureDocumentsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SignatureDocuments, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SignatureDocuments, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class DocumentSignersModelTest(TestCase):
    def test_create(self):
        obj = create_valid(DocumentSigners, document_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(DocumentSigners)
        self.assertIsInstance(str(obj), str)


class SignatureAuditTrailModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SignatureAuditTrail, document_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SignatureAuditTrail)
        self.assertIsInstance(str(obj), str)


class SignatureTemplatesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SignatureTemplates, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SignatureTemplates)
        self.assertIsInstance(str(obj), str)


class SignatureWebhooksLogModelTest(TestCase):
    def test_create(self):
        doc = create_valid(SignatureDocuments, organization_id=uuid.uuid4())
        obj = create_valid(SignatureWebhooksLog,
            provider="docusign",
            event_type="completed",
            document=doc,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.provider, "docusign")

    def test_str(self):
        obj = create_valid(SignatureWebhooksLog,
            provider="hellosign",
            event_type="viewed",
        )
        self.assertIsInstance(str(obj), str)


class SignatureWorkflowsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SignatureWorkflows, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SignatureWorkflows)
        self.assertIsInstance(str(obj), str)


class SignersModelTest(TestCase):
    def test_create(self):
        obj = create_valid(Signers, workflow_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(Signers)
        self.assertIsInstance(str(obj), str)


class SignatureAuditLogModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SignatureAuditLog, workflow_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SignatureAuditLog)
        self.assertIsInstance(str(obj), str)


class SignatureVerificationModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SignatureVerification, workflow_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SignatureVerification)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Shopify / Webhooks
# ---------------------------------------------------------------------------


class ShopifyConfigModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ShopifyConfig, org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ShopifyConfig)
        self.assertIsInstance(str(obj), str)


class WebhookReceiptsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(WebhookReceipts, provider="stripe")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.provider, "stripe")

    def test_str(self):
        obj = create_valid(WebhookReceipts, provider="shopify")
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Social media (FK → Organizations)
# ---------------------------------------------------------------------------


class SocialAccountsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="soc-acc", organization_type="union"
        )
        obj = create_valid(SocialAccounts, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="soc-acc-s", organization_type="union"
        )
        obj = create_valid(SocialAccounts, organization=org)
        self.assertIsInstance(str(obj), str)


class SocialPostsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="soc-pst", organization_type="union"
        )
        obj = create_valid(SocialPosts, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="soc-pst-s", organization_type="union"
        )
        obj = create_valid(SocialPosts, organization=org)
        self.assertIsInstance(str(obj), str)


class SocialCampaignsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="soc-cmp", organization_type="union"
        )
        obj = create_valid(SocialCampaigns, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="soc-cmp-s", organization_type="union"
        )
        obj = create_valid(SocialCampaigns, organization=org)
        self.assertIsInstance(str(obj), str)


class SocialAnalyticsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="soc-an", organization_type="union"
        )
        obj = create_valid(SocialAnalytics, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="soc-an-s", organization_type="union"
        )
        obj = create_valid(SocialAnalytics, organization=org)
        self.assertIsInstance(str(obj), str)


class SocialFeedsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="soc-fd", organization_type="union"
        )
        obj = create_valid(SocialFeeds, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="soc-fd-s", organization_type="union"
        )
        obj = create_valid(SocialFeeds, organization=org)
        self.assertIsInstance(str(obj), str)


class SocialEngagementModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="soc-eng", organization_type="union"
        )
        obj = create_valid(SocialEngagement, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="soc-eng-s", organization_type="union"
        )
        obj = create_valid(SocialEngagement, organization=org)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Marketing / Impact
# ---------------------------------------------------------------------------


class ImpactMetricsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ImpactMetrics, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ImpactMetrics)
        self.assertIsInstance(str(obj), str)


class CaseStudiesModelTest(TestCase):
    """__str__ = title."""

    def test_create(self):
        obj = create_valid(CaseStudies,
            slug="union-success-story",
            title="Union Success Story",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.slug, "union-success-story")

    def test_str(self):
        obj = create_valid(CaseStudies,
            slug="case-study-2",
            title="Bargaining Win",
        )
        self.assertEqual(str(obj), "Bargaining Win")


class TestimonialsModelTest(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(Testimonials,
            type="quote",
            quote="Great platform",
            author="Jane Doe",
            role="President",
            created_at=now,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.author, "Jane Doe")
        self.assertFalse(obj.featured)
        self.assertEqual(obj.visibility, "public")

    def test_str(self):
        obj = create_valid(Testimonials,
            type="video",
            quote="Excellent service",
            author="John Smith",
            role="VP",
            created_at=timezone.now(),
        )
        self.assertIsInstance(str(obj), str)


class PilotApplicationsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(PilotApplications,
            organization_name="CUPE Local 1",
            organization_type="union",
            contact_name="Jane Doe",
            contact_email="jane@cupe.ca",
            member_count=500,
            jurisdictions=["Ontario"],
            sectors=["Public"],
            challenges=["Legacy systems"],
            goals=["Full digitization"],
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.member_count, 500)
        obj.refresh_from_db()
        self.assertEqual(obj.jurisdictions, ["Ontario"])

    def test_str(self):
        obj = create_valid(PilotApplications,
            organization_name="UFCW",
            organization_type="union",
            contact_name="Bob",
            contact_email="bob@ufcw.ca",
            member_count=200,
            jurisdictions=["BC"],
            sectors=["Retail"],
            challenges=["Paper"],
            goals=["Digital"],
        )
        self.assertIsInstance(str(obj), str)


class PilotMetricsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(PilotMetrics, pilot_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(PilotMetrics)
        self.assertIsInstance(str(obj), str)


class OrganizerImpactsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(OrganizerImpacts, user_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(OrganizerImpacts, user_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class DataAggregationConsentModelTest(TestCase):
    def test_create(self):
        obj = create_valid(DataAggregationConsent, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(DataAggregationConsent)
        self.assertIsInstance(str(obj), str)


class MovementTrendsModelTest(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(MovementTrends,
            category="bargaining",
            dimension="wages",
            aggregated_count=42,
            organizations_contributing=5,
            timeframe="Q1-2025",
            insights="Wage increases trending up",
            created_at=now,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.aggregated_count, 42)
        self.assertFalse(obj.legislative_brief_relevance)
        self.assertEqual(obj.confidence_level, "medium")

    def test_str(self):
        obj = create_valid(MovementTrends,
            category="organizing",
            dimension="new_certifications",
            aggregated_count=10,
            organizations_contributing=3,
            timeframe="Q2-2025",
            insights="Growth",
            created_at=timezone.now(),
        )
        self.assertIsInstance(str(obj), str)
