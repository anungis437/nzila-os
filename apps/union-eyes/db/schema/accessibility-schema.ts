/**
 * Compatibility path for accessibility audits.
 * The only pgTable declarations live in the domain module.
 * Do not add a second pgTable in this file.
 */
export {
  wcagLevelEnum,
  auditStatusEnum,
  a11yIssueSeverityEnum,
  a11yIssueStatusEnum,
  accessibilityAudits,
  accessibilityIssues,
  wcagSuccessCriteria,
  type AccessibilityAudit,
  type NewAccessibilityAudit,
  type AccessibilityIssue,
  type NewAccessibilityIssue,
  type WcagSuccessCriteria,
  type NewWcagSuccessCriteria,
} from './domains/infrastructure/accessibility';
