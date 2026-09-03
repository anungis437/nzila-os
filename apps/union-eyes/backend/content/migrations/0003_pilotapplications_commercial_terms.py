from django.db import migrations, models


class Migration(migrations.Migration):
    """Adds platform-approved commercial-terms fields to pilot_applications
    (PR #752 round 25/26). Additive-only, all nullable — safe against
    existing rows. See models.py's PilotApplications class doc comment for
    the trust-boundary rationale. Django is the canonical migration source
    for this table (docs/categories/platform-and-operations/architecture/
    orm-governance/master-orm-governance-index.md); the Drizzle schema
    addition in db/schema/domains/marketing.ts is a TYPE MIRROR only."""

    dependencies = [
        ("content", "0002_pilotapplications_verified_organization"),
    ]

    operations = [
        migrations.AddField(
            model_name="pilotapplications",
            name="verified_member_count",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pilotapplications",
            name="verified_pilot_amount",
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=12, null=True
            ),
        ),
        migrations.AddField(
            model_name="pilotapplications",
            name="verified_subscription_plan_id",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pilotapplications",
            name="commercial_terms_approved_by",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pilotapplications",
            name="commercial_terms_approved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
