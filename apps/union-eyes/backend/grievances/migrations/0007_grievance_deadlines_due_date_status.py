"""grievance_deadlines.due_date / status for the deadline engine (Phase 3A release qualification).

The reminder worker, the overdue cron and assignment convergence read ``due_date`` and ``status``; the live table built from
the Django lineage lacked both (the confirmation columns from the historical SQL lineage were present, these two were not).
Additive and guarded: a database that already has compatible columns is left alone.

Semantics (matches app/api/grievance-deadlines/*/confirmation and lib/services/deadline-confirmation-service.ts):
``due_date`` is the effective due date; for existing rows it is derived as COALESCE(override_due_date, calculated_due_date).
Rows already superseded become ``cancelled`` so the overdue cron and the worker's dispatch revalidation ignore them.
There is no completion marker beyond ``status``; completion paths that need ``completed_at`` stay REQUIRED_LATER and fail
closed (no deadline can become ``completed`` until they are delivered).
Reverse is a no-op: the columns may be owned by another lineage and hold data.
"""
from django.db import migrations, models

from core.migration_ops import AddFieldIfNotExists

BACKFILL = """
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
             AND table_name = 'grievance_deadlines' AND column_name = 'calculated_due_date')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
             AND table_name = 'grievance_deadlines' AND column_name = 'override_due_date') THEN
    UPDATE grievance_deadlines
       SET due_date = COALESCE(override_due_date, calculated_due_date)
     WHERE due_date IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
             AND table_name = 'grievance_deadlines' AND column_name = 'superseded_at') THEN
    UPDATE grievance_deadlines SET status = 'cancelled' WHERE superseded_at IS NOT NULL AND status = 'pending';
  END IF;
END $$;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("grievances", "0006_claim_number_org_scope_and_user_text"),
    ]

    operations = [
        AddFieldIfNotExists(
            model_name="grievancedeadlines",
            name="due_date",
            field=models.DateTimeField(blank=True, null=True),
        ),
        AddFieldIfNotExists(
            model_name="grievancedeadlines",
            name="status",
            field=models.CharField(db_default="pending", default="pending", max_length=50),
        ),
        migrations.RunSQL(sql=BACKFILL, reverse_sql=migrations.RunSQL.noop),
    ]