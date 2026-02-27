"""
Tests for core models.
"""

import uuid

from auth_core.models import Organizations
from django.test import TestCase

from .models import (
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

# ---------------------------------------------------------------------------
# Alerting
# ---------------------------------------------------------------------------


class AlertRulesModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="ar-org", organization_type="union"
        )
        obj = AlertRules.objects.create(organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="ar-org-s", organization_type="union"
        )
        obj = AlertRules.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class AlertConditionsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="ac-org", organization_type="union"
        )
        rule = AlertRules.objects.create(organization=org)
        obj = AlertConditions.objects.create(alert_rule=rule)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.alert_rule, rule)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="ac-org-s", organization_type="union"
        )
        rule = AlertRules.objects.create(organization=org)
        obj = AlertConditions.objects.create(alert_rule=rule)
        self.assertIsInstance(str(obj), str)


class AlertActionsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="aa-org", organization_type="union"
        )
        rule = AlertRules.objects.create(organization=org)
        obj = AlertActions.objects.create(alert_rule=rule)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="aa-org-s", organization_type="union"
        )
        rule = AlertRules.objects.create(organization=org)
        obj = AlertActions.objects.create(alert_rule=rule)
        self.assertIsInstance(str(obj), str)


class AlertEscalationsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="ae-org", organization_type="union"
        )
        obj = AlertEscalations.objects.create(organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="ae-org-s", organization_type="union"
        )
        obj = AlertEscalations.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class AlertExecutionsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="aex-org", organization_type="union"
        )
        rule = AlertRules.objects.create(organization=org)
        obj = AlertExecutions.objects.create(alert_rule=rule)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="aex-org-s", organization_type="union"
        )
        rule = AlertRules.objects.create(organization=org)
        obj = AlertExecutions.objects.create(alert_rule=rule)
        self.assertIsInstance(str(obj), str)


class AlertRecipientsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="arec-org", organization_type="union"
        )
        rule = AlertRules.objects.create(organization=org)
        obj = AlertRecipients.objects.create(alert_rule=rule)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="arec-org-s", organization_type="union"
        )
        rule = AlertRules.objects.create(organization=org)
        obj = AlertRecipients.objects.create(alert_rule=rule)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Workflows
# ---------------------------------------------------------------------------


class WorkflowDefinitionsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="wd-org", organization_type="union"
        )
        obj = WorkflowDefinitions.objects.create(organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="wd-org-s", organization_type="union"
        )
        obj = WorkflowDefinitions.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class WorkflowExecutionsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="we-org", organization_type="union"
        )
        wd = WorkflowDefinitions.objects.create(organization=org)
        obj = WorkflowExecutions.objects.create(workflow_definition=wd)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.workflow_definition, wd)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="we-org-s", organization_type="union"
        )
        wd = WorkflowDefinitions.objects.create(organization=org)
        obj = WorkflowExecutions.objects.create(workflow_definition=wd)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Audit / Security
# ---------------------------------------------------------------------------


class AuditLogsModelTest(TestCase):
    def test_create(self):
        obj = AuditLogs.objects.create(
            action="create",
            resource_type="Member",
            resource_id="member-123",
            user_id="clerk_user_1",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.action, "create")

    def test_str(self):
        obj = AuditLogs.objects.create()
        self.assertIsInstance(str(obj), str)


class SecurityEventsModelTest(TestCase):
    def test_create(self):
        obj = SecurityEvents.objects.create(user_id="clerk_user_2")
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = SecurityEvents.objects.create()
        self.assertIsInstance(str(obj), str)


class FailedLoginAttemptsModelTest(TestCase):
    """__str__ = email."""

    def test_create(self):
        obj = FailedLoginAttempts.objects.create(email="bad@example.com")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.email, "bad@example.com")

    def test_str(self):
        obj = FailedLoginAttempts.objects.create(email="test@example.com")
        self.assertEqual(str(obj), "test@example.com")


class RateLimitEventsModelTest(TestCase):
    def test_create(self):
        obj = RateLimitEvents.objects.create(identifier="192.168.1.1")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.identifier, "192.168.1.1")

    def test_str(self):
        obj = RateLimitEvents.objects.create()
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Automation
# ---------------------------------------------------------------------------


class AutomationRulesModelTest(TestCase):
    """__str__ = name."""

    def test_create(self):
        obj = AutomationRules.objects.create(name="Auto-assign grievances")
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = AutomationRules.objects.create(name="Auto-assign grievances")
        self.assertEqual(str(obj), "Auto-assign grievances")


class AutomationExecutionLogModelTest(TestCase):
    def test_create(self):
        rule = AutomationRules.objects.create(name="Rule AEL")
        obj = AutomationExecutionLog.objects.create(rule=rule)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.rule, rule)

    def test_str(self):
        rule = AutomationRules.objects.create(name="Rule AEL-S")
        obj = AutomationExecutionLog.objects.create(rule=rule)
        self.assertIsInstance(str(obj), str)


class AutomationSchedulesModelTest(TestCase):
    def test_create(self):
        rule = AutomationRules.objects.create(name="Rule AS")
        obj = AutomationSchedules.objects.create(rule=rule, schedule_type="cron")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.schedule_type, "cron")

    def test_str(self):
        rule = AutomationRules.objects.create(name="Rule AS-S")
        obj = AutomationSchedules.objects.create(rule=rule)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# External integrations — accounting
# ---------------------------------------------------------------------------


class ExternalInvoicesModelTest(TestCase):
    def test_create(self):
        obj = ExternalInvoices.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalInvoices.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalPaymentsModelTest(TestCase):
    def test_create(self):
        obj = ExternalPayments.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalPayments.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalCustomersModelTest(TestCase):
    def test_create(self):
        obj = ExternalCustomers.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalCustomers.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalAccountsModelTest(TestCase):
    def test_create(self):
        obj = ExternalAccounts.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalAccounts.objects.create()
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# External integrations — communication
# ---------------------------------------------------------------------------


class ExternalCommunicationChannelsModelTest(TestCase):
    def test_create(self):
        obj = ExternalCommunicationChannels.objects.create(org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalCommunicationChannels.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalCommunicationMessagesModelTest(TestCase):
    def test_create(self):
        obj = ExternalCommunicationMessages.objects.create(org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalCommunicationMessages.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalCommunicationUsersModelTest(TestCase):
    def test_create(self):
        obj = ExternalCommunicationUsers.objects.create(org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalCommunicationUsers.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalCommunicationFilesModelTest(TestCase):
    def test_create(self):
        obj = ExternalCommunicationFiles.objects.create(org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalCommunicationFiles.objects.create()
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# External integrations — documents
# ---------------------------------------------------------------------------


class ExternalDocumentSitesModelTest(TestCase):
    def test_create(self):
        obj = ExternalDocumentSites.objects.create(org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalDocumentSites.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalDocumentLibrariesModelTest(TestCase):
    def test_create(self):
        obj = ExternalDocumentLibraries.objects.create(org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalDocumentLibraries.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalDocumentFilesModelTest(TestCase):
    def test_create(self):
        obj = ExternalDocumentFiles.objects.create(org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalDocumentFiles.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalDocumentPermissionsModelTest(TestCase):
    def test_create(self):
        obj = ExternalDocumentPermissions.objects.create(org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalDocumentPermissions.objects.create()
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# External integrations — HRIS
# ---------------------------------------------------------------------------


class ExternalEmployeesModelTest(TestCase):
    def test_create(self):
        obj = ExternalEmployees.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalEmployees.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalPositionsModelTest(TestCase):
    def test_create(self):
        obj = ExternalPositions.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalPositions.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalDepartmentsModelTest(TestCase):
    def test_create(self):
        obj = ExternalDepartments.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalDepartments.objects.create()
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# External integrations — insurance/benefits
# ---------------------------------------------------------------------------


class ExternalBenefitPlansModelTest(TestCase):
    def test_create(self):
        obj = ExternalBenefitPlans.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalBenefitPlans.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalBenefitEnrollmentsModelTest(TestCase):
    def test_create(self):
        obj = ExternalBenefitEnrollments.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalBenefitEnrollments.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalBenefitDependentsModelTest(TestCase):
    def test_create(self):
        obj = ExternalBenefitDependents.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalBenefitDependents.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalBenefitCoverageModelTest(TestCase):
    def test_create(self):
        obj = ExternalBenefitCoverage.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalBenefitCoverage.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalInsuranceClaimsModelTest(TestCase):
    def test_create(self):
        obj = ExternalInsuranceClaims.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalInsuranceClaims.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalInsurancePoliciesModelTest(TestCase):
    def test_create(self):
        obj = ExternalInsurancePolicies.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalInsurancePolicies.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalInsuranceBeneficiariesModelTest(TestCase):
    def test_create(self):
        obj = ExternalInsuranceBeneficiaries.objects.create(
            organization_id=uuid.uuid4()
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalInsuranceBeneficiaries.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalBenefitUtilizationModelTest(TestCase):
    def test_create(self):
        obj = ExternalBenefitUtilization.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalBenefitUtilization.objects.create()
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# External integrations — LMS
# ---------------------------------------------------------------------------


class ExternalLmsCoursesModelTest(TestCase):
    def test_create(self):
        obj = ExternalLmsCourses.objects.create(org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalLmsCourses.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalLmsEnrollmentsModelTest(TestCase):
    def test_create(self):
        obj = ExternalLmsEnrollments.objects.create(org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalLmsEnrollments.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalLmsProgressModelTest(TestCase):
    def test_create(self):
        obj = ExternalLmsProgress.objects.create(org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalLmsProgress.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalLmsCompletionsModelTest(TestCase):
    def test_create(self):
        obj = ExternalLmsCompletions.objects.create(org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalLmsCompletions.objects.create()
        self.assertIsInstance(str(obj), str)


class ExternalLmsLearnersModelTest(TestCase):
    def test_create(self):
        obj = ExternalLmsLearners.objects.create(org_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ExternalLmsLearners.objects.create()
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Integration management
# ---------------------------------------------------------------------------


class IntegrationConfigsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="ic-org", organization_type="union"
        )
        obj = IntegrationConfigs.objects.create(organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="ic-org-s", organization_type="union"
        )
        obj = IntegrationConfigs.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class IntegrationSyncLogModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="isl-org", organization_type="union"
        )
        obj = IntegrationSyncLog.objects.create(organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="isl-org-s", organization_type="union"
        )
        obj = IntegrationSyncLog.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class WebhookEventsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="whe-org", organization_type="union"
        )
        obj = WebhookEvents.objects.create(organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="whe-org-s", organization_type="union"
        )
        obj = WebhookEvents.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class IntegrationSyncSchedulesModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="iss-org", organization_type="union"
        )
        obj = IntegrationSyncSchedules.objects.create(organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="iss-org-s", organization_type="union"
        )
        obj = IntegrationSyncSchedules.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class IntegrationApiKeysModelTest(TestCase):
    def test_create(self):
        obj = IntegrationApiKeys.objects.create()
        self.assertIsNotNone(obj.id)

    def test_create_with_org(self):
        org = Organizations.objects.create(
            name="O", slug="iak-org", organization_type="union"
        )
        obj = IntegrationApiKeys.objects.create(organization=org)
        self.assertEqual(obj.organization, org)

    def test_str(self):
        obj = IntegrationApiKeys.objects.create()
        self.assertIsInstance(str(obj), str)


class IntegrationWebhooksModelTest(TestCase):
    def test_create(self):
        obj = IntegrationWebhooks.objects.create()
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="iw-org", organization_type="union"
        )
        obj = IntegrationWebhooks.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class WebhookDeliveriesModelTest(TestCase):
    def test_create(self):
        wh = IntegrationWebhooks.objects.create()
        obj = WebhookDeliveries.objects.create(webhook=wh)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.webhook, wh)

    def test_str(self):
        wh = IntegrationWebhooks.objects.create()
        obj = WebhookDeliveries.objects.create(webhook=wh)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Support
# ---------------------------------------------------------------------------


class SupportTicketsModelTest(TestCase):
    def test_create(self):
        obj = SupportTickets.objects.create(ticket_number="TKT-001")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.ticket_number, "TKT-001")

    def test_str(self):
        obj = SupportTickets.objects.create()
        self.assertIsInstance(str(obj), str)


class TicketCommentsModelTest(TestCase):
    def test_create(self):
        tkt = SupportTickets.objects.create(ticket_number="TKT-TC-001")
        obj = TicketComments.objects.create(ticket=tkt)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.ticket, tkt)

    def test_str(self):
        tkt = SupportTickets.objects.create(ticket_number="TKT-TC-002")
        obj = TicketComments.objects.create(ticket=tkt)
        self.assertIsInstance(str(obj), str)


class TicketHistoryModelTest(TestCase):
    def test_create(self):
        tkt = SupportTickets.objects.create(ticket_number="TKT-TH-001")
        obj = TicketHistory.objects.create(ticket=tkt)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        tkt = SupportTickets.objects.create(ticket_number="TKT-TH-002")
        obj = TicketHistory.objects.create(ticket=tkt)
        self.assertIsInstance(str(obj), str)


class SlaPoliciesModelTest(TestCase):
    """__str__ = name."""

    def test_create(self):
        obj = SlaPolicies.objects.create(name="Standard SLA")
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = SlaPolicies.objects.create(name="Premium SLA")
        self.assertEqual(str(obj), "Premium SLA")


class KnowledgeBaseArticlesModelTest(TestCase):
    """__str__ = title."""

    def test_create(self):
        obj = KnowledgeBaseArticles.objects.create(title="How to file a grievance")
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = KnowledgeBaseArticles.objects.create(title="FAQ: Dues Payments")
        self.assertEqual(str(obj), "FAQ: Dues Payments")


class WebhookSubscriptionsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="ws-org", organization_type="union"
        )
        obj = WebhookSubscriptions.objects.create(organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="ws-org-s", organization_type="union"
        )
        obj = WebhookSubscriptions.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class ApiIntegrationsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="ai-org", organization_type="union"
        )
        obj = ApiIntegrations.objects.create(organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="ai-org-s", organization_type="union"
        )
        obj = ApiIntegrations.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class IntegrationSyncLogsModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="isls-org", organization_type="union"
        )
        integ = ApiIntegrations.objects.create(organization=org)
        obj = IntegrationSyncLogs.objects.create(integration=integ)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.integration, integ)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="isls-org-s", organization_type="union"
        )
        integ = ApiIntegrations.objects.create(organization=org)
        obj = IntegrationSyncLogs.objects.create(integration=integ)
        self.assertIsInstance(str(obj), str)


class ApiAccessTokensModelTest(TestCase):
    def test_create(self):
        org = Organizations.objects.create(
            name="O", slug="aat-org", organization_type="union"
        )
        obj = ApiAccessTokens.objects.create(organization=org)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        org = Organizations.objects.create(
            name="O", slug="aat-org-s", organization_type="union"
        )
        obj = ApiAccessTokens.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)
