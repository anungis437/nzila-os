"""
WorkflowsTest API ViewSet
Manages workflow definitions and executions for the workflow engine.
Provides CRUD operations and execution lifecycle management.
"""

from core.models import AuditLogs, WorkflowDefinitions, WorkflowExecutions
from core.serializers import WorkflowDefinitionsSerializer, WorkflowExecutionsSerializer
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class WorkflowsTestViewSet(viewsets.ViewSet):
    """
    ViewSet for workflow engine operations.

    Custom endpoints for defining workflows, triggering executions,
    and querying execution status.
    """

    permission_classes = [IsAuthenticated]

    # ------------------------------------------------------------------
    # Workflow Definitions
    # ------------------------------------------------------------------

    def list(self, request):
        """
        List workflow definitions for the user's organization.
        GET /api/services/workflows-test/
        """
        org_id = getattr(request.user, "organization_id", None)
        qs = WorkflowDefinitions.objects.all().order_by("-created_at")
        if org_id:
            qs = qs.filter(organization_id=org_id)
        serializer = WorkflowDefinitionsSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def create_definition(self, request):
        """
        Create a new workflow definition.
        POST /api/services/workflows-test/create_definition/
        """
        try:
            serializer = WorkflowDefinitionsSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                instance = serializer.save()
                AuditLogs.objects.create(
                    action="workflow_definition_created",
                    actor_id=str(request.user.id),
                    entity_type="workflow_definition",
                    entity_id=str(instance.id),
                )
            return Response(
                WorkflowDefinitionsSerializer(instance).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Workflow Executions
    # ------------------------------------------------------------------

    @action(detail=False, methods=["get"])
    def executions(self, request):
        """
        List workflow executions, optionally filtered by ?workflow_definition_id=.
        GET /api/services/workflows-test/executions/
        """
        qs = WorkflowExecutions.objects.all().order_by("-created_at")
        def_id = request.query_params.get("workflow_definition_id")
        if def_id:
            qs = qs.filter(workflow_definition_id=def_id)
        serializer = WorkflowExecutionsSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def trigger_execution(self, request):
        """
        Trigger a new workflow execution.
        POST /api/services/workflows-test/trigger_execution/
        Expects: { "workflowDefinitionId": "<uuid>" }
        """
        try:
            data = request.data
            definition_id = data["workflowDefinitionId"]

            # Validate the definition exists
            try:
                definition = WorkflowDefinitions.objects.get(id=definition_id)
            except WorkflowDefinitions.DoesNotExist:
                return Response(
                    {"error": f"Workflow definition {definition_id} not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            with transaction.atomic():
                execution = WorkflowExecutions.objects.create(
                    workflow_definition=definition,
                )

                AuditLogs.objects.create(
                    action="workflow_execution_triggered",
                    actor_id=str(request.user.id),
                    entity_type="workflow_execution",
                    entity_id=str(execution.id),
                )

            return Response(
                WorkflowExecutionsSerializer(execution).data,
                status=status.HTTP_201_CREATED,
            )
        except KeyError:
            return Response(
                {"error": "workflowDefinitionId is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
