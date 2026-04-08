"""
ABR Insights — Need-To-Know API Views

Enforces:
  1. Case list/detail — never returns identity fields
  2. Case detail — requires team membership OR compliance-officer override
  3. Identity view — requires elevated role, justification string, logs access
  4. Response payloads filtered through DTO allowlists (abr_serializers.py)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from django.http import JsonResponse
from django.utils import timezone as dj_timezone
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .abr_serializers import (
    AbrCaseDetailSerializer,
    AbrCaseMetaSerializer,
    AbrCaseTeamMemberSerializer,
    AbrCaseWriteSerializer,
    AbrReporterIdentitySerializer,
    AbrSensitiveActionApprovalSerializer,
    AbrSensitiveActionRequestSerializer,
)
from .case_evidence_export import (
    build_case_evidence_pack,
    seal_case_evidence_pack,
    verify_case_evidence_pack,
)
from .models import (
    AbrCase,
    AbrCaseTeamMember,
    AbrIdentityAccessLog,
    AbrReporterIdentity,
    AbrSensitiveActionApproval,
    AbrSensitiveActionRequest,
)

# ── Role helpers ──────────────────────────────────────────────────────────────


def _get_user_id(request: Request) -> str:
    """Extract a stable user identifier from the DRF request."""
    user = request.user
    if hasattr(user, "clerk_user_id") and user.clerk_user_id:
        return user.clerk_user_id
    return str(user.pk) if user and user.pk else "anonymous"


def _has_role(request: Request, *roles: str) -> bool:
    """Check whether the request user holds any of the given roles.

    Precedence:
      1. Superusers implicitly hold ALL roles (admin bypass).
      2. Production: roles come from Clerk JWT claims on ``user.abr_roles``.
      3. Tests: ``user.abr_roles`` may be injected directly by fixtures.
    """
    user = request.user
    if not user or not user.is_authenticated:
        return False
    # Superuser bypass — checked first so an empty abr_roles list never masks it.
    if getattr(user, "is_superuser", False):
        return True
    user_roles: set[str] = set(getattr(user, "abr_roles", []))
    return bool(user_roles & set(roles))


def _is_case_team_member(request: Request, case: AbrCase) -> bool:
    """Return True if the current user is a team member of the case."""
    user_id = _get_user_id(request)
    return AbrCaseTeamMember.objects.filter(
        case=case,
        user_id=user_id,
        org_id=case.org_id,
    ).exists()


def _can_see_case_details(request: Request, case: AbrCase) -> bool:
    """
    Details access: team membership OR compliance-officer override.
    Mirrors NzilaOS ABR default access policy.
    """
    return _is_case_team_member(request, case) or _has_role(
        request, "compliance-officer", "case-manager"
    )


# ── Case views ────────────────────────────────────────────────────────────────


class AbrCaseListView(APIView):
    """
    GET  /api/abr/cases/          — list all cases for caller's org (metadata only)
    POST /api/abr/cases/          — create a new case
    """

    permission_classes = [permissions.IsAuthenticated]

    def _get_org_id(self, request: Request) -> uuid.UUID:
        """Derive Org ID exclusively from authenticated session context.

        SECURITY: Org ID MUST come from server-side auth context (Clerk JWT
        via OrganizationIsolationMiddleware). Never from query params, request
        body, or any client-controlled input.  This prevents cross-Org data
        access via parameter injection.
        """
        user = request.user
        if hasattr(user, "organization_id") and user.organization_id:
            return uuid.UUID(str(user.organization_id))
        raise PermissionDenied(
            "Organization context is required. "
            "Ensure the request is authenticated via Clerk with an active Org."
        )

    def get(self, request: Request) -> Response:
        org_id = self._get_org_id(request)
        cases = AbrCase.objects.filter(org_id=org_id).order_by("-created_at")
        serializer = AbrCaseMetaSerializer(cases, many=True)
        return Response(serializer.data)

    def post(self, request: Request) -> Response:
        org_id = self._get_org_id(request)
        data = {**request.data, "org_id": str(org_id)}
        serializer = AbrCaseWriteSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        case = serializer.save()
        return Response(
            AbrCaseMetaSerializer(case).data, status=status.HTTP_201_CREATED
        )


class AbrCaseDetailView(APIView):
    """
    GET   /api/abr/cases/<id>/   — case detail (requires membership or compliance)
    PATCH /api/abr/cases/<id>/   — update case (requires membership or compliance)
    """

    permission_classes = [permissions.IsAuthenticated]

    def _get_case(self, request: Request, case_id: str) -> AbrCase:
        try:
            return AbrCase.objects.get(pk=case_id)
        except AbrCase.DoesNotExist:
            raise NotFound(f"Case {case_id} not found.")

    def get(self, request: Request, case_id: str) -> Response:
        case = self._get_case(request, case_id)
        if not _can_see_case_details(request, case):
            raise PermissionDenied(
                "Case details access requires team membership or compliance-officer role."
            )
        serializer = AbrCaseDetailSerializer(case)
        return Response(serializer.data)

    def patch(self, request: Request, case_id: str) -> Response:
        case = self._get_case(request, case_id)
        if not _can_see_case_details(request, case):
            raise PermissionDenied("Insufficient access to modify this case.")
        serializer = AbrCaseWriteSerializer(case, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(AbrCaseDetailSerializer(case).data)


# ── Identity view (elevated access only) ─────────────────────────────────────


class AbrIdentityDetailView(APIView):
    """
    GET /api/abr/cases/<id>/identity/

    Compliance-only endpoint. Requires:
      1. compliance-officer role
      2. Non-empty 'X-Justification' header
      3. Creates an immutable AbrIdentityAccessLog record on every call.

    Returns only identity metadata (from AbrReporterIdentity).
    Actual PII decryption is not returned here — see IdentityVaultEntry.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request, case_id: str) -> Response:
        # 1 — Role gate: compliance-officer only
        if not _has_role(request, "compliance-officer"):
            raise PermissionDenied(
                "Identity access requires compliance-officer role. "
                "Justification and dual-control approval may be required."
            )

        # 2 — Justification gate: mandatory non-empty string
        justification = request.headers.get("X-Justification", "").strip()
        if not justification:
            raise ValidationError(
                {
                    "X-Justification": "A non-empty justification is required to access identity data."
                }
            )

        # 3 — Load the case
        try:
            case = AbrCase.objects.get(pk=case_id)
        except AbrCase.DoesNotExist:
            raise NotFound(f"Case {case_id} not found.")

        if case.identity_id is None:
            return Response(
                {"detail": "No reporter identity is linked to this case."},
                status=status.HTTP_404_NOT_FOUND,
            )

        identity = case.identity_id  # AbrReporterIdentity instance

        # 4 — Log the access (immutable record)
        user_id = _get_user_id(request)
        AbrIdentityAccessLog.objects.create(
            org_id=case.org_id,
            case_id=case.pk,
            identity_id=identity.pk,
            accessed_by=user_id,
            justification=justification,
            access_type="view",
        )

        serializer = AbrReporterIdentitySerializer(identity)
        return Response(serializer.data)


# ── Team member views ─────────────────────────────────────────────────────────


class AbrCaseTeamMemberView(APIView):
    """
    GET  /api/abr/cases/<id>/team/  — list team members
    POST /api/abr/cases/<id>/team/  — add a team member (compliance-officer only)
    """

    permission_classes = [permissions.IsAuthenticated]

    def _get_case(self, case_id: str) -> AbrCase:
        try:
            return AbrCase.objects.get(pk=case_id)
        except AbrCase.DoesNotExist:
            raise NotFound(f"Case {case_id} not found.")

    def get(self, request: Request, case_id: str) -> Response:
        case = self._get_case(case_id)
        if not _can_see_case_details(request, case):
            raise PermissionDenied("Case-details access required to view team members.")
        members = AbrCaseTeamMember.objects.filter(case=case)
        return Response(AbrCaseTeamMemberSerializer(members, many=True).data)

    def post(self, request: Request, case_id: str) -> Response:
        if not _has_role(request, "compliance-officer"):
            raise PermissionDenied("Only compliance-officers can manage team members.")
        case = self._get_case(case_id)
        data = {
            **request.data,
            "case": str(case.pk),
            "org_id": str(case.org_id),
            "added_by": _get_user_id(request),
        }
        serializer = AbrCaseTeamMemberSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        member = serializer.save()
        return Response(
            AbrCaseTeamMemberSerializer(member).data,
            status=status.HTTP_201_CREATED,
        )


# ── Case evidence export ──────────────────────────────────────────────────────


class AbrCaseEvidenceExportView(APIView):
    """
    POST /api/compliance/abr/cases/<id>/export-evidence/

    Builds a sealed evidence pack for the case. Returns the pack as JSON.
    verifySeal MUST pass — if it fails the endpoint returns 500.

    Requires:
      - compliance-officer role
      - Non-empty X-Justification header
      - Dual-control approval if include_identity=true is passed

    Evidence pack contains:
      - Case metadata (minimized, no PII unless include_identity approved)
      - Audit trail entries
      - Dual-control approvals for this case
      - Artifact digests
      - Merkle root + HMAC seal (requires EVIDENCE_SEAL_KEY env var)

    The export is deterministic given the same input data (sorted hashes,
    canonical JSON).
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request, case_id: str) -> Response:
        # 1 — Role gate
        if not _has_role(request, "compliance-officer"):
            raise PermissionDenied("Evidence export requires compliance-officer role.")

        # 2 — Justification gate
        justification = request.headers.get("X-Justification", "").strip()
        if not justification:
            raise ValidationError(
                {
                    "X-Justification": "A non-empty justification is required for evidence export."
                }
            )

        # 3 — Load case
        try:
            case = AbrCase.objects.get(pk=case_id)
        except AbrCase.DoesNotExist:
            raise NotFound(f"Case {case_id} not found.")

        # 4 — Build case_data dict for the exporter
        case_data = {
            "id": str(case.pk),
            "organization_id": str(case.org_id),
            "case_number": case.case_number,
            "title": case.title,
            "status": case.status,
            "severity": case.severity,
            "category": case.category,
            "description": case.description,
            "created_at": case.created_at.isoformat() if case.created_at else None,
        }

        # 5 — Load dual-control approvals for this case
        approvals = []
        for req in AbrSensitiveActionRequest.objects.filter(case_id=case.pk):
            for approval in req.approvals.all():
                approvals.append(
                    {
                        "request_id": str(req.pk),
                        "action": req.action,
                        "requested_by": req.requested_by,
                        "approver_id": approval.approver_id,
                        "decision": approval.decision,
                        "decided_at": approval.decided_at.isoformat(),
                    }
                )

        # 6 — Load audit entries (identity access logs as lightweight audit trail)
        audit_entries = list(
            AbrIdentityAccessLog.objects.filter(case_id=case.pk).values(
                "id", "accessed_by", "justification", "accessed_at", "access_type"
            )
        )
        # Make audit entries JSON-serializable
        for entry in audit_entries:
            entry["id"] = str(entry["id"])
            if hasattr(entry.get("accessed_at"), "isoformat"):
                entry["accessed_at"] = entry["accessed_at"].isoformat()

        # 7 — Build draft pack
        pack = build_case_evidence_pack(
            case_data=case_data,
            audit_entries=audit_entries,
            evidence_artifacts=[],  # attachment digests: empty unless provided separately
            dual_control_approvals=approvals,
            include_identity=False,  # always false — identity export requires separate flow
        )

        # 8 — Seal: requires EVIDENCE_SEAL_KEY
        try:
            pack = seal_case_evidence_pack(pack)
        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "hint": "Set EVIDENCE_SEAL_KEY environment variable.",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # 9 — BLOCKING verify: if seal is invalid, return 500
        verification = verify_case_evidence_pack(pack)
        if not verification["valid"]:
            return Response(
                {
                    "detail": "Evidence seal verification failed — export aborted.",
                    "errors": verification["errors"],
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # 10 — Log the export as an identity-adjacent audit event
        AbrIdentityAccessLog.objects.create(
            org_id=case.org_id,
            case_id=case.pk,
            identity_id=case.identity_id.pk if case.identity_id else uuid.uuid4(),
            accessed_by=_get_user_id(request),
            justification=f"[EVIDENCE-EXPORT] {justification}",
            access_type="export",
        )

        return Response(pack, status=status.HTTP_200_OK)
