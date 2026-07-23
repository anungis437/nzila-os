# Phase 0B.2 - Section 9 (platform shared-table adoption).
#
# ``organization_members`` is declared PLATFORM_OWNED_SHARED in the ownership
# manifest (packages/db/schema-ownership-manifest.json). The DDL owner is the
# platform (Drizzle); Django adopts it read-only via ``managed = False`` and a
# state-only ``AlterModelTable`` to record the schema-qualified table name.
#
# ``SeparateDatabaseAndState`` with an empty ``database_operations`` list makes
# the adoption invisible to the database: no ALTER TABLE, no DDL, no data
# movement. Only Django's internal model state is updated so that ORM queries
# emit ``"public"."organization_members"`` and no future ``makemigrations``
# pass tries to synchronise field-level DDL against the platform-owned table.
#
# See:
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
