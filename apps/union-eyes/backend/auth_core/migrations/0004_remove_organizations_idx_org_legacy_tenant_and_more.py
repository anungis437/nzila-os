# Reconcile organizations model state to the physical schema.
#
# The field rename legacy_tenant_id -> legacy_org_id keeps db_column=
# "legacy_tenant_id", so the PHYSICAL column is unchanged. The naive
# auto-generated DDL would DROP COLUMN legacy_tenant_id CASCADE and re-ADD it
# (destroying data on an already-populated DB) purely to satisfy Django state.
# Rendering the migration (sqlmigrate) confirms every operation here is a pure
# state reconciliation: the physical column, its index, and the
# auth_provider_org_id unique/index already exist from 0003. We therefore apply
# these as STATE-ONLY operations (database_operations=[]) — no physical DDL.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("auth_core", "0003_rename_clerk_organization_id"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveIndex(
                    model_name="organizations",
                    name="idx_org_legacy_tenant",
                ),
                migrations.RemoveField(
                    model_name="organizations",
                    name="legacy_tenant_id",
                ),
                migrations.AddField(
                    model_name="organizations",
                    name="legacy_org_id",
                    field=models.UUIDField(
                        blank=True,
                        db_column="legacy_tenant_id",
                        db_index=True,
                        help_text="Original org ID from legacy system",
                        null=True,
                    ),
                ),
                migrations.AlterField(
                    model_name="organizations",
                    name="auth_provider_org_id",
                    field=models.TextField(
                        blank=True,
                        db_index=True,
                        help_text="External auth provider organization ID (e.g. org_2abc...) — set by webhook on organization.created",
                        null=True,
                        unique=True,
                    ),
                ),
                migrations.AddIndex(
                    model_name="organizations",
                    index=models.Index(
                        fields=["legacy_org_id"], name="idx_org_legacy_tenant"
                    ),
                ),
            ],
            database_operations=[],
        ),
    ]
