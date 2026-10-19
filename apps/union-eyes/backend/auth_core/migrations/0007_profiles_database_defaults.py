"""Database defaults for ``profiles`` (Phase 3A release qualification).

The Drizzle insert in app/[locale]/dashboard/layout.tsx omits id, membership, payment_provider, usage_credits,
used_credits, status, created_at and updated_at and relies on database defaults. A database built by Django had none
(Django applies ``default=`` in Python only), so the insert raised a NOT NULL violation and every first dashboard load
redirected to /sign-up. Metadata-only (``ALTER COLUMN ... SET DEFAULT``); no table rewrite, no data change, no RLS change.
Scope is exactly this table: other tables get a default only when an insert path is proven to need one.
"""
from django.db import migrations, models
from django.db.models import Func
from django.db.models.functions import Now
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("auth_core", "0006_application_user_id_text"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profiles",
            name="id",
            field=models.UUIDField(
                primary_key=True,
                default=uuid.uuid4,
                db_default=Func(function="gen_random_uuid", output_field=models.UUIDField()),
                editable=False,
                serialize=False,
            ),
        ),
        migrations.AlterField(
            model_name="profiles",
            name="membership",
            field=models.CharField(choices=[("free", "Free"), ("pro", "Pro")], default="free", db_default="free", max_length=14),
        ),
        migrations.AlterField(
            model_name="profiles",
            name="payment_provider",
            field=models.CharField(blank=True, choices=[("stripe", "Stripe"), ("whop", "Whop")], default="whop", db_default="whop", max_length=16, null=True),
        ),
        migrations.AlterField(
            model_name="profiles",
            name="usage_credits",
            field=models.IntegerField(blank=True, default=0, db_default=0, null=True),
        ),
        migrations.AlterField(
            model_name="profiles",
            name="used_credits",
            field=models.IntegerField(blank=True, default=0, db_default=0, null=True),
        ),
        migrations.AlterField(
            model_name="profiles",
            name="status",
            field=models.TextField(blank=True, default="active", db_default="active", null=True),
        ),
        migrations.AlterField(
            model_name="profiles",
            name="created_at",
            field=models.DateTimeField(db_default=Now()),
        ),
        migrations.AlterField(
            model_name="profiles",
            name="updated_at",
            field=models.DateTimeField(blank=True, db_default=Now(), null=True),
        ),
    ]