/**
 * ML Domain
 * 
 * Machine learning and AI feature schemas.
 * 
 * This domain consolidates:
 * - ml-predictions-schema.ts (deprecated, merged into analytics)
 * - ai-chatbot-schema.ts
 * - AI Intelligence Layer schemas (grievance triage, clause reasoning,
 *   employer risk, copilot sessions, insight reports)
 * 
 * Priority: 11
 */

// Export all ML-related schemas from consolidated domain location
export * from './predictions';
export * from './chatbot';

// AI Intelligence Layer
export * from './ai-grievance-triage';
export * from './ai-clause-reasoning';
export * from './employer-risk-scores';
export * from './ai-copilot-sessions';
export * from './ai-insight-reports';
export * from './knowledge-transfer-runtime';
export * from './authority-kernel';
