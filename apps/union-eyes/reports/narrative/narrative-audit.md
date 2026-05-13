# UnionEyes — Narrative CI Report

Generated: 2026-05-13T03:48:20.347Z

## Summary

- Files scanned: **8**
- Hard-fail violations: **0**
- Warning violations: **160**
- Rule failures: **3**
- Average Institutional Maturity: **67/100**

## Per-Surface Detail

### app/[locale]/layout.tsx

- **Path:** `app/[locale]/layout.tsx`
- **Institutional Maturity:** 71/100

**Scores:**
- narrative-balance: 50/100 (warn)
- coexistence-positioning: 50/100 (warn)
- procedural-neutrality: 100/100 (pass)
- labour-safe-ai: 100/100 (pass)
- canadian-positioning: 55/100 (warn)

**Flags:**
- (narrative-balance) No narrative-pillar vocabulary detected.
- (coexistence-positioning) No coexistence / overlay framing detected.
- (canadian-positioning) No Canadian-positioning vocabulary detected on a substantive public page.

**Recommendations:**
- Use phrases like 'continuity layer', 'overlay infrastructure', or 'alongside existing systems'.
- Where appropriate, surface Canadian-hosted / bilingual-first / sovereignty-conscious framing.

### app/[locale]/page.tsx

- **Path:** `app/[locale]/page.tsx`
- **Institutional Maturity:** 62/100

**Scores:**
- narrative-balance: 36/100 (pass)
- coexistence-positioning: 70/100 (pass)
- procedural-neutrality: 100/100 (pass)
- labour-safe-ai: 40/100 (fail)
- canadian-positioning: 73/100 (pass)

**Vocabulary violations:**
- L6 [warning/warning] `platform` — import { auth } from '@nzila/platform-auth/entra/server';

**Flags:**
- (labour-safe-ai) AI is referenced without labour-safe framing (oversight / explainability / reviewability).

**Recommendations:**
- Remove or rephrase "platform" (warning).
- Add human-oversight, explainability, or governance-safe AI framing.

### messages/en-CA.json

- **Path:** `messages/en-CA.json`
- **Institutional Maturity:** 74/100

**Scores:**
- narrative-balance: 59/100 (warn)
- coexistence-positioning: 100/100 (pass)
- procedural-neutrality: 100/100 (pass)
- labour-safe-ai: 20/100 (fail)
- canadian-positioning: 100/100 (pass)

**Vocabulary violations:**
- L1587 [warning/warning] `platform` — "description": "Member relationship management and organizing platform integrations."
- L2180 [warning/warning] `platform` — "title": "Platform Analytics",
- L2249 [warning/warning] `platform` — "title": "Platform Summary",
- L2680 [warning/warning] `platform` — "metaDescription": "Sign in to UnionEyes - the intelligent labour relations platform for unions, locals, and federations.",
- L2714 [warning/warning] `platform` — "metaDescription": "Monitor platform migration runs and operational migration health"
- L2958 [warning/warning] `platform` — "platform": "Platform",
- L3015 [warning/warning] `platform` — "platform": "Platform",
- L3024 [warning/warning] `platform` — "platform": "SaaS platform provider (Nzila Ventures)",
- L3107 [warning/warning] `platform` — "platform": "Platform",
- L3116 [warning/warning] `platform` — "platform": "SaaS platform provider (Nzila Ventures)",
- L3199 [warning/warning] `platform` — "metaDescription": "Create your UnionEyes account - join the intelligent labour relations platform.",
- L3245 [warning/warning] `platform` — "metaDescription": "Manage platform and organization configuration settings"
- L3590 [warning/warning] `platform` — "setupBillingDescription": "Create a billing account to enable platform invoicing and cost allocation. All billing is processed in Canadian Dollars (CAD).",
- L3825 [warning/warning] `AI-powered` — "aiTriage": "AI-powered case triage & drafting",
- L4506 [warning/warning] `platform` — "activityTrackingDescription": "Help improve the platform with usage data",
- L4608 [warning/warning] `platform` — "platformLabel": "Platform & Goals (Optional)",
- L4979 [warning/warning] `platform` — "noCasesFiledBody": "No cases have been filed across the platform yet.",
- L5849 [warning/warning] `platform` — "platformSlasLink": "Platform SLAs",
- L6010 [warning/warning] `platform` — "description": "Our platform helps you manage union claims, track grievances, and collaborate with your team more effectively.",
- L7050 [warning/warning] `platform` — "nzilaPlatform": "Platform",
- L7110 [warning/warning] `platform` — "platformAdminView": "Platform Admin View",
- L7111 [warning/warning] `platform` — "viewingAsAdmin": "You are viewing {orgName} as a platform administrator. This is an oversight view, not a membership view.",
- L7184 [warning/warning] `platform` — "heroDescription": "Grievances. Finances. Membership. Compliance. One governed platform — total transparency, total accountability, zero guesswork.",
- L7186 [warning/warning] `platform` — "ctaSecondary": "View Platform Overview",
- L7197 [warning/warning] `platform` — "solutionHeading": "A Platform Built for How Unions Actually Operate",
- L7217 [warning/warning] `platform` — "governanceDescription": "Union executives, finance officers, and legal teams need a platform they can defend — to their members, their boards, and their auditors.",
- L7226 [warning/warning] `platform` — "modulesBadge": "Platform Modules",
- L7248 [warning/warning] `platform` — "missionDescription": "UnionEyes was born when a healthcare representative lost a winnable grievance because her notes were trapped in a spreadsheet. The employer had a million-dollar HR system. She h
- L7422 [warning/warning] `centralized` — "noGovernanceOversight": "No centralized governance oversight"
- L7444 [warning/warning] `platform` — "heroDescription": "Real-time operational status of UnionEyes platform services",
- L7446 [warning/warning] `platform` — "pageDescription": "Real-time status of UnionEyes platform services."
- L7450 [warning/warning] `platform` — "platform": "Capabilities",
- L7502 [warning/warning] `platform` — "badge": "Platform Module",
- L7536 [warning/warning] `platform` — "badge": "Platform Module",
- L7571 [warning/warning] `platform` — "badge": "Platform Module",
- L7601 [warning/warning] `platform` — "badge": "Platform Module",
- L7611 [warning/warning] `platform` — "feat4Desc": "Match platform billing against bank statements and internal ledgers. Flag discrepancies before they become audit findings.",
- L7661 [warning/warning] `platform` — "collectDesc": "UnionEyes collects information necessary to provide union management services, including: name, email address, union membership details, and usage data. We collect this information whe
- L7675 [warning/warning] `platform` — "pageDescription": "Terms and conditions governing the use of UnionEyes union management platform.",
- L7678 [warning/warning] `platform` — "acceptanceDesc": "By accessing or using UnionEyes, you agree to be bound by these Terms of Service. UnionEyes is a platform designed for union organizations in Canada and is governed by Canadian law.
- L7680 [warning/warning] `platform` — "useDesc": "You may use UnionEyes solely for lawful union management purposes, including grievance tracking, member communication, voting, and organizational administration. You agree not to misuse th
- L7684 [warning/warning] `platform` — "liabilityDesc": "UnionEyes is provided \"as is\" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our to
- L7696 [warning/warning] `platform` — "standardsDesc": "We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA and comply with the Accessible Canada Act (ACA). Our platform is regularly audited for accessibility
- L7739 [warning/warning] `platform` — "ctaDescription": "Every engagement starts with a controlled pilot. We work with your team to define scope, select modules, and validate the platform against your real workflows.",
- L7741 [warning/warning] `platform` — "ctaSecondary": "View Platform Overview",
- L7751 [warning/warning] `platform` — "auditDesc": "Every action on the platform is logged with who, what, when, and why. Audit logs are immutable, exportable, and available to authorized roles at any time.",
- L7757 [warning/warning] `platform` — "reconDesc": "Platform billing reconciles against your internal ledgers. Allocation is transparent. Every dollar is accounted for from parent invoice to local cost centre.",
- L7761 [warning/warning] `platform` — "defensibilityDesc": "Evidence sealing, grievance chain of custody, and tamper-evident records. When your decisions are challenged, the platform provides the proof.",
- L7767 [warning/warning] `disruption` — "disruptionTitle": "Operational disruption modeling",
- L7905 [warning/warning] `centralized` — "ba3After": "Centralized campaign tracking with real-time progress",
- L8651 [warning/warning] `AI-powered` — "benefit2": "AI-powered grievance triage & drafting",
- L8803 [warning/warning] `platform` — "platform": {
- L8807 [warning/warning] `platform` — "operationsOverview": "Nzila Platform Operations — here's your overview.",
- L8823 [warning/warning] `platform` — "platformHealthIncidents": "Platform health & incidents",
- L8828 [warning/warning] `platform` — "platformAnalytics": "Platform Analytics",
- L8835 [warning/warning] `platform` — "platformSecurityPosture": "Platform security posture",
- L8838 [warning/warning] `platform` — "platformHealth": "Platform Health",
- L8845 [warning/warning] `platform` — "recentPlatformEvents": "Recent Platform Events",
- L8852 [warning/warning] `platform` — "platformActivityAppears": "Platform activity will appear here",
- L9153 [warning/warning] `platform` — "title": "Platform Operations",
- L9154 [warning/warning] `platform` — "subtitle": "Real-time platform health, incidents, and operational metrics",
- L9166 [warning/warning] `platform` — "platformUptimeTitle": "Platform Uptime",
- L9227 [warning/warning] `platform` — "platformAdoptionTitle": "Platform Adoption",
- L9228 [warning/warning] `platform` — "moduleUsageDescription": "Module usage across the platform",
- L9264 [warning/warning] `platform` — "featureAdoptionDescription": "Usage across the platform by feature",
- L10584 [warning/warning] `AI-powered` — "description": "AI-powered recommendations"

**Flags:**
- (narrative-balance) Continuity language under-represented: 9.3% (target 30%).
- (labour-safe-ai) Forbidden AI framing: "autonomous decisions".

**Recommendations:**
- Remove or rephrase "platform" (warning).
- Remove or rephrase "AI-powered" (warning).
- Remove or rephrase "centralized" (warning).
- Remove or rephrase "disruption" (warning).
- Add institutional-continuity framing.
- Reframe as assistive intelligence under human oversight.

### messages/en.json

- **Path:** `messages/en.json`
- **Institutional Maturity:** 61/100

**Scores:**
- narrative-balance: 48/100 (warn)
- coexistence-positioning: 50/100 (warn)
- procedural-neutrality: 100/100 (pass)
- labour-safe-ai: 20/100 (fail)
- canadian-positioning: 100/100 (pass)

**Vocabulary violations:**
- L1593 [warning/warning] `platform` — "description": "Member relationship management and organizing platform integrations."
- L2186 [warning/warning] `platform` — "title": "Platform Analytics",
- L2255 [warning/warning] `platform` — "title": "Platform Summary",
- L2686 [warning/warning] `platform` — "metaDescription": "Sign in to UnionEyes - the intelligent labour relations platform for unions, locals, and federations.",
- L2720 [warning/warning] `platform` — "metaDescription": "Monitor platform migration runs and operational migration health"
- L3021 [warning/warning] `platform` — "platform": "Platform",
- L3078 [warning/warning] `platform` — "platform": "Platform",
- L3087 [warning/warning] `platform` — "platform": "SaaS platform provider (Nzila Ventures)",
- L3170 [warning/warning] `platform` — "platform": "Platform",
- L3179 [warning/warning] `platform` — "platform": "SaaS platform provider (Nzila Ventures)",
- L3262 [warning/warning] `platform` — "metaDescription": "Create your UnionEyes account - join the intelligent labour relations platform.",
- L3308 [warning/warning] `platform` — "metaDescription": "Manage platform and organization configuration settings"
- L3653 [warning/warning] `platform` — "setupBillingDescription": "Create a billing account to enable platform invoicing and cost allocation. All billing is processed in Canadian Dollars (CAD).",
- L3888 [warning/warning] `AI-powered` — "aiTriage": "AI-powered case triage & drafting",
- L4569 [warning/warning] `platform` — "activityTrackingDescription": "Help improve the platform with usage data",
- L4671 [warning/warning] `platform` — "platformLabel": "Platform & Goals (Optional)",
- L5042 [warning/warning] `platform` — "noCasesFiledBody": "No cases have been filed across the platform yet.",
- L5912 [warning/warning] `platform` — "platformSlasLink": "Platform SLAs",
- L6073 [warning/warning] `platform` — "description": "Our platform helps you manage union claims, track grievances, and collaborate with your team more effectively.",
- L7113 [warning/warning] `platform` — "nzilaPlatform": "Platform",
- L7173 [warning/warning] `platform` — "platformAdminView": "Platform Admin View",
- L7174 [warning/warning] `platform` — "viewingAsAdmin": "You are viewing {orgName} as a platform administrator. This is an oversight view, not a membership view.",
- L7228 [warning/warning] `platform` — "heroDescription": "Grievances. Finances. Membership. Compliance. One governed platform — total transparency, total accountability, zero guesswork.",
- L7230 [warning/warning] `platform` — "ctaSecondary": "View Platform Overview",
- L7241 [warning/warning] `platform` — "solutionHeading": "A Platform Built for How Unions Actually Operate",
- L7261 [warning/warning] `platform` — "governanceDescription": "Union executives, finance officers, and legal teams need a platform they can defend — to their members, their boards, and their auditors.",
- L7270 [warning/warning] `platform` — "modulesBadge": "Platform Modules",
- L7292 [warning/warning] `platform` — "missionDescription": "UnionEyes was born when a healthcare representative lost a winnable grievance because her notes were trapped in a spreadsheet. The employer had a million-dollar HR system. She h
- L7457 [warning/warning] `centralized` — "noGovernanceOversight": "No centralized governance oversight"
- L7479 [warning/warning] `platform` — "heroDescription": "Real-time operational status of UnionEyes platform services",
- L7481 [warning/warning] `platform` — "pageDescription": "Real-time status of UnionEyes platform services."
- L7591 [warning/warning] `centralized` — "ba3After": "Centralized campaign tracking with real-time progress",
- L7627 [warning/warning] `platform` — "platform": "Capabilities",
- L7678 [warning/warning] `platform` — "badge": "Platform Module",
- L7712 [warning/warning] `platform` — "badge": "Platform Module",
- L7747 [warning/warning] `platform` — "badge": "Platform Module",
- L7777 [warning/warning] `platform` — "badge": "Platform Module",
- L7787 [warning/warning] `platform` — "feat4Desc": "Match platform billing against bank statements and internal ledgers. Flag discrepancies before they become audit findings.",
- L7837 [warning/warning] `platform` — "collectDesc": "UnionEyes collects information necessary to provide union management services, including: name, email address, union membership details, and usage data. We collect this information whe
- L7851 [warning/warning] `platform` — "pageDescription": "Terms and conditions governing the use of UnionEyes union management platform.",
- L7854 [warning/warning] `platform` — "acceptanceDesc": "By accessing or using UnionEyes, you agree to be bound by these Terms of Service. UnionEyes is a platform designed for union organizations in Canada and is governed by Canadian law.
- L7856 [warning/warning] `platform` — "useDesc": "You may use UnionEyes solely for lawful union management purposes, including grievance tracking, member communication, voting, and organizational administration. You agree not to misuse th
- L7860 [warning/warning] `platform` — "liabilityDesc": "UnionEyes is provided \"as is\" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our to
- L7872 [warning/warning] `platform` — "standardsDesc": "We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA and comply with the Accessible Canada Act (ACA). Our platform is regularly audited for accessibility
- L7915 [warning/warning] `platform` — "ctaDescription": "Every engagement starts with a controlled pilot. We work with your team to define scope, select modules, and validate the platform against your real workflows.",
- L7917 [warning/warning] `platform` — "ctaSecondary": "View Platform Overview",
- L7927 [warning/warning] `platform` — "auditDesc": "Every action on the platform is logged with who, what, when, and why. Audit logs are immutable, exportable, and available to authorized roles at any time.",
- L7933 [warning/warning] `platform` — "reconDesc": "Platform billing reconciles against your internal ledgers. Allocation is transparent. Every dollar is accounted for from parent invoice to local cost centre.",
- L7937 [warning/warning] `platform` — "defensibilityDesc": "Evidence sealing, grievance chain of custody, and tamper-evident records. When your decisions are challenged, the platform provides the proof."
- L8889 [warning/warning] `AI-powered` — "benefit2": "AI-powered grievance triage & drafting",
- L9041 [warning/warning] `platform` — "platform": {
- L9045 [warning/warning] `platform` — "operationsOverview": "Nzila Platform Operations — here's your overview.",
- L9061 [warning/warning] `platform` — "platformHealthIncidents": "Platform health & incidents",
- L9066 [warning/warning] `platform` — "platformAnalytics": "Platform Analytics",
- L9073 [warning/warning] `platform` — "platformSecurityPosture": "Platform security posture",
- L9076 [warning/warning] `platform` — "platformHealth": "Platform Health",
- L9083 [warning/warning] `platform` — "recentPlatformEvents": "Recent Platform Events",
- L9090 [warning/warning] `platform` — "platformActivityAppears": "Platform activity will appear here",
- L10195 [warning/warning] `AI-powered` — "description": "AI-powered recommendations"
- L10871 [warning/warning] `platform` — "title": "Platform Operations",
- L10872 [warning/warning] `platform` — "subtitle": "Real-time platform health, incidents, and operational metrics",
- L10884 [warning/warning] `platform` — "platformUptimeTitle": "Platform Uptime",
- L10946 [warning/warning] `platform` — "platformAdoptionTitle": "Platform Adoption",
- L10947 [warning/warning] `platform` — "moduleUsageDescription": "Module usage across the platform",
- L10983 [warning/warning] `platform` — "featureAdoptionDescription": "Usage across the platform by feature",

**Flags:**
- (narrative-balance) Continuity language under-represented: 4.2% (target 30%).
- (coexistence-positioning) No coexistence / overlay framing detected.
- (labour-safe-ai) Forbidden AI framing: "autonomous decisions".

**Recommendations:**
- Remove or rephrase "platform" (warning).
- Remove or rephrase "AI-powered" (warning).
- Remove or rephrase "centralized" (warning).
- Add institutional-continuity framing.
- Use phrases like 'continuity layer', 'overlay infrastructure', or 'alongside existing systems'.
- Reframe as assistive intelligence under human oversight.

### messages/fr-CA.json

- **Path:** `messages/fr-CA.json`
- **Institutional Maturity:** 72/100

**Scores:**
- narrative-balance: 40/100 (warn)
- coexistence-positioning: 70/100 (pass)
- procedural-neutrality: 100/100 (pass)
- labour-safe-ai: 76/100 (pass)
- canadian-positioning: 85/100 (pass)

**Vocabulary violations:**
- L2958 [warning/warning] `platform` — "platform": "Plateforme",
- L3015 [warning/warning] `platform` — "platform": "Plateforme",
- L3024 [warning/warning] `platform` — "platform": "Fournisseur de plateforme SaaS (Nzila Ventures)",
- L3107 [warning/warning] `platform` — "platform": "Plateforme",
- L3116 [warning/warning] `platform` — "platform": "Fournisseur de plateforme SaaS (Nzila Ventures)",
- L7450 [warning/warning] `platform` — "platform": "Capacités",
- L8803 [warning/warning] `platform` — "platform": {

**Flags:**
- (narrative-balance) Continuity language under-represented: 3.3% (target 30%).

**Recommendations:**
- Remove or rephrase "platform" (warning).
- Add institutional-continuity framing.

### messages/fr.json

- **Path:** `messages/fr.json`
- **Institutional Maturity:** 65/100

**Scores:**
- narrative-balance: 31/100 (warn)
- coexistence-positioning: 50/100 (warn)
- procedural-neutrality: 100/100 (pass)
- labour-safe-ai: 76/100 (pass)
- canadian-positioning: 82/100 (pass)

**Vocabulary violations:**
- L2958 [warning/warning] `platform` — "platform": "Plateforme",
- L3015 [warning/warning] `platform` — "platform": "Plateforme",
- L3024 [warning/warning] `platform` — "platform": "Fournisseur de plateforme SaaS (Nzila Ventures)",
- L3107 [warning/warning] `platform` — "platform": "Plateforme",
- L3116 [warning/warning] `platform` — "platform": "Fournisseur de plateforme SaaS (Nzila Ventures)",
- L7422 [warning/warning] `platform` — "platform": "Plateforme",
- L8762 [warning/warning] `platform` — "platform": {

**Flags:**
- (narrative-balance) Continuity language under-represented: 0.9% (target 30%).
- (coexistence-positioning) No coexistence / overlay framing detected.

**Recommendations:**
- Remove or rephrase "platform" (warning).
- Add institutional-continuity framing.
- Use phrases like 'continuity layer', 'overlay infrastructure', or 'alongside existing systems'.

### messages/it.json

- **Path:** `messages/it.json`
- **Institutional Maturity:** 64/100

**Scores:**
- narrative-balance: 26/100 (warn)
- coexistence-positioning: 50/100 (warn)
- procedural-neutrality: 100/100 (pass)
- labour-safe-ai: 76/100 (pass)
- canadian-positioning: 82/100 (pass)

**Vocabulary violations:**
- L2958 [warning/warning] `platform` — "platform": "Piattaforma",
- L3015 [warning/warning] `platform` — "platform": "Piattaforma",
- L3024 [warning/warning] `platform` — "platform": "Fornitore di piattaforma SaaS (Nzila Ventures)",
- L3107 [warning/warning] `platform` — "platform": "Piattaforma",
- L3116 [warning/warning] `platform` — "platform": "Fornitore di piattaforma SaaS (Nzila Ventures)",
- L7432 [warning/warning] `platform` — "platform": "Moduli",
- L8785 [warning/warning] `platform` — "platform": {

**Flags:**
- (narrative-balance) Governance saturation detected: 47.4% of pillar terms (target 30%, threshold 40%).
- (narrative-balance) Continuity language under-represented: 0.4% (target 30%).
- (coexistence-positioning) No coexistence / overlay framing detected.

**Recommendations:**
- Remove or rephrase "platform" (warning).
- Rebalance toward continuity, coordination, and trust language.
- Add institutional-continuity framing.
- Use phrases like 'continuity layer', 'overlay infrastructure', or 'alongside existing systems'.

### messages/pt.json

- **Path:** `messages/pt.json`
- **Institutional Maturity:** 63/100

**Scores:**
- narrative-balance: 25/100 (warn)
- coexistence-positioning: 50/100 (warn)
- procedural-neutrality: 100/100 (pass)
- labour-safe-ai: 76/100 (pass)
- canadian-positioning: 79/100 (pass)

**Vocabulary violations:**
- L2958 [warning/warning] `platform` — "platform": "Plataforma",
- L3015 [warning/warning] `platform` — "platform": "Plataforma",
- L3024 [warning/warning] `platform` — "platform": "Provedor de plataforma SaaS (Nzila Ventures)",
- L3107 [warning/warning] `platform` — "platform": "Plataforma",
- L3116 [warning/warning] `platform` — "platform": "Provedor de plataforma SaaS (Nzila Ventures)",
- L7432 [warning/warning] `platform` — "platform": "Modulos",
- L8785 [warning/warning] `platform` — "platform": {

**Flags:**
- (narrative-balance) Continuity language under-represented: 0.4% (target 30%).
- (coexistence-positioning) No coexistence / overlay framing detected.

**Recommendations:**
- Remove or rephrase "platform" (warning).
- Add institutional-continuity framing.
- Use phrases like 'continuity layer', 'overlay infrastructure', or 'alongside existing systems'.
