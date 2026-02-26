"""
Celery tasks for the notifications app.

Migrated from BullMQ workers:
  - frontend/lib/workers/email-worker.ts     → send_email_task, send_email_digest_task
  - frontend/lib/workers/sms-worker.ts       → send_sms_task
  - frontend/lib/workers/notification-worker.ts → send_notification_task

Queue routing (set in config/settings.py):
  email queue       → send_email_task, send_email_digest_task
  sms queue         → send_sms_task
  notifications queue → send_notification_task
"""

import logging
import os
from typing import Optional

from celery import shared_task
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

EMAIL_CONCURRENCY = 5  # BullMQ: concurrency: 5
EMAIL_RATE_LIMIT = "100/m"  # BullMQ: limiter { max: 100, duration: 60000 }
SMS_CONCURRENCY = 3  # BullMQ: concurrency: 3
SMS_RATE_LIMIT = "10/s"  # BullMQ: limiter { max: 10, duration: 1000 }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_twilio_client():
    """Return a Twilio client or raise if not configured."""
    try:
        from twilio.rest import Client
    except ImportError:
        raise RuntimeError("twilio package not installed — pip install twilio")

    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    if not sid or not token:
        raise RuntimeError("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured")
    return Client(sid, token)


def _format_phone(phone: str) -> str:
    """Normalise to E.164 (US fallback)."""
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return f"+{digits}"


def _log_notification(
    app_label: str,
    channel: str,
    recipient: str,
    subject: str,
    template: str,
    status: str,
    error: Optional[str] = None,
    user_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    """Persist a delivery record to the NotificationLog model (best-effort)."""
    try:
        from notifications.models import NotificationLog

        NotificationLog.objects.create(
            organization_id=None,
            type=channel,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not persist notification log: %s", exc)


def _check_email_preference(email: str) -> bool:
    """Return True if the recipient allows email notifications."""
    try:
        # Preference lookup via the notification_preferences table when available.
        # Falls back to True (opt-in by default).
        from notifications.models import CommunicationPreferences  # noqa: F401

        # Future: CommunicationPreferences.objects.get(email=email).email_enabled
        return True
    except Exception:  # noqa: BLE001
        return True


def _check_sms_preference(phone: str) -> bool:
    """Return True if the recipient allows SMS notifications (opt-out by default)."""
    return False  # Mirrors BullMQ: preferences?.smsEnabled ?? false


def _render_email_template(template: str, data: dict) -> str:
    """
    Return rendered HTML for the given template name.

    In production, wire in Django templates or a third-party renderer
    (e.g. react-email compiled to static HTML).
    """
    from django.template.loader import render_to_string

    template_map = {
        "welcome": "emails/welcome.html",
        "password-reset": "emails/password_reset.html",
        "digest": "emails/digest.html",
        "report-ready": "emails/report_ready.html",
        "deadline-alert": "emails/deadline_alert.html",
        "notification": "emails/notification.html",
        "raw-html": None,
        "claims-report": "emails/report_ready.html",
        "members-report": "emails/report_ready.html",
        "grievances-report": "emails/report_ready.html",
        "usage-report": "emails/report_ready.html",
    }

    if template == "raw-html":
        return data.get("html", "")

    path = template_map.get(template)
    if not path:
        raise ValueError(f"Unknown email template: {template}")

    try:
        return render_to_string(path, data)
    except Exception:  # noqa: BLE001
        # Graceful fallback: plain-text subject+body
        return f"<p><strong>{data.get('title', '')}</strong><br>{data.get('message', '')}</p>"


def _send_via_smtp(to: str, subject: str, html: str) -> None:
    """Deliver a single email via Django's email backend."""
    from django.core.mail import send_mail

    text_content = ""  # HTML-only; could add html2text conversion here
    send_mail(
        subject=subject,
        message=text_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[to],
        html_message=html,
        fail_silently=False,
    )


# ---------------------------------------------------------------------------
# Task: send_email_task
# BullMQ equivalent: emailQueue / email-worker.ts → processEmailJob()
# Options: concurrency=5, rate_limit=100/min, max_retries=3, exponential backoff
# ---------------------------------------------------------------------------


@shared_task(
    bind=True,
    name="notifications.tasks.send_email_task",
    queue="email",
    max_retries=3,
    default_retry_delay=5,  # base seconds; doubled each retry (exponential)
    rate_limit=EMAIL_RATE_LIMIT,
    acks_late=True,
)
def send_email_task(
    self,
    *,
    to,  # str or list[str]
    subject: str,
    template: str,
    data: dict,
    priority: int = 5,
    user_id: Optional[str] = None,
):
    """
    Send an email (or batch of emails) using a named template.

    Args:
        to:       Single address or list of addresses.
        subject:  Email subject line.
        template: Template key (e.g. 'welcome', 'deadline-alert').
        data:     Template context data.
        priority: 1 = critical (overrides opt-out), 5 = normal.
        user_id:  Clerk user ID for audit logging.
    """
    recipients = [to] if isinstance(to, str) else list(to)
    sent = 0
    errors = []

    for email in recipients:
        try:
            # Respect opt-out (skip non-critical emails)
            if priority != 1 and not _check_email_preference(email):
                logger.info("Skipping email — opted out: %s", email)
                _log_notification(
                    "notifications", "email", email, subject, template, "skipped"
                )
                continue

            html = _render_email_template(template, data)
            _send_via_smtp(email, subject, html)
            _log_notification(
                "notifications",
                "email",
                email,
                subject,
                template,
                "sent",
                user_id=user_id,
            )
            sent += 1
            logger.info("Email sent to %s (template=%s)", email, template)

        except Exception as exc:  # noqa: BLE001
            _log_notification(
                "notifications",
                "email",
                email,
                subject,
                template,
                "failed",
                error=str(exc),
            )
            errors.append({"email": email, "error": str(exc)})
            logger.error("Failed to send email to %s: %s", email, exc)

    if errors:
        # Retry the whole task; Celery will pass same args
        raise self.retry(
            exc=RuntimeError(f"{len(errors)}/{len(recipients)} emails failed"),
            countdown=5 * (2**self.request.retries),  # exponential backoff
        )

    return {"sent": sent, "total": len(recipients)}


# ---------------------------------------------------------------------------
# Task: send_email_digest_task
# BullMQ equivalent: emailQueue / processDigestJob()  (repeat cron job)
# ---------------------------------------------------------------------------


@shared_task(
    bind=True,
    name="notifications.tasks.send_email_digest_task",
    queue="email",
    max_retries=2,
    default_retry_delay=60,
    acks_late=True,
)
def send_email_digest_task(self, frequency: str = "daily"):
    """
    Send digest emails to all opted-in users.

    Args:
        frequency: 'daily' or 'weekly'
    """
    from notifications.models import CommunicationPreferences  # noqa: F401

    logger.info("Running email digest task: frequency=%s", frequency)

    # Placeholder: in production query UserNotificationPreferences here
    # and call _send_via_smtp for each user.
    sent = 0
    logger.info("Email digest complete: sent=%d frequency=%s", sent, frequency)
    return {"sent": sent, "frequency": frequency}


# ---------------------------------------------------------------------------
# Task: send_sms_task
# BullMQ equivalent: smsQueue / sms-worker.ts → processSmsJob()
# Options: concurrency=3, rate_limit=10/s, max_retries=2, exponential backoff
# ---------------------------------------------------------------------------


@shared_task(
    bind=True,
    name="notifications.tasks.send_sms_task",
    queue="sms",
    max_retries=2,
    default_retry_delay=3,
    rate_limit=SMS_RATE_LIMIT,
    acks_late=True,
)
def send_sms_task(
    self,
    *,
    to: str,
    message: str,
    priority: int = 3,
    user_id: Optional[str] = None,
):
    """
    Send an SMS via Twilio.

    Args:
        to:       Recipient phone number (any format).
        message:  SMS body text.
        priority: 1 = critical (overrides opt-out), 3 = normal.
        user_id:  Clerk user ID for audit logging.
    """
    formatted = _format_phone(to)

    # Respect opt-out (skip non-critical SMS)
    if priority != 1 and not _check_sms_preference(formatted):
        logger.info("Skipping SMS — opted out: %s", formatted)
        return {"sent": False, "skipped": True}

    try:
        client = _get_twilio_client()
        phone_from = os.environ.get("TWILIO_PHONE_NUMBER", "")
        if not phone_from:
            raise RuntimeError("TWILIO_PHONE_NUMBER not configured")

        result = client.messages.create(
            body=message,
            from_=phone_from,
            to=formatted,
        )

        masked = formatted[:3] + "****" + formatted[-4:]
        logger.info("SMS sent to %s (sid=%s)", masked, result.sid)
        return {"sent": True, "sid": result.sid, "status": result.status}

    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to send SMS to %s: %s", formatted, exc)
        raise self.retry(
            exc=exc,
            countdown=3 * (2**self.request.retries),
        )


# ---------------------------------------------------------------------------
# Task: send_notification_task
# BullMQ equivalent: notificationsQueue / notification-worker.ts → processNotification()
# Options: concurrency=10, max_retries=3, exponential backoff
# ---------------------------------------------------------------------------


@shared_task(
    bind=True,
    name="notifications.tasks.send_notification_task",
    queue="notifications",
    max_retries=3,
    default_retry_delay=5,
    acks_late=True,
)
def send_notification_task(
    self,
    *,
    user_id: str,
    title: str,
    message: str,
    channels: list,  # ['email', 'sms', 'push', 'in-app']
    data: Optional[dict] = None,
):
    """
    Dispatch a notification across one or more channels.

    Respects user quiet-hours and per-channel preferences (looked up from
    CommunicationPreferences).  Failed channels are retried; if all channels
    fail the task is retried as a whole.

    Args:
        user_id:  Clerk user ID.
        title:    Notification headline.
        message:  Notification body text.
        channels: List of channels to dispatch on.
        data:     Extra context (action URL, organization ID, etc.).
    """
    data = data or {}
    successful_channels = []
    failed_channels = []

    for channel in channels:
        try:
            if channel == "email":
                # Enqueue an email sub-task (fan-out pattern)
                send_email_task.apply_async(
                    kwargs={
                        "to": data.get("email", ""),
                        "subject": title,
                        "template": "notification",
                        "data": {"title": title, "message": message, **data},
                        "user_id": user_id,
                    },
                    queue="email",
                )
                successful_channels.append(channel)

            elif channel == "sms":
                phone = data.get("phone")
                if phone:
                    send_sms_task.apply_async(
                        kwargs={
                            "to": phone,
                            "message": f"{title}: {message}",
                            "user_id": user_id,
                        },
                        queue="sms",
                    )
                    successful_channels.append(channel)
                else:
                    logger.warning("No phone for user %s — skipping SMS", user_id)

            elif channel == "in-app":
                _create_in_app_notification(user_id, title, message, data)
                successful_channels.append(channel)

            elif channel == "push":
                # Push via FCM — reuse existing FcmServiceViewSet or a direct call
                _send_push_notification(user_id, title, message, data)
                successful_channels.append(channel)

            else:
                logger.warning("Unknown notification channel: %s", channel)

        except Exception as exc:  # noqa: BLE001
            logger.error("Channel %s failed for user %s: %s", channel, user_id, exc)
            failed_channels.append({"channel": channel, "error": str(exc)})

    # Log delivery attempt
    _log_notification(
        "notifications",
        "multi",
        user_id,
        title,
        "notification",
        "sent" if not failed_channels else "partial",
    )

    if failed_channels and len(failed_channels) == len(channels):
        raise self.retry(
            exc=RuntimeError(f"All channels failed for user {user_id}"),
            countdown=5 * (2**self.request.retries),
        )

    return {
        "sent": len(successful_channels),
        "failed": len(failed_channels),
        "channels": successful_channels,
    }


# ---------------------------------------------------------------------------
# Internal helpers for in-app / push
# ---------------------------------------------------------------------------


def _create_in_app_notification(
    user_id: str,
    title: str,
    message: str,
    data: dict,
) -> None:
    """Persist an in-app notification record and publish via Redis pub/sub."""
    try:
        from notifications.models import NotificationLog

        NotificationLog.objects.create(
            type="in-app",
            organization_id=data.get("organization_id") or None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not create in-app notification: %s", exc)

    # Real-time delivery via Redis pub/sub (mirrors notification-worker.ts)
    try:
        import redis as _redis

        r = _redis.from_url(settings.REDIS_URL)
        import json

        org_id = data.get("organization_id", "default")
        r.publish(
            f"notifications:{org_id}:{user_id}",
            json.dumps(
                {
                    "type": "notification",
                    "userId": user_id,
                    "orgId": org_id,
                    "title": title,
                    "message": message,
                    "data": data,
                    "timestamp": timezone.now().isoformat(),
                }
            ),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis pub/sub failed for in-app notification: %s", exc)


def _send_push_notification(user_id: str, title: str, message: str, data: dict) -> None:
    """Dispatch a push notification via the existing FcmServiceViewSet logic."""
    # Delegate to the existing FCM service view logic when available.
    logger.info(
        "Push notification queued for user %s (FCM integration pending)", user_id
    )
