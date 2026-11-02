"""
Tests for core models.
"""

import uuid

from auth_core.models import Organizations
from django.test import TestCase

from core.models import (
    AlertActions,
    AlertConditions,
    AlertEscalations,
    AlertExecutions,
    AlertRecipients,
    AlertRules,
    ApiAccessTokens,
    ApiIntegrations,
    AuditLogs,
    AutomationExecutionLog,
    AutomationRules,
    AutomationSchedules,
    ExternalAccounts,
    ExternalBenefitCoverage,
    ExternalBenefitDependents,
    ExternalBenefitEnrollments,
    ExternalBenefitPlans,
    ExternalBenefitUtilization,
    ExternalCommunicationChannels,
    ExternalCommunicationFiles,
    ExternalCommunicationMessages,
    ExternalCommunicationUsers,
    ExternalCustomers,
    ExternalDepartments,
    ExternalDocumentFiles,
    ExternalDocumentLibraries,
    ExternalDocumentPermissions,
    ExternalDocumentSites,
    ExternalEmployees,
    ExternalInsuranceBeneficiaries,
    ExternalInsuranceClaims,
    ExternalInsurancePolicies,
    ExternalInvoices,
    ExternalLmsCompletions,
    ExternalLmsCourses,
    ExternalLmsEnrollments,
    ExternalLmsLearners,
    ExternalLmsProgress,
    ExternalPayments,
    ExternalPositions,
    FailedLoginAttempts,
    IntegrationApiKeys,
    IntegrationConfigs,
    IntegrationSyncLog,
    IntegrationSyncLogs,
    IntegrationSyncSchedules,
    IntegrationWebhooks,
    KnowledgeBaseArticles,
    RateLimitEvents,
    SecurityEvents,
    SlaPolicies,
    SupportTickets,
    TicketComments,
    TicketHistory,
    WebhookDeliveries,
    WebhookEvents,
    WebhookSubscriptions,
    WorkflowDefinitions,
    WorkflowExecutions,
)
from core.testing import create_valid

# ---------------------------------------------------------------------------
# Alerting
# ---------------------------------------------------------------------------


class AlertRulesModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="ar-org", organization_type="union"
        )
        obj = create_valid(AlertRules, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="ar-org-s", organization_type="union"
        )
        obj = create_valid(AlertRules, organization=org)
        self.assertIsInstance(str(obj), str)


class AlertConditionsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="ac-org", organization_type="union"
        )
        rule = create_valid(AlertRules, organization=org)
        obj = create_valid(AlertConditions, alert_rule=rule)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.alert_rule, rule)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="ac-org-s", organization_type="union"
        )
        rule = create_valid(AlertRules, organization=org)
        obj = create_valid(AlertConditions, alert_rule=rule)
        self.assertIsInstance(str(obj), str)


class AlertActionsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="aa-org", organization_type="union"
        )
        rule = create_valid(AlertRules, organization=org)
        obj = create_valid(AlertActions, alert_rule=rule)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="aa-org-s", organization_type="union"
        )
        rule = create_valid(AlertRules, organization=org)
        obj = create_valid(AlertActions, alert_rule=rule)
        self.assertIsInstance(str(obj), str)


class AlertEscalationsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="ae-org", organization_type="union"
        )
        obj = create_valid(AlertEscalations, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="ae-org-s", organization_type="union"
        )
        obj = create_valid(AlertEscalations, organization=org)
        self.assertIsInstance(str(obj), str)


class AlertExecutionsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="aex-org", organization_type="union"
        )
        rule = create_valid(AlertRules, organization=org)
        obj = create_valid(AlertExecutions, alert_rule=rule)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="aex-org-s", organization_type="union"
        )
        rule = create_valid(AlertRules, organization=org)
        obj = create_valid(AlertExecutions, alert_rule=rule)
        self.assertIsInstance(str(obj), str)


class AlertRecipientsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="arec-org", organization_type="union"
        )
        rule = create_valid(AlertRules, organization=org)
        obj = create_valid(AlertRecipients, alert_rule=rule)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="arec-org-s", organization_type="union"
        )
        rule = create_valid(AlertRules, organization=org)
        obj = create_valid(AlertRecipients, alert_rule=rule)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Workflows
# ---------------------------------------------------------------------------


class WorkflowDefinitionsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="wd-org", organization_type="union"
        )
        obj = create_valid(WorkflowDefinitions, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="wd-org-s", organization_type="union"
        )
        obj = create_valid(WorkflowDefinitions, organization=org)
        self.assertIsInstance(str(obj), str)


class WorkflowExecutionsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="we-org", organization_type="union"
        )
        wd = create_valid(WorkflowDefinitions, organization=org)
        obj = create_valid(WorkflowExecutions, workflow_definition=wd)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.workflow_definition, wd)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="we-org-s", organization_type="union"
        )
        wd = create_valid(WorkflowDefinitions, organization=org)
        obj = create_valid(WorkflowExecutions, workflow_definition=wd)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Audit / Security
# ---------------------------------------------------------------------------


class AuditLogsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(AuditLogs,
            action="create",
            resource_type="Member",
            resource_id="member-123",
            user_id="user_1",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.action, "create")

    def test_str(self):
        obj = create_valid(AuditLogs)
        self.assertIsInstance(str(obj), str)


class SecurityEventsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SecurityEvents, user_id="user_2")
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SecurityEvents)
        self.assertIsInstance(str(obj), str)


class FailedLoginAttemptsModelTest(TestCase):
    """__str__ = email."""

    def test_create(self):
        obj = create_valid(FailedLoginAttempts, email="bad@example.com")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.email, "bad@example.com")

    def test_str(self):
        obj = create_valid(FailedLoginAttempts, email="test@example.com")
        self.assertEqual(str(obj), "test@example.com")


class RateLimitEventsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(RateLimitEvents, identifier="192.168.1.1")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.identifier, "192.168.1.1")

    def test_str(self):
        obj = create_valid(RateLimitEvents)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Automation
# ---------------------------------------------------------------------------


class AutomationRulesModelTest(TestCase):
    """__str__ = name."""

    def test_create(self):
        obj = create_valid(AutomationRules, name="Auto-assign grievances")
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(AutomationRules, name="Auto-assign grievances")
        self.assertEqual(str(obj), "Auto-assign grievances")


class AutomationExecutionLogModelTest(TestCase):
    def test_create(self):
        rule = create_valid(AutomationRules, name="Rule AEL")
        obj = create_valid(AutomationExecutionLog, rule=rule)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.rule, rule)

    def test_str(self):
        rule = create_valid(AutomationRules, name="Rule AEL-S")
        obj = create_valid(AutomationExecutionLog, rule=rule)
        self.assertIsInstance(str(obj), str)


class AutomationSchedulesModelTest(TestCase):
    def test_create(self):
        rule = create_valid(AutomationRules, name="Rule AS")
        obj = create_valid(AutomationSchedules, rule=rule, schedule_type="cron")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.schedule_type, "cron")

    def test_str(self):
        rule = create_valid(AutomationRules, name="Rule AS-S")
        obj = create_valid(AutomationSchedules, rule=rule)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# External integrations — accounting
# ---------------------------------------------------------------------------


class ExternalInvoicesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalInvoices, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalInvoices)
        self.assertIsInstance(str(obj), str)


class ExternalPaymentsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalPayments, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalPayments)
        self.assertIsInstance(str(obj), str)


class ExternalCustomersModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalCustomers, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalCustomers)
        self.assertIsInstance(str(obj), str)


class ExternalAccountsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalAccounts, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalAccounts)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# External integrations — communication
# ---------------------------------------------------------------------------


class ExternalCommunicationChannelsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalCommunicationChannels, org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalCommunicationChannels)
        self.assertIsInstance(str(obj), str)


class ExternalCommunicationMessagesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalCommunicationMessages, org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalCommunicationMessages)
        self.assertIsInstance(str(obj), str)


class ExternalCommunicationUsersModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalCommunicationUsers, org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalCommunicationUsers)
        self.assertIsInstance(str(obj), str)


class ExternalCommunicationFilesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalCommunicationFiles, org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalCommunicationFiles)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# External integrations — documents
# ---------------------------------------------------------------------------


class ExternalDocumentSitesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalDocumentSites, org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalDocumentSites)
        self.assertIsInstance(str(obj), str)


class ExternalDocumentLibrariesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalDocumentLibraries, org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalDocumentLibraries)
        self.assertIsInstance(str(obj), str)


class ExternalDocumentFilesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalDocumentFiles, org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalDocumentFiles)
        self.assertIsInstance(str(obj), str)


class ExternalDocumentPermissionsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalDocumentPermissions, org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalDocumentPermissions)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# External integrations — HRIS
# ---------------------------------------------------------------------------


class ExternalEmployeesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalEmployees, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalEmployees)
        self.assertIsInstance(str(obj), str)


class ExternalPositionsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalPositions, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalPositions)
        self.assertIsInstance(str(obj), str)


class ExternalDepartmentsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalDepartments, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalDepartments)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# External integrations — insurance/benefits
# ---------------------------------------------------------------------------


class ExternalBenefitPlansModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalBenefitPlans, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalBenefitPlans)
        self.assertIsInstance(str(obj), str)


class ExternalBenefitEnrollmentsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalBenefitEnrollments, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalBenefitEnrollments)
        self.assertIsInstance(str(obj), str)


class ExternalBenefitDependentsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalBenefitDependents, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalBenefitDependents)
        self.assertIsInstance(str(obj), str)


class ExternalBenefitCoverageModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalBenefitCoverage, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalBenefitCoverage)
        self.assertIsInstance(str(obj), str)


class ExternalInsuranceClaimsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalInsuranceClaims, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalInsuranceClaims)
        self.assertIsInstance(str(obj), str)


class ExternalInsurancePoliciesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalInsurancePolicies, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalInsurancePolicies)
        self.assertIsInstance(str(obj), str)


class ExternalInsuranceBeneficiariesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalInsuranceBeneficiaries,
            organization_id=uuid.uuid4()
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalInsuranceBeneficiaries)
        self.assertIsInstance(str(obj), str)


class ExternalBenefitUtilizationModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalBenefitUtilization, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalBenefitUtilization)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# External integrations — LMS
# ---------------------------------------------------------------------------


class ExternalLmsCoursesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalLmsCourses, org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalLmsCourses)
        self.assertIsInstance(str(obj), str)


class ExternalLmsEnrollmentsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalLmsEnrollments, org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalLmsEnrollments)
        self.assertIsInstance(str(obj), str)


class ExternalLmsProgressModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalLmsProgress, org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalLmsProgress)
        self.assertIsInstance(str(obj), str)


class ExternalLmsCompletionsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalLmsCompletions, org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalLmsCompletions)
        self.assertIsInstance(str(obj), str)


class ExternalLmsLearnersModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ExternalLmsLearners, org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ExternalLmsLearners)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Integration management
# ---------------------------------------------------------------------------


class IntegrationConfigsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="ic-org", organization_type="union"
        )
        obj = create_valid(IntegrationConfigs, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="ic-org-s", organization_type="union"
        )
        obj = create_valid(IntegrationConfigs, organization=org)
        self.assertIsInstance(str(obj), str)


class IntegrationSyncLogModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="isl-org", organization_type="union"
        )
        obj = create_valid(IntegrationSyncLog, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="isl-org-s", organization_type="union"
        )
        obj = create_valid(IntegrationSyncLog, organization=org)
        self.assertIsInstance(str(obj), str)


class WebhookEventsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="whe-org", organization_type="union"
        )
        obj = create_valid(WebhookEvents, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="whe-org-s", organization_type="union"
        )
        obj = create_valid(WebhookEvents, organization=org)
        self.assertIsInstance(str(obj), str)


class IntegrationSyncSchedulesModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="iss-org", organization_type="union"
        )
        obj = create_valid(IntegrationSyncSchedules, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="iss-org-s", organization_type="union"
        )
        obj = create_valid(IntegrationSyncSchedules, organization=org)
        self.assertIsInstance(str(obj), str)


class IntegrationApiKeysModelTest(TestCase):
    def test_create(self):
        obj = create_valid(IntegrationApiKeys)
        self.assertIsNotNone(obj.id)

    def test_create_with_org(self):
        org = create_valid(Organizations,
            name="O", slug="iak-org", organization_type="union"
        )
        obj = create_valid(IntegrationApiKeys, organization=org)
        self.assertEqual(obj.organization, org)

    def test_str(self):
        obj = create_valid(IntegrationApiKeys)
        self.assertIsInstance(str(obj), str)


class IntegrationWebhooksModelTest(TestCase):
    def test_create(self):
        obj = create_valid(IntegrationWebhooks)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="iw-org", organization_type="union"
        )
        obj = create_valid(IntegrationWebhooks, organization=org)
        self.assertIsInstance(str(obj), str)


class WebhookDeliveriesModelTest(TestCase):
    def test_create(self):
        wh = create_valid(IntegrationWebhooks)
        obj = create_valid(WebhookDeliveries, webhook=wh)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.webhook, wh)

    def test_str(self):
        wh = create_valid(IntegrationWebhooks)
        obj = create_valid(WebhookDeliveries, webhook=wh)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Support
# ---------------------------------------------------------------------------


class SupportTicketsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SupportTickets, ticket_number="TKT-001")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.ticket_number, "TKT-001")

    def test_str(self):
        obj = create_valid(SupportTickets)
        self.assertIsInstance(str(obj), str)


class TicketCommentsModelTest(TestCase):
    def test_create(self):
        tkt = create_valid(SupportTickets, ticket_number="TKT-TC-001")
        obj = create_valid(TicketComments, ticket=tkt)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.ticket, tkt)

    def test_str(self):
        tkt = create_valid(SupportTickets, ticket_number="TKT-TC-002")
        obj = create_valid(TicketComments, ticket=tkt)
        self.assertIsInstance(str(obj), str)


class TicketHistoryModelTest(TestCase):
    def test_create(self):
        tkt = create_valid(SupportTickets, ticket_number="TKT-TH-001")
        obj = create_valid(TicketHistory, ticket=tkt)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        tkt = create_valid(SupportTickets, ticket_number="TKT-TH-002")
        obj = create_valid(TicketHistory, ticket=tkt)
        self.assertIsInstance(str(obj), str)


class SlaPoliciesModelTest(TestCase):
    """__str__ = name."""

    def test_create(self):
        obj = create_valid(SlaPolicies, name="Standard SLA")
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SlaPolicies, name="Premium SLA")
        self.assertEqual(str(obj), "Premium SLA")


class KnowledgeBaseArticlesModelTest(TestCase):
    """__str__ = title."""

    def test_create(self):
        obj = create_valid(KnowledgeBaseArticles, title="How to file a grievance")
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(KnowledgeBaseArticles, title="FAQ: Dues Payments")
        self.assertEqual(str(obj), "FAQ: Dues Payments")


class WebhookSubscriptionsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="ws-org", organization_type="union"
        )
        obj = create_valid(WebhookSubscriptions, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="ws-org-s", organization_type="union"
        )
        obj = create_valid(WebhookSubscriptions, organization=org)
        self.assertIsInstance(str(obj), str)


class ApiIntegrationsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="ai-org", organization_type="union"
        )
        obj = create_valid(ApiIntegrations, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="ai-org-s", organization_type="union"
        )
        obj = create_valid(ApiIntegrations, organization=org)
        self.assertIsInstance(str(obj), str)


class IntegrationSyncLogsModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="isls-org", organization_type="union"
        )
        integ = create_valid(ApiIntegrations, organization=org)
        obj = create_valid(IntegrationSyncLogs, integration=integ)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.integration, integ)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="isls-org-s", organization_type="union"
        )
        integ = create_valid(ApiIntegrations, organization=org)
        obj = create_valid(IntegrationSyncLogs, integration=integ)
        self.assertIsInstance(str(obj), str)


class ApiAccessTokensModelTest(TestCase):
    def test_create(self):
        org = create_valid(Organizations,
            name="O", slug="aat-org", organization_type="union"
        )
        obj = create_valid(ApiAccessTokens, organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = create_valid(Organizations,
            name="O", slug="aat-org-s", organization_type="union"
        )
        obj = create_valid(ApiAccessTokens, organization=org)
        self.assertIsInstance(str(obj), str)
