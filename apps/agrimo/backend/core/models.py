"""Base models for Agrimo backend — shared abstractions."""

import uuid

from django.db import models


class BaseModel(models.Model):
    """Abstract base with UUID PK and timestamps."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class OrganizationModel(BaseModel):
    """Abstract base for models scoped to an organization."""

    organization = models.ForeignKey(
        "auth_core.Organizations",
        on_delete=models.CASCADE,
        related_name="%(class)s_set",
    )

    class Meta:
        abstract = True
