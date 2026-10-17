from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="memberduesledger",
            name="user_id",
            field=models.TextField(),
        ),
        migrations.AlterField(
            model_name="memberarrears",
            name="user_id",
            field=models.TextField(unique=True),
        ),
    ]
