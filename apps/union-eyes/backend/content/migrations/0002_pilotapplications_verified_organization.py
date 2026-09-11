import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Adds server-controlled organization-verification fields to
    pilot_applications (PR #752 round 20). Additive-only, all nullable —
    safe against existing rows. See models.py's PilotApplications class
    doc comment for the trust-boundary rationale."""

    dependencies = [
        ("content", "0001_initial"),
        ("auth_core", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="pilotapplications",
            name="verified_organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="verified_pilot_applications",
                to="auth_core.organizations",
            ),
        ),
        migrations.AddField(
            model_name="pilotapplications",
            name="verified_by",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pilotapplications",
            name="verified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
