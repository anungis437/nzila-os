"""
Base model classes for the Zonga backend.
"""

import uuid

from django.db import models


class BaseModel(models.Model):
    """Abstract base with standard audit fields."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class OrganizationModel(BaseModel):
    """Abstract base for multi-organization models."""

    organization = models.ForeignKey(
        "auth_core.Organizations",
        on_delete=models.CASCADE,
        related_name="%(class)ss",
    )

    class Meta:
        abstract = True
