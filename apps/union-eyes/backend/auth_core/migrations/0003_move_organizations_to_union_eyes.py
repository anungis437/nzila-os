# Phase 0B.2 — Section 8 (foundational UE table migration).
#
# Move the Union-Eyes-owned ``organizations`` table from the ``public`` schema
# into the ``union_eyes`` schema, preserving all rows.
#
# Cross-references:
#   * reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-foundational-slice.md
#   * reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-django-schema-strategy.md
#   * packages/db/schema-ownership-manifest.json (organizations → UNION_EYES_OWNED_SHARED,
#     target_schema=union_eyes)
#
# Idempotency: the SQL guards every DDL statement with information_schema
# lookups so a second run against a database that already reflects the target
# state is a no-op. Row-count validation is performed inside PL/pgSQL and
# raises if any rows are lost during the move.
#
# The ``AlterModelTable`` operation is state-only via ``SeparateDatabaseAndState``
# because the actual table move is handled by the ``RunSQL`` block; without
# ``state_operations`` Django would attempt to ``ALTER TABLE`` the model on
# subsequent migrations and produce a phantom rename.

from django.db import migrations

FORWARD_SQL = r"""
DO $phase0b2_move_organizations$
DECLARE
    v_row_count_before BIGINT;
    v_row_count_after BIGINT;
    v_exists_public BOOLEAN;
    v_exists_union_eyes BOOLEAN;
BEGIN
    -- Ensure the target schema exists (first-op guarantee for the whole
    -- Union-Eyes-owned schema tree).
    CREATE SCHEMA IF NOT EXISTS union_eyes;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'organizations'
    ) INTO v_exists_public;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'union_eyes' AND table_name = 'organizations'
    ) INTO v_exists_union_eyes;

    IF v_exists_public AND v_exists_union_eyes THEN
        RAISE EXCEPTION
            'Phase 0B.2 §8 aborted: organizations exists in BOTH public and '
            'union_eyes schemas. Manual reconciliation required.';
    END IF;

    IF v_exists_union_eyes AND NOT v_exists_public THEN
        RAISE NOTICE
            'Phase 0B.2 §8: union_eyes.organizations already present; '
            'schema move is a no-op.';
        RETURN;
    END IF;

    -- v_exists_public = TRUE, v_exists_union_eyes = FALSE: do the move.
    EXECUTE 'SELECT COUNT(*) FROM public.organizations' INTO v_row_count_before;

    RAISE NOTICE
        'Phase 0B.2 §8: moving public.organizations -> union_eyes.organizations '
        '(% rows).',
        v_row_count_before;

    ALTER TABLE public.organizations SET SCHEMA union_eyes;

    EXECUTE 'SELECT COUNT(*) FROM union_eyes.organizations' INTO v_row_count_after;

    IF v_row_count_before <> v_row_count_after THEN
        RAISE EXCEPTION
            'Phase 0B.2 §8 row-count mismatch: before=%, after=%.',
            v_row_count_before, v_row_count_after;
    END IF;

    RAISE NOTICE
        'Phase 0B.2 §8: schema move verified (% rows preserved).',
        v_row_count_after;
END
$phase0b2_move_organizations$;
"""


REVERSE_SQL = r"""
DO $phase0b2_move_organizations_reverse$
DECLARE
    v_exists_public BOOLEAN;
    v_exists_union_eyes BOOLEAN;
    v_row_count_before BIGINT;
    v_row_count_after BIGINT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'organizations'
    ) INTO v_exists_public;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'union_eyes' AND table_name = 'organizations'
    ) INTO v_exists_union_eyes;

    IF v_exists_public AND NOT v_exists_union_eyes THEN
        RAISE NOTICE
            'Phase 0B.2 §8 reverse: public.organizations already present; '
            'reverse is a no-op.';
        RETURN;
    END IF;

    IF NOT v_exists_union_eyes THEN
        RAISE EXCEPTION
            'Phase 0B.2 §8 reverse aborted: union_eyes.organizations not '
            'found. Refusing to reverse a non-existent move.';
    END IF;

    EXECUTE 'SELECT COUNT(*) FROM union_eyes.organizations' INTO v_row_count_before;

    ALTER TABLE union_eyes.organizations SET SCHEMA public;

    EXECUTE 'SELECT COUNT(*) FROM public.organizations' INTO v_row_count_after;

    IF v_row_count_before <> v_row_count_after THEN
        RAISE EXCEPTION
            'Phase 0B.2 §8 reverse row-count mismatch: before=%, after=%.',
            v_row_count_before, v_row_count_after;
    END IF;
END
$phase0b2_move_organizations_reverse$;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("auth_core", "0002_add_clerk_organization_id"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=FORWARD_SQL,
                    reverse_sql=REVERSE_SQL,
                ),
            ],
            state_operations=[
                migrations.AlterModelTable(
                    name="organizations",
                    # Django quotes each dotted component; embedding the
                    # closing-quote/dot/opening-quote sequence produces the
                    # expected ``"union_eyes"."organizations"`` in generated SQL.
                    table='union_eyes"."organizations',
                ),
            ],
        ),
    ]
