"""
Celery tasks for the billing app.

Migrated from BullMQ scheduled jobs:
  - frontend/lib/jobs/billing-scheduler.ts      → run_billing_scheduler_task
  - frontend/lib/jobs/dues-reminder-scheduler.ts → send_dues_reminders_task
  - frontend/lib/jobs/failed-payment-retry.ts   → retry_failed_payments_task

Beat schedule (in config/settings.py):
  monthly-billing         crontab(hour=0, minute=0, day_of_month=1)
  weekly-billing          crontab(hour=0, minute=0, day_of_week=1)
  daily-dues-reminders    crontab(hour=9, minute=0)
  daily-failed-payment-retry  crontab(hour=6, minute=0)
"""

import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Literal, Optional

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

BillingFrequency = Literal["monthly", "bi-weekly", "weekly"]


# ---------------------------------------------------------------------------
# Task: run_billing_scheduler_task
# BullMQ equivalent: BillingScheduler.runScheduledBilling() called from cron
# Options: max_retries=2, time_limit=1800 (30 min)
# ---------------------------------------------------------------------------

@shared_task(
    bind=True,
    name="billing.tasks.run_billing_scheduler_task",
    queue="billing",
    max_retries=2,
    default_retry_delay=300,    # 5 minutes between retries
    acks_late=True,
    time_limit=1800,
    soft_time_limit=1680,
)
def run_billing_scheduler_task(self, frequency: BillingFrequency):
    """
    Run automated billing for all organizations of the given billing frequency.

    Mirrors BillingScheduler.runScheduledBilling() in billing-scheduler.ts.

    Args:
        frequency: 'monthly', 'bi-weekly', or 'weekly'
    """
    start_time = timezone.now()
    logger.info("Starting billing scheduler: frequency=%s", frequency)

    result = {
        "frequency": frequency,
        "total_organizations": 0,
        "successful": 0,
        "failed": 0,
        "skipped": 0,
        "results": [],
        "executed_at": start_time.isoformat(),
    }

    try:
        orgs = _get_organizations_for_billing(frequency)
        result["total_organizations"] = len(orgs)
        logger.info("Found %d organizations for %s billing", len(orgs), frequency)

        for org in orgs:
            org_result = _process_org_billing(org, frequency)
            result["results"].append(org_result)

            if org_result.get("skipped"):
                result["skipped"] += 1
            elif org_result.get("success"):
                result["successful"] += 1
            else:
                result["failed"] += 1

        elapsed_ms = int((timezone.now() - start_time).total_seconds() * 1000)
        result["execution_time_ms"] = elapsed_ms

        # Notify admins if any failures
        if result["failed"] > 0:
            _notify_billing_failure(frequency, result)

        logger.info(
            "Billing scheduler complete: freq=%s total=%d ok=%d fail=%d skip=%d elapsed=%dms",
            frequency, result["total_organizations"],
            result["successful"], result["failed"],
            result["skipped"], elapsed_ms,
        )
        return result

    except Exception as exc:  # noqa: BLE001
        logger.error("Billing scheduler failed: frequency=%s error=%s", frequency, exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Task: send_dues_reminders_task
# BullMQ equivalent: DuesReminderScheduler.runReminderJob() called from cron
# Options: runs daily at 09:00 UTC
# ---------------------------------------------------------------------------

@shared_task(
    bind=True,
    name="billing.tasks.send_dues_reminders_task",
    queue="billing",
    max_retries=2,
    default_retry_delay=300,
    acks_late=True,
    time_limit=3600,
    soft_time_limit=3300,
)
def send_dues_reminders_task(self):
    """
    Send dues payment reminders:
      - 7 days before due date
      - 1 day before due date
      - On overdue date

    Mirrors DuesReminderScheduler.runReminderJob() in dues-reminder-scheduler.ts.
    """
    logger.info("Starting dues reminder job")

    result = {
        "total_processed": 0,
        "reminders_sent": 0,
        "reminders_failed": 0,
        "breakdown": {
            "seven_day_reminders": 0,
            "one_day_reminders": 0,
            "overdue_notices": 0,
        },
    }

    try:
        today = date.today()
        seven_days_out = today + timedelta(days=7)
        one_day_out = today + timedelta(days=1)

        # --- 7-day reminders ---
        pending_7day = _get_transactions_due_on(seven_days_out)
        for txn in pending_7day:
            result["total_processed"] += 1
            if _send_dues_reminder(txn, reminder_type="7day"):
                result["reminders_sent"] += 1
                result["breakdown"]["seven_day_reminders"] += 1
            else:
                result["reminders_failed"] += 1

        # --- 1-day reminders ---
        pending_1day = _get_transactions_due_on(one_day_out)
        for txn in pending_1day:
            result["total_processed"] += 1
            if _send_dues_reminder(txn, reminder_type="1day"):
                result["reminders_sent"] += 1
                result["breakdown"]["one_day_reminders"] += 1
            else:
                result["reminders_failed"] += 1

        # --- Overdue notices ---
        overdue = _get_overdue_transactions(cutoff=today)
        for txn in overdue:
            result["total_processed"] += 1
            if _send_dues_reminder(txn, reminder_type="overdue"):
                result["reminders_sent"] += 1
                result["breakdown"]["overdue_notices"] += 1
            else:
                result["reminders_failed"] += 1

        logger.info(
            "Dues reminders complete: processed=%d sent=%d failed=%d",
            result["total_processed"], result["reminders_sent"], result["reminders_failed"],
        )
        return result

    except Exception as exc:  # noqa: BLE001
        logger.error("Dues reminder job failed: %s", exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Task: retry_failed_payments_task
# BullMQ equivalent: FailedPaymentRetryService.runRetryJob() called from cron
# Retry strategy (mirrors TS): Day 0, Day 1, Day 3, Day 7 → admin intervention
# ---------------------------------------------------------------------------

@shared_task(
    bind=True,
    name="billing.tasks.retry_failed_payments_task",
    queue="billing",
    max_retries=1,
    default_retry_delay=60,
    acks_late=True,
    time_limit=1800,
    soft_time_limit=1680,
)
def retry_failed_payments_task(self):
    """
    Retry failed dues payments following the tiered backoff schedule.

    Mirrors FailedPaymentRetryService.runRetryJob() in failed-payment-retry.ts.

    Retry schedule:
      Attempt 1 → immediate
      Attempt 2 → Day 1
      Attempt 3 → Day 3
      Attempt 4 → Day 7
      After 4   → mark for admin intervention
    """
    RETRY_DAYS = {1: 1, 2: 3, 3: 7}   # attempt_number → days_after_failure
    MAX_ATTEMPTS = 4

    logger.info("Starting failed payment retry job")

    result = {
        "total_processed": 0,
        "retries_attempted": 0,
        "retries_succeeded": 0,
        "retries_failed": 0,
        "marked_for_admin": 0,
        "results": [],
    }

    try:
        transactions = _get_transactions_needing_retry()
        result["total_processed"] = len(transactions)
        logger.info("Found %d transactions needing retry", len(transactions))

        for txn in transactions:
            metadata = txn.get("metadata", {}) or {}
            failure_count = int(metadata.get("failure_count", 0))
            last_failure = metadata.get("last_failure_date")

            should_retry = _should_retry_payment(failure_count, last_failure, RETRY_DAYS, MAX_ATTEMPTS)

            if not should_retry["retry"]:
                if should_retry.get("max_attempts_reached"):
                    _mark_for_admin_intervention(txn["id"], failure_count)
                    result["marked_for_admin"] += 1
                    result["results"].append({
                        "transaction_id": txn["id"],
                        "member_id": txn.get("member_id"),
                        "attempt_number": failure_count,
                        "result": "max_attempts",
                    })
                continue

            result["retries_attempted"] += 1
            try:
                retry_result = _attempt_payment_retry(txn)
                if retry_result["success"]:
                    result["retries_succeeded"] += 1
                else:
                    result["retries_failed"] += 1

                result["results"].append({
                    "transaction_id": txn["id"],
                    "member_id": txn.get("member_id"),
                    "attempt_number": failure_count + 1,
                    "result": "retried",
                    **retry_result,
                })
            except Exception as exc:  # noqa: BLE001
                result["retries_failed"] += 1
                result["results"].append({
                    "transaction_id": txn["id"],
                    "member_id": txn.get("member_id"),
                    "attempt_number": failure_count + 1,
                    "result": "error",
                    "error": str(exc),
                })

        logger.info(
            "Failed payment retry complete: processed=%d attempted=%d succeeded=%d admin=%d",
            result["total_processed"], result["retries_attempted"],
            result["retries_succeeded"], result["marked_for_admin"],
        )
        return result

    except Exception as exc:  # noqa: BLE001
        logger.error("Failed payment retry job error: %s", exc)
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Internal helpers  (stubs — wire to real DB models as they become available)
# ---------------------------------------------------------------------------

def _get_organizations_for_billing(frequency: BillingFrequency) -> list[dict]:
    """Return a list of org dicts configured for this billing frequency."""
    try:
        from billing.models import OrganizationBillingConfigs

        qs = OrganizationBillingConfigs.objects.filter(billing_frequency=frequency)
        return [
            {
                "organization_id": str(obj.id),
                "organization_name": str(obj.id),
                "frequency": frequency,
                "enabled": True,
            }
            for obj in qs
        ]
    except Exception:  # noqa: BLE001
        return []


def _process_org_billing(org: dict, frequency: BillingFrequency) -> dict:
    """Process a billing cycle for one organization. Returns a result dict."""
    if not org.get("enabled"):
        return {**org, "success": True, "skipped": True,
                "error": "Billing disabled for this organization"}

    try:
        # Wire in BillingCycleService when available in billing/services.py
        logger.info(
            "Processing billing: org=%s frequency=%s",
            org["organization_id"], frequency,
        )
        return {
            "organization_id": org["organization_id"],
            "organization_name": org["organization_name"],
            "success": True,
            "transactions_created": 0,
            "total_amount": "0.00",
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("Billing failed for org %s: %s", org["organization_id"], exc)
        return {
            "organization_id": org["organization_id"],
            "organization_name": org["organization_name"],
            "success": False,
            "error": str(exc),
        }


def _notify_billing_failure(frequency: str, result: dict) -> None:
    """Notify admins that some billing cycles failed."""
    try:
        from notifications.tasks import send_notification_task

        send_notification_task.apply_async(
            kwargs={
                "user_id": "system",
                "title": f"Billing scheduler failures — {frequency}",
                "message": (
                    f"{result['failed']} of {result['total_organizations']} "
                    f"organizations failed billing."
                ),
                "channels": ["email"],
            },
            queue="notifications",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not send billing failure notification: %s", exc)


def _get_transactions_due_on(due_date: date) -> list[dict]:
    """Return pending transactions due on the given date."""
    try:
        from django.db import connection

        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT id, member_id, amount, due_date
                FROM   dues_transactions
                WHERE  status   = 'pending'
                  AND  due_date = %s
                """,
                [due_date],
            )
            cols = [c.name for c in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    except Exception:  # noqa: BLE001
        return []


def _get_overdue_transactions(cutoff: date) -> list[dict]:
    """Return transactions that passed their due date and are still unpaid."""
    try:
        from django.db import connection

        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT id, member_id, amount, due_date
                FROM   dues_transactions
                WHERE  status   IN ('pending', 'overdue')
                  AND  due_date < %s
                """,
                [cutoff],
            )
            cols = [c.name for c in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    except Exception:  # noqa: BLE001
        return []


def _send_dues_reminder(txn: dict, reminder_type: str) -> bool:
    """Dispatch a dues reminder notification for a transaction."""
    try:
        from notifications.tasks import send_notification_task

        titles = {
            "7day":   "Dues Payment Due in 7 Days",
            "1day":   "Dues Payment Due Tomorrow",
            "overdue": "Dues Payment Overdue",
        }

        send_notification_task.apply_async(
            kwargs={
                "user_id": str(txn.get("member_id", "")),
                "title":   titles.get(reminder_type, "Dues Reminder"),
                "message": (
                    f"Your dues payment of ${txn.get('amount', '0.00')} "
                    f"is {'overdue' if reminder_type == 'overdue' else f'due {txn.get(\"due_date\", \"soon\")}'}."
                ),
                "channels": ["email", "in-app"],
                "data": {
                    "transaction_id": str(txn.get("id", "")),
                    "reminder_type":  reminder_type,
                    "due_date":       str(txn.get("due_date", "")),
                },
            },
            queue="notifications",
        )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to send dues reminder: txn=%s error=%s", txn.get("id"), exc)
        return False


def _get_transactions_needing_retry() -> list[dict]:
    """Return failed/overdue transactions that are eligible for payment retry."""
    try:
        from django.db import connection

        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT id, member_id, amount, metadata
                FROM   dues_transactions
                WHERE  status IN ('failed', 'overdue')
                  AND  (
                        metadata->>'failure_count' IS NULL
                    OR  (metadata->>'failure_count')::int < 4
                  )
                """
            )
            cols = [c.name for c in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    except Exception:  # noqa: BLE001
        return []


def _should_retry_payment(
    failure_count: int,
    last_failure_date: Optional[str],
    retry_days: dict,
    max_attempts: int,
) -> dict:
    """Return {'retry': bool, 'max_attempts_reached': bool}."""
    if failure_count >= max_attempts:
        return {"retry": False, "max_attempts_reached": True}

    if failure_count == 0:
        return {"retry": True}

    if not last_failure_date:
        return {"retry": True}

    from datetime import datetime

    try:
        last = datetime.fromisoformat(last_failure_date).date()
    except ValueError:
        return {"retry": True}

    days_required = retry_days.get(failure_count, 7)
    return {"retry": (date.today() - last).days >= days_required}


def _attempt_payment_retry(txn: dict) -> dict:
    """
    Attempt to charge the payment method on file via Stripe.

    Requires STRIPE_SECRET_KEY in the environment.
    Uses the payment_method stored on the dues_transaction.
    """
    import os

    stripe_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe_key:
        logger.warning("STRIPE_SECRET_KEY not configured — payment retry skipped for %s", txn.get("id"))
        return {"success": False, "reason": "payment_processor_not_configured"}

    try:
        import stripe

        stripe.api_key = stripe_key
        amount_cents = int(float(txn.get("amount", 0)) * 100)
        currency = txn.get("currency", "cad").lower()
        payment_method = txn.get("payment_method_id") or txn.get("stripe_payment_method_id")
        customer_id = txn.get("stripe_customer_id")

        if not payment_method or not customer_id:
            logger.warning("Transaction %s missing payment_method or customer — cannot retry", txn.get("id"))
            return {"success": False, "reason": "missing_payment_method"}

        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=currency,
            customer=customer_id,
            payment_method=payment_method,
            confirm=True,
            off_session=True,
            metadata={
                "transaction_id": str(txn.get("id", "")),
                "retry": "true",
            },
        )

        if intent.status in ("succeeded", "requires_capture"):
            logger.info("Payment retry succeeded for transaction %s (intent %s)", txn.get("id"), intent.id)
            return {"success": True, "payment_intent_id": intent.id}

        logger.warning("Payment retry intent status=%s for transaction %s", intent.status, txn.get("id"))
        return {"success": False, "reason": f"intent_status_{intent.status}", "payment_intent_id": intent.id}

    except Exception as exc:  # noqa: BLE001
        logger.error("Payment retry failed for transaction %s: %s", txn.get("id"), exc)
        return {"success": False, "reason": str(exc)}


def _mark_for_admin_intervention(transaction_id: str, failure_count: int) -> None:
    """Flag a transaction as requiring manual admin action."""
    try:
        from django.db import connection

        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE dues_transactions
                SET    status    = 'admin_required',
                       updated_at = NOW()
                WHERE  id = %s
                """,
                [transaction_id],
            )
        logger.warning(
            "Transaction %s marked for admin intervention after %d failures",
            transaction_id, failure_count,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Could not mark transaction %s for admin: %s", transaction_id, exc
        )
