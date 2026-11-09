"""Record platform-0088 grievance provenance state without replaying its governed DDL."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('grievances', '0010_claims_is_anonymous_default_false')]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(model_name='grievances', name='demo_seed_id', field=models.UUIDField(blank=True, editable=False, null=True)),
            ],
            database_operations=[],
        ),
    ]
