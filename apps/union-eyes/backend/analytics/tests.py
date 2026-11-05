"""
Tests for analytics models.
"""

import uuid

from auth_core.models import Organizations
from django.test import TestCase

from .models import (
    AnalyticsMetrics,
    AnalyticsScheduledReports,
    BenchmarkCategories,
    BenchmarkData,
    CommunicationAnalytics,
    ComparativeAnalyses,
    ContributionRates,
    CostOfLivingData,
    ExternalDataSyncLog,
    InsightRecommendations,
    KpiConfigurations,
    OrganizationBenchmarkSnapshots,
    PageAnalytics,
    ReportDeliveryHistory,
    ReportExecutions,
    Reports,
    ReportShares,
    ReportTemplates,
    ScheduledReports,
    TrendAnalyses,
    UnionDensity,
    UserEngagementScores,
    WageBenchmarks,
)
from core.testing import create_valid


class AnalyticsScheduledReportsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(AnalyticsScheduledReports, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)

    def test_str(self):
        obj = create_valid(AnalyticsScheduledReports, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ReportDeliveryHistoryModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ReportDeliveryHistory, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)

    def test_str(self):
        obj = create_valid(ReportDeliveryHistory, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class BenchmarkCategoriesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(BenchmarkCategories,
            category_name="member_retention",
            display_name="Member Retention",
            category_group="membership",
            unit_type="percentage",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.category_name, "member_retention")
        self.assertEqual(obj.display_name, "Member Retention")
        self.assertTrue(obj.higher_is_better)

    def test_str(self):
        obj = create_valid(BenchmarkCategories,
            category_name="engagement_rate",
            display_name="Engagement Rate",
            category_group="engagement",
            unit_type="percentage",
        )
        self.assertIsInstance(str(obj), str)


class BenchmarkDataModelTest(TestCase):
    def test_create(self):
        cat_id = uuid.uuid4()
        obj = create_valid(BenchmarkData, benchmark_category_id=cat_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.benchmark_category_id, cat_id)

    def test_str(self):
        obj = create_valid(BenchmarkData, benchmark_category_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class OrganizationBenchmarkSnapshotsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(OrganizationBenchmarkSnapshots,
            organization_id=uuid.uuid4()
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(OrganizationBenchmarkSnapshots,
            organization_id=uuid.uuid4()
        )
        self.assertIsInstance(str(obj), str)


class AnalyticsMetricsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Analytics Org",
            slug="test-analytics-metrics",
            organization_type="union",
        )
        obj = create_valid(AnalyticsMetrics, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="Org", slug="test-analytics-metrics-str", organization_type="union"
        )
        obj = create_valid(AnalyticsMetrics, organization=org)
        self.assertIsInstance(str(obj), str)


class KpiConfigurationsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="KPI Org", slug="test-kpi-configs", organization_type="union"
        )
        obj = create_valid(KpiConfigurations, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="Org", slug="test-kpi-configs-str", organization_type="union"
        )
        obj = create_valid(KpiConfigurations, organization=org)
        self.assertIsInstance(str(obj), str)


class TrendAnalysesModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Trend Org", slug="test-trend-analyses", organization_type="union"
        )
        obj = create_valid(TrendAnalyses, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="Org", slug="test-trend-analyses-str", organization_type="union"
        )
        obj = create_valid(TrendAnalyses, organization=org)
        self.assertIsInstance(str(obj), str)


class InsightRecommendationsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Insight Org", slug="test-insight-recs", organization_type="union"
        )
        obj = create_valid(InsightRecommendations, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="Org", slug="test-insight-recs-str", organization_type="union"
        )
        obj = create_valid(InsightRecommendations, organization=org)
        self.assertIsInstance(str(obj), str)


class ComparativeAnalysesModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Comp Org", slug="test-comp-analyses", organization_type="union"
        )
        obj = create_valid(ComparativeAnalyses, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="Org", slug="test-comp-analyses-str", organization_type="union"
        )
        obj = create_valid(ComparativeAnalyses, organization=org)
        self.assertIsInstance(str(obj), str)


class PageAnalyticsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Page Org", slug="test-page-analytics", organization_type="union"
        )
        obj = create_valid(PageAnalytics, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="Org", slug="test-page-analytics-str", organization_type="union"
        )
        obj = create_valid(PageAnalytics, organization=org)
        self.assertIsInstance(str(obj), str)


class CommunicationAnalyticsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(CommunicationAnalytics, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(CommunicationAnalytics, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class UserEngagementScoresModelTest(TestCase):
    def test_create(self):
        obj = create_valid(UserEngagementScores, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(UserEngagementScores, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ReportsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(Reports, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(Reports, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ReportTemplatesModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="Tmpl Org", slug="test-report-templates", organization_type="union"
        )
        obj = create_valid(ReportTemplates, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="Org", slug="test-report-templates-str", organization_type="union"
        )
        obj = create_valid(ReportTemplates, organization=org)
        self.assertIsInstance(str(obj), str)


class ReportExecutionsModelTest(TestCase):
    def test_create(self):
        report_id = uuid.uuid4()
        obj = create_valid(ReportExecutions,
            report_id=report_id, organization_id=uuid.uuid4()
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.report_id, report_id)

    def test_str(self):
        obj = create_valid(ReportExecutions,
            report_id=uuid.uuid4(), organization_id=uuid.uuid4()
        )
        self.assertIsInstance(str(obj), str)


class ScheduledReportsModelTest(TestCase):
    def test_create(self):
        report_id = uuid.uuid4()
        obj = create_valid(ScheduledReports,
            report_id=report_id, organization_id=uuid.uuid4()
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.report_id, report_id)

    def test_str(self):
        obj = create_valid(ScheduledReports,
            report_id=uuid.uuid4(), organization_id=uuid.uuid4()
        )
        self.assertIsInstance(str(obj), str)


class ReportSharesModelTest(TestCase):
    def test_create(self):
        report_id = uuid.uuid4()
        obj = create_valid(ReportShares,
            report_id=report_id, organization_id=uuid.uuid4()
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.report_id, report_id)

    def test_str(self):
        obj = create_valid(ReportShares,
            report_id=uuid.uuid4(), organization_id=uuid.uuid4()
        )
        self.assertIsInstance(str(obj), str)


class WageBenchmarksModelTest(TestCase):
    def test_create(self):
        obj = create_valid(WageBenchmarks, noc_code="21234")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.noc_code, "21234")

    def test_str(self):
        obj = create_valid(WageBenchmarks, noc_code="21235")
        self.assertIsInstance(str(obj), str)


class UnionDensityModelTest(TestCase):
    def test_create(self):
        obj = create_valid(UnionDensity, geography_code="CA-ON")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.geography_code, "CA-ON")

    def test_str(self):
        obj = create_valid(UnionDensity, geography_code="CA-QC")
        self.assertIsInstance(str(obj), str)


class CostOfLivingDataModelTest(TestCase):
    def test_create(self):
        obj = create_valid(CostOfLivingData, geography_code="CA-BC")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.geography_code, "CA-BC")

    def test_str(self):
        obj = create_valid(CostOfLivingData, geography_code="CA-AB")
        self.assertIsInstance(str(obj), str)


class ContributionRatesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ContributionRates, rate_type="per_capita")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.rate_type, "per_capita")

    def test_str(self):
        obj = create_valid(ContributionRates, rate_type="flat")
        self.assertIsInstance(str(obj), str)


class ExternalDataSyncLogModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalDataSyncLog, source="stats_canada")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.source, "stats_canada")

    def test_str(self):
        obj = create_valid(ExternalDataSyncLog, source="bank_of_canada")
        self.assertIsInstance(str(obj), str)
