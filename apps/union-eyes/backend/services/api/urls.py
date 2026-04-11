"""
API URL Configuration
Generated for UnionEyes service migration
Auto-generated: 2026-02-18 09:08
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Import ViewSets — existing (manually built)
from .workflows_test_views import WorkflowsTestViewSet
from .governance_service_views import GovernanceServiceViewSet
from .schema_views import SchemaViewSet
from .certification_management_service_views import CertificationManagementServiceViewSet
from .lmbp_immigration_service_views import LmbpImmigrationServiceViewSet
from .tax_slip_service_views import TaxSlipServiceViewSet
from .signature_service_views import SignatureServiceViewSet

# Import ViewSets — generated
from .break_glass_service_views import BreakGlassServiceViewSet
from .carbon_accounting_integration_views import CarbonAccountingIntegrationViewSet
from .carbon_accounting_service_views import CarbonAccountingServiceViewSet
from .currency_enforcement_service_views import CurrencyEnforcementServiceViewSet
from .email_views import EmailServiceViewSet
from .employer_non_interference_service_views import EmployerNonInterferenceServiceViewSet
from .fcm_service_views import FcmServiceViewSet
from .force_majeure_integration_views import ForceMajeureIntegrationViewSet
from .founder_conflict_service_views import FounderConflictServiceViewSet
from .geofence_privacy_service_views import GeofencePrivacyServiceViewSet
from .indigenous_data_service_views import IndigenousDataServiceViewSet
from .joint_trust_fmv_service_views import JointTrustFmvServiceViewSet
from .provincial_privacy_service_views import ProvincialPrivacyServiceViewSet
from .transfer_pricing_service_views import TransferPricingServiceViewSet
from .twilio_sms_service_views import TwilioSmsServiceViewSet
from .whiplash_prevention_service_views import WhiplashPreventionServiceViewSet

router = DefaultRouter()

# Register ViewSets — existing
router.register(r'workflows-test', WorkflowsTestViewSet, basename='workflows-test')
router.register(r'governance-service', GovernanceServiceViewSet, basename='governance-service')
router.register(r'schema', SchemaViewSet, basename='schema')
router.register(r'certification-management-service', CertificationManagementServiceViewSet, basename='certification-management-service')
router.register(r'lmbp-immigration-service', LmbpImmigrationServiceViewSet, basename='lmbp-immigration-service')
router.register(r'tax-slip-service', TaxSlipServiceViewSet, basename='tax-slip-service')
router.register(r'signature-service', SignatureServiceViewSet, basename='signature-service')

# Register ViewSets — generated
router.register(r'break-glass-service', BreakGlassServiceViewSet, basename='break-glass-service')
router.register(r'carbon-accounting-integration', CarbonAccountingIntegrationViewSet, basename='carbon-accounting-integration')
router.register(r'carbon-accounting-service', CarbonAccountingServiceViewSet, basename='carbon-accounting-service')
router.register(r'currency-enforcement-service', CurrencyEnforcementServiceViewSet, basename='currency-enforcement-service')
router.register(r'email', EmailServiceViewSet, basename='email')
router.register(r'employer-non-interference-service', EmployerNonInterferenceServiceViewSet, basename='employer-non-interference-service')
router.register(r'fcm-service', FcmServiceViewSet, basename='fcm-service')
router.register(r'force-majeure-integration', ForceMajeureIntegrationViewSet, basename='force-majeure-integration')
router.register(r'founder-conflict-service', FounderConflictServiceViewSet, basename='founder-conflict-service')
router.register(r'geofence-privacy-service', GeofencePrivacyServiceViewSet, basename='geofence-privacy-service')
router.register(r'indigenous-data-service', IndigenousDataServiceViewSet, basename='indigenous-data-service')
router.register(r'joint-trust-fmv-service', JointTrustFmvServiceViewSet, basename='joint-trust-fmv-service')
router.register(r'provincial-privacy-service', ProvincialPrivacyServiceViewSet, basename='provincial-privacy-service')
router.register(r'transfer-pricing-service', TransferPricingServiceViewSet, basename='transfer-pricing-service')
router.register(r'twilio-sms-service', TwilioSmsServiceViewSet, basename='twilio-sms-service')
router.register(r'whiplash-prevention-service', WhiplashPreventionServiceViewSet, basename='whiplash-prevention-service')

urlpatterns = [
    path('', include(router.urls)),
]
