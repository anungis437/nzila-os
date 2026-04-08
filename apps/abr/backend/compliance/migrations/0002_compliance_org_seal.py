"""
Migration: Fix compliance models to use proper org FK and add evidence seal fields.

Changes:
1. RiskScoreHistory: replace raw organization_id (UUIDField) with
   organization ForeignKey to auth_core.Organizations.
2. OrganizationRiskHistory: same.
3. EvidenceBundles: same FK fix + add seal lifecycle fields
   (sealed_at, seal_envelope, content_hash, previous_hash) and
   'sealed' STATUS_CHOICE variant.
"""

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("compliance", "0001_initial"),
        ("auth_core", "0002_audit_hash_chain"),
    ]

    operations = [
        # ── RiskScoreHistory: raw UUID → FK ───────────────────────────────
        migrations.RemoveField(
            model_name="riskscorehistory",
            name="organization_id",
        ),
        migrations.AddField(
            model_name="riskscorehistory",
            name="organization",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="riskscorehistorys",
                to="auth_core.organizations",
                null=True,
            ),
        ),
        # ── OrganizationRiskHistory: raw UUID → FK ────────────────────────
        migrations.RemoveField(
            model_name="organizationriskhistory",
            name="organization_id",
        ),
        migrations.AddField(
            model_name="organizationriskhistory",
            name="organization",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="organizationriskhistorys",
                to="auth_core.organizations",
                null=True,
            ),
        ),
        # ── EvidenceBundles: raw UUID → FK ────────────────────────────────
        migrations.RemoveField(
            model_name="evidencebundles",
            name="organization_id",
        ),
        migrations.AddField(
            model_name="evidencebundles",
            name="organization",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="evidencebundless",
                to="auth_core.organizations",
                null=True,
            ),
        ),
        # ── EvidenceBundles: update STATUS_CHOICES max_length ─────────────
        # 'sealed' is 6 chars — max_length=19 is sufficient, no change needed.
        # ── EvidenceBundles: seal lifecycle fields ────────────────────────
        migrations.AddField(
            model_name="evidencebundles",
            name="sealed_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Timestamp of first-and-only seal. Immutable once set.",
            ),
        ),
        migrations.AddField(
            model_name="evidencebundles",
            name="seal_envelope",
            field=models.JSONField(
                blank=True,
                null=True,
                help_text=(
                    "Serialized SealEnvelope: packDigest, artifactsMerkleRoot, "
                    "sealVersion, sealedAt, optional hmacSignature."
                ),
            ),
        ),
        migrations.AddField(
            model_name="evidencebundles",
            name="content_hash",
            field=models.CharField(
                blank=True,
                max_length=64,
                null=True,
                help_text="SHA-256 of canonical bundle content at seal time.",
            ),
        ),
        migrations.AddField(
            model_name="evidencebundles",
            name="previous_hash",
            field=models.CharField(
                blank=True,
                max_length=64,
                null=True,
                help_text="content_hash of previous EvidenceBundles record (hash chain link).",
            ),
        ),
    ]
