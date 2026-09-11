"""
Compliance Snapshot Engine — DRF views.
"""

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import ComplianceSnapshot
from .serializers import ComplianceSnapshotSerializer
from .service import capture_snapshot, verify_chain


class ComplianceSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to compliance snapshots + capture / verify actions."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ComplianceSnapshotSerializer
    filterset_fields = ["snapshot_type"]
    ordering_fields = ["created_at", "sequence_number"]

    def get_queryset(self):
        org_id = getattr(self.request, "organization_id", None)
        if not org_id:
            return ComplianceSnapshot.objects.none()
        return ComplianceSnapshot.objects.filter(org_id=org_id)

    @action(detail=False, methods=["post"], url_path="capture")
    def capture(self, request):
        """Capture an on-demand compliance snapshot."""
        org_id = getattr(request, "organization_id", None)
        actor_id = str(getattr(request, "user_id", "system"))

        if not org_id:
            return Response(
                {"error": "Organization context required"},
                status=status.HTTP_403_FORBIDDEN,
            )

        result = capture_snapshot(
            org_id=str(org_id),
            snapshot_type="on_demand",
            created_by=actor_id,
        )
        return Response(result, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="verify-chain")
    def verify_chain_action(self, request):
        """Verify the full hash chain for the calling org."""
        org_id = getattr(request, "organization_id", None)
        if not org_id:
            return Response(
                {"error": "Organization context required"},
                status=status.HTTP_403_FORBIDDEN,
            )

        result = verify_chain(str(org_id))
        return Response(result)

    @action(detail=True, methods=["get"], url_path="verify")
    def verify_single(self, request, pk=None):
        """Verify a single snapshot's hash integrity."""
        snapshot = self.get_object()
        return Response(
            {
                "snapshot_id": str(snapshot.id),
                "sequence_number": snapshot.sequence_number,
                "integrity_valid": snapshot.verify_integrity(),
                "hash": snapshot.hash,
            }
        )
