# Phase 0B.2 - Section 9 (platform shared-table adoption).
#
# ``stripe_webhook_events`` is declared PLATFORM_OWNED_SHARED in the ownership
# manifest (packages/db/schema-ownership-manifest.json). DDL owner is the
# platform (Drizzle); Django adopts the table via ``managed = False`` and a
# state-only ``AlterModelTable`` to record the schema-qualified table name.
#
# See:
#   * reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-django-schema-strategy.md

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterModelTable(
                    name="stripewebhookevents",
                    table='public"."stripe_webhook_events',
                ),
                migrations.AlterModelOptions(
                    name="stripewebhookevents",
                    options={
                        "managed": False,
                        "verbose_name": "StripeWebhookEvents",
                    },
                ),
            ],
        ),
    ]
