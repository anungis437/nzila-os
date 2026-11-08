# State-only: apps/union-eyes/db/migrations-cache/0058_survey_response_capability.sql owns the real
# ALTER TABLE ... ADD COLUMN DDL for survey_responses.response_token_hash. This migration only reconciles
# Django's model state to match - applying AddField for real here as well would try to add the same column
# twice.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('unions', '0004_remove_rewardwalletledger_award_id_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='surveyresponses',
                    name='response_token_hash',
                    field=models.TextField(null=True, blank=True),
                ),
            ],
            database_operations=[],
        ),
    ]
