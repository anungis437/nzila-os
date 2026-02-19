"""
migrate_routes.py
=================
Programmatically migrates Next.js API route.ts files from Drizzle ORM
to Django REST Framework proxy calls using lib/django-proxy.ts.

Usage:
    python migrate_routes.py [--dry-run] [--domain <domain>] [--verbose]

Algorithm:
    1. Walk every route.ts under frontend/app/api/
    2. Detect legacy Drizzle imports (or other broken DB imports)
    3. Look up the Django endpoint from ROUTE_MAP (keyed on Next.js URL path pattern)
    4. Generate idiomatic TypeScript proxy handlers
    5. Write the file (or just print diff in --dry-run mode)

Exit codes:
    0  All done (no errors)
    1  One or more files could not be mapped — check UNMAPPED log
"""

from __future__ import annotations
import argparse
import re
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
FRONTEND_API = Path(r"C:\APPS\nzila-union-eyes\frontend\app\api")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
DRIZZLE_IMPORT_PATTERNS: list[str] = [
    r"from '@/db/db'",
    r'from "@/db/db"',
    r"from '@/db/'",
    r'from "@/db/"',
    r"from 'drizzle-orm",
    r'from "drizzle-orm',
    r"from '@/db/schema",
    r'from "@/db/schema',
    r"from '@/db/queries",
    r'from "@/db/queries',
    r"withRLSContext",
    r"withEnhancedRoleAuth",
    r"withSecureAPI",
]

def is_legacy(content: str) -> bool:
    """Return True if the file still contains Drizzle / legacy ORM imports."""
    return any(re.search(p, content) for p in DRIZZLE_IMPORT_PATTERNS)

def is_already_proxied(content: str) -> bool:
    return "djangoProxy" in content or "django-proxy" in content

# ---------------------------------------------------------------------------
# Route map
# Each entry:   next_path_pattern -> RouteSpec
#
# next_path_pattern uses the POSIX-style relative path under app/api/,
# with dynamic segments expressed as [param]:
#     "claims"            → app/api/claims/route.ts
#     "claims/[id]"       → app/api/claims/[id]/route.ts
#     "claims/[id]/updates" → …
# ---------------------------------------------------------------------------

@dataclass
class RouteSpec:
    """Describes how to proxy a Next.js route to Django."""
    django_prefix: str          # e.g.  "auth_core/organization-members"
    verbs: list[str]            # HTTP verbs to export, in order
    # If True, the last dynamic segment becomes a positional path arg
    is_detail: bool = False
    # param name used when is_detail=True (e.g. "id", "caseId")
    param: str = "id"
    # Extra query-string to append when forwarding GET (no leading ?)
    qs: str = ""
    # Extra header to inject (key -> template, use {param} placeholder)
    extra_header: Optional[tuple[str, str]] = None
    notes: str = ""


# Build the map.  Key = posix path relative to app/api (no leading slash).
ROUTE_MAP: dict[str, RouteSpec] = {

    # ------------------------------------------------------------------ auth
    "auth/sign-in": RouteSpec("auth_core/users", ["POST"], notes="sign-in stub"),
    "auth/sign-out": RouteSpec("auth_core/user-sessions", ["DELETE"]),
    "auth/session": RouteSpec("auth_core/user-sessions", ["GET"]),
    "auth/user": RouteSpec("auth_core/users", ["GET", "PATCH"]),
    "auth/[id]": RouteSpec("auth_core/users", ["GET", "PATCH", "DELETE"], is_detail=True),

    # ---------------------------------------------------------------- members
    "members": RouteSpec("auth_core/organization-members", ["GET", "POST"]),
    "members/search": RouteSpec("auth_core/organization-members", ["GET"], qs="search={q}"),
    "members/export": RouteSpec("auth_core/organization-members", ["GET"], notes="export"),
    "members/bulk": RouteSpec("auth_core/organization-members", ["POST"]),
    "members/merge": RouteSpec("auth_core/organization-members", ["POST"]),
    "members/dues": RouteSpec("billing/dues-transactions", ["GET"]),
    "members/segments": RouteSpec("unions/member-segments", ["GET", "POST"]),
    "members/appointments": RouteSpec("unions/calendar-events", ["POST"]),
    "members/me": RouteSpec("auth_core/profile", ["GET", "PATCH"]),
    "members/[id]": RouteSpec("auth_core/organization-members", ["GET", "PATCH", "DELETE"], is_detail=True),
    "members/[id]/claims": RouteSpec("grievances/claims", ["GET", "POST"], extra_header=("X-Member-Id", "{id}")),
    "members/[id]/consents": RouteSpec("auth_core/member-consents", ["GET", "PATCH"], extra_header=("X-Member-Id", "{id}")),
    "members/[id]/documents": RouteSpec("content/member-documents", ["GET"], extra_header=("X-Member-Id", "{id}")),
    "members/[id]/employment": RouteSpec("auth_core/member-employment-details", ["GET", "PATCH"], extra_header=("X-Member-Id", "{id}")),
    "members/[id]/history": RouteSpec("auth_core/member-history-events", ["GET"], extra_header=("X-Member-Id", "{id}")),
    "members/[id]/preferences": RouteSpec("auth_core/member-contact-preferences", ["GET", "PATCH"], extra_header=("X-Member-Id", "{id}")),
    "members/[id]/roles": RouteSpec("auth_core/organization-members", ["GET", "POST"], extra_header=("X-Member-Id", "{id}")),
    "members/[id]/addresses": RouteSpec("unions/member-addresses", ["GET", "POST"], extra_header=("X-Member-Id", "{id}")),
    "members/[id]/dues": RouteSpec("billing/dues-transactions", ["GET"], extra_header=("X-Member-Id", "{id}")),
    "members/[id]/leaves": RouteSpec("unions/member-leaves", ["GET"], extra_header=("X-Member-Id", "{id}")),
    "members/[id]/training": RouteSpec("unions/course-registrations", ["GET"], extra_header=("X-Member-Id", "{id}")),
    "member/profile": RouteSpec("auth_core/profile", ["GET", "PATCH"]),
    "member/[id]": RouteSpec("auth_core/organization-members", ["GET", "PATCH", "DELETE"], is_detail=True),

    # ---------------------------------------------------------- organizations
    "organizations": RouteSpec("auth_core/organization-members", ["GET", "POST"]),
    "organizations/search": RouteSpec("auth_core/organization-members", ["GET"], qs="search={q}"),
    "organizations/switch": RouteSpec("auth_core/organization-members", ["POST"]),
    "organizations/hierarchy": RouteSpec("unions/bargaining-units", ["GET"]),
    "organizations/tree": RouteSpec("unions/bargaining-units", ["GET"]),
    "organizations/[id]": RouteSpec("auth_core/organization-members", ["GET", "PATCH", "DELETE"], is_detail=True),
    "organizations/[id]/members": RouteSpec("auth_core/organization-members", ["GET", "POST"], extra_header=("X-Organization-Id", "{id}")),
    "organizations/[id]/analytics": RouteSpec("analytics/analytics-metrics", ["GET"], extra_header=("X-Organization-Id", "{id}")),
    "organizations/[id]/access-logs": RouteSpec("auth_core/cross-org-access-log", ["GET"], extra_header=("X-Organization-Id", "{id}")),
    "organizations/[id]/ancestors": RouteSpec("unions/bargaining-units", ["GET"], extra_header=("X-Organization-Id", "{id}")),
    "organizations/[id]/children": RouteSpec("unions/bargaining-units", ["GET"], extra_header=("X-Organization-Id", "{id}")),
    "organizations/[id]/descendants": RouteSpec("unions/bargaining-units", ["GET"], extra_header=("X-Organization-Id", "{id}")),
    "organizations/[id]/path": RouteSpec("unions/bargaining-units", ["GET"], extra_header=("X-Organization-Id", "{id}")),
    "organizations/[id]/sharing-settings": RouteSpec("auth_core/organization-sharing-settings", ["GET", "PATCH"], extra_header=("X-Organization-Id", "{id}")),
    "organization/[id]": RouteSpec("auth_core/organization-members", ["GET", "PATCH", "DELETE"], is_detail=True),

    # ----------------------------------------------------------------- claims
    "claims": RouteSpec("grievances/claims", ["GET", "POST"]),
    "claims/bulk": RouteSpec("grievances/claims", ["POST"]),
    "claims/[id]": RouteSpec("grievances/claims", ["GET", "PATCH", "DELETE"], is_detail=True),
    "claims/[id]/status": RouteSpec("grievances/claims", ["PATCH"], is_detail=True, notes="status sub-action"),
    "claims/[id]/updates": RouteSpec("grievances/claim-updates", ["GET", "POST"], extra_header=("X-Claim-Id", "{id}")),
    "claims/[id]/workflow": RouteSpec("grievances/grievance-workflows", ["GET", "POST"], extra_header=("X-Claim-Id", "{id}")),
    "claims/[id]/workflow/history": RouteSpec("grievances/grievance-workflows", ["GET"], extra_header=("X-Claim-Id", "{id}")),
    "claims/[id]/defensibility-pack": RouteSpec("grievances/defensibility-packs", ["GET", "POST"], extra_header=("X-Claim-Id", "{id}")),
    "v1/claims": RouteSpec("grievances/claims", ["GET", "POST"]),

    # --------------------------------------------------------------- grievances
    "grievances": RouteSpec("grievances/grievances", ["GET", "POST"]),
    "grievances/[id]": RouteSpec("grievances/grievances", ["GET", "PATCH", "DELETE"], is_detail=True),
    "grievances/[id]/responses": RouteSpec("grievances/grievance-responses", ["GET", "POST"], extra_header=("X-Grievance-Id", "{id}")),
    "grievances/[id]/timeline": RouteSpec("grievances/grievance-timeline", ["GET"], extra_header=("X-Grievance-Id", "{id}")),
    "grievances/[id]/assignments": RouteSpec("grievances/grievance-assignments", ["GET", "POST"], extra_header=("X-Grievance-Id", "{id}")),
    "grievances/[id]/documents": RouteSpec("grievances/grievance-documents", ["GET", "POST"], extra_header=("X-Grievance-Id", "{id}")),
    "federations/benchmark/grievances": RouteSpec("grievances/grievances", ["GET"]),

    # ------------------------------------------------------------------- admin
    "admin/organizations": RouteSpec("auth_core/organization-members", ["GET", "POST"]),
    "admin/organizations/bulk-import": RouteSpec("auth_core/organization-members", ["POST"]),
    "admin/organizations/[id]": RouteSpec("auth_core/organization-members", ["GET", "PATCH", "DELETE"], is_detail=True),
    "admin/clc/analytics/organizations": RouteSpec("analytics/analytics-metrics", ["GET"]),

    # --------------------------------------------------------------- analytics
    "analytics/claims": RouteSpec("analytics/analytics-metrics", ["GET"]),
    "analytics/claims/categories": RouteSpec("analytics/analytics-metrics", ["GET"]),
    "analytics/claims/stewards": RouteSpec("analytics/analytics-metrics", ["GET"]),
    "analytics/claims/trends": RouteSpec("analytics/trend-analyses", ["GET"]),
    "analytics": RouteSpec("analytics/analytics-metrics", ["GET"]),
    "analytics/[id]": RouteSpec("analytics/analytics-metrics", ["GET"], is_detail=True),
    "analytics/reports": RouteSpec("analytics/reports", ["GET", "POST"]),
    "analytics/benchmarks": RouteSpec("analytics/benchmark-data", ["GET"]),
    "analytics/engagement": RouteSpec("analytics/user-engagement-scores", ["GET"]),
    "analytics/kpis": RouteSpec("analytics/kpi-configurations", ["GET", "POST"]),
    "analytics/insights": RouteSpec("analytics/insight-recommendations", ["GET"]),

    # ----------------------------------------------------------------- billing
    "billing": RouteSpec("billing/per-capita-remittances", ["GET", "POST"]),
    "billing/[id]": RouteSpec("billing/per-capita-remittances", ["GET", "PATCH", "DELETE"], is_detail=True),
    "billing/dues": RouteSpec("billing/per-capita-remittances", ["GET"]),
    "billing/invoices": RouteSpec("core/external-invoices", ["GET", "POST"]),
    "billing/payments": RouteSpec("billing/per-capita-remittances", ["GET", "POST"]),
    "billing/autopay": RouteSpec("billing/autopay-settings", ["GET", "PATCH"]),
    "billing/remittances": RouteSpec("billing/per-capita-remittances", ["GET", "POST"]),
    "billing/remittances/[id]": RouteSpec("billing/per-capita-remittances", ["GET", "PATCH", "DELETE"], is_detail=True),
    "dues": RouteSpec("billing/per-capita-remittances", ["GET", "POST"]),
    "dues/[id]": RouteSpec("billing/per-capita-remittances", ["GET", "PATCH", "DELETE"], is_detail=True),
    "payments": RouteSpec("billing/per-capita-remittances", ["GET", "POST"]),
    "payments/[id]": RouteSpec("billing/per-capita-remittances", ["GET", "PATCH", "DELETE"], is_detail=True),
    "stripe": RouteSpec("billing/stripe-connect-accounts", ["GET", "POST"]),
    "stripe/[id]": RouteSpec("billing/stripe-connect-accounts", ["GET", "PATCH", "DELETE"], is_detail=True),
    "arrears": RouteSpec("billing/per-capita-remittances", ["GET", "POST"]),

    # --------------------------------------------------------------- bargaining
    "bargaining": RouteSpec("bargaining/negotiations", ["GET", "POST"]),
    "bargaining/[id]": RouteSpec("bargaining/negotiations", ["GET", "PATCH", "DELETE"], is_detail=True),
    "bargaining/proposals": RouteSpec("bargaining/bargaining-proposals", ["GET", "POST"]),
    "bargaining/proposals/[id]": RouteSpec("bargaining/bargaining-proposals", ["GET", "PATCH", "DELETE"], is_detail=True),
    "bargaining/team": RouteSpec("bargaining/bargaining-team-members", ["GET", "POST"]),
    "bargaining/sessions": RouteSpec("bargaining/negotiation-sessions", ["GET", "POST"]),
    "bargaining/sessions/[id]": RouteSpec("bargaining/negotiation-sessions", ["GET", "PATCH", "DELETE"], is_detail=True),
    "bargaining/tentative-agreements": RouteSpec("bargaining/tentative-agreements", ["GET", "POST"]),
    "bargaining-notes": RouteSpec("bargaining/bargaining-notes", ["GET", "POST"]),
    "bargaining-notes/[id]": RouteSpec("bargaining/bargaining-notes", ["GET", "PATCH", "DELETE"], is_detail=True),
    "cbas": RouteSpec("bargaining/collective-agreements", ["GET", "POST"]),
    "cbas/[id]": RouteSpec("bargaining/collective-agreements", ["GET", "PATCH", "DELETE"], is_detail=True),
    "cba": RouteSpec("bargaining/collective-agreements", ["GET", "POST"]),
    "cba/[id]": RouteSpec("bargaining/collective-agreements", ["GET", "PATCH", "DELETE"], is_detail=True),
    "clauses": RouteSpec("bargaining/cba-clauses", ["GET", "POST"]),
    "clauses/[id]": RouteSpec("bargaining/cba-clauses", ["GET", "PATCH", "DELETE"], is_detail=True),
    "clause-library": RouteSpec("bargaining/shared-clause-library", ["GET", "POST"]),
    "arbitration": RouteSpec("bargaining/arbitration-decisions", ["GET", "POST"]),
    "arbitration/[id]": RouteSpec("bargaining/arbitration-decisions", ["GET", "PATCH", "DELETE"], is_detail=True),
    "precedents": RouteSpec("bargaining/arbitration-precedents", ["GET", "POST"]),
    "precedents/[id]": RouteSpec("bargaining/arbitration-precedents", ["GET", "PATCH", "DELETE"], is_detail=True),
    "negotiations": RouteSpec("bargaining/negotiations", ["GET", "POST"]),
    "negotiations/[id]": RouteSpec("bargaining/negotiations", ["GET", "PATCH", "DELETE"], is_detail=True),

    # ----------------------------------------------------------------- content
    "content": RouteSpec("content/cms-pages", ["GET", "POST"]),
    "content/[id]": RouteSpec("content/cms-pages", ["GET", "PATCH", "DELETE"], is_detail=True),
    "documents": RouteSpec("content/documents", ["GET", "POST"]),
    "documents/[id]": RouteSpec("content/documents", ["GET", "PATCH", "DELETE"], is_detail=True),
    "docs": RouteSpec("content/documents", ["GET"]),
    "storage": RouteSpec("content/cms-media-library", ["GET", "POST"]),
    "upload": RouteSpec("content/cms-media-library", ["POST"]),

    # ------------------------------------------------------- compliance / gdpr
    "compliance": RouteSpec("compliance/data-classification-policy", ["GET"]),
    "compliance/[id]": RouteSpec("compliance/data-classification-policy", ["GET", "PATCH"], is_detail=True),
    "gdpr": RouteSpec("compliance/dsr-requests", ["GET", "POST"]),
    "gdpr/[id]": RouteSpec("compliance/dsr-requests", ["GET", "PATCH", "DELETE"], is_detail=True),
    "consent": RouteSpec("compliance/consent-records", ["GET", "POST"]),
    "privacy": RouteSpec("compliance/data-classification-policy", ["GET"]),
    "audits": RouteSpec("core/audit-logs", ["GET"]),
    "audits/[id]": RouteSpec("core/audit-logs", ["GET"], is_detail=True),
    "security": RouteSpec("core/security-events", ["GET"]),

    # -------------------------------------------------------------- notifications
    "notifications": RouteSpec("notifications/in-app-notifications", ["GET", "POST"]),
    "notifications/[id]": RouteSpec("notifications/in-app-notifications", ["GET", "PATCH", "DELETE"], is_detail=True),
    "messages": RouteSpec("notifications/messages", ["GET", "POST"]),
    "messages/[id]": RouteSpec("notifications/messages", ["GET", "PATCH", "DELETE"], is_detail=True),
    "messaging": RouteSpec("notifications/message-threads", ["GET", "POST"]),
    "messaging/[id]": RouteSpec("notifications/message-threads", ["GET", "PATCH", "DELETE"], is_detail=True),
    "communications": RouteSpec("notifications/campaigns", ["GET", "POST"]),

    # -------------------------------------------------------------------- unions
    "stewards": RouteSpec("unions/steward-assignments", ["GET", "POST"]),
    "stewards/[id]": RouteSpec("unions/steward-assignments", ["GET", "PATCH", "DELETE"], is_detail=True),
    "employers": RouteSpec("unions/employers", ["GET", "POST"]),
    "employers/[id]": RouteSpec("unions/employers", ["GET", "PATCH", "DELETE"], is_detail=True),
    "worksites": RouteSpec("unions/worksites", ["GET", "POST"]),
    "worksites/[id]": RouteSpec("unions/worksites", ["GET", "PATCH", "DELETE"], is_detail=True),
    "committees": RouteSpec("unions/committees", ["GET", "POST"]),
    "committees/[id]": RouteSpec("unions/committees", ["GET", "PATCH", "DELETE"], is_detail=True),
    "locals": RouteSpec("unions/bargaining-units", ["GET", "POST"]),
    "locals/[id]": RouteSpec("unions/bargaining-units", ["GET", "PATCH", "DELETE"], is_detail=True),
    "federations": RouteSpec("unions/federations", ["GET", "POST"]),
    "federations/[id]": RouteSpec("unions/federations", ["GET", "PATCH", "DELETE"], is_detail=True),
    "voting": RouteSpec("unions/voting-sessions", ["GET", "POST"]),
    "voting/[id]": RouteSpec("unions/voting-sessions", ["GET", "PATCH", "DELETE"], is_detail=True),
    "strike": RouteSpec("unions/voting-sessions", ["GET", "POST"]),
    "events": RouteSpec("unions/calendar-events", ["GET", "POST"]),
    "events/[id]": RouteSpec("unions/calendar-events", ["GET", "PATCH", "DELETE"], is_detail=True),
    "calendars": RouteSpec("unions/calendars", ["GET", "POST"]),
    "calendars/[id]": RouteSpec("unions/calendars", ["GET", "PATCH", "DELETE"], is_detail=True),
    "calendar-sync": RouteSpec("unions/external-calendar-connections", ["GET", "POST"]),
    "meeting-rooms": RouteSpec("unions/meeting-rooms", ["GET", "POST"]),
    "surveys": RouteSpec("unions/surveys", ["GET", "POST"]),
    "surveys/[id]": RouteSpec("unions/surveys", ["GET", "PATCH", "DELETE"], is_detail=True),
    "organizing": RouteSpec("unions/organizing-campaigns", ["GET", "POST"]),
    "organizing/[id]": RouteSpec("unions/organizing-campaigns", ["GET", "PATCH", "DELETE"], is_detail=True),
    "organizer": RouteSpec("unions/organizer-tasks", ["GET", "POST"]),
    "education": RouteSpec("unions/training-courses", ["GET", "POST"]),
    "education/[id]": RouteSpec("unions/training-courses", ["GET", "PATCH", "DELETE"], is_detail=True),
    "jurisdiction": RouteSpec("unions/bargaining-units", ["GET"]),
    "jurisdiction-rules": RouteSpec("unions/bargaining-units", ["GET"]),
    "units": RouteSpec("unions/bargaining-units", ["GET", "POST"]),
    "units/[id]": RouteSpec("unions/bargaining-units", ["GET", "PATCH", "DELETE"], is_detail=True),

    # ------------------------------------------------------------------ user/s
    "user": RouteSpec("auth_core/users", ["GET", "PATCH"]),
    "user/[id]": RouteSpec("auth_core/users", ["GET", "PATCH", "DELETE"], is_detail=True),
    "users": RouteSpec("auth_core/users", ["GET", "POST"]),
    "users/[id]": RouteSpec("auth_core/users", ["GET", "PATCH", "DELETE"], is_detail=True),
    "users/me": RouteSpec("auth_core/profile", ["GET", "PATCH"]),
    "users/me/organizations": RouteSpec("auth_core/organization-members", ["GET"]),
    "profile": RouteSpec("auth_core/profile", ["GET", "PATCH"]),
    "profile/[id]": RouteSpec("auth_core/profiles", ["GET", "PATCH"], is_detail=True),
    "onboarding": RouteSpec("auth_core/pending-profiles", ["GET", "POST"]),
    "scim": RouteSpec("auth_core/scim-configurations", ["GET"]),

    # -------------------------------------------------------------- ai / ml
    "ai": RouteSpec("ai_core/knowledge-base", ["GET", "POST"]),
    "ai/[id]": RouteSpec("ai_core/knowledge-base", ["GET", "PATCH", "DELETE"], is_detail=True),
    "chatbot": RouteSpec("ai_core/chat-sessions", ["GET", "POST"]),
    "chatbot/[id]": RouteSpec("ai_core/chat-sessions", ["GET", "PATCH", "DELETE"], is_detail=True),
    "ml": RouteSpec("ai_core/ml-predictions", ["GET", "POST"]),
    "workbench": RouteSpec("ai_core/knowledge-base", ["GET", "POST"]),
    "movement-insights": RouteSpec("analytics/analytics-metrics", ["GET"]),

    # -------------------------------------------------------- misc platform
    "dashboard": RouteSpec("analytics/analytics-metrics", ["GET"]),
    "reports": RouteSpec("analytics/reports", ["GET", "POST"]),
    "reports/[id]": RouteSpec("analytics/reports", ["GET", "PATCH", "DELETE"], is_detail=True),
    "exports": RouteSpec("analytics/reports", ["GET"]),
    "activities": RouteSpec("core/audit-logs", ["GET"]),
    "cases": RouteSpec("grievances/grievances", ["GET", "POST"]),
    "cases/[caseId]": RouteSpec("grievances/grievances", ["GET", "PATCH", "DELETE"], is_detail=True, param="caseId"),
    "cases/[caseId]/evidence": RouteSpec("grievances/grievance-documents", ["GET", "POST"], extra_header=("X-Grievance-Id", "{caseId}"), param="caseId"),
    "cases/[caseId]/timeline": RouteSpec("grievances/grievance-timeline", ["GET"], extra_header=("X-Grievance-Id", "{caseId}"), param="caseId"),
    "cases/[caseId]/outcomes": RouteSpec("grievances/settlements", ["GET", "POST"], extra_header=("X-Grievance-Id", "{caseId}"), param="caseId"),
    "cases/[caseId]/meetings": RouteSpec("unions/calendar-events", ["GET", "POST"], extra_header=("X-Grievance-Id", "{caseId}"), param="caseId"),
    "case-studies": RouteSpec("grievances/grievances", ["GET"]),
    "deadlines": RouteSpec("grievances/claim-deadlines", ["GET", "POST"]),
    "metrics": RouteSpec("analytics/analytics-metrics", ["GET"]),
    "status": RouteSpec("ai_core/ai-usage-metrics", ["GET"]),
    "health": RouteSpec("auth_core/health", ["GET"]),
    "ready": RouteSpec("auth_core/health", ["GET"]),
    "feature-flags": RouteSpec("auth_core/feature-flags", ["GET"]),
    "bulk-import": RouteSpec("auth_core/organization-members", ["POST"]),
    "location": RouteSpec("unions/member-addresses", ["GET", "POST"]),
    "tax": RouteSpec("billing/per-capita-remittances", ["GET"]),
    "enterprise": RouteSpec("auth_core/organization-members", ["GET"]),
    "platform": RouteSpec("analytics/analytics-metrics", ["GET"]),
    "portal": RouteSpec("content/cms-pages", ["GET"]),
    "pilot": RouteSpec("auth_core/organization-members", ["GET"]),
    "extensions": RouteSpec("auth_core/feature-flags", ["GET"]),
    "integrations": RouteSpec("auth_core/oauth-providers", ["GET", "POST"]),
    "external-data": RouteSpec("core/external-accounts", ["GET", "POST"]),
    "carbon": RouteSpec("analytics/analytics-metrics", ["GET"]),
    "signatures": RouteSpec("content/documents", ["GET", "POST"]),
    "support": RouteSpec("notifications/in-app-notifications", ["GET", "POST"]),
    "testimonials": RouteSpec("content/public-content", ["GET"]),
    "social-media": RouteSpec("notifications/campaigns", ["GET", "POST"]),
    "governance": RouteSpec("compliance/data-classification-policy", ["GET"]),
    "equity": RouteSpec("analytics/analytics-metrics", ["GET"]),
    "pension": RouteSpec("billing/per-capita-remittances", ["GET"]),
    "healthwelfare": RouteSpec("billing/per-capita-remittances", ["GET"]),
    "cope": RouteSpec("billing/donation-campaigns", ["GET", "POST"]),
    "whop": RouteSpec("billing/per-capita-remittances", ["GET"]),
    "graphql": RouteSpec("auth_core/health", ["POST"], notes="GraphQL not yet implemented"),
    "financial": RouteSpec("billing/per-capita-remittances", ["GET"]),
    "rewards": RouteSpec("unions/recognition-awards", ["GET", "POST"]),
    "rewards/[id]": RouteSpec("unions/recognition-awards", ["GET", "PATCH", "DELETE"], is_detail=True),
    "mobile": RouteSpec("auth_core/users", ["GET"]),
    "reconciliation": RouteSpec("billing/remittance-approvals", ["GET", "POST"]),
    "currency": RouteSpec("analytics/analytics-metrics", ["GET"]),
    "jurisdiction-rules": RouteSpec("unions/bargaining-units", ["GET"]),
    "emergency": RouteSpec("notifications/in-app-notifications", ["POST"]),
    "voice": RouteSpec("ai_core/knowledge-base", ["POST"]),
    "webhooks": RouteSpec("auth_core/health", ["POST"], notes="webhook passthrough"),
    "cron": RouteSpec("auth_core/health", ["POST"], notes="cron passthrough"),
    "debug": RouteSpec("auth_core/health", ["GET"], notes="debug stub"),
    "test-auth": RouteSpec("auth_core/health", ["GET"], notes="test auth stub"),
    "payment/[id]": RouteSpec("billing/per-capita-remittances", ["GET", "PATCH", "DELETE"], is_detail=True),

    # ------------------------------------------------------------------- scim
    "scim/[id]": RouteSpec("auth_core/scim-configurations", ["GET", "PATCH", "DELETE"], is_detail=True),

    # -------------------------------------------------------- pilots / misc
    "clc": RouteSpec("billing/clc-sync-log", ["GET"]),
    "executive": RouteSpec("unions/federation-executives", ["GET"]),

    # ------------------------------------------------------------- health safety
    "health-safety": RouteSpec("compliance/data-classification-policy", ["GET"]),

    # ---------------------------------------------------------------- calendar
    "calendar/events": RouteSpec("unions/calendar-events", ["GET", "POST"]),
    "calendar/events/[id]": RouteSpec("unions/calendar-events", ["GET", "PATCH", "DELETE"], is_detail=True),
}


# ---------------------------------------------------------------------------
# Algorithmic fallback resolver
# Handles the long tail of sub-paths not explicitly in ROUTE_MAP.
# ---------------------------------------------------------------------------

# First URL segment -> Django app
_DOMAIN_APP: dict[str, str] = {
    "claims": "grievances", "grievances": "grievances", "arbitration": "bargaining",
    "cases": "grievances", "case-studies": "grievances",
    "members": "auth_core", "member": "auth_core",
    "organizations": "auth_core", "organization": "auth_core",
    "users": "auth_core", "user": "auth_core",
    "auth": "auth_core", "profile": "auth_core", "onboarding": "auth_core",
    "scim": "auth_core", "mfa": "auth_core",
    "billing": "billing", "dues": "billing", "payments": "billing",
    "arrears": "billing", "stripe": "billing", "tax": "billing",
    "cope": "billing", "pension": "billing", "healthwelfare": "billing",
    "financial": "billing", "reconciliation": "billing", "whop": "billing",
    "analytics": "analytics", "reports": "analytics", "metrics": "analytics",
    "dashboard": "analytics", "insights": "analytics", "movement-insights": "analytics",
    "bargaining": "bargaining", "negotiations": "bargaining",
    "cbas": "bargaining", "cba": "bargaining", "clauses": "bargaining",
    "clause-library": "bargaining", "precedents": "bargaining",
    "bargaining-notes": "bargaining",
    "unions": "unions", "stewards": "unions", "employers": "unions",
    "worksites": "unions", "federations": "unions", "voting": "unions",
    "surveys": "unions", "calendars": "unions", "calendar-sync": "unions",
    "events": "unions", "committees": "unions", "locals": "unions",
    "organizing": "unions", "organizer": "unions", "education": "unions",
    "strike": "unions", "rewards": "unions", "units": "unions",
    "jurisdiction": "unions", "jurisdiction-rules": "unions",
    "meeting-rooms": "unions", "equity": "unions",
    "content": "content", "documents": "content", "docs": "content",
    "storage": "content", "upload": "content", "signatures": "content",
    "cms": "content", "portal": "content", "testimonials": "content",
    "notifications": "notifications", "messages": "notifications",
    "messaging": "notifications", "communications": "notifications",
    "support": "notifications", "social-media": "notifications",
    "compliance": "compliance", "gdpr": "compliance", "consent": "compliance",
    "governance": "compliance", "privacy": "compliance", "health-safety": "compliance",
    "audits": "core", "security": "core", "activities": "core",
    "workflow": "core", "automation": "core",
    "ai": "ai_core", "chatbot": "ai_core", "ml": "ai_core",
    "voice": "ai_core", "workbench": "ai_core",
    "admin": "auth_core", "enterprise": "auth_core", "platform": "auth_core",
    "pilot": "auth_core", "extensions": "auth_core", "integrations": "auth_core",
    "feature-flags": "auth_core", "bulk-import": "auth_core",
    "deadlines": "grievances", "clc": "billing", "executive": "unions",
    "exports": "analytics", "external-data": "core",
    "webhooks": "auth_core", "cron": "auth_core", "debug": "auth_core",
    "health": "auth_core", "ready": "auth_core", "status": "auth_core",
    "test-auth": "auth_core", "carbon": "analytics", "currency": "analytics",
    "rewads": "unions", "location": "unions", "mobile": "auth_core",
    "emergency": "notifications", "v1": "grievances",
}

# (app, first-resource-segment) -> DRF URL prefix
_RESOURCE_PREFIX: dict[tuple[str, str], str] = {
    ("grievances", "claims"): "claims",
    ("grievances", "grievances"): "grievances",
    ("grievances", "cases"): "grievances",
    ("grievances", "arbitration"): "arbitrations",
    ("grievances", "deadlines"): "claim-deadlines",
    ("grievances", "settlements"): "settlements",
    ("auth_core", "members"): "organization-members",
    ("auth_core", "member"): "organization-members",
    ("auth_core", "organizations"): "organization-members",
    ("auth_core", "organization"): "organization-members",
    ("auth_core", "users"): "users",
    ("auth_core", "user"): "users",
    ("auth_core", "admin"): "organization-members",
    ("auth_core", "scim"): "scim-configurations",
    ("auth_core", "profile"): "profiles",
    ("auth_core", "onboarding"): "pending-profiles",
    ("auth_core", "feature-flags"): "feature-flags",
    ("auth_core", "bulk-import"): "organization-members",
    ("auth_core", "integrations"): "oauth-providers",
    ("auth_core", "webhooks"): "health",
    ("auth_core", "cron"): "health",
    ("auth_core", "health"): "health",
    ("auth_core", "ready"): "health",
    ("auth_core", "status"): "health",
    ("billing", "billing"): "per-capita-remittances",
    ("billing", "dues"): "per-capita-remittances",
    ("billing", "payments"): "per-capita-remittances",
    ("billing", "arrears"): "per-capita-remittances",
    ("billing", "stripe"): "stripe-connect-accounts",
    ("billing", "tax"): "per-capita-remittances",
    ("billing", "reconciliation"): "remittance-approvals",
    ("billing", "cope"): "donation-campaigns",
    ("billing", "clc"): "clc-sync-log",
    ("billing", "financial"): "per-capita-remittances",
    ("billing", "whop"): "per-capita-remittances",
    ("billing", "pension"): "per-capita-remittances",
    ("billing", "healthwelfare"): "per-capita-remittances",
    ("analytics", "analytics"): "analytics-metrics",
    ("analytics", "reports"): "reports",
    ("analytics", "metrics"): "analytics-metrics",
    ("analytics", "dashboard"): "analytics-metrics",
    ("analytics", "insights"): "insight-recommendations",
    ("analytics", "exports"): "reports",
    ("analytics", "movement-insights"): "analytics-metrics",
    ("analytics", "carbon"): "analytics-metrics",
    ("analytics", "currency"): "analytics-metrics",
    ("bargaining", "bargaining"): "negotiations",
    ("bargaining", "cbas"): "collective-agreements",
    ("bargaining", "cba"): "collective-agreements",
    ("bargaining", "clauses"): "cba-clauses",
    ("bargaining", "clause-library"): "shared-clause-library",
    ("bargaining", "precedents"): "arbitration-precedents",
    ("bargaining", "arbitration"): "arbitration-decisions",
    ("bargaining", "bargaining-notes"): "bargaining-notes",
    ("bargaining", "negotiations"): "negotiations",
    ("unions", "stewards"): "steward-assignments",
    ("unions", "employers"): "employers",
    ("unions", "worksites"): "worksites",
    ("unions", "federations"): "federations",
    ("unions", "voting"): "voting-sessions",
    ("unions", "surveys"): "surveys",
    ("unions", "calendars"): "calendars",
    ("unions", "calendar-sync"): "external-calendar-connections",
    ("unions", "events"): "calendar-events",
    ("unions", "committees"): "committees",
    ("unions", "locals"): "bargaining-units",
    ("unions", "organizing"): "organizing-campaigns",
    ("unions", "organizer"): "organizer-tasks",
    ("unions", "education"): "training-courses",
    ("unions", "strike"): "voting-sessions",
    ("unions", "rewards"): "recognition-awards",
    ("unions", "units"): "bargaining-units",
    ("unions", "jurisdiction"): "bargaining-units",
    ("unions", "jurisdiction-rules"): "bargaining-units",
    ("unions", "meeting-rooms"): "meeting-rooms",
    ("unions", "equity"): "member-segments",
    ("unions", "location"): "member-addresses",
    ("unions", "executive"): "federation-executives",
    ("content", "documents"): "documents",
    ("content", "docs"): "documents",
    ("content", "storage"): "cms-media-library",
    ("content", "upload"): "cms-media-library",
    ("content", "signatures"): "documents",
    ("content", "content"): "cms-pages",
    ("content", "portal"): "cms-pages",
    ("content", "testimonials"): "public-content",
    ("notifications", "notifications"): "in-app-notifications",
    ("notifications", "messages"): "messages",
    ("notifications", "messaging"): "message-threads",
    ("notifications", "communications"): "campaigns",
    ("notifications", "support"): "in-app-notifications",
    ("notifications", "social-media"): "campaigns",
    ("notifications", "emergency"): "notification-log",
    ("compliance", "compliance"): "data-classification-policy",
    ("compliance", "gdpr"): "dsr-requests",
    ("compliance", "consent"): "consent-records",
    ("compliance", "governance"): "data-classification-policy",
    ("compliance", "privacy"): "data-classification-policy",
    ("compliance", "health-safety"): "data-classification-policy",
    ("core", "audits"): "audit-logs",
    ("core", "security"): "security-events",
    ("core", "activities"): "audit-logs",
    ("core", "workflow"): "workflow-definitions",
    ("core", "external-data"): "external-accounts",
    ("ai_core", "ai"): "knowledge-base",
    ("ai_core", "chatbot"): "chat-sessions",
    ("ai_core", "ml"): "ml-predictions",
    ("ai_core", "voice"): "knowledge-base",
    ("ai_core", "workbench"): "knowledge-base",
    ("ai_core", "status"): "ai-usage-metrics",
    # v1 aliases
    ("grievances", "v1"): "claims",
}


def _fallback_resolve(rel_posix: str) -> Optional[RouteSpec]:
    """
    Algorithmically derive a RouteSpec from the path structure when no
    explicit ROUTE_MAP entry exists.

    Strategy:
      1.  First segment  -> Django app  (via _DOMAIN_APP)
      2.  Second segment -> DRF prefix  (via _RESOURCE_PREFIX or kebab of segment)
      3.  Dynamic segments -> is_detail=True
      4.  Remaining static sub-segments appended to URL as sub-actions
    """
    parts = rel_posix.split("/")
    if not parts:
        return None

    domain = parts[0]
    app = _DOMAIN_APP.get(domain)
    if app is None:
        return None

    # Determine the resource/prefix
    resource_key = parts[1] if len(parts) > 1 else domain
    # Strip dynamic markers for lookup
    resource_clean = re.sub(r'^\[|\]$', '', resource_key)

    prefix = _RESOURCE_PREFIX.get((app, domain)) or _RESOURCE_PREFIX.get((app, resource_clean))

    if prefix is None:
        # Fallback: convert the second segment to kebab-case DRF prefix
        prefix = resource_clean if not resource_clean.startswith('[') else domain

    # Detect if there's a dynamic segment
    dynamic_segments = [p for p in parts if p.startswith('[') and p.endswith(']')]
    is_detail = bool(dynamic_segments)
    param_name = re.sub(r'^\[|\]$', '', dynamic_segments[-1]) if dynamic_segments else 'id'

    # Determine verbs from position
    if is_detail:
        verbs = ["GET", "PATCH", "DELETE"]
    else:
        verbs = ["GET", "POST"]

    # Read-only endpoints
    if any(s in rel_posix for s in ["/analytics", "/results", "/history", "/export", "/run"]):
        verbs = ["GET"]

    return RouteSpec(
        django_prefix=f"{app}/{prefix}",
        verbs=verbs,
        is_detail=is_detail,
        param=param_name,
        notes=f"auto-resolved from {rel_posix}",
    )


# ---------------------------------------------------------------------------
# TypeScript code generation
# ---------------------------------------------------------------------------

_VERB_BODY: dict[str, str] = {
    "POST": "POST",
    "PATCH": "PATCH",
    "PUT": "PUT",
    "DELETE": "DELETE",
}

def _param_from_path(rel_posix: str) -> str:
    """Extract the last dynamic param name from a path, e.g. [caseId] → caseId."""
    m = re.findall(r'\[([^\]]+)\]', rel_posix)
    return m[-1] if m else "id"


def generate_proxy_ts(rel_posix: str, spec: RouteSpec) -> str:
    """Generate the full TypeScript proxy route content."""
    verbs = spec.verbs
    is_detail = spec.is_detail
    param = spec.param or _param_from_path(rel_posix)
    prefix = spec.django_prefix  # e.g. "grievances/claims"

    # Derive Django app and URL prefix
    app, _, url_prefix = prefix.partition("/")
    django_base = f"/api/{app}/{url_prefix}/"

    has_body_verb = any(v in _VERB_BODY for v in verbs)
    needs_auth_import = is_detail  # only needed for param extraction

    lines: list[str] = []
    lines.append("/**")
    lines.append(f" * {' '.join(verbs)} /api/{rel_posix}")
    lines.append(f" * -> Django {app}: {django_base}")
    if spec.notes:
        lines.append(f" * NOTE: {spec.notes}")
    lines.append(" * Auto-migrated by scripts/migrate_routes.py")
    lines.append(" */")

    # Imports
    imports = ["NextRequest"]
    if is_detail or any(v == "PATCH" and spec.extra_header for v in verbs):
        imports.append("NextResponse")
    lines.append(f"import {{ {', '.join(imports)} }} from 'next/server';")
    lines.append("import { djangoProxy } from '@/lib/django-proxy';")
    lines.append("")
    lines.append("export const dynamic = 'force-dynamic';")
    lines.append("")

    if is_detail:
        # Dynamic route — receives params
        lines.append(f"type Params = {{ params: Promise<{{ {param}: string }}> }};")
        lines.append("")

        for verb in verbs:
            django_url_expr: str
            method_opt = ""

            if verb == "GET":
                if "status" in rel_posix:
                    # Status sub-action
                    django_url_expr = f"'/api/{app}/{url_prefix}/' + {param} + '/status/'"
                else:
                    django_url_expr = f"'/api/{app}/{url_prefix}/' + {param} + '/'"
                method_opt = ""
            elif verb in _VERB_BODY:
                if "status" in rel_posix:
                    django_url_expr = f"'/api/{app}/{url_prefix}/' + {param} + '/status/'"
                else:
                    django_url_expr = f"'/api/{app}/{url_prefix}/' + {param} + '/'"
                method_opt = f", {{ method: '{verb}' }}"
            else:
                django_url_expr = f"'/api/{app}/{url_prefix}/' + {param} + '/'"
                method_opt = f", {{ method: '{verb}' }}"

            lines.append(f"export async function {verb}(req: NextRequest, {{ params }}: Params) {{")
            lines.append(f"  const {{ {param} }} = await params;")
            lines.append(f"  return djangoProxy(req, {django_url_expr}{method_opt});")
            lines.append("}")
            lines.append("")
    else:
        # Collection / flat route
        for verb in verbs:
            if verb == "GET":
                if spec.qs:
                    # Build query string forwarding
                    qs_comment = f"  // Forwards ?{spec.qs}"
                    lines.append(f"export function GET(req: NextRequest) {{")
                    lines.append(qs_comment)
                    lines.append(f"  const url = new URL(req.url);")
                    lines.append(f"  const q = url.searchParams.get('q') ?? url.searchParams.get('query') ?? url.searchParams.get('search') ?? '';")
                    lines.append(f"  const fwd = new URLSearchParams();")
                    lines.append(f"  if (q) fwd.set('search', q);")
                    lines.append(f"  // Forward all other search params")
                    lines.append(f"  url.searchParams.forEach((v, k) => {{ if (k !== 'q' && k !== 'query') fwd.set(k, v); }});")
                    lines.append(f"  return djangoProxy(req, '{django_base}?' + fwd.toString());")
                    lines.append("}")
                else:
                    lines.append(f"export function GET(req: NextRequest) {{")
                    lines.append(f"  return djangoProxy(req, '{django_base}');")
                    lines.append("}")
                lines.append("")
            else:
                lines.append(f"export function {verb}(req: NextRequest) {{")
                lines.append(f"  return djangoProxy(req, '{django_base}', {{ method: '{verb}' }});")
                lines.append("}")
                lines.append("")

    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# File walker
# ---------------------------------------------------------------------------

@dataclass
class MigrationResult:
    migrated: list[str] = field(default_factory=list)
    skipped_already_done: list[str] = field(default_factory=list)
    skipped_no_drizzle: list[str] = field(default_factory=list)
    unmapped: list[str] = field(default_factory=list)
    errors: list[tuple[str, str]] = field(default_factory=list)


def _route_file_to_posix_key(route_file: Path) -> str:
    """
    Convert  app/api/members/[id]/claims/route.ts
    to       members/[id]/claims
    """
    rel = route_file.relative_to(FRONTEND_API)
    parts = rel.parts[:-1]  # strip route.ts
    return "/".join(parts)


def migrate_all(
    dry_run: bool = False,
    domain_filter: Optional[str] = None,
    verbose: bool = False,
) -> MigrationResult:
    result = MigrationResult()

    route_files = sorted(FRONTEND_API.rglob("route.ts"))

    for route_file in route_files:
        rel_posix = _route_file_to_posix_key(route_file)

        if domain_filter and not rel_posix.startswith(domain_filter):
            continue

        try:
            content = route_file.read_text(encoding="utf-8")
        except Exception as e:
            result.errors.append((rel_posix, str(e)))
            continue

        if is_already_proxied(content):
            result.skipped_already_done.append(rel_posix)
            if verbose:
                print(f"  [SKIP/done]   {rel_posix}")
            continue

        if not is_legacy(content):
            result.skipped_no_drizzle.append(rel_posix)
            if verbose:
                print(f"  [SKIP/clean]  {rel_posix}")
            continue

        spec = ROUTE_MAP.get(rel_posix)
        if spec is None:
            spec = _fallback_resolve(rel_posix)
        if spec is None:
            result.unmapped.append(rel_posix)
            print(f"  [UNMAPPED]    {rel_posix}")
            continue

        new_content = generate_proxy_ts(rel_posix, spec)

        if dry_run:
            print(f"  [DRY-RUN]     {rel_posix} -> /api/{spec.django_prefix}/")
        else:
            route_file.write_text(new_content, encoding="utf-8")
            result.migrated.append(rel_posix)
            print(f"  [MIGRATED]    {rel_posix} -> /api/{spec.django_prefix}/")

    return result


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate Next.js routes to Django proxy")
    parser.add_argument("--dry-run", action="store_true", help="Print what would change, don't write files")
    parser.add_argument("--domain", default=None, help="Only migrate routes under this prefix (e.g. 'claims')")
    parser.add_argument("--verbose", action="store_true", help="Also log skipped files")
    args = parser.parse_args()

    print(f"\n{'='*64}")
    print(f"  Nzila Route Migration  |  {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"  Target: {FRONTEND_API}")
    print(f"{'='*64}\n")

    result = migrate_all(
        dry_run=args.dry_run,
        domain_filter=args.domain,
        verbose=args.verbose,
    )

    print(f"\n{'='*64}")
    print(f"  Migrated:          {len(result.migrated)}")
    print(f"  Already proxied:   {len(result.skipped_already_done)}")
    print(f"  No legacy imports: {len(result.skipped_no_drizzle)}")
    print(f"  UNMAPPED:          {len(result.unmapped)}")
    if result.unmapped:
        for p in result.unmapped:
            print(f"    - {p}")
    if result.errors:
        print(f"  ERRORS:            {len(result.errors)}")
        for p, e in result.errors:
            print(f"    - {p}: {e}")
    print(f"{'='*64}\n")

    return 1 if result.unmapped or result.errors else 0


if __name__ == "__main__":
    sys.exit(main())
