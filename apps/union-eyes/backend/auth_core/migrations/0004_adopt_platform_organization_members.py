# Phase 0B.2 §9 — Django adoption of the ``organization_members`` table.
#
# CORRECTED (Phase 0B.2R §4, 2026-07-23):
#   Original comment claimed the platform is the DDL owner. Ownership review
#   found NO platform DDL in packages/db/. The real DDL owner is the
#   union-eyes app itself:
#       * Drizzle:    apps/union-eyes/db/schema-organizations.ts (organizationMembers)
#       * Django:     apps/union-eyes/backend/auth_core/models.py (OrganizationMembers)
#       * Migrations: auth_core/0001_initial.py CreateModel (db_table="organization_members")
#                     auth_core/0004_adopt_platform_organization_members.py (this file)
#
#   The ownership manifest (packages/db/schema-ownership-manifest.json) now
#   classifies this table as ``UNION_EYES_OWNED_SHARED``. The filename retains
#   the historical ``adopt_platform_`` prefix because the migration has
#   already been applied to live databases; renaming it would require
#   coordinated DB state fixes that are out of Phase 0B.2R scope.
#
# What this migration actually does (unchanged behaviour):
#   The Django Meta on ``OrganizationMembers`` sets ``db_table`` to the
#   schema-qualified literal ``'public"."organization_members'`` so ORM
#   queries emit ``"public"."organization_members"``. ``0001_initial`` created
#   the model with the unqualified ``db_table="organization_members"``; this
#   migration performs a state-only ``AlterModelTable`` so Django's migration
#   state matches the model. ``managed=False`` prevents future
#   ``makemigrations`` runs from trying to synchronise field-level DDL — the
#   Drizzle schema is the source of truth.
#
# ``SeparateDatabaseAndState`` with an empty ``database_operations`` list
# keeps the change invisible to the database: no ALTER TABLE, no DDL, no data
# movement. Only Django's internal model state is updated.
#
# Physical relocation from ``public`` → ``union_eyes`` schema (to match the
# UNION_EYES_OWNED_SHARED target_schema) is deferred to CUPE Wave 1.
#
# See:
#   * reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-organization-members-resolution.md
#   * reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-django-schema-strategy.md
#   * reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-foundational-slice.md

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("auth_core", "0003_move_organizations_to_union_eyes"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterModelTable(
                    name="organizationmembers",
                    table='public"."organization_members',
                ),
                migrations.AlterModelOptions(
                    name="organizationmembers",
                    options={
                        "managed": False,
                        "verbose_name": "OrganizationMembers",
                    },
                ),
            ],
        ),
    ]
