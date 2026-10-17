from django.db import migrations, models


class Migration(migrations.Migration):
    """Claim numbers are organization-scoped; application user ids are TEXT."""

    dependencies = [
        ("grievances", "0005_claims_idempotency_hash"),
    ]

    operations = [
        migrations.AlterField(
            model_name="claims",
            name="claim_number",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddConstraint(
            model_name="claims",
            constraint=models.UniqueConstraint(
                fields=("organization_id", "claim_number"),
                name="claims_org_claim_number_uniq",
            ),
        ),
        migrations.AlterField(
            model_name="grievances",
            name="created_by",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="grievances",
            name="last_updated_by",
            field=models.TextField(blank=True, null=True),
        ),
    ]