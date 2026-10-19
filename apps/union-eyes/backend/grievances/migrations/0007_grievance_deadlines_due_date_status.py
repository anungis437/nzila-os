"""grievance_deadlines.due_date / status for the deadline engine (Phase 3A release qualification).

The reminder worker, the overdue cron and assignment convergence read ``due_date`` and ``status``; the live table built from
the Django lineage lacked both (the confirmation columns from the historical SQL lineage were present, these two were not).
Additive and guarded: a database that already has equivalent columns is left alone (see core.migration_ops).

Semantics (lib/deadline-engine/deadline-semantics.ts; app/api/grievance-deadlines/*/confirmation; deadline-confirmation-service):
``due_date`` is the effective due date. ``override_due_date`` is the confirmed date when a human overrode the calculation and
``calculated_due_date`` is the original system calculation. Two invariants hold for every writer:

* I1  override_due_date IS NOT NULL  =>  due_date = override_due_date
* I2  superseded_at IS NOT NULL      =>  status IN ('completed', 'cancelled')

The migration (1) converges any existing rows to the invariants (due_date from the override, else from the calculation when
it is missing; superseded rows become ``cancelled`` unless already ``completed``) and (2) installs CHECK constraints so a
writer that forgets an invariant fails closed instead of leaving a stale duplicate. The constraints are installed only when
the lineage columns they reference exist (a Django-first database has no override/superseded columns), are idempotent, and
the backfill/constraints are not tracked in the Django state (like the lineage columns they protect).
There is no completion marker beyond ``status``; completion paths that need ``completed_at`` stay REQUIRED_LATER and fail
closed (no deadline can become ``completed`` until they are delivered).
Reverse is a no-op: the columns and constraints may be owned by another lineage and hold data.
"""
from django.db import migrations, models

from core.migration_ops import AddFieldIfNotExists

CONVERGE_AND_GUARD = """
DO $$
DECLARE
  v_tbl regclass := to_regclass(current_schema() || '.grievance_deadlines');
  v_has_calc boolean;
  v_has_override boolean;
  v_has_superseded boolean;
BEGIN
  IF v_tbl IS NULL THEN
    RETURN;
  END IF;
  SELECT bool_or(attname = 'calculated_due_date'), bool_or(attname = 'override_due_date'), bool_or(attname = 'superseded_at')
    INTO v_has_calc, v_has_override, v_has_superseded
    FROM pg_attribute WHERE attrelid = v_tbl AND attnum > 0 AND NOT attisdropped;

  IF v_has_override THEN
    UPDATE grievance_deadlines SET due_date = override_due_date
     WHERE override_due_date IS NOT NULL AND due_date IS DISTINCT FROM override_due_date;
  END IF;
  IF v_has_calc THEN
    UPDATE grievance_deadlines SET due_date = calculated_due_date
     WHERE due_date IS NULL AND calculated_due_date IS NOT NULL;
  END IF;
  IF v_has_superseded THEN
    UPDATE grievance_deadlines SET status = 'cancelled'
     WHERE superseded_at IS NOT NULL AND status NOT IN ('completed', 'cancelled');
  END IF;

  -- The UPDATEs above queue deferred foreign-key trigger events (Django declares FKs DEFERRABLE INITIALLY DEFERRED); ALTER TABLE
  -- is refused while they are pending ("cannot ALTER TABLE ... because it has pending trigger events"). Fire them now.
  SET CONSTRAINTS ALL IMMEDIATE;

  IF v_has_override AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = v_tbl AND conname = 'grievance_deadlines_override_is_effective'
  ) THEN
    ALTER TABLE grievance_deadlines ADD CONSTRAINT grievance_deadlines_override_is_effective
      CHECK (override_due_date IS NULL OR due_date IS NOT DISTINCT FROM override_due_date);
  END IF;
  IF v_has_superseded AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = v_tbl AND conname = 'grievance_deadlines_superseded_is_terminal'
  ) THEN
    ALTER TABLE grievance_deadlines ADD CONSTRAINT grievance_deadlines_superseded_is_terminal
      CHECK (superseded_at IS NULL OR status IN ('completed', 'cancelled'));
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
        migrations.RunSQL(sql=CONVERGE_AND_GUARD, reverse_sql=migrations.RunSQL.noop),
    ]