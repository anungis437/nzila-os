/**
 * @nzila/platform-rum — barrel exports
 *
 * Real User Monitoring with Web Vitals collection and OTel export.
 */

// Types
export type { WebVitalMetric, RUMEvent, RUMReporterOptions, WebVitalName } from './types';
export { WebVitalMetricSchema, RUMEventSchema, WEB_VITAL_THRESHOLDS } from './types';

// Client-side Web Vitals collection
export { initWebVitals, flushWebVitals } from './web-vitals';

// Server-side reporter
export { processRUMBatch, handleRUMBeacon, isRUMHealthy } from './reporter';
export type { RUMSummary } from './reporter';
