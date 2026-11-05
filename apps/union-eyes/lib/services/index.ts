/**
 * Services Index
 * Central export point for all application services
 */

// Multi-Currency Support Services
export { ExchangeRateService } from './exchange-rate-service';
export { MultiCurrencyGLHelper } from './multi-currency-gl-helper';
export { T106ComplianceService } from './t106-compliance-service';

// Financial Services
// audit-service exports functions, not a class - import directly from file
export { AuditTrailService } from './audit-trail-service';
// general-ledger-service exports default object, not named export - import directly from file
export { MultiCurrencyTreasuryService } from './multi-currency-treasury-service';
export { FinancialEmailService } from './financial-email-service';
export { InvoiceGenerator } from './invoice-generator';
// transfer-pricing-service exports functions, not a class - import directly from file

// Document Services
// document-service exports functions/types, not a class - import directly from file
// document-storage-service exports functions, not a class - import directly from file
// precedent-document-service exports functions, not a class - import directly from file
// precedent-service exports functions, not a class - import directly from file

// Member & Organization Services
// member-service exports functions, not a class - import directly from file
// cba-service exports functions, not a class - import directly from file
// education-service exports functions, not a class - import directly from file
export { IndigenousDataService } from './indigenous-data-service';

// Notification & Communication Services
export { NotificationService } from './notification-service';
// grievance-notifications exports GrievanceNotificationContext, not GrievanceNotifications - import directly from file

// Workflow & Process Services
// case-timeline-service exports functions, not a class - import directly from file
// case-workflow-fsm exports functions, not a class - import directly from file
// claim-workflow-fsm exports functions, not a class - import directly from file
// signature-workflow-service exports default, not named export - import directly from file
// voting-service exports functions, not a class - import directly from file

// Clause & Agreement Services
// clause-service exports functions, not a class - import directly from file
// bargaining-notes-service exports functions, not a class - import directly from file

// Security & Privacy Services
// provincial-privacy-service exports functions, not a class - import directly from file
// geofence-privacy-service exports functions, not a class - import directly from file

// Infrastructure Services
// cache-service exports functions, not a class - import directly from file
// calendar-service exports CalendarEvent, not CalendarService - import directly from file
export { LocationTrackingService } from './location-tracking-service';
export { BreakGlassService } from './break-glass-service';

// Feature Management Services
// feature-flags-service exports functions, not a class - import directly from file
// feature-flags exports functions, not a class - import directly from file
// entitlements service exports functions - import directly from file

// Support & Metrics Services
// support-service exports functions, not a class - import directly from file
// sla-calculator exports functions, not a class - import directly from file
// lro-metrics exports functions, not a class - import directly from file
// lro-signals exports functions, not a class - import directly from file

// Cryptography & Security Services
// vote-crypto-service exports functions, not a class - import directly from file
// voting-crypto-service exports functions, not a class - import directly from file

// OCR & Data Processing
// ocr-service exports functions, not a class - import directly from file

// Signature Providers
// signature-providers exports SignatureProvider, not SignatureProviders - import directly from file

// Utilities
export { CurrencyService } from './currency-service';
export type { DefensibilityPack } from './defensibility-pack';
