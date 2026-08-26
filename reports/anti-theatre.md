# Anti-Theatre Scan Report

- Generated: 2026-08-26T17:39:41.506Z
- Files scanned: 4825
- Rules: R-1, R-2, R-3, R-4, R-5, R-6, R-7, R-8
- **Errors: 0**
- Warnings: 1266

## Findings

| Severity | Rule | File | Line | Message |
|----------|------|------|------|---------|
| warning | R-2 | `apps/union-eyes/app/api/admin/database/health/route.ts` | 39 | Handler literally returns `status: "healthy"`. Verify this is derived from real measurements, not a placeholder. |
| warning | R-6 | `apps/union-eyes/app/[locale]/calendar/page.tsx` | 99 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/calendar/page.tsx` | 112 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/admin/dues/reports/page.tsx` | 91 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/admin/dues/reports/page.tsx` | 111 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/admin/organizations/[id]/edit/page.tsx` | 136 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/admin/organizations/new/page.tsx` | 113 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/admin/page.tsx` | 115 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/admin/page.tsx` | 127 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/audits/page.tsx` | 46 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/claims/[id]/page.tsx` | 127 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/claims/new/page.tsx` | 135 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/committees/[id]/committee-workspace.tsx` | 102 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/committees/[id]/committee-workspace.tsx` | 113 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/committees/[id]/committee-workspace.tsx` | 124 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/committees/[id]/committee-workspace.tsx` | 135 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/committees/committees-page.tsx` | 40 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/communications/distribution-lists/[id]/page.tsx` | 129 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/compliance/page.tsx` | 68 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/data-source/page.tsx` | 193 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/dispatch/page.tsx` | 69 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/dispatch/page.tsx` | 99 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/dispatch/page.tsx` | 116 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/profile/page.tsx` | 67 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/rewards/page.tsx` | 43 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/settings/_components/org-settings-content.tsx` | 126 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/settings/_components/org-settings-content.tsx` | 236 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/settings/sharing/page.tsx` | 28 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/dashboard/stewards/ratings/page.tsx` | 29 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/final-go/page.tsx` | 39 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/operational-proving/page.tsx` | 43 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/[locale]/page.tsx` | 45 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/api/admin/pki/signatures/[id]/sign/route.ts` | 88 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/api/ai/pension/plans/[id]/trustee-summary/route.ts` | 64 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/api/cases/[caseId]/timeline/route.ts` | 97 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/api/compliance/validate/route.ts` | 89 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/api/exit-interviews/[id]/publish/route.ts` | 126 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/api/gdpr/cookie-consent/route.ts` | 26 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/api/governance/telemetry/route.ts` | 54 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/api/members/import/route.ts` | 79 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/api/members/route.ts` | 102 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/api/social-media/accounts/route.ts` | 292 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/app/api/voting/sessions/[id]/results/route.ts` | 42 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/accessibility/accessibility-dashboard.tsx` | 139 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/accessibility/accessibility-dashboard.tsx` | 151 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/accessibility/accessibility-dashboard.tsx` | 163 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/address/international-address-input.tsx` | 122 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/admin/clc-remittances-dashboard.tsx` | 190 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/admin/FeatureFlagsAdmin.tsx` | 34 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/admin/FeatureFlagsAdmin.tsx` | 57 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/admin/organization-form.tsx` | 356 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/admin/OrganizationHierarchyAdmin.tsx` | 85 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/admin/OrganizationHierarchyAdmin.tsx` | 144 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/admin/OrganizationHierarchyAdmin.tsx` | 169 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/admin/representation-protocol-editor.tsx` | 71 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/admin/representation-protocol-editor.tsx` | 96 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/ai/ai-chatbot.tsx` | 96 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/ai/ai-chatbot.tsx` | 113 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/ai/ai-chatbot.tsx` | 254 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/analytics/analytics-overview-console.tsx` | 119 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/analytics/benchmark-comparison-dashboard.tsx` | 228 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/analytics/CBAClauseAnalyticsDashboard.tsx` | 87 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/analytics/CBAPrecedentImpactAnalytics.tsx` | 82 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/analytics/communication-analytics-dashboard.tsx` | 246 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/analytics/comparative-analysis.tsx` | 74 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/analytics/engagement-metrics-dashboard.tsx` | 209 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/analytics/real-time-ticker.tsx` | 109 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/analytics/scheduled-reports-manager.tsx` | 341 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/auth/login-form.tsx` | 62 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/automation/automation-workflow-builder.tsx` | 826 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/calendar/CalendarSyncManager.tsx` | 77 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/cancellation-popup.tsx` | 32 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/cancellation-popup.tsx` | 52 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/cancellation-popup.tsx` | 70 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/cancellation-popup.tsx` | 77 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/claims/claim-assignment-modal.tsx` | 110 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/claims/claim-detail-view-enhanced.tsx` | 139 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/clause-library/ClauseSharingControls.tsx` | 123 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/clc/CLCRemittanceDashboard.tsx` | 52 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/clc/CLCSyncDashboard.tsx` | 50 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/communications/push-device-manager.tsx` | 106 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/communications/push-notification-history.tsx` | 112 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/communications/sms-console.tsx` | 67 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/communications/sms-inbox.tsx` | 104 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/communications/unified-analytics-dashboard.tsx` | 195 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/communications/unified-analytics-dashboard.tsx` | 271 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/communications/unified-analytics-dashboard.tsx` | 297 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/compliance/member-data-anonymizer.tsx` | 188 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/compliance/privacy-consent-manager.tsx` | 112 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/cope/CanvassingInterface.tsx` | 129 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/cope/PoliticalCampaignDashboard.tsx` | 94 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/credit-usage-display.tsx` | 38 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/cross-union-analytics/cross-union-analytics-console.tsx` | 217 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/dashboards/clc-dashboard.tsx` | 75 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/dashboards/federation-dashboard.tsx` | 76 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/dashboards/pilot-dashboard.tsx` | 66 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/dashboards/pilot-dashboard.tsx` | 83 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/dashboards/union-dashboard.tsx` | 306 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/dashboards/union-dashboard.tsx` | 333 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/dashboards/union-dashboard.tsx` | 359 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/dashboards/union-dashboard.tsx` | 402 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/documents/advanced-search.tsx` | 141 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/documents/advanced-search.tsx` | 152 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/documents/document-browser.tsx` | 205 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/documents/documents-console.tsx` | 323 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/documents/ocr-upload.tsx` | 98 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/education/admin/ApprenticeshipManager.tsx` | 172 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/education/admin/ApprenticeshipManager.tsx` | 185 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/education/admin/CertificationManager.tsx` | 108 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/education/ApprenticeshipPortal.tsx` | 137 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/education/ApprenticeshipPortal.tsx` | 153 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/education/ApprenticeshipPortal.tsx` | 180 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/education/CourseCatalog.tsx` | 95 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/education/MemberLearningPortal.tsx` | 107 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/executive/ExecutiveDashboard.tsx` | 60 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/executive/StrategicPlanningBoard.tsx` | 48 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/gdpr/cookie-consent-banner.tsx` | 62 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/gdpr/cookie-consent-banner.tsx` | 154 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/gdpr/cookie-consent-banner.tsx` | 418 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/gdpr/cookie-consent-banner.tsx` | 433 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/governance/BylawsViewer.tsx` | 48 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/governance/PolicyManager.tsx` | 47 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/governance/SignatoryManager.tsx` | 51 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/grievances/grievance-detail-console.tsx` | 155 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/grievances/grievance-intake-form.tsx` | 238 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/icra/ICRAAssessmentFlow.tsx` | 93 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/icra/ICRAAssessmentFlow.tsx` | 218 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/icra/ICRAAssessmentFlow.tsx` | 241 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/icra/ICRAAssessmentFlow.tsx` | 530 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/icra/TurnstileWidget.tsx` | 74 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/icra/TurnstileWidget.tsx` | 100 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/inbox/inbox-console.tsx` | 132 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/jurisdiction/compliance-checker.tsx` | 220 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/knowledge-transfer/continuity-intelligence-cockpit.tsx` | 138 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/knowledge-transfer/continuity-planning-workspace.tsx` | 180 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/knowledge-transfer/continuity-planning-workspace.tsx` | 195 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/knowledge-transfer/continuity-simulation-workspace.tsx` | 281 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/knowledge-transfer/continuity-simulation-workspace.tsx` | 320 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/knowledge-transfer/continuity-simulation-workspace.tsx` | 359 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/knowledge-transfer/organizational-memory-explorer.tsx` | 215 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/knowledge/knowledge-base-browser.tsx` | 244 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/members/member-search-modal.tsx` | 111 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/messages/MessageNotificationBadge.tsx` | 26 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/mobile/OfflineBanner.tsx` | 38 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/monitoring/StatusPage.tsx` | 65 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/notifications/notifications-console.tsx` | 222 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/notifications/notifications-console.tsx` | 232 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/notifications/notifications-console.tsx` | 243 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/onboarding/action-hint.tsx` | 32 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/onboarding/SelfServeOnboarding.tsx` | 106 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/organization/organization-breadcrumb.tsx` | 61 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/organization/organization-members.tsx` | 84 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/organization/organization-selector.tsx` | 119 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/organizing/CampaignTracker.tsx` | 110 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/organizing/DensityHeatMap.tsx` | 86 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/organizing/DensityHeatMap.tsx` | 111 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/organizing/LabourBoardFormGenerator.tsx` | 153 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/organizing/LabourBoardFormGenerator.tsx` | 236 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/organizing/WorkplaceMap.tsx` | 107 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/organizing/WorkplaceMap.tsx` | 121 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/payment-success-popup.tsx` | 92 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/payment-success-popup.tsx` | 105 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/payment-success-popup.tsx` | 123 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/payment-success-popup.tsx` | 165 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/payment-success-popup.tsx` | 182 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/payment/payment-status-alert.tsx` | 34 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/pension/pension-admin-console.tsx` | 145 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/pilot/pilot-admin-overview.tsx` | 116 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/pilot/pilot-feedback-widget.tsx` | 113 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/pilot/pilot-feedback-widget.tsx` | 247 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/precedents/JurisdictionPreferences.tsx` | 91 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/precedents/precedents-console.tsx` | 223 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/precedents/precedents-console.tsx` | 352 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/precedents/precedents-console.tsx` | 404 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/priorities/priorities-console.tsx` | 101 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/public/donation-page.tsx` | 140 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/public/donation-page.tsx` | 165 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/public/event-registration-page.tsx` | 165 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/public/event-registration-page.tsx` | 203 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/public/event-registration-page.tsx` | 224 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/public/job-application-page.tsx` | 76 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/public/job-board-page.tsx` | 79 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/public/page-renderer.tsx` | 70 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/rewards/recognition-feed.tsx` | 52 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/rewards/recognition-feed.tsx` | 108 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/satisfaction/satisfaction-survey.tsx` | 217 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/sidebar.tsx` | 104 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/sidebar.tsx` | 186 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/sidebar.tsx` | 198 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/signatures/documents-list.tsx` | 65 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/social-media/campaign-scheduler.tsx` | 186 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/social-media/post-composer.tsx` | 185 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/social-media/social-analytics-dashboard.tsx` | 136 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/social-media/social-feed-widget.tsx` | 116 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/social-media/social-feed-widget.tsx` | 339 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/social-media/social-media-dashboard.tsx` | 190 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/strike-fund/strike-fund-console.tsx` | 63 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/strike/StrikeFundDashboard.tsx` | 90 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/strike/StrikeFundDashboard.tsx` | 108 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/strike/StrikeFundDashboard.tsx` | 120 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/ui/confirm-dialog.tsx` | 81 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/ui/search-bar-advanced.tsx` | 89 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/ui/search-bar-advanced.tsx` | 128 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/upgrade-plan-popup.tsx` | 58 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/upgrade-plan-popup.tsx` | 68 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/upgrade-plan-popup.tsx` | 88 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/upgrade-plan-popup.tsx` | 99 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/upgrade-plan-popup.tsx` | 125 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/upgrade-plan-popup.tsx` | 178 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/welcome-message-popup.tsx` | 39 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/welcome-message-popup.tsx` | 55 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/welcome-message-popup.tsx` | 91 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/welcome-message-popup.tsx` | 109 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/welcome-message-popup.tsx` | 116 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/components/welcome-message-popup.tsx` | 128 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/contexts/organization-context.tsx` | 202 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/contexts/organization-context.tsx` | 226 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/contexts/pilot-mode-context.tsx` | 37 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/contexts/pilot-mode-context.tsx` | 66 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/instrumentation.ts` | 64 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/instrumentation.ts` | 72 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/address/address-service.ts` | 351 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/address/address-service.ts` | 367 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/analytics-aggregation.ts` | 265 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/analytics-middleware.ts` | 108 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/api-auth-guard.ts` | 411 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/api-auth-guard.ts` | 429 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/api-auth-guard.ts` | 528 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/api-auth-guard.ts` | 540 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/api/standardized-responses.ts` | 24 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/api/with-api.ts` | 335 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/api/with-api.ts` | 350 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/api/with-api.ts` | 368 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/api/with-api.ts` | 393 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/api/with-api.ts` | 447 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/api/with-api.ts` | 544 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/blob-client.ts` | 111 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/calendar-reminder-scheduler.ts` | 223 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/chaos-engineering/chaos-monkey.ts` | 233 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/chaos-engineering/chaos-monkey.ts` | 235 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/claim-notifications.ts` | 86 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/claim-notifications.ts` | 290 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/claim-notifications.ts` | 371 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/clc/executive-snapshot-store.ts` | 54 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/clc/governance.ts` | 316 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/client-logger.ts` | 29 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/cognition/ue-adapter.ts` | 127 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/db/with-rls-context.ts` | 152 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/deadline-tracking-system.ts` | 583 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/deadline-tracking-system.ts` | 604 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/document-management-system.ts` | 797 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/document-management-system.ts` | 862 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/documents/batch-operations-service.ts` | 97 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/email/report-email-templates.ts` | 130 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/enterprise-role-middleware.ts` | 568 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/external-calendar-sync/google-calendar-service.ts` | 294 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/external-calendar-sync/google-calendar-service.ts` | 499 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/external-calendar-sync/google-calendar-service.ts` | 544 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/external-calendar-sync/microsoft-calendar-service.ts` | 370 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/external-calendar-sync/microsoft-calendar-service.ts` | 659 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/external-calendar-sync/microsoft-calendar-service.ts` | 699 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/governance-observability/ledger.ts` | 36 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/governance-observability/telemetry.ts` | 111 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/governance-observability/telemetry.ts` | 146 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/governance-observability/telemetry.ts` | 184 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/governance-observability/telemetry.ts` | 227 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/governance-observability/telemetry.ts` | 256 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/governance-observability/telemetry.ts` | 301 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/governance-simulation/ledger.ts` | 37 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/hooks/use-feature-flags.tsx` | 61 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/hooks/use-onboarding.ts` | 35 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/hooks/use-onboarding.ts` | 45 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/hooks/use-pilot-tracking.ts` | 65 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/hooks/use-workspace-telemetry.ts` | 45 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/icra/observability.ts` | 66 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/logger.ts` | 29 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/middleware/auth-middleware.ts` | 32 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/middleware/request-validation.ts` | 269 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/migrations/data-integrity.ts` | 159 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/migrations/data-integrity.ts` | 199 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/migrations/data-integrity.ts` | 233 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/migrations/data-integrity.ts` | 271 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/migrations/data-integrity.ts` | 327 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/migrations/data-integrity.ts` | 355 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/migrations/data-integrity.ts` | 463 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/migrations/data-integrity.ts` | 506 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/migrations/data-integrity.ts` | 548 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/migrations/data-integrity.ts` | 595 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/migrations/data-integrity.ts` | 635 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/migrations/rollback.ts` | 117 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/migrations/tenant-to-org-mapper.ts` | 461 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/mobile/biometric-auth.ts` | 144 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/observability/telemetry.ts` | 63 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/recurring-events-service.ts` | 262 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/rollout-governance.ts` | 52 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/rollout-governance.ts` | 76 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/services/signature-providers.ts` | 147 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/signature/signature-service.ts` | 343 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/signature/signature-service.ts` | 476 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/signature/signature-service.ts` | 547 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/social-media/social-media-service.ts` | 621 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/tracing/utils.ts` | 247 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/trust/system-metrics.ts` | 261 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/utils/member-data-utils.ts` | 116 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/workers/cleanup-worker.ts` | 19 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/workers/cleanup-worker.ts` | 122 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/workers/cleanup-worker.ts` | 148 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/workers/email-worker.ts` | 20 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/workers/notification-worker.ts` | 20 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/workers/report-worker.ts` | 22 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/workers/report-worker.ts` | 56 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/workers/report-worker.ts` | 497 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/workers/sms-worker.ts` | 19 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/workers/sms-worker.ts` | 102 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/lib/workflow-engine.ts` | 446 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/services/clc/per-capita-calculator.ts` | 268 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/services/clc/remittance-audit.ts` | 669 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/services/clc/remittance-notifications.ts` | 929 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/services/financial-service/check-dues-transactions.ts` | 41 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/services/financial-service/check-stipend-structure.ts` | 55 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/services/financial-service/check-tables.ts` | 59 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-6 | `apps/union-eyes/services/pki/certificate-manager.ts` | 369 | Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored. |
| warning | R-7 | `apps/union-eyes/app/api/activities/route.ts` | 1 | Production API route `app/api/activities/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/ai-usage/route.ts` | 1 | Production API route `app/api/admin/ai-usage/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/alerts/escalations/[id]/route.ts` | 1 | Production API route `app/api/admin/alerts/escalations/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/alerts/escalations/route.ts` | 1 | Production API route `app/api/admin/alerts/escalations/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/alerts/executions/route.ts` | 1 | Production API route `app/api/admin/alerts/executions/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/alerts/executions/test/route.ts` | 1 | Production API route `app/api/admin/alerts/executions/test/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/alerts/recipients/[id]/route.ts` | 1 | Production API route `app/api/admin/alerts/recipients/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/alerts/recipients/route.ts` | 1 | Production API route `app/api/admin/alerts/recipients/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/alerts/rules/[id]/route.ts` | 1 | Production API route `app/api/admin/alerts/rules/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/alerts/rules/route.ts` | 1 | Production API route `app/api/admin/alerts/rules/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/billing-cycles/preview/route.ts` | 1 | Production API route `app/api/admin/billing-cycles/preview/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/billing-cycles/route.ts` | 1 | Production API route `app/api/admin/billing-cycles/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/billing-cycles/trigger-scheduled/route.ts` | 1 | Production API route `app/api/admin/billing-cycles/trigger-scheduled/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/clc/analytics/annual-report/route.ts` | 1 | Production API route `app/api/admin/clc/analytics/annual-report/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/clc/analytics/anomalies/route.ts` | 1 | Production API route `app/api/admin/clc/analytics/anomalies/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/clc/analytics/forecast/route.ts` | 1 | Production API route `app/api/admin/clc/analytics/forecast/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/clc/analytics/multi-year-trends/route.ts` | 1 | Production API route `app/api/admin/clc/analytics/multi-year-trends/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/clc/analytics/organizations/route.ts` | 1 | Production API route `app/api/admin/clc/analytics/organizations/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/clc/analytics/patterns/route.ts` | 1 | Production API route `app/api/admin/clc/analytics/patterns/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/clc/analytics/trends/route.ts` | 1 | Production API route `app/api/admin/clc/analytics/trends/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/clc/remittances/[id]/export/route.ts` | 1 | Production API route `app/api/admin/clc/remittances/[id]/export/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/clc/remittances/[id]/route.ts` | 1 | Production API route `app/api/admin/clc/remittances/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/clc/remittances/[id]/submit/route.ts` | 1 | Production API route `app/api/admin/clc/remittances/[id]/submit/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/clc/remittances/export/route.ts` | 1 | Production API route `app/api/admin/clc/remittances/export/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/clc/remittances/route.ts` | 1 | Production API route `app/api/admin/clc/remittances/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/database/health/route.ts` | 1 | Production API route `app/api/admin/database/health/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/database/optimize/route.ts` | 1 | Production API route `app/api/admin/database/optimize/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/dues/overview/route.ts` | 1 | Production API route `app/api/admin/dues/overview/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/dues/payments/[id]/route.ts` | 1 | Production API route `app/api/admin/dues/payments/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/dues/payments/route.ts` | 1 | Production API route `app/api/admin/dues/payments/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/dues/send-reminders/route.ts` | 1 | Production API route `app/api/admin/dues/send-reminders/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/duplicates/route.ts` | 1 | Production API route `app/api/admin/duplicates/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/employment/[id]/route.ts` | 1 | Production API route `app/api/admin/employment/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/employment/member/[memberId]/history/route.ts` | 1 | Production API route `app/api/admin/employment/member/[memberId]/history/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/employment/member/[memberId]/route.ts` | 1 | Production API route `app/api/admin/employment/member/[memberId]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/employment/route.ts` | 1 | Production API route `app/api/admin/employment/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/feature-flags/route.ts` | 1 | Production API route `app/api/admin/feature-flags/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/fix-super-admin-roles/route.ts` | 1 | Production API route `app/api/admin/fix-super-admin-roles/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/ingest/batches/[id]/route.ts` | 1 | Production API route `app/api/admin/ingest/batches/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/ingest/batches/route.ts` | 1 | Production API route `app/api/admin/ingest/batches/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/ingest/retry/route.ts` | 1 | Production API route `app/api/admin/ingest/retry/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/ingest/route.ts` | 1 | Production API route `app/api/admin/ingest/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/job-classifications/[id]/route.ts` | 1 | Production API route `app/api/admin/job-classifications/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/job-classifications/route.ts` | 1 | Production API route `app/api/admin/job-classifications/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/jobs/[action]/route.ts` | 1 | Production API route `app/api/admin/jobs/[action]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/jobs/retry/route.ts` | 1 | Production API route `app/api/admin/jobs/retry/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/jobs/route.ts` | 1 | Production API route `app/api/admin/jobs/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/leaves/[id]/route.ts` | 1 | Production API route `app/api/admin/leaves/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/leaves/route.ts` | 1 | Production API route `app/api/admin/leaves/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/lro/metrics/route.ts` | 1 | Production API route `app/api/admin/lro/metrics/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/members/bulk-import/route.ts` | 1 | Production API route `app/api/admin/members/bulk-import/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/members/export/route.ts` | 1 | Production API route `app/api/admin/members/export/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/members/stats/route.ts` | 1 | Production API route `app/api/admin/members/stats/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/organizations/[id]/route.ts` | 1 | Production API route `app/api/admin/organizations/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/organizations/bulk-import/route.ts` | 1 | Production API route `app/api/admin/organizations/bulk-import/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/organizations/route.ts` | 1 | Production API route `app/api/admin/organizations/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/payments/retry-failed/route.ts` | 1 | Production API route `app/api/admin/payments/retry-failed/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/pki/certificates/[id]/route.ts` | 1 | Production API route `app/api/admin/pki/certificates/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/pki/certificates/route.ts` | 1 | Production API route `app/api/admin/pki/certificates/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/pki/signatures/[id]/sign/route.ts` | 1 | Production API route `app/api/admin/pki/signatures/[id]/sign/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/pki/signatures/[id]/verify/route.ts` | 1 | Production API route `app/api/admin/pki/signatures/[id]/verify/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/pki/signatures/route.ts` | 1 | Production API route `app/api/admin/pki/signatures/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/pki/workflows/[id]/route.ts` | 1 | Production API route `app/api/admin/pki/workflows/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/pki/workflows/route.ts` | 1 | Production API route `app/api/admin/pki/workflows/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/representation-protocol/route.ts` | 1 | Production API route `app/api/admin/representation-protocol/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/roles/batch/route.ts` | 1 | Production API route `app/api/admin/roles/batch/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/seed-cupe-pilot/route.ts` | 1 | Production API route `app/api/admin/seed-cupe-pilot/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/seed-test-data/route.ts` | 1 | Production API route `app/api/admin/seed-test-data/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/segments/[id]/execute/route.ts` | 1 | Production API route `app/api/admin/segments/[id]/execute/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/segments/[id]/route.ts` | 1 | Production API route `app/api/admin/segments/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/segments/route.ts` | 1 | Production API route `app/api/admin/segments/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/stats/activity/route.ts` | 1 | Production API route `app/api/admin/stats/activity/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/stats/overview/route.ts` | 1 | Production API route `app/api/admin/stats/overview/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/system/cache/route.ts` | 1 | Production API route `app/api/admin/system/cache/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/system/settings/route.ts` | 1 | Production API route `app/api/admin/system/settings/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/update-role/route.ts` | 1 | Production API route `app/api/admin/update-role/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/users/[userId]/route.ts` | 1 | Production API route `app/api/admin/users/[userId]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/admin/users/route.ts` | 1 | Production API route `app/api/admin/users/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/agreements/route.ts` | 1 | Production API route `app/api/agreements/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/cache-stats/route.ts` | 1 | Production API route `app/api/ai/cache-stats/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/classify/route.ts` | 1 | Production API route `app/api/ai/classify/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/copilot/query/route.ts` | 1 | Production API route `app/api/ai/copilot/query/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/copilot/sessions/[id]/route.ts` | 1 | Production API route `app/api/ai/copilot/sessions/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/employers/[id]/risk/route.ts` | 1 | Production API route `app/api/ai/employers/[id]/risk/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/extract-clauses/route.ts` | 1 | Production API route `app/api/ai/extract-clauses/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/feedback/route.ts` | 1 | Production API route `app/api/ai/feedback/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/finance/analysis/route.ts` | 1 | Production API route `app/api/ai/finance/analysis/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/grievances/[id]/clause-reasoning/route.ts` | 1 | Production API route `app/api/ai/grievances/[id]/clause-reasoning/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/grievances/[id]/triage/route.ts` | 1 | Production API route `app/api/ai/grievances/[id]/triage/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/grievances/triage/route.ts` | 1 | Production API route `app/api/ai/grievances/triage/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/ingest/route.ts` | 1 | Production API route `app/api/ai/ingest/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/insights/[reportType]/route.ts` | 1 | Production API route `app/api/ai/insights/[reportType]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/insights/summary/route.ts` | 1 | Production API route `app/api/ai/insights/summary/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/mamba/route.ts` | 1 | Production API route `app/api/ai/mamba/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/match-precedents/route.ts` | 1 | Production API route `app/api/ai/match-precedents/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/pension/members/[id]/projection/route.ts` | 1 | Production API route `app/api/ai/pension/members/[id]/projection/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/pension/plans/[id]/funding/route.ts` | 1 | Production API route `app/api/ai/pension/plans/[id]/funding/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/pension/plans/[id]/trustee-summary/route.ts` | 1 | Production API route `app/api/ai/pension/plans/[id]/trustee-summary/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/search/route.ts` | 1 | Production API route `app/api/ai/search/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/semantic-search/route.ts` | 1 | Production API route `app/api/ai/semantic-search/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/ai/summarize/route.ts` | 1 | Production API route `app/api/ai/summarize/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/alerts/realtime/route.ts` | 1 | Production API route `app/api/alerts/realtime/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/claims/categories/route.ts` | 1 | Production API route `app/api/analytics/claims/categories/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/claims/route.ts` | 1 | Production API route `app/api/analytics/claims/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/claims/stewards/route.ts` | 1 | Production API route `app/api/analytics/claims/stewards/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/claims/trends/route.ts` | 1 | Production API route `app/api/analytics/claims/trends/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/clause-stats/route.ts` | 1 | Production API route `app/api/analytics/clause-stats/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/comparative/route.ts` | 1 | Production API route `app/api/analytics/comparative/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/cross-org/route.ts` | 1 | Production API route `app/api/analytics/cross-org/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/dashboard/route.ts` | 1 | Production API route `app/api/analytics/dashboard/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/deadlines-metrics/route.ts` | 1 | Production API route `app/api/analytics/deadlines-metrics/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/executive/route.ts` | 1 | Production API route `app/api/analytics/executive/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/financial/categories/route.ts` | 1 | Production API route `app/api/analytics/financial/categories/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/financial/costs/route.ts` | 1 | Production API route `app/api/analytics/financial/costs/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/financial/outcomes/route.ts` | 1 | Production API route `app/api/analytics/financial/outcomes/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/financial/route.ts` | 1 | Production API route `app/api/analytics/financial/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/financial/trends/route.ts` | 1 | Production API route `app/api/analytics/financial/trends/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/heatmap/route.ts` | 1 | Production API route `app/api/analytics/heatmap/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/insights/route.ts` | 1 | Production API route `app/api/analytics/insights/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/insights/weekly-summary/route.ts` | 1 | Production API route `app/api/analytics/insights/weekly-summary/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/kpis/route.ts` | 1 | Production API route `app/api/analytics/kpis/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/members/churn-risk/route.ts` | 1 | Production API route `app/api/analytics/members/churn-risk/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/members/cohorts/route.ts` | 1 | Production API route `app/api/analytics/members/cohorts/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/members/route.ts` | 1 | Production API route `app/api/analytics/members/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/members/trends/route.ts` | 1 | Production API route `app/api/analytics/members/trends/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/metrics/route.ts` | 1 | Production API route `app/api/analytics/metrics/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/operational/bottlenecks/route.ts` | 1 | Production API route `app/api/analytics/operational/bottlenecks/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/operational/derived-case-metrics/route.ts` | 1 | Production API route `app/api/analytics/operational/derived-case-metrics/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/operational/queues/route.ts` | 1 | Production API route `app/api/analytics/operational/queues/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/operational/route.ts` | 1 | Production API route `app/api/analytics/operational/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/operational/sla/route.ts` | 1 | Production API route `app/api/analytics/operational/sla/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/operational/workload/route.ts` | 1 | Production API route `app/api/analytics/operational/workload/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/org-activity/route.ts` | 1 | Production API route `app/api/analytics/org-activity/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/precedent-stats/route.ts` | 1 | Production API route `app/api/analytics/precedent-stats/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/predictions/route.ts` | 1 | Production API route `app/api/analytics/predictions/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/refresh/route.ts` | 1 | Production API route `app/api/analytics/refresh/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/analytics/trends/route.ts` | 1 | Production API route `app/api/analytics/trends/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/arbitration/precedents/[id]/citations/route.ts` | 1 | Production API route `app/api/arbitration/precedents/[id]/citations/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/arbitration/precedents/[id]/documents/route.ts` | 1 | Production API route `app/api/arbitration/precedents/[id]/documents/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/arbitration/precedents/[id]/route.ts` | 1 | Production API route `app/api/arbitration/precedents/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/arbitration/precedents/route.ts` | 1 | Production API route `app/api/arbitration/precedents/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/arbitration/precedents/search/route.ts` | 1 | Production API route `app/api/arbitration/precedents/search/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/arbitrations/[id]/route.ts` | 1 | Production API route `app/api/arbitrations/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/arbitrations/route.ts` | 1 | Production API route `app/api/arbitrations/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/arrears/case/[memberId]/route.ts` | 1 | Production API route `app/api/arrears/case/[memberId]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/arrears/cases/route.ts` | 1 | Production API route `app/api/arrears/cases/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/arrears/create-payment-plan/route.ts` | 1 | Production API route `app/api/arrears/create-payment-plan/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/arrears/escalate/[caseId]/route.ts` | 1 | Production API route `app/api/arrears/escalate/[caseId]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/arrears/log-contact/route.ts` | 1 | Production API route `app/api/arrears/log-contact/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/arrears/resolve/[caseId]/route.ts` | 1 | Production API route `app/api/arrears/resolve/[caseId]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/audits/[id]/route.ts` | 1 | Production API route `app/api/audits/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/audits/route.ts` | 1 | Production API route `app/api/audits/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth_core/health/route.ts` | 1 | Production API route `app/api/auth_core/health/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/[...nextauth]/route.ts` | 1 | Production API route `app/api/auth/[...nextauth]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/forgot-password/route.ts` | 1 | Production API route `app/api/auth/forgot-password/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/invite/accept/route.ts` | 1 | Production API route `app/api/auth/invite/accept/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/invite/create/route.ts` | 1 | Production API route `app/api/auth/invite/create/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/login/route.ts` | 1 | Production API route `app/api/auth/login/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/logout/route.ts` | 1 | Production API route `app/api/auth/logout/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/magic-link/request/route.ts` | 1 | Production API route `app/api/auth/magic-link/request/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/magic-link/verify/route.ts` | 1 | Production API route `app/api/auth/magic-link/verify/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/me/route.ts` | 1 | Production API route `app/api/auth/me/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/methods/route.ts` | 1 | Production API route `app/api/auth/methods/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/mfa/challenge/route.ts` | 1 | Production API route `app/api/auth/mfa/challenge/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/mfa/disable/route.ts` | 1 | Production API route `app/api/auth/mfa/disable/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/mfa/enroll/route.ts` | 1 | Production API route `app/api/auth/mfa/enroll/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/mfa/status/route.ts` | 1 | Production API route `app/api/auth/mfa/status/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/mfa/verify-enroll/route.ts` | 1 | Production API route `app/api/auth/mfa/verify-enroll/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/policy/route.ts` | 1 | Production API route `app/api/auth/policy/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/reset-password/route.ts` | 1 | Production API route `app/api/auth/reset-password/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/role/route.ts` | 1 | Production API route `app/api/auth/role/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/signup/route.ts` | 1 | Production API route `app/api/auth/signup/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/auth/user-role/route.ts` | 1 | Production API route `app/api/auth/user-role/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/bargaining-notes/[id]/route.ts` | 1 | Production API route `app/api/bargaining-notes/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/bargaining-notes/route.ts` | 1 | Production API route `app/api/bargaining-notes/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/bargaining/negotiations/[id]/route.ts` | 1 | Production API route `app/api/bargaining/negotiations/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/bargaining/negotiations/route.ts` | 1 | Production API route `app/api/bargaining/negotiations/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |
| warning | R-7 | `apps/union-eyes/app/api/bargaining/proposals/[id]/route.ts` | 1 | Production API route `app/api/bargaining/proposals/[id]/route.ts` has no capability-registry entry. Add it to `apps/union-eyes/lib/reality/capability-registry.ts`. |