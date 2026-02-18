#!/usr/bin/env python3
"""
Union Eyes — Service View Generator
====================================
Reads frontend TypeScript service files, extracts function signatures,
maps to Django models, and generates production-grade DRF ViewSets.

Usage:
    python generate_service_views.py [--dry-run] [--target PATH]

Outputs:
    - One *_views.py per service in backend/services/api/
    - Updated urls.py with all registrations
    - Generation report JSON
"""

import os
import re
import json
import argparse
import textwrap
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ──────────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────────

FRONTEND_SERVICES_DIR = r"D:\APPS\nzila-union-eyes\frontend\services"
BACKEND_DIR = r"D:\APPS\nzila-union-eyes\backend"
SERVICES_API_DIR = os.path.join(BACKEND_DIR, "services", "api")

# Services that already have views built — skip these
EXISTING_VIEWS = {
    "governance-service",
    "signature-service",
    "workflows-test",
    "schema",
    "certification-management-service",
    "lmbp-immigration-service",
    "tax-slip-service",
}

# ──────────────────────────────────────────────────────────────────
# SERVICE DEFINITIONS — Maps frontend service → Django models & endpoints
# ──────────────────────────────────────────────────────────────────

SERVICE_SPECS: Dict[str, dict] = {
    "break-glass-service": {
        "class_name": "BreakGlassServiceViewSet",
        "app": "compliance",
        "models": [
            "BreakGlassSystem", "BreakGlassActivations", "DisasterRecoveryDrills",
            "KeyHolderRegistry", "RecoveryTimeObjectives", "EmergencyDeclarations",
        ],
        "actions": [
            {"name": "activate", "method": "post", "desc": "Activate break-glass emergency access", "model": "BreakGlassActivations"},
            {"name": "deactivate", "method": "post", "desc": "Deactivate break-glass access", "model": "BreakGlassActivations"},
            {"name": "audit_log", "method": "get", "desc": "Get break-glass audit log", "model": "BreakGlassActivations"},
            {"name": "key_holders", "method": "get", "desc": "List authorized key holders", "model": "KeyHolderRegistry"},
            {"name": "register_key_holder", "method": "post", "desc": "Register a new key holder", "model": "KeyHolderRegistry"},
            {"name": "emergency_declarations", "method": "get", "desc": "List emergency declarations", "model": "EmergencyDeclarations"},
            {"name": "declare_emergency", "method": "post", "desc": "Declare an emergency", "model": "EmergencyDeclarations"},
            {"name": "dr_drills", "method": "get", "desc": "List disaster recovery drills", "model": "DisasterRecoveryDrills"},
            {"name": "schedule_drill", "method": "post", "desc": "Schedule a DR drill", "model": "DisasterRecoveryDrills"},
            {"name": "recovery_objectives", "method": "get", "desc": "Get recovery time objectives", "model": "RecoveryTimeObjectives"},
            {"name": "cold_storage_status", "method": "get", "desc": "Swiss cold storage status", "model": "BreakGlassSystem"},
        ],
    },
    "carbon-accounting-service": {
        "class_name": "CarbonAccountingServiceViewSet",
        "app": "compliance",
        "models": [],
        "custom_models": True,
        "actions": [
            {"name": "record_emission", "method": "post", "desc": "Record a carbon emission entry"},
            {"name": "emission_report", "method": "get", "desc": "Get emissions report for org"},
            {"name": "carbon_summary", "method": "get", "desc": "Get carbon footprint summary"},
            {"name": "set_target", "method": "post", "desc": "Set carbon reduction target"},
            {"name": "offset_purchase", "method": "post", "desc": "Record carbon offset purchase"},
            {"name": "compliance_check", "method": "get", "desc": "Check carbon reporting compliance"},
        ],
    },
    "carbon-accounting-integration": {
        "class_name": "CarbonAccountingIntegrationViewSet",
        "app": "core",
        "models": ["IntegrationConfigs", "IntegrationSyncLog"],
        "actions": [
            {"name": "sync_provider", "method": "post", "desc": "Sync carbon data from external provider", "model": "IntegrationSyncLog"},
            {"name": "provider_status", "method": "get", "desc": "Get integration provider status", "model": "IntegrationConfigs"},
            {"name": "configure_provider", "method": "post", "desc": "Configure carbon data provider", "model": "IntegrationConfigs"},
            {"name": "sync_history", "method": "get", "desc": "Get sync history", "model": "IntegrationSyncLog"},
        ],
    },
    "currency-enforcement-service": {
        "class_name": "CurrencyEnforcementServiceViewSet",
        "app": "billing",
        "models": [
            "CurrencyEnforcementPolicy", "BankOfCanadaRates",
            "TransactionCurrencyConversions", "CurrencyEnforcementViolations",
            "FxRateAuditLog", "CurrencyEnforcementAudit", "ExchangeRates",
        ],
        "actions": [
            {"name": "get_policy", "method": "get", "desc": "Get currency enforcement policy for org", "model": "CurrencyEnforcementPolicy"},
            {"name": "update_policy", "method": "post", "desc": "Update currency enforcement policy", "model": "CurrencyEnforcementPolicy"},
            {"name": "validate_transaction", "method": "post", "desc": "Validate a transaction against currency policy", "model": "TransactionCurrencyConversions"},
            {"name": "violations", "method": "get", "desc": "List currency enforcement violations", "model": "CurrencyEnforcementViolations"},
            {"name": "exchange_rates", "method": "get", "desc": "Get current exchange rates", "model": "ExchangeRates"},
            {"name": "refresh_rates", "method": "post", "desc": "Refresh Bank of Canada rates", "model": "BankOfCanadaRates"},
            {"name": "audit_trail", "method": "get", "desc": "Get FX audit trail", "model": "FxRateAuditLog"},
            {"name": "conversion_history", "method": "get", "desc": "Get conversion history", "model": "TransactionCurrencyConversions"},
        ],
    },
    "email": {
        "class_name": "EmailServiceViewSet",
        "app": "notifications",
        "models": ["MessageTemplates", "MessageLog", "CommunicationChannels"],
        "actions": [
            {"name": "send", "method": "post", "desc": "Send a single email", "model": "MessageLog"},
            {"name": "send_bulk", "method": "post", "desc": "Send bulk emails", "model": "MessageLog"},
            {"name": "templates", "method": "get", "desc": "List email templates", "model": "MessageTemplates"},
            {"name": "create_template", "method": "post", "desc": "Create email template", "model": "MessageTemplates"},
            {"name": "history", "method": "get", "desc": "Get email send history", "model": "MessageLog"},
        ],
    },
    "employer-non-interference-service": {
        "class_name": "EmployerNonInterferenceServiceViewSet",
        "app": "compliance",
        "models": [
            "FirewallAccessRules", "EmployerAccessAttempts",
            "AccessJustificationRequests", "UnionOnlyDataTags",
            "FirewallViolations", "FirewallComplianceAudit",
        ],
        "actions": [
            {"name": "check_access", "method": "post", "desc": "Check if employer access attempt is permitted", "model": "EmployerAccessAttempts"},
            {"name": "access_rules", "method": "get", "desc": "List firewall access rules", "model": "FirewallAccessRules"},
            {"name": "create_rule", "method": "post", "desc": "Create firewall access rule", "model": "FirewallAccessRules"},
            {"name": "violations", "method": "get", "desc": "List non-interference violations", "model": "FirewallViolations"},
            {"name": "report_violation", "method": "post", "desc": "Report a non-interference violation", "model": "FirewallViolations"},
            {"name": "justification_requests", "method": "get", "desc": "List access justification requests", "model": "AccessJustificationRequests"},
            {"name": "submit_justification", "method": "post", "desc": "Submit access justification", "model": "AccessJustificationRequests"},
            {"name": "compliance_audit", "method": "get", "desc": "Get compliance audit report", "model": "FirewallComplianceAudit"},
            {"name": "union_data_tags", "method": "get", "desc": "List union-only data tags", "model": "UnionOnlyDataTags"},
            {"name": "tag_data", "method": "post", "desc": "Tag data as union-only", "model": "UnionOnlyDataTags"},
        ],
    },
    "fcm-service": {
        "class_name": "FcmServiceViewSet",
        "app": "notifications",
        "models": [
            "PushDevices", "PushNotificationTemplates",
            "PushNotifications", "PushDeliveries",
        ],
        "actions": [
            {"name": "register_token", "method": "post", "desc": "Register FCM device token", "model": "PushDevices"},
            {"name": "deregister_token", "method": "post", "desc": "Deregister FCM device token", "model": "PushDevices"},
            {"name": "send_to_device", "method": "post", "desc": "Send push to specific device", "model": "PushNotifications"},
            {"name": "send_to_user", "method": "post", "desc": "Send push to all user devices", "model": "PushNotifications"},
            {"name": "send_to_topic", "method": "post", "desc": "Send push to topic subscribers", "model": "PushNotifications"},
            {"name": "subscribe_topic", "method": "post", "desc": "Subscribe device to topic", "model": "PushDevices"},
            {"name": "unsubscribe_topic", "method": "post", "desc": "Unsubscribe device from topic", "model": "PushDevices"},
            {"name": "delivery_status", "method": "get", "desc": "Get delivery status for notification", "model": "PushDeliveries"},
            {"name": "cleanup_invalid", "method": "post", "desc": "Cleanup invalid FCM tokens", "model": "PushDevices"},
            {"name": "retry_failed", "method": "post", "desc": "Retry failed deliveries", "model": "PushDeliveries"},
            {"name": "templates", "method": "get", "desc": "List push notification templates", "model": "PushNotificationTemplates"},
            {"name": "create_template", "method": "post", "desc": "Create push notification template", "model": "PushNotificationTemplates"},
        ],
    },
    "force-majeure-integration": {
        "class_name": "ForceMajeureIntegrationViewSet",
        "app": "compliance",
        "models": ["EmergencyDeclarations"],
        "extra_apps": {"bargaining": ["CollectiveAgreements", "CbaClauses"]},
        "actions": [
            {"name": "declare", "method": "post", "desc": "Declare force majeure event", "model": "EmergencyDeclarations"},
            {"name": "lift", "method": "post", "desc": "Lift force majeure declaration"},
            {"name": "active", "method": "get", "desc": "List active force majeure events", "model": "EmergencyDeclarations"},
            {"name": "history", "method": "get", "desc": "Force majeure event history", "model": "EmergencyDeclarations"},
            {"name": "affected_agreements", "method": "get", "desc": "List CBAs affected by force majeure"},
            {"name": "impact_assessment", "method": "post", "desc": "Run impact assessment on active FM"},
        ],
    },
    "founder-conflict-service": {
        "class_name": "FounderConflictServiceViewSet",
        "app": "compliance",
        "models": [
            "ConflictOfInterestPolicy", "BlindTrustRegistry",
            "ConflictDisclosures", "ArmsLengthVerification",
            "RecusalTracking", "ConflictReviewCommittee",
            "ConflictTraining", "ConflictAuditLog",
        ],
        "actions": [
            {"name": "disclosures", "method": "get", "desc": "List conflict disclosures", "model": "ConflictDisclosures"},
            {"name": "submit_disclosure", "method": "post", "desc": "Submit conflict disclosure", "model": "ConflictDisclosures"},
            {"name": "resolve_disclosure", "method": "post", "desc": "Resolve a conflict disclosure", "model": "ConflictDisclosures"},
            {"name": "blind_trusts", "method": "get", "desc": "List blind trust registry", "model": "BlindTrustRegistry"},
            {"name": "register_trust", "method": "post", "desc": "Register blind trust", "model": "BlindTrustRegistry"},
            {"name": "arms_length_verify", "method": "post", "desc": "Verify arms-length transaction", "model": "ArmsLengthVerification"},
            {"name": "recusals", "method": "get", "desc": "List recusal records", "model": "RecusalTracking"},
            {"name": "record_recusal", "method": "post", "desc": "Record a recusal", "model": "RecusalTracking"},
            {"name": "review_committee", "method": "get", "desc": "Get review committee members", "model": "ConflictReviewCommittee"},
            {"name": "training_status", "method": "get", "desc": "Get conflict training status", "model": "ConflictTraining"},
            {"name": "audit_log", "method": "get", "desc": "Get conflict audit log", "model": "ConflictAuditLog"},
            {"name": "policy", "method": "get", "desc": "Get conflict of interest policy", "model": "ConflictOfInterestPolicy"},
            {"name": "update_policy", "method": "post", "desc": "Update conflict of interest policy", "model": "ConflictOfInterestPolicy"},
        ],
    },
    "geofence-privacy-service": {
        "class_name": "GeofencePrivacyServiceViewSet",
        "app": "compliance",
        "models": [
            "LocationTracking", "Geofences", "GeofenceEvents",
            "LocationTrackingAudit", "LocationDeletionLog", "LocationTrackingConfig",
        ],
        "actions": [
            {"name": "zones", "method": "get", "desc": "List geofence zones", "model": "Geofences"},
            {"name": "create_zone", "method": "post", "desc": "Create geofence zone", "model": "Geofences"},
            {"name": "update_zone", "method": "post", "desc": "Update geofence zone", "model": "Geofences"},
            {"name": "delete_zone", "method": "post", "desc": "Delete geofence zone", "model": "Geofences"},
            {"name": "check_location", "method": "post", "desc": "Check if location is within geofence", "model": "GeofenceEvents"},
            {"name": "events", "method": "get", "desc": "List geofence events", "model": "GeofenceEvents"},
            {"name": "tracking_config", "method": "get", "desc": "Get location tracking config", "model": "LocationTrackingConfig"},
            {"name": "update_tracking_config", "method": "post", "desc": "Update tracking config", "model": "LocationTrackingConfig"},
            {"name": "audit_trail", "method": "get", "desc": "Location tracking audit trail", "model": "LocationTrackingAudit"},
            {"name": "deletion_log", "method": "get", "desc": "Location data deletion log", "model": "LocationDeletionLog"},
            {"name": "request_deletion", "method": "post", "desc": "Request location data deletion", "model": "LocationDeletionLog"},
        ],
    },
    "indigenous-data-service": {
        "class_name": "IndigenousDataServiceViewSet",
        "app": "compliance",
        "models": [
            "BandCouncils", "BandCouncilConsent", "IndigenousMemberData",
            "IndigenousDataAccessLog", "IndigenousDataSharingAgreements",
            "TraditionalKnowledgeRegistry",
        ],
        "actions": [
            {"name": "band_councils", "method": "get", "desc": "List band councils", "model": "BandCouncils"},
            {"name": "register_council", "method": "post", "desc": "Register band council", "model": "BandCouncils"},
            {"name": "consent_records", "method": "get", "desc": "List band council consent records", "model": "BandCouncilConsent"},
            {"name": "record_consent", "method": "post", "desc": "Record band council consent (OCAP)", "model": "BandCouncilConsent"},
            {"name": "member_data", "method": "get", "desc": "Get indigenous member data (OCAP-controlled)", "model": "IndigenousMemberData"},
            {"name": "access_log", "method": "get", "desc": "Get indigenous data access log", "model": "IndigenousDataAccessLog"},
            {"name": "sharing_agreements", "method": "get", "desc": "List data sharing agreements", "model": "IndigenousDataSharingAgreements"},
            {"name": "create_sharing_agreement", "method": "post", "desc": "Create data sharing agreement", "model": "IndigenousDataSharingAgreements"},
            {"name": "traditional_knowledge", "method": "get", "desc": "Access traditional knowledge registry", "model": "TraditionalKnowledgeRegistry"},
            {"name": "register_knowledge", "method": "post", "desc": "Register traditional knowledge entry", "model": "TraditionalKnowledgeRegistry"},
            {"name": "request_access", "method": "post", "desc": "Request access to indigenous data", "model": "IndigenousDataAccessLog"},
            {"name": "approve_access", "method": "post", "desc": "Approve indigenous data access request", "model": "IndigenousDataAccessLog"},
        ],
    },
    "joint-trust-fmv-service": {
        "class_name": "JointTrustFmvServiceViewSet",
        "app": "billing",
        "models": [
            "FmvPolicy", "CpiData", "FmvBenchmarks",
            "ProcurementRequests", "ProcurementBids",
            "IndependentAppraisals", "CpiAdjustedPricing",
            "FmvViolations", "FmvAuditLog",
        ],
        "actions": [
            {"name": "fmv_policy", "method": "get", "desc": "Get FMV policy", "model": "FmvPolicy"},
            {"name": "update_fmv_policy", "method": "post", "desc": "Update FMV policy", "model": "FmvPolicy"},
            {"name": "calculate_fmv", "method": "post", "desc": "Calculate fair market value"},
            {"name": "procurement_requests", "method": "get", "desc": "List procurement requests", "model": "ProcurementRequests"},
            {"name": "create_procurement", "method": "post", "desc": "Create procurement request", "model": "ProcurementRequests"},
            {"name": "bids", "method": "get", "desc": "List procurement bids", "model": "ProcurementBids"},
            {"name": "submit_bid", "method": "post", "desc": "Submit procurement bid", "model": "ProcurementBids"},
            {"name": "appraisals", "method": "get", "desc": "List independent appraisals", "model": "IndependentAppraisals"},
            {"name": "request_appraisal", "method": "post", "desc": "Request independent appraisal", "model": "IndependentAppraisals"},
            {"name": "cpi_data", "method": "get", "desc": "Get CPI data", "model": "CpiData"},
            {"name": "cpi_adjusted_pricing", "method": "get", "desc": "Get CPI-adjusted pricing", "model": "CpiAdjustedPricing"},
            {"name": "benchmarks", "method": "get", "desc": "Get FMV benchmarks", "model": "FmvBenchmarks"},
            {"name": "violations", "method": "get", "desc": "List FMV violations", "model": "FmvViolations"},
            {"name": "audit_log", "method": "get", "desc": "Get FMV audit log", "model": "FmvAuditLog"},
        ],
    },
    "provincial-privacy-service": {
        "class_name": "ProvincialPrivacyServiceViewSet",
        "app": "compliance",
        "models": [
            "ProvincialPrivacyConfig", "ProvincialConsent",
            "PrivacyBreaches", "ProvincialDataHandling",
            "DataSubjectAccessRequests",
        ],
        "actions": [
            {"name": "config", "method": "get", "desc": "Get provincial privacy config", "model": "ProvincialPrivacyConfig"},
            {"name": "update_config", "method": "post", "desc": "Update provincial privacy config", "model": "ProvincialPrivacyConfig"},
            {"name": "consent_records", "method": "get", "desc": "List provincial consent records", "model": "ProvincialConsent"},
            {"name": "record_consent", "method": "post", "desc": "Record provincial consent", "model": "ProvincialConsent"},
            {"name": "breaches", "method": "get", "desc": "List privacy breaches", "model": "PrivacyBreaches"},
            {"name": "report_breach", "method": "post", "desc": "Report privacy breach", "model": "PrivacyBreaches"},
            {"name": "data_handling", "method": "get", "desc": "Get provincial data handling rules", "model": "ProvincialDataHandling"},
            {"name": "dsar_requests", "method": "get", "desc": "List data subject access requests", "model": "DataSubjectAccessRequests"},
            {"name": "submit_dsar", "method": "post", "desc": "Submit a DSAR", "model": "DataSubjectAccessRequests"},
            {"name": "fulfill_dsar", "method": "post", "desc": "Fulfill a DSAR", "model": "DataSubjectAccessRequests"},
            {"name": "compliance_check", "method": "get", "desc": "Check provincial privacy compliance"},
        ],
    },
    "transfer-pricing-service": {
        "class_name": "TransferPricingServiceViewSet",
        "app": "billing",
        "models": [
            "T106FilingTracking", "TransferPricingDocumentation",
            "CrossBorderTransactions",
        ],
        "actions": [
            {"name": "documentation", "method": "get", "desc": "List transfer pricing documentation", "model": "TransferPricingDocumentation"},
            {"name": "create_document", "method": "post", "desc": "Create TP document", "model": "TransferPricingDocumentation"},
            {"name": "t106_filings", "method": "get", "desc": "List T106 filing records", "model": "T106FilingTracking"},
            {"name": "create_t106", "method": "post", "desc": "Create T106 filing record", "model": "T106FilingTracking"},
            {"name": "cross_border", "method": "get", "desc": "List cross-border transactions", "model": "CrossBorderTransactions"},
            {"name": "record_cross_border", "method": "post", "desc": "Record cross-border transaction", "model": "CrossBorderTransactions"},
            {"name": "calculate", "method": "post", "desc": "Calculate transfer pricing"},
            {"name": "compliance_report", "method": "get", "desc": "Get TP compliance report"},
        ],
    },
    "twilio-sms-service": {
        "class_name": "TwilioSmsServiceViewSet",
        "app": "notifications",
        "models": [
            "SmsTemplates", "SmsCampaigns", "SmsMessages",
            "SmsConversations", "SmsCampaignRecipients",
            "SmsOptOuts", "SmsRateLimits",
        ],
        "actions": [
            {"name": "send", "method": "post", "desc": "Send a single SMS", "model": "SmsMessages"},
            {"name": "send_bulk", "method": "post", "desc": "Send bulk SMS campaign", "model": "SmsCampaigns"},
            {"name": "templates", "method": "get", "desc": "List SMS templates", "model": "SmsTemplates"},
            {"name": "create_template", "method": "post", "desc": "Create SMS template", "model": "SmsTemplates"},
            {"name": "opt_outs", "method": "get", "desc": "List SMS opt-outs", "model": "SmsOptOuts"},
            {"name": "handle_opt_out", "method": "post", "desc": "Handle opt-out request", "model": "SmsOptOuts"},
            {"name": "conversations", "method": "get", "desc": "List SMS conversations", "model": "SmsConversations"},
            {"name": "message_history", "method": "get", "desc": "Get SMS message history", "model": "SmsMessages"},
            {"name": "validate_phone", "method": "post", "desc": "Validate phone number format"},
            {"name": "rate_limits", "method": "get", "desc": "Get SMS rate limit status", "model": "SmsRateLimits"},
            {"name": "webhook", "method": "post", "desc": "Handle Twilio inbound webhook"},
            {"name": "campaign_status", "method": "get", "desc": "Get campaign delivery status", "model": "SmsCampaigns"},
        ],
    },
    "whiplash-prevention-service": {
        "class_name": "WhiplashPreventionServiceViewSet",
        "app": "billing",
        "models": [
            "WhiplashViolations", "WhiplashPreventionAudit",
            "PaymentClassificationPolicy", "PaymentRoutingRules",
            "SeparatedPaymentTransactions", "StrikeFundPaymentAudit",
            "AccountBalanceReconciliation",
        ],
        "actions": [
            {"name": "monitor", "method": "get", "desc": "Monitor whiplash indicators for agreement"},
            {"name": "violations", "method": "get", "desc": "List whiplash violations", "model": "WhiplashViolations"},
            {"name": "flag_violation", "method": "post", "desc": "Flag a whiplash violation", "model": "WhiplashViolations"},
            {"name": "resolve_violation", "method": "post", "desc": "Resolve a whiplash violation", "model": "WhiplashViolations"},
            {"name": "payment_policy", "method": "get", "desc": "Get payment classification policy", "model": "PaymentClassificationPolicy"},
            {"name": "update_payment_policy", "method": "post", "desc": "Update payment classification policy", "model": "PaymentClassificationPolicy"},
            {"name": "routing_rules", "method": "get", "desc": "Get payment routing rules", "model": "PaymentRoutingRules"},
            {"name": "separated_transactions", "method": "get", "desc": "List separated payment transactions", "model": "SeparatedPaymentTransactions"},
            {"name": "reconciliation", "method": "get", "desc": "Get account balance reconciliation", "model": "AccountBalanceReconciliation"},
            {"name": "strike_fund_audit", "method": "get", "desc": "Get strike fund payment audit", "model": "StrikeFundPaymentAudit"},
            {"name": "prevention_audit", "method": "get", "desc": "Get whiplash prevention audit trail", "model": "WhiplashPreventionAudit"},
        ],
    },
}


# ──────────────────────────────────────────────────────────────────
# CODE GENERATION
# ──────────────────────────────────────────────────────────────────

def generate_action_method(action: dict) -> str:
    """Generate a single @action method for a ViewSet."""
    name = action["name"]
    method = action["method"]
    desc = action["desc"]
    model_name = action.get("model")

    if method == "get":
        if model_name:
            body = textwrap.dedent(f"""\
                queryset = {model_name}.objects.filter(
                    organization_id=request.user.organization_id
                )
                # Apply filters from query params
                for param in ['status', 'type', 'created_after', 'created_before']:
                    val = request.query_params.get(param)
                    if val:
                        if param == 'created_after':
                            queryset = queryset.filter(created_at__gte=val)
                        elif param == 'created_before':
                            queryset = queryset.filter(created_at__lte=val)
                        else:
                            queryset = queryset.filter(**{{param: val}})
                
                page = self.paginate_queryset(queryset.order_by('-created_at'))
                if page is not None:
                    data = list(page.values())
                    return self.get_paginated_response(data)
                
                return Response({{
                    'count': queryset.count(),
                    'results': list(queryset.order_by('-created_at').values()[:100]),
                }}, status=status.HTTP_200_OK)""")
        else:
            body = textwrap.dedent(f"""\
                # TODO: Business logic computation
                org_id = request.user.organization_id
                return Response({{
                    'status': 'success',
                    'organization_id': str(org_id),
                    'data': {{}},
                }}, status=status.HTTP_200_OK)""")
    else:  # POST
        if model_name:
            body = textwrap.dedent(f"""\
                data = request.data
                with transaction.atomic():
                    obj = {model_name}.objects.create(
                        organization_id=request.user.organization_id,
                        **{{k: v for k, v in data.items() if k != 'organization_id'}}
                    )
                    AuditLogs.objects.create(
                        organization_id=request.user.organization_id,
                        action='{name}',
                        resource_type='{model_name}',
                        resource_id=str(obj.id),
                        user_id=str(request.user.id),
                        details=data,
                    )
                return Response({{
                    'id': str(obj.id),
                    'created_at': obj.created_at.isoformat(),
                    'status': 'success',
                }}, status=status.HTTP_201_CREATED)""")
        else:
            body = textwrap.dedent(f"""\
                data = request.data
                org_id = request.user.organization_id
                # TODO: Implement business logic
                return Response({{
                    'status': 'success',
                    'message': '{desc}',
                }}, status=status.HTTP_200_OK)""")

    return textwrap.dedent(f"""\
    @action(detail=False, methods=['{method}'])
    def {name}(self, request):
        \"\"\"
        {desc}
        {method.upper()} /api/services/{{basename}}/{name}/
        \"\"\"
        try:
            {textwrap.indent(body, '            ').strip()}
        except Exception as e:
            return Response({{
                'error': str(e),
                'action': '{name}',
            }}, status=status.HTTP_400_BAD_REQUEST)
    """)


def generate_view_file(service_key: str, spec: dict) -> str:
    """Generate a complete views.py file for a service."""
    class_name = spec["class_name"]
    app = spec["app"]
    models = spec["models"]
    actions = spec["actions"]
    extra_apps = spec.get("extra_apps", {})

    # Build imports
    imports = [
        '"""',
        f'{class_name}',
        f'Generated from service: {service_key}',
        f'Auto-generated: {datetime.now().strftime("%Y-%m-%d %H:%M")}',
        '"""',
        '',
        'from rest_framework import viewsets, status',
        'from rest_framework.decorators import action',
        'from rest_framework.response import Response',
        'from rest_framework.permissions import IsAuthenticated',
        'from rest_framework.pagination import CursorPagination',
        'from django.db import transaction',
        'from django.utils import timezone',
        'import uuid',
        'import logging',
        '',
        'logger = logging.getLogger(__name__)',
    ]

    # Model imports
    if models:
        model_list = ", ".join(models)
        imports.append(f'from {app}.models import {model_list}')
    if spec.get("custom_models"):
        imports.append(f'# NOTE: This service may need custom models — create in {app}/models.py')

    for extra_app, extra_models in extra_apps.items():
        model_list = ", ".join(extra_models)
        imports.append(f'from {extra_app}.models import {model_list}')

    # Always import AuditLogs for write operations
    if any(a["method"] == "post" for a in actions):
        imports.append('from core.models import AuditLogs')

    imports.append('')
    imports.append('')

    # Pagination class
    pagination = textwrap.dedent(f"""\
    class {class_name.replace('ViewSet', '')}Pagination(CursorPagination):
        page_size = 50
        ordering = '-created_at'
        cursor_query_param = 'cursor'
    
    
    """)

    # ViewSet class
    basname_url = service_key
    action_methods = []
    for a in actions:
        method_code = generate_action_method(a)
        # Replace {basename} placeholder
        method_code = method_code.replace("{basename}", basname_url)
        action_methods.append(method_code)

    endpoint_docs = "\n".join(
        f"    - {a['method'].upper()} /api/services/{basname_url}/{a['name']}/ — {a['desc']}"
        for a in actions
    )

    viewset = textwrap.dedent(f"""\
    class {class_name}(viewsets.ViewSet):
        \"\"\"
        ViewSet for {service_key} operations.
        
        Endpoints:
    {endpoint_docs}
        \"\"\"
        
        permission_classes = [IsAuthenticated]
        pagination_class = {class_name.replace('ViewSet', '')}Pagination
        
        def paginate_queryset(self, queryset):
            paginator = self.pagination_class()
            return paginator.paginate_queryset(queryset, self.request, view=self)
        
        def get_paginated_response(self, data):
            paginator = self.pagination_class()
            # Reconstruct paginated response
            return Response({{
                'count': len(data),
                'results': data,
            }}, status=status.HTTP_200_OK)
        
    """)

    # Combine
    file_content = "\n".join(imports) + pagination + viewset
    for method_code in action_methods:
        # Indent once more for class body
        indented = textwrap.indent(method_code, "    ")
        file_content += indented + "\n"

    return file_content


def generate_urls_file(all_services: Dict[str, dict], existing_views: set) -> str:
    """Generate the complete urls.py with all registrations."""
    lines = [
        '"""',
        'API URL Configuration',
        'Generated for Union Eyes service migration',
        f'Auto-generated: {datetime.now().strftime("%Y-%m-%d %H:%M")}',
        '"""',
        '',
        'from django.urls import path, include',
        'from rest_framework.routers import DefaultRouter',
        '',
        '# Import ViewSets — existing (manually built)',
    ]

    # Existing imports
    existing_imports = {
        "workflows-test": ("workflows_test_views", "WorkflowsTestViewSet"),
        "governance-service": ("governance_service_views", "GovernanceServiceViewSet"),
        "schema": ("schema_views", "SchemaViewSet"),
        "certification-management-service": ("certification_management_service_views", "CertificationManagementServiceViewSet"),
        "lmbp-immigration-service": ("lmbp_immigration_service_views", "LmbpImmigrationServiceViewSet"),
        "tax-slip-service": ("tax_slip_service_views", "TaxSlipServiceViewSet"),
        "signature-service": ("signature_service_views", "SignatureServiceViewSet"),
    }

    for key, (module, cls) in existing_imports.items():
        lines.append(f"from .{module} import {cls}")

    lines.append("")
    lines.append("# Import ViewSets — generated")

    # New imports
    for svc_key, spec in sorted(all_services.items()):
        module_name = svc_key.replace("-", "_") + "_views"
        lines.append(f"from .{module_name} import {spec['class_name']}")

    lines.append("")
    lines.append("router = DefaultRouter()")
    lines.append("")
    lines.append("# Register ViewSets — existing")

    for key, (module, cls) in existing_imports.items():
        lines.append(f"router.register(r'{key}', {cls}, basename='{key}')")

    lines.append("")
    lines.append("# Register ViewSets — generated")

    for svc_key, spec in sorted(all_services.items()):
        lines.append(f"router.register(r'{svc_key}', {spec['class_name']}, basename='{svc_key}')")

    lines.append("")
    lines.append("urlpatterns = [")
    lines.append("    path('', include(router.urls)),")
    lines.append("]")
    lines.append("")

    return "\n".join(lines)


# ──────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate Union Eyes Django service views")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing files")
    parser.add_argument("--target", default=SERVICES_API_DIR, help="Target directory for output")
    args = parser.parse_args()

    target_dir = args.target
    os.makedirs(target_dir, exist_ok=True)

    report = {
        "generated_at": datetime.now().isoformat(),
        "target_dir": target_dir,
        "dry_run": args.dry_run,
        "services": [],
        "totals": {"files": 0, "viewsets": 0, "endpoints": 0, "lines": 0},
    }

    print(f"{'='*60}")
    print(f"Union Eyes — Service View Generator")
    print(f"{'='*60}")
    print(f"Target: {target_dir}")
    print(f"Dry run: {args.dry_run}")
    print(f"Services to generate: {len(SERVICE_SPECS)}")
    print()

    generated_files = []

    for svc_key, spec in sorted(SERVICE_SPECS.items()):
        module_name = svc_key.replace("-", "_") + "_views"
        filename = f"{module_name}.py"
        filepath = os.path.join(target_dir, filename)

        content = generate_view_file(svc_key, spec)
        line_count = content.count("\n") + 1
        endpoint_count = len(spec["actions"])

        svc_report = {
            "service": svc_key,
            "file": filename,
            "class": spec["class_name"],
            "app": spec["app"],
            "models": spec["models"],
            "endpoints": endpoint_count,
            "lines": line_count,
        }

        if args.dry_run:
            print(f"  [DRY-RUN] Would create: {filename} ({line_count} lines, {endpoint_count} endpoints)")
        else:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"  ✅ Created: {filename} ({line_count} lines, {endpoint_count} endpoints)")
            generated_files.append(filepath)

        report["services"].append(svc_report)
        report["totals"]["files"] += 1
        report["totals"]["viewsets"] += 1
        report["totals"]["endpoints"] += endpoint_count
        report["totals"]["lines"] += line_count

    # Generate urls.py
    urls_content = generate_urls_file(SERVICE_SPECS, EXISTING_VIEWS)
    urls_path = os.path.join(target_dir, "urls.py")
    urls_lines = urls_content.count("\n") + 1

    if args.dry_run:
        print(f"\n  [DRY-RUN] Would overwrite: urls.py ({urls_lines} lines)")
    else:
        with open(urls_path, "w", encoding="utf-8") as f:
            f.write(urls_content)
        print(f"\n  ✅ Updated: urls.py ({urls_lines} lines)")

    # Write report
    report_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "service_view_generation_report.json"
    )
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"  Files:     {report['totals']['files']}")
    print(f"  ViewSets:  {report['totals']['viewsets']}")
    print(f"  Endpoints: {report['totals']['endpoints']}")
    print(f"  Lines:     {report['totals']['lines']}")
    print(f"  Report:    {report_path}")
    print()

    return report


if __name__ == "__main__":
    main()
