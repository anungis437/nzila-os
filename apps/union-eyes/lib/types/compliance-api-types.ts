/**
 * Type definitions for Compliance APIs
 * Phase 2 - Service Layer Integration
 */

// ====== Provincial Privacy API ======
export interface ProvincialPrivacyRequest {
  province: 'AB' | 'BC' | 'ON' | 'QC' | 'FEDERAL';
  action: 'get_rules' | 'assess_breach' | 'validate_consent' | 'compliance_report';
  memberId?: string;
  dataTypes?: string[];
  breachDate?: string;
  consentType?: 'explicit' | 'informed' | 'opt-in';
}

export interface PrivacyRules {
  breachNotification: string;
  consentType: string;
  dataResidency: string;
  authority: string;
  key_requirements: string[];
}

export interface ProvincialPrivacyResponse {
  success: boolean;
  province: string;
  rules?: PrivacyRules;
  dataRetention?: {
    days: number;
    reason: string;
  };
  result?: any;
  error?: string;
}

export interface BreachNotificationAssessment {
  requiresNotification: boolean;
  notificationDeadlineHours: number;
  affectedProvince: string;
  authority: string;
  notificationChannels: string[];
  estimatedAffectedMembers: number;
}

// ====== Currency Conversion API ======
export interface CurrencyConversionRequest {
  amount: number;
  sourceCurrency: string;
  targetCurrency: string;
  conversionDate?: string;
}

export interface CurrencyConversionResponse {
  success: boolean;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  convertedAmount: number;
  exchangeRate: number;
  conversionDate: string;
  source: 'BOC' | 'BoC VALET API';
  error?: string;
}

export interface BillingValidationRequest {
  customerId: string;
  amount: number;
  currency: string;
  description?: string;
  invoiceDate?: string;
}

export interface BillingValidationResponse {
  valid: boolean;
  currency: string;
  amount: number;
  requiredCurrency?: string;
  message?: string;
  error?: string;
}

// ====== CRA T1 General / T106 Slip API ======
export interface T106FilingRequest {
  memberId: string;
  taxYear: number;
  strikePayments: Array<{
    date: string;
    amount: number;
    description: string;
  }>;
  province: string;
}

export interface T106Filing {
  slipNumber: string;
  taxYear: number;
  payerName: string;
  recipientName: string;
  amount: number;
  boxes: Record<string, number | string>;
  filingDeadline: string;
  requiresElectronicFiling: boolean;
}

export interface T106FilingResponse {
  success: boolean;
  requiresT106: boolean;
  filing?: T106Filing;
  rl1Details?: {
    province: string;
    deadline: string;
    slipFormat: string;
  };
  message?: string;
  error?: string;
}

// ====== Force Majeure Emergency API ======
export interface EmergencyActivationRequest {
  memberId: string;
  emergencyType: 'natural_disaster' | 'strike' | 'war' | 'epidemic' | 'government_action' | 'supplier_failure';
  affectedRegions: string[];
  description: string;
  expectedDurationDays: number;
}

export interface EmergencyDeclaration {
  emergencyId: string;
  memberId: string;
  emergencyType: string;
  status: 'active' | 'paused' | 'ended';
  declaredAt: string;
  expectedEndDate: string;
  breakGlassActivated: boolean;
  affectedRegions: string[];
}

export interface EmergencyActivationResponse {
  success: boolean;
  declaration?: EmergencyDeclaration;
  breakGlassOps?: {
    activated: boolean;
    allowedOperations: string[];
    safetyLimits: Record<string, string | number>;
  };
  notificationsSent: string[];
  error?: string;
}

export interface EmergencyRecoveryRequest {
  emergencyId: string;
  memberId: string;
}

export interface EmergencyRecoveryResponse {
  success: boolean;
  emergencyId: string;
  status: string;
  recoverySteps: string[];
  completedAt?: string;
  remainingActions?: string[];
  error?: string;
}

export interface PIPEDABreachRequest {
  memberId: string;
  breachDate: string;
  affectedDataTypes: string[];
  estimatedAffectedCount: number;
  province: string;
}

export interface PIPEDABreachAssessment {
  requiresBreachReport: boolean;
  notificationRequired: boolean;
  affectingMinimumThreshold: boolean;
  reportDeadline: string;
  reportingChannels: string[];
  estimatedDamages?: string;
}

// ====== Carbon Emissions Tracking API ======
export interface CarbonDashboardRequest {
  organizationId?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export interface CarbonMetrics {
  totalEmissions: number;
  emissionsUnit: 'tCO2e';
  breakdown: Record<string, number>;
  reductionTarget: number;
  onTrack: boolean;
}

export interface CarbonDashboardResponse {
  success: boolean;
  metrics?: CarbonMetrics;
  azureInfrastructure?: {
    regions: string[];
    renewablePercentage: number;
    certificationLevel: string;
  };
  recommendations?: string[];
  error?: string;
}

export interface AzureInfrastructureMonitoring {
  region: string;
  resourceType: string;
  estimatedEmissions: number;
  optimizationOpportunities: string[];
  renewableEnergyPercentage: number;
}

export interface CarbonValidationRequest {
  claimType: 'carbon_neutral' | 'renewable_powered' | 'net_zero';
  dataPoints: Array<{
    metric: string;
    value: number;
    unit: string;
  }>;
}

export interface CarbonValidationResponse {
  valid: boolean;
  claimType: string;
  validationScore: number;
  issues?: string[];
  recommendations?: string[];
  certificationEligible?: boolean;
  error?: string;
}

// ====== Location Tracking API (Geofence Privacy) ======
export interface LocationConsentRequest {
  memberId: string;
  purpose: 'delivery_tracking' | 'attendance_verification' | 'emergency_response' | 'voluntary_analytics';
  duration: 'session' | 'day' | 'month' | 'permanent';
}

export interface LocationConsentResponse {
  success: boolean;
  consentGranted: boolean;
  consentId?: string;
  trackingPeriod?: {
    startDate: string;
    endDate?: string;
  };
  memberOptOut?: boolean;
  error?: string;
}

export interface LocationTrackingRequest {
  memberId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp?: string;
}

export interface LocationTrackingResponse {
  success: boolean;
  locationRecorded: boolean;
  locationId?: string;
  privacyGuards: {
    backgroundTrackingBlocked: boolean;
    dataEncrypted: boolean;
    retentionDays: number;
  };
  error?: string;
}

export interface LocationPurgeRequest {
  memberId?: string;
  olderThanDays: number;
  reason: 'manual_request' | 'retention_policy' | 'account_closure';
}

export interface LocationPurgeResponse {
  success: boolean;
  recordsPurged: number;
  purgeDate: string;
  memberNotified: boolean;
  error?: string;
}

