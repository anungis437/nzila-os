"""
ABR Insights — ABR-specific URL routes.

Mounted at: /api/compliance/abr/  (via compliance/urls.py)

Endpoints:
  GET  /api/compliance/abr/cases/               — list cases (metadata only)
  POST /api/compliance/abr/cases/               — create case
  GET  /api/compliance/abr/cases/<id>/          — case detail (membership required)
  PATCH /api/compliance/abr/cases/<id>/         — update case (membership required)
  GET  /api/compliance/abr/cases/<id>/identity/ — identity detail (compliance-officer only)
  GET  /api/compliance/abr/cases/<id>/team/     — team members
  POST /api/compliance/abr/cases/<id>/team/     — add team member (compliance-officer only)
  POST /api/compliance/abr/cases/<id>/export-evidence/ — sealed evidence export
"""

from django.urls import path

from .abr_views import (
    AbrCaseDetailView,
    AbrCaseEvidenceExportView,
    AbrCaseListView,
    AbrCaseTeamMemberView,
    AbrIdentityDetailView,
)

app_name = "abr"

urlpatterns = [
    # Case list + create
    path("cases/", AbrCaseListView.as_view(), name="case-list"),
    # Case detail + update
    path("cases/<uuid:case_id>/", AbrCaseDetailView.as_view(), name="case-detail"),
    # Identity access (compliance-officer only, requires justification header)
    path(
        "cases/<uuid:case_id>/identity/",
        AbrIdentityDetailView.as_view(),
        name="case-identity",
    ),
    # Team membership
    path(
        "cases/<uuid:case_id>/team/",
        AbrCaseTeamMemberView.as_view(),
        name="case-team",
    ),
    # Sealed evidence export (compliance-officer only, EVIDENCE_SEAL_KEY required)
    path(
        "cases/<uuid:case_id>/export-evidence/",
        AbrCaseEvidenceExportView.as_view(),
        name="case-export-evidence",
    ),
]
