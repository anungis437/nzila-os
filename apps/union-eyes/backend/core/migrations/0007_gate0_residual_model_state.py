"""Record platform-0088 integration version state without replaying its governed DDL."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('core', '0006_converge_models_to_physical_schema')]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(model_name='integrationconfigs', name='active_version', field=models.IntegerField(db_default=1, default=1, editable=False)),
            ],
            database_operations=[],
        ),
    ]
