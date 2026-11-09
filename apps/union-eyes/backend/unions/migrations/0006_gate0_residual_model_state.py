"""Record platform-0088 survey, consent and demo provenance fields in Django state."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('unions', '0005_surveyresponses_response_token_hash')]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(model_name='surveyresponses', name='questionnaire_version_id', field=models.UUIDField()),
                migrations.AddField(model_name='memberlocationconsent', name='organization_id', field=models.UUIDField(blank=True, null=True)),
                migrations.AddField(model_name='memberlocationconsent', name='scope_kind', field=models.CharField(blank=True, max_length=16, null=True)),
                migrations.AddField(model_name='memberlocationconsent', name='scope_id', field=models.UUIDField(blank=True, null=True)),
                migrations.AddField(model_name='employers', name='demo_seed_id', field=models.UUIDField(blank=True, editable=False, null=True)),
            ],
            database_operations=[],
        ),
    ]
