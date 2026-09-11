"""
Event Bus — DRF views.
"""

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .dispatcher import emit_event
from .models import Event
from .serializers import EventCreateSerializer, EventSerializer


class EventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only access to domain events, scoped to the calling org.
    Includes an ``emit`` action for programmatic event creation.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EventSerializer
    filterset_fields = ["event_type", "actor_id"]
    ordering_fields = ["created_at", "event_type"]

    def get_queryset(self):
        org_id = getattr(self.request, "organization_id", None)
        if not org_id:
            return Event.objects.none()
        return Event.objects.filter(org_id=org_id)

    @action(detail=False, methods=["post"], url_path="emit")
    def emit(self, request):
        """Emit a new domain event."""
        ser = EventCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        org_id = getattr(request, "organization_id", None)
        actor_id = getattr(request, "user_id", "unknown")

        if not org_id:
            return Response(
                {"error": "Organization context required"},
                status=status.HTTP_403_FORBIDDEN,
            )

        event_id = emit_event(
            event_type=ser.validated_data["event_type"],
            org_id=str(org_id),
            actor_id=str(actor_id),
            payload=ser.validated_data.get("payload", {}),
            correlation_id=ser.validated_data.get("correlation_id", ""),
            metadata=ser.validated_data.get("metadata", {}),
        )

        return Response({"event_id": event_id}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="verify-integrity")
    def verify_integrity(self, request):
        """Verify hash integrity of all events for the calling org."""
        qs = self.get_queryset().order_by("created_at")
        total = qs.count()
        invalid = []
        for event in qs.iterator(chunk_size=500):
            if not event.verify_integrity():
                invalid.append(str(event.id))
        return Response(
            {
                "total_events": total,
                "invalid_count": len(invalid),
                "invalid_event_ids": invalid[:100],  # cap at 100 for response size
                "integrity_status": "valid" if not invalid else "corrupted",
            }
        )
