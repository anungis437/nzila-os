"""Redelivery safety of the scheduled billing and notification work.

Celery redelivers a task after a worker dies (acks_late) and these tasks retry after partial
failure, so any scheduled task can run its body twice. This pins what each active task does
when that happens, and fails when a new scheduled task is added without being classified.
"""
import contextlib
import sys
from datetime import date, timedelta
from unittest import mock

from django.conf import settings
from django.test import SimpleTestCase, override_settings

from billing import tasks

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "redelivery"}}

# Every task in CELERY_BEAT_SCHEDULE and what a second execution of it does today.
ACTIVE_TASK_REDELIVERY = {
    "notifications.tasks.send_email_digest_task": "NO_EFFECT: placeholder body sends nothing",
    "core.tasks.cleanup_task": "IDEMPOTENT: deletes files older than a cutoff",
    "billing.tasks.run_billing_scheduler_task": "NO_EFFECT: per-organization processing is a stub that writes nothing",
    "billing.tasks.send_dues_reminders_task": "GUARDED: at most one dispatch per transaction, reminder type and day",
    "billing.tasks.retry_failed_payments_task": "GUARDED: charge reuses one Stripe idempotency key per attempt; charge path unreachable today",
    "compliance_snapshot.capture_daily": "INTERNAL_WRITE: not an external or financial effect",
    "compliance_snapshot.capture_monthly": "INTERNAL_WRITE: not an external or financial effect",
    "compliance_snapshot.capture_quarterly": "INTERNAL_WRITE: not an external or financial effect",
}


@contextlib.contextmanager
def _stripe(fake):
    # Not patch.dict(sys.modules): that restore deletes modules imported meanwhile and breaks
    # class identity for the rest of the test run.
    previous = sys.modules.get("stripe")
    sys.modules["stripe"] = fake
    try:
        yield
    finally:
        if previous is None:
            sys.modules.pop("stripe", None)
        else:
            sys.modules["stripe"] = previous


class ScheduledTaskClassificationTests(SimpleTestCase):
    def test_every_scheduled_task_is_classified(self):
        scheduled = {entry["task"] for entry in settings.CELERY_BEAT_SCHEDULE.values()}
        self.assertEqual(scheduled, set(ACTIVE_TASK_REDELIVERY))


@override_settings(CACHES=LOCMEM)
class DuesReminderRedeliveryTests(SimpleTestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        self.txn = {"id": "txn-1", "member_id": "m-1", "amount": "40.00", "due_date": date(2026, 11, 1)}

    def _dispatch(self):
        send = mock.MagicMock()
        with mock.patch("notifications.tasks.send_notification_task", send):
            outcome = tasks._send_dues_reminder(self.txn, "7day")
        return outcome, send

    def test_a_second_attempt_does_not_send_again(self):
        first, send_first = self._dispatch()
        second, send_second = self._dispatch()
        self.assertEqual(first, tasks.REMINDER_SENT)
        self.assertEqual(second, tasks.REMINDER_ALREADY_SENT)
        send_first.apply_async.assert_called_once()
        send_second.apply_async.assert_not_called()

    def test_a_different_reminder_type_is_not_suppressed(self):
        self._dispatch()
        send = mock.MagicMock()
        with mock.patch("notifications.tasks.send_notification_task", send):
            outcome = tasks._send_dues_reminder(self.txn, "overdue")
        self.assertEqual(outcome, tasks.REMINDER_SENT)

    def test_a_failed_dispatch_releases_the_claim_so_a_retry_can_send(self):
        failing = mock.MagicMock()
        failing.apply_async.side_effect = RuntimeError("broker down")
        with mock.patch("notifications.tasks.send_notification_task", failing):
            self.assertEqual(tasks._send_dues_reminder(self.txn, "7day"), tasks.REMINDER_FAILED)
        outcome, send = self._dispatch()
        self.assertEqual(outcome, tasks.REMINDER_SENT)
        send.apply_async.assert_called_once()

    def test_nothing_is_sent_when_uniqueness_cannot_be_shown(self):
        send = mock.MagicMock()
        with mock.patch("notifications.tasks.send_notification_task", send):
            with mock.patch.object(tasks.cache, "add", return_value=None):
                outcome = tasks._send_dues_reminder(self.txn, "7day")
        self.assertEqual(outcome, tasks.REMINDER_FAILED)
        send.apply_async.assert_not_called()

    def test_the_whole_task_run_twice_dispatches_each_reminder_once(self):
        send = mock.MagicMock()
        today = date.today()
        txns = [{"id": f"t{i}", "member_id": "m", "amount": "1", "due_date": today + timedelta(days=7)} for i in range(3)]

        def due_on(day):
            return txns if day == today + timedelta(days=7) else []

        with mock.patch("notifications.tasks.send_notification_task", send):
            with mock.patch.object(tasks, "_get_transactions_due_on", side_effect=due_on):
                with mock.patch.object(tasks, "_get_overdue_transactions", return_value=[]):
                    first = tasks.send_dues_reminders_task.run()
                    second = tasks.send_dues_reminders_task.run()
        self.assertEqual(first["reminders_sent"], 3)
        self.assertEqual(second["reminders_sent"], 0)
        self.assertEqual(second["reminders_already_sent"], 3)
        self.assertEqual(send.apply_async.call_count, 3)

class PaymentRetryRedeliveryTests(SimpleTestCase):
    def _txn(self, **extra):
        return {"id": "txn-9", "member_id": "m", "amount": "25.00", "metadata": {"failure_count": 1}, **extra}

    def test_the_rows_the_task_actually_reads_cannot_reach_stripe(self):
        # _get_transactions_needing_retry selects id, member_id, amount, metadata only.
        fake_stripe = mock.MagicMock()
        with _stripe(fake_stripe), mock.patch.dict("os.environ", {"STRIPE_SECRET_KEY": "k"}):
            result = tasks._attempt_payment_retry(self._txn())
        self.assertEqual(result["reason"], "missing_payment_method")
        fake_stripe.PaymentIntent.create.assert_not_called()

    def test_a_repeated_attempt_reuses_one_idempotency_key(self):
        fake_stripe = mock.MagicMock()
        fake_stripe.PaymentIntent.create.return_value = mock.MagicMock(status="succeeded", id="pi_1")
        txn = self._txn(payment_method_id="pm_1", stripe_customer_id="cus_1")
        with _stripe(fake_stripe), mock.patch.dict("os.environ", {"STRIPE_SECRET_KEY": "k"}):
            tasks._attempt_payment_retry(txn)
            tasks._attempt_payment_retry(txn)
        keys = [call.kwargs["idempotency_key"] for call in fake_stripe.PaymentIntent.create.call_args_list]
        self.assertEqual(keys, ["dues-retry:txn-9:2", "dues-retry:txn-9:2"])

    def test_the_next_attempt_uses_a_new_key(self):
        fake_stripe = mock.MagicMock()
        fake_stripe.PaymentIntent.create.return_value = mock.MagicMock(status="succeeded", id="pi_1")
        with _stripe(fake_stripe), mock.patch.dict("os.environ", {"STRIPE_SECRET_KEY": "k"}):
            tasks._attempt_payment_retry(self._txn(payment_method_id="pm", stripe_customer_id="c", metadata={"failure_count": 1}))
            tasks._attempt_payment_retry(self._txn(payment_method_id="pm", stripe_customer_id="c", metadata={"failure_count": 2}))
        keys = [call.kwargs["idempotency_key"] for call in fake_stripe.PaymentIntent.create.call_args_list]
        self.assertEqual(len(set(keys)), 2)


class NoEffectTaskTests(SimpleTestCase):
    def test_the_billing_scheduler_stub_writes_nothing(self):
        with mock.patch.object(tasks, "_get_organizations_for_billing", return_value=[{
            "organization_id": "o", "organization_name": "o", "frequency": "monthly", "enabled": True}]):
            result = tasks.run_billing_scheduler_task.run("monthly")
        self.assertEqual(result["successful"], 1)
        self.assertEqual(result["results"][0]["transactions_created"], 0)
        self.assertEqual(result["results"][0]["total_amount"], "0.00")