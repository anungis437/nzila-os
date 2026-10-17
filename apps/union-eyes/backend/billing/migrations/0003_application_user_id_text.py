from django.db import migrations, models


class Migration(migrations.Migration):
    """APPLICATION_USER_ID is TEXT for dues-domain identity columns (no casts, no surrogate ids)."""

    dependencies = [
        ("billing", "0002_member_dues_ledger_user_id_text"),
    ]

    operations = [
        migrations.AlterField(
            model_name="duestransactions",
            name="member_id",
            field=models.TextField(),
        ),
        migrations.AlterField(
            model_name="remittancelineitems",
            name="user_id",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="paymentplans",
            name="user_id",
            field=models.TextField(),
        ),
    ]