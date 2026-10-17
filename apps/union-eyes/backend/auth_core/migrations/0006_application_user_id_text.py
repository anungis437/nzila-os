from django.db import migrations, models


class Migration(migrations.Migration):
    """APPLICATION_USER_ID is TEXT: actor attribution columns store the authenticated user id."""

    dependencies = [
        ("auth_core", "0005_organizationmembers_deleted_at_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="organizations",
            name="created_by",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="organizationrelationships",
            name="created_by",
            field=models.TextField(blank=True, null=True),
        ),
    ]