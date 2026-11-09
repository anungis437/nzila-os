"""Record platform-0088 fields in Django state without replaying its governed DDL."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('auth_core', '0009_converge_models_to_physical_schema')]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(model_name='organizationmembers', name='demo_seed_id', field=models.UUIDField(blank=True, editable=False, null=True)),
                migrations.AddField(model_name='ssoproviders', name='active_version', field=models.IntegerField(db_default=0, default=0, editable=False)),
                migrations.AddField(model_name='ssoproviders', name='approved_by', field=models.CharField(blank=True, editable=False, max_length=255, null=True)),
                migrations.AddField(model_name='ssoproviders', name='approved_at', field=models.DateTimeField(blank=True, editable=False, null=True)),
                migrations.AddField(model_name='ssoproviders', name='approval_reference', field=models.CharField(blank=True, editable=False, max_length=255, null=True)),
            ],
            database_operations=[],
        ),
    ]
