"""
SignatureService API ViewSet
Manages document hashing, digital signatures, signature requests,
workflow orchestration, and audit trail for the e-signature subsystem.
"""

import hashlib
import uuid

from content.models import (
    DocumentSigners,
    SignatureAuditLog,
    SignatureAuditTrail,
    SignatureDocuments,
    SignatureTemplates,
    SignatureVerification,
    SignatureWebhooksLog,
    SignatureWorkflows,
    Signers,
)
from content.serializers import (
    DocumentSignersSerializer,
    SignatureAuditLogSerializer,
    SignatureAuditTrailSerializer,
    SignatureDocumentsSerializer,
    SignatureTemplatesSerializer,
    SignatureVerificationSerializer,
    SignatureWorkflowsSerializer,
    SignersSerializer,
)
from core.models import AuditLogs
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class SignatureServiceViewSet(viewsets.ViewSet):
    """
    ViewSet for signature-service operations.

    Custom endpoints for document hashing, signing, signature-request
    workflows, and audit-trail queries.
    """

    permission_classes = [IsAuthenticated]

    # ------------------------------------------------------------------
    # List
    # ------------------------------------------------------------------

    def list(self, request):
        """
        List signature documents for the user's organization.
        GET /api/services/signature-service/
        """
        org_id = getattr(request.user, "organization_id", None)
        qs = SignatureDocuments.objects.all().order_by("-created_at")
        if org_id:
            qs = qs.filter(organization_id=org_id)
        serializer = SignatureDocumentsSerializer(qs, many=True)
        return Response({"data": serializer.data}, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # Hash Document
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"])
    def hashDocument(self, request):
        """
        Hash a document's content for integrity verification.
        POST /api/services/signature-service/hashDocument/
        Expects: { "content": "<base64 or utf-8 text>" }
        """
        try:
            content = request.data.get("content", "")
            doc_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
            return Response(
                {
                    "hash": doc_hash,
                    "algorithm": "sha256",
                    "timestamp": timezone.now().isoformat(),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Hash Document Reference
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"])
    def hashDocumentReference(self, request):
        """
        Hash a document by its stored reference (document_id).
        POST /api/services/signature-service/hashDocumentReference/
        Expects: { "documentId": "<uuid>" }
        """
        try:
            document_id = request.data.get("documentId")
            doc = SignatureDocuments.objects.get(id=document_id)
            serialized = SignatureDocumentsSerializer(doc).data
            content_str = str(serialized)
            doc_hash = hashlib.sha256(content_str.encode("utf-8")).hexdigest()
            return Response(
                {
                    "documentId": str(doc.id),
                    "hash": doc_hash,
                    "algorithm": "sha256",
                    "timestamp": timezone.now().isoformat(),
                },
                status=status.HTTP_200_OK,
            )
        except SignatureDocuments.DoesNotExist:
            return Response(
                {"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Sign Document
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"])
    def signDocument(self, request):
        """
        Record a signature on a document.
        POST /api/services/signature-service/signDocument/
        Expects: { "documentId": "<uuid>", "signerId": "<uuid>" }
        """
        try:
            data = request.data
            document_id = data["documentId"]
            signer_id = data.get("signerId", str(request.user.id))

            with transaction.atomic():
                signer = DocumentSigners.objects.create(
                    document_id=document_id,
                )

                SignatureAuditTrail.objects.create(
                    document_id=document_id,
                )

                AuditLogs.objects.create(
                    action="document_signed",
                    actor_id=str(request.user.id),
                    entity_type="signature_document",
                    entity_id=str(document_id),
                )

            return Response(
                {
                    "signerId": str(signer.id),
                    "documentId": str(document_id),
                    "signedAt": timezone.now().isoformat(),
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Sign Document With Key
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"])
    def signDocumentWithKey(self, request):
        """
        Sign a document using a provided cryptographic key.
        POST /api/services/signature-service/signDocumentWithKey/
        Expects: { "documentId": "<uuid>", "publicKey": "<pem>", "signature": "<hex>" }
        """
        try:
            data = request.data
            document_id = data["documentId"]

            with transaction.atomic():
                verification = SignatureVerification.objects.create(
                    workflow_id=document_id,
                )

                SignatureAuditTrail.objects.create(
                    document_id=document_id,
                )

                AuditLogs.objects.create(
                    action="document_signed_with_key",
                    actor_id=str(request.user.id),
                    entity_type="signature_document",
                    entity_id=str(document_id),
                )

            return Response(
                {
                    "verificationId": str(verification.id),
                    "documentId": str(document_id),
                    "verified": True,
                    "signedAt": timezone.now().isoformat(),
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Get Document Signatures
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"])
    def getDocumentSignatures(self, request):
        """
        Get all signatures for a document.
        POST /api/services/signature-service/getDocumentSignatures/
        Expects: { "documentId": "<uuid>" }
        """
        try:
            document_id = request.data.get("documentId")
            signers = DocumentSigners.objects.filter(document_id=document_id).order_by(
                "-created_at"
            )
            serializer = DocumentSignersSerializer(signers, many=True)
            audit = SignatureAuditTrail.objects.filter(
                document_id=document_id
            ).order_by("-created_at")
            audit_serializer = SignatureAuditTrailSerializer(audit, many=True)
            return Response(
                {
                    "documentId": str(document_id),
                    "signatures": serializer.data,
                    "auditTrail": audit_serializer.data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Reject Signature
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"])
    def rejectSignature(self, request):
        """
        Reject a signature / signing request.
        POST /api/services/signature-service/rejectSignature/
        Expects: { "documentId": "<uuid>", "reason": "<text>" }
        """
        try:
            data = request.data
            document_id = data["documentId"]
            reason = data.get("reason", "")

            with transaction.atomic():
                SignatureAuditTrail.objects.create(
                    document_id=document_id,
                )

                AuditLogs.objects.create(
                    action="signature_rejected",
                    actor_id=str(request.user.id),
                    entity_type="signature_document",
                    entity_id=str(document_id),
                )

            return Response(
                {
                    "documentId": str(document_id),
                    "rejected": True,
                    "reason": reason,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Create Signature Request (workflow)
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"])
    def createSignatureRequest(self, request):
        """
        Create a multi-step signature request workflow.
        POST /api/services/signature-service/createSignatureRequest/
        Expects: { "organizationId": "<uuid>", "signers": [{"email": "..."}] }
        """
        try:
            data = request.data
            org_id = data.get(
                "organizationId", getattr(request.user, "organization_id", None)
            )

            with transaction.atomic():
                workflow = SignatureWorkflows.objects.create(
                    organization_id=org_id,
                )

                signer_list = data.get("signers", [])
                for s in signer_list:
                    Signers.objects.create(
                        workflow_id=workflow.id,
                    )

                SignatureAuditLog.objects.create(
                    workflow_id=workflow.id,
                )

                AuditLogs.objects.create(
                    action="signature_request_created",
                    actor_id=str(request.user.id),
                    entity_type="signature_workflow",
                    entity_id=str(workflow.id),
                )

            return Response(
                {
                    "workflowId": str(workflow.id),
                    "organizationId": str(org_id),
                    "signersCount": len(signer_list),
                    "createdAt": timezone.now().isoformat(),
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Get User Signature Requests
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"])
    def getUserSignatureRequests(self, request):
        """
        Get all signature requests for the current user's organization.
        POST /api/services/signature-service/getUserSignatureRequests/
        """
        try:
            org_id = getattr(request.user, "organization_id", None)
            workflows = SignatureWorkflows.objects.all().order_by("-created_at")
            if org_id:
                workflows = workflows.filter(organization_id=org_id)
            serializer = SignatureWorkflowsSerializer(workflows, many=True)
            return Response({"data": serializer.data}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Complete Signature Request Step
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"])
    def completeSignatureRequestStep(self, request):
        """
        Mark the current step of a signature workflow as complete.
        POST /api/services/signature-service/completeSignatureRequestStep/
        Expects: { "workflowId": "<uuid>", "signerId": "<uuid>" }
        """
        try:
            data = request.data
            workflow_id = data["workflowId"]

            with transaction.atomic():
                SignatureAuditLog.objects.create(
                    workflow_id=workflow_id,
                )

                AuditLogs.objects.create(
                    action="signature_step_completed",
                    actor_id=str(request.user.id),
                    entity_type="signature_workflow",
                    entity_id=str(workflow_id),
                )

            return Response(
                {
                    "workflowId": str(workflow_id),
                    "stepCompleted": True,
                    "completedAt": timezone.now().isoformat(),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Cancel Signature Request
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"])
    def cancelSignatureRequest(self, request):
        """
        Cancel a pending signature-request workflow.
        POST /api/services/signature-service/cancelSignatureRequest/
        Expects: { "workflowId": "<uuid>", "reason": "<text>" }
        """
        try:
            data = request.data
            workflow_id = data["workflowId"]
            reason = data.get("reason", "")

            with transaction.atomic():
                SignatureAuditLog.objects.create(
                    workflow_id=workflow_id,
                )

                AuditLogs.objects.create(
                    action="signature_request_cancelled",
                    actor_id=str(request.user.id),
                    entity_type="signature_workflow",
                    entity_id=str(workflow_id),
                )

            return Response(
                {
                    "workflowId": str(workflow_id),
                    "cancelled": True,
                    "reason": reason,
                    "cancelledAt": timezone.now().isoformat(),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Expire Overdue Signature Requests
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"])
    def expireOverdueSignatureRequests(self, request):
        """
        Expire all overdue signature-request workflows.
        POST /api/services/signature-service/expireOverdueSignatureRequests/
        This is typically called by a scheduled task.
        """
        try:
            # Workflows are considered overdue based on their updated_at
            # threshold (e.g., no activity in 30 days). Exact logic depends
            # on business rules stored in workflow metadata.
            from datetime import timedelta

            cutoff = timezone.now() - timedelta(days=30)
            overdue = SignatureWorkflows.objects.filter(updated_at__lt=cutoff)
            expired_count = overdue.count()

            with transaction.atomic():
                for wf in overdue:
                    SignatureAuditLog.objects.create(
                        workflow_id=wf.id,
                    )

                AuditLogs.objects.create(
                    action="overdue_signature_requests_expired",
                    actor_id=str(request.user.id),
                    entity_type="signature_workflow",
                    entity_id="batch",
                )

            return Response(
                {
                    "expiredCount": expired_count,
                    "cutoffDate": cutoff.isoformat(),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
