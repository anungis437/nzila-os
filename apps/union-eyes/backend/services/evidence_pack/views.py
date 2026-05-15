"""
Evidence Pack System — DRF views.

Provides:
  GET     /api/governance/evidence-pack/            — list packs for org
  GET     /api/governance/evidence-pack/<id>/        — pack detail
  POST    /api/governance/evidence-pack/export/      — build + seal + export
  GET     /api/governance/evidence-pack/<id>/download/ — download sealed JSON
  GET     /api/governance/evidence-pack/<id>/verify/   — verify seal integrity
"""

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .builder import build_evidence_pack, export_pack_json
from .models import EvidenceArtifact, EvidencePack
from .serializers import (
    EvidenceArtifactSerializer,
    EvidencePackExportSerializer,
    EvidencePackSerializer,
)


class EvidencePackViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only listing + export/verify actions for evidence packs."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EvidencePackSerializer

    def get_queryset(self):
        org_id = getattr(self.request, "organization_id", None)
        if not org_id:
            return EvidencePack.objects.none()
        return EvidencePack.objects.filter(org_id=org_id)

    # ----- export: build + seal + return -----

    @action(detail=False, methods=["post"], url_path="export")
    def export(self, request):
        """
        ``POST /api/governance/evidence-pack/export/``

        Builds, seals, and returns a governance evidence pack.
        """
        ser = EvidencePackExportSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        org_id = getattr(request, "organization_id", None)
        actor_id = str(getattr(request, "clerk_user_id", "system"))

        if not org_id:
            return Response(
                {"error": "Organization context required"},
                status=status.HTTP_403_FORBIDDEN,
            )

        result = build_evidence_pack(
            org_id=str(org_id),
            pack_type=ser.validated_data["pack_type"],
            title=ser.validated_data.get("title", ""),
            period_start=ser.validated_data.get("period_start"),
            period_end=ser.validated_data.get("period_end"),
            requested_by=actor_id,
            include_events=ser.validated_data["include_events"],
            include_audit_logs=ser.validated_data["include_audit_logs"],
            include_cases=ser.validated_data["include_cases"],
            include_governance=ser.validated_data["include_governance"],
            include_votes=ser.validated_data["include_votes"],
        )

        # Emit governance event.
        from services.events.dispatcher import emit_event

        emit_event(
            event_type="evidence_pack_exported",
            org_id=str(org_id),
            actor_id=actor_id,
            payload={
                "pack_id": result["pack_id"],
                "pack_type": ser.validated_data["pack_type"],
                "artifact_count": result["artifact_count"],
            },
        )

        return Response(result, status=status.HTTP_201_CREATED)

    # ----- download sealed JSON -----

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        """Download the sealed JSON archive for a pack."""
        try:
            archive = export_pack_json(pk)
            return Response(archive)
        except EvidencePack.DoesNotExist:
            return Response(
                {"error": "Pack not found"}, status=status.HTTP_404_NOT_FOUND
            )
        except ValueError as e:
            return Response({"error": "An error occurred"}, status=status.HTTP_400_BAD_REQUEST)

    # ----- verify seal -----

    @action(detail=True, methods=["get"], url_path="verify")
    def verify(self, request, pk=None):
        """Verify the seal integrity of a pack."""
        pack = self.get_object()
        if pack.status not in ("sealed", "exported"):
            return Response(
                {"error": "Pack not yet sealed", "status": pack.status},
                status=status.HTTP_400_BAD_REQUEST,
            )
        valid = pack.verify_seal()
        return Response(
            {
                "pack_id": str(pack.id),
                "seal_valid": valid,
                "pack_hash": pack.pack_hash,
                "sealed_at": str(pack.sealed_at),
            }
        )

    # ----- list artifacts for a pack -----

    @action(detail=True, methods=["get"], url_path="artifacts")
    def artifacts(self, request, pk=None):
        pack = self.get_object()
        artifacts = EvidenceArtifact.objects.filter(pack=pack).order_by("created_at")
        ser = EvidenceArtifactSerializer(artifacts, many=True)
        return Response(ser.data)
