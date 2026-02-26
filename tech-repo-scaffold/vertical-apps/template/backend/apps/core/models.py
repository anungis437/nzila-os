# Nzila Vertical App - Core App Models

import uuid

from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    """Abstract base model with timestamp fields."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """Abstract base model with UUID primary key."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class OrgModel(UUIDModel, TimeStampedModel):
    """Abstract base model for multi-org applications."""

    org_id = models.CharField(max_length=64, db_index=True)

    class Meta:
        abstract = True
