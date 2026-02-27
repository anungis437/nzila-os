"""
TwilioSmsServiceViewSet
Generated from service: twilio-sms-service
Auto-generated: 2026-02-18 09:08
"""

import logging
import re
import uuid

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import CursorPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)
from core.models import AuditLogs
from notifications.models import (
    SmsCampaignRecipients,
    SmsCampaigns,
    SmsConversations,
    SmsMessages,
    SmsOptOuts,
    SmsRateLimits,
    SmsTemplates,
)


class TwilioSmsServicePagination(CursorPagination):
    page_size = 50
    ordering = "-created_at"
    cursor_query_param = "cursor"


class TwilioSmsServiceViewSet(viewsets.ViewSet):
    """
        ViewSet for twilio-sms-service operations.

        Endpoints:
        - POST /api/services/twilio-sms-service/send/ — Send a single SMS
    - POST /api/services/twilio-sms-service/send_bulk/ — Send bulk SMS campaign
    - GET /api/services/twilio-sms-service/templates/ — List SMS templates
    - POST /api/services/twilio-sms-service/create_template/ — Create SMS template
    - GET /api/services/twilio-sms-service/opt_outs/ — List SMS opt-outs
    - POST /api/services/twilio-sms-service/handle_opt_out/ — Handle opt-out request
    - GET /api/services/twilio-sms-service/conversations/ — List SMS conversations
    - GET /api/services/twilio-sms-service/message_history/ — Get SMS message history
    - POST /api/services/twilio-sms-service/validate_phone/ — Validate phone number format
    - GET /api/services/twilio-sms-service/rate_limits/ — Get SMS rate limit status
    - POST /api/services/twilio-sms-service/webhook/ — Handle Twilio inbound webhook
    - GET /api/services/twilio-sms-service/campaign_status/ — Get campaign delivery status
    """

    permission_classes = [IsAuthenticated]
    pagination_class = TwilioSmsServicePagination

    def paginate_queryset(self, queryset):
        paginator = self.pagination_class()
        return paginator.paginate_queryset(queryset, self.request, view=self)

    def get_paginated_response(self, data):
        paginator = self.pagination_class()
        # Reconstruct paginated response
        return Response(
            {
                "count": len(data),
                "results": data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"])
    def send(self, request):
        """
        Send a single SMS
        POST /api/services/twilio-sms-service/send/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SmsMessages.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"},
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="send",
                    resource_type="SmsMessages",
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response(
                {
                    "id": str(obj.id),
                    "created_at": obj.created_at.isoformat(),
                    "status": "success",
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "send",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def send_bulk(self, request):
        """
        Send bulk SMS campaign
        POST /api/services/twilio-sms-service/send_bulk/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SmsCampaigns.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"},
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="send_bulk",
                    resource_type="SmsCampaigns",
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response(
                {
                    "id": str(obj.id),
                    "created_at": obj.created_at.isoformat(),
                    "status": "success",
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "send_bulk",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def templates(self, request):
        """
        List SMS templates
        GET /api/services/twilio-sms-service/templates/
        """
        try:
            queryset = SmsTemplates.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
            for param in ["status", "type", "created_after", "created_before"]:
                val = request.query_params.get(param)
                if val:
                    if param == "created_after":
                        queryset = queryset.filter(created_at__gte=val)
                    elif param == "created_before":
                        queryset = queryset.filter(created_at__lte=val)
                    else:
                        queryset = queryset.filter(**{param: val})

            page = self.paginate_queryset(queryset.order_by("-created_at"))
            if page is not None:
                data = list(page.values())
                return self.get_paginated_response(data)

            return Response(
                {
                    "count": queryset.count(),
                    "results": list(queryset.order_by("-created_at").values()[:100]),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "templates",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def create_template(self, request):
        """
        Create SMS template
        POST /api/services/twilio-sms-service/create_template/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SmsTemplates.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"},
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="create_template",
                    resource_type="SmsTemplates",
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response(
                {
                    "id": str(obj.id),
                    "created_at": obj.created_at.isoformat(),
                    "status": "success",
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "create_template",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def opt_outs(self, request):
        """
        List SMS opt-outs
        GET /api/services/twilio-sms-service/opt_outs/
        """
        try:
            queryset = SmsOptOuts.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
            for param in ["status", "type", "created_after", "created_before"]:
                val = request.query_params.get(param)
                if val:
                    if param == "created_after":
                        queryset = queryset.filter(created_at__gte=val)
                    elif param == "created_before":
                        queryset = queryset.filter(created_at__lte=val)
                    else:
                        queryset = queryset.filter(**{param: val})

            page = self.paginate_queryset(queryset.order_by("-created_at"))
            if page is not None:
                data = list(page.values())
                return self.get_paginated_response(data)

            return Response(
                {
                    "count": queryset.count(),
                    "results": list(queryset.order_by("-created_at").values()[:100]),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "opt_outs",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def handle_opt_out(self, request):
        """
        Handle opt-out request
        POST /api/services/twilio-sms-service/handle_opt_out/
        """
        try:
            data = request.data
            with transaction.atomic():
                obj = SmsOptOuts.objects.create(
                    organization_id=request.user.organization_id,
                    **{k: v for k, v in data.items() if k != "organization_id"},
                )
                AuditLogs.objects.create(
                    organization_id=request.user.organization_id,
                    action="handle_opt_out",
                    resource_type="SmsOptOuts",
                    resource_id=str(obj.id),
                    user_id=str(request.user.id),
                    details=data,
                )
            return Response(
                {
                    "id": str(obj.id),
                    "created_at": obj.created_at.isoformat(),
                    "status": "success",
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "handle_opt_out",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def conversations(self, request):
        """
        List SMS conversations
        GET /api/services/twilio-sms-service/conversations/
        """
        try:
            queryset = SmsConversations.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
            for param in ["status", "type", "created_after", "created_before"]:
                val = request.query_params.get(param)
                if val:
                    if param == "created_after":
                        queryset = queryset.filter(created_at__gte=val)
                    elif param == "created_before":
                        queryset = queryset.filter(created_at__lte=val)
                    else:
                        queryset = queryset.filter(**{param: val})

            page = self.paginate_queryset(queryset.order_by("-created_at"))
            if page is not None:
                data = list(page.values())
                return self.get_paginated_response(data)

            return Response(
                {
                    "count": queryset.count(),
                    "results": list(queryset.order_by("-created_at").values()[:100]),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "conversations",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def message_history(self, request):
        """
        Get SMS message history
        GET /api/services/twilio-sms-service/message_history/
        """
        try:
            queryset = SmsMessages.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
            for param in ["status", "type", "created_after", "created_before"]:
                val = request.query_params.get(param)
                if val:
                    if param == "created_after":
                        queryset = queryset.filter(created_at__gte=val)
                    elif param == "created_before":
                        queryset = queryset.filter(created_at__lte=val)
                    else:
                        queryset = queryset.filter(**{param: val})

            page = self.paginate_queryset(queryset.order_by("-created_at"))
            if page is not None:
                data = list(page.values())
                return self.get_paginated_response(data)

            return Response(
                {
                    "count": queryset.count(),
                    "results": list(queryset.order_by("-created_at").values()[:100]),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "message_history",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def validate_phone(self, request):
        """
        Validate phone number format.
        Required fields: phone_number.
        Validates E.164 format with special support for North American numbers.
        """
        try:
            data = request.data
            phone = data.get("phone_number", "").strip()

            if not phone:
                return Response(
                    {"error": "phone_number is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Strip common formatting characters
            cleaned = re.sub(r"[\s\-\(\)\.]", "", phone)

            # Add +1 for bare 10-digit North American numbers
            if re.match(r"^\d{10}$", cleaned):
                cleaned = "+1" + cleaned
            elif re.match(r"^1\d{10}$", cleaned):
                cleaned = "+" + cleaned
            elif not cleaned.startswith("+"):
                cleaned = "+" + cleaned

            # Validate E.164 format: +[country code][subscriber number] (max 15 digits)
            e164_pattern = re.compile(r"^\+[1-9]\d{1,14}$")
            is_valid = bool(e164_pattern.match(cleaned))

            # Detect country
            is_canadian = cleaned.startswith("+1") and len(cleaned) == 12
            country = (
                "CA"
                if is_canadian
                else (
                    "US" if cleaned.startswith("+1") and len(cleaned) == 12 else "other"
                )
            )

            # Check opt-out status if valid
            opted_out = False
            if is_valid:
                opted_out = SmsOptOuts.objects.filter(
                    organization_id=request.user.organization_id,
                    phone_number=cleaned,
                ).exists()

            return Response(
                {
                    "status": "success",
                    "original": phone,
                    "normalized": cleaned,
                    "valid": is_valid,
                    "country": country if is_valid else None,
                    "opted_out": opted_out,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "validate_phone",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def rate_limits(self, request):
        """
        Get SMS rate limit status
        GET /api/services/twilio-sms-service/rate_limits/
        """
        try:
            queryset = SmsRateLimits.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
            for param in ["status", "type", "created_after", "created_before"]:
                val = request.query_params.get(param)
                if val:
                    if param == "created_after":
                        queryset = queryset.filter(created_at__gte=val)
                    elif param == "created_before":
                        queryset = queryset.filter(created_at__lte=val)
                    else:
                        queryset = queryset.filter(**{param: val})

            page = self.paginate_queryset(queryset.order_by("-created_at"))
            if page is not None:
                data = list(page.values())
                return self.get_paginated_response(data)

            return Response(
                {
                    "count": queryset.count(),
                    "results": list(queryset.order_by("-created_at").values()[:100]),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "rate_limits",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"])
    def webhook(self, request):
        """
        Handle Twilio inbound webhook.
        Processes incoming SMS messages from Twilio.
        Expected Twilio fields: From, To, Body, MessageSid, AccountSid.
        """
        try:
            data = request.data
            org_id = request.user.organization_id

            from_number = data.get("From", "")
            to_number = data.get("To", "")
            body = data.get("Body", "")
            message_sid = data.get("MessageSid", "")

            if not from_number or not body:
                return Response(
                    {"error": "From and Body are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check if sender is opted out
            if SmsOptOuts.objects.filter(
                organization_id=org_id,
                phone_number=from_number,
            ).exists():
                logger.info(f"Inbound SMS from opted-out number {from_number}, ignored")
                return Response({"status": "opted_out"}, status=status.HTTP_200_OK)

            # Handle opt-out keywords
            opt_out_keywords = {"stop", "unsubscribe", "cancel", "quit", "end"}
            if body.strip().lower() in opt_out_keywords:
                with transaction.atomic():
                    SmsOptOuts.objects.get_or_create(
                        organization_id=org_id,
                        phone_number=from_number,
                        defaults={"opted_out_at": timezone.now()},
                    )
                    AuditLogs.objects.create(
                        organization_id=org_id,
                        action="sms_opt_out",
                        resource_type="SmsOptOuts",
                        resource_id=from_number,
                        user_id="system",
                        details={"from": from_number, "keyword": body.strip().lower()},
                    )
                return Response(
                    {"status": "opted_out_processed"}, status=status.HTTP_200_OK
                )

            with transaction.atomic():
                # Find or create conversation
                conversation, _ = SmsConversations.objects.get_or_create(
                    organization_id=org_id,
                    phone_number=from_number,
                    defaults={"status": "active"},
                )

                # Record the message
                msg = SmsMessages.objects.create(
                    organization_id=org_id,
                    conversation=conversation,
                    direction="inbound",
                    from_number=from_number,
                    to_number=to_number,
                    body=body,
                    external_id=message_sid,
                    status="received",
                )

                AuditLogs.objects.create(
                    organization_id=org_id,
                    action="webhook_inbound_sms",
                    resource_type="SmsMessages",
                    resource_id=str(msg.id),
                    user_id="system",
                    details={
                        "from": from_number,
                        "to": to_number,
                        "message_sid": message_sid,
                    },
                )

            return Response(
                {
                    "status": "success",
                    "message_id": str(msg.id),
                    "conversation_id": str(conversation.id),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.exception("webhook processing failed")
            return Response(
                {
                    "error": str(e),
                    "action": "webhook",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def campaign_status(self, request):
        """
        Get campaign delivery status
        GET /api/services/twilio-sms-service/campaign_status/
        """
        try:
            queryset = SmsCampaigns.objects.filter(
                organization_id=request.user.organization_id
            )
            # Apply filters from query params
            for param in ["status", "type", "created_after", "created_before"]:
                val = request.query_params.get(param)
                if val:
                    if param == "created_after":
                        queryset = queryset.filter(created_at__gte=val)
                    elif param == "created_before":
                        queryset = queryset.filter(created_at__lte=val)
                    else:
                        queryset = queryset.filter(**{param: val})

            page = self.paginate_queryset(queryset.order_by("-created_at"))
            if page is not None:
                data = list(page.values())
                return self.get_paginated_response(data)

            return Response(
                {
                    "count": queryset.count(),
                    "results": list(queryset.order_by("-created_at").values()[:100]),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "error": str(e),
                    "action": "campaign_status",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
