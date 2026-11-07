# State-only: db/migrations-platform/0083_reward_wallet_ledger_drop_legacy_columns.sql owns the real
# ALTER TABLE ... DROP COLUMN DDL for these six columns (fail-closed: it refuses to run while any of
# them still holds non-null data). This migration only reconciles Django's model state to match -
# applying RemoveField for real here as well would try to drop the same columns twice.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('unions', '0003_converge_models_to_physical_schema'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(
                    model_name='rewardwalletledger',
                    name='award_id',
                ),
                migrations.RemoveField(
                    model_name='rewardwalletledger',
                    name='description',
                ),
                migrations.RemoveField(
                    model_name='rewardwalletledger',
                    name='points_change',
                ),
                migrations.RemoveField(
                    model_name='rewardwalletledger',
                    name='reference_id',
                ),
                migrations.RemoveField(
                    model_name='rewardwalletledger',
                    name='reference_type',
                ),
                migrations.RemoveField(
                    model_name='rewardwalletledger',
                    name='transaction_type',
                ),
            ],
            database_operations=[],
        ),
    ]

