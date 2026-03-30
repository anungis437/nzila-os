"""
Auth models for Zonga backend.

Platform tables (orgs, org_members, profiles) are owned by Drizzle ORM.
Django reads them with managed = False — no Django migrations generated for these.
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


# =============================================================================
# Platform tables — owned by Drizzle, read-only from Django
# =============================================================================


class Organizations(BaseModel):
    """Platform organizations table (Drizzle-owned, Django read-only)."""

    ORGANIZATION_STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("suspended", "Suspended"),
        ("archived", "Archived"),
    ]

    legal_name = models.TextField()
    jurisdiction = models.CharField(max_length=255, null=True, blank=True)
    incorporation_number = models.TextField(null=True, blank=True)
    registered_office_address = models.JSONField(null=True, blank=True)
    fiscal_year_end = models.CharField(max_length=10, null=True, blank=True)
    policy_config = models.JSONField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=ORGANIZATION_STATUS_CHOICES, default="active"
    )
    clerk_org_id = models.CharField(max_length=255, null=True, blank=True, unique=True)

    class Meta:
        db_table = "orgs"
        managed = False
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"

    def __str__(self):
        return self.legal_name or str(self.id)


class OrgMembers(BaseModel):
    """Platform org_members table (Drizzle-owned, Django read-only)."""

    ROLE_CHOICES = [
        ("org_admin", "Admin"),
        ("org_secretary", "Secretary"),
        ("org_creator", "Creator"),
        ("org_viewer", "Viewer"),
    ]

    STATUS_CHOICES = [
        ("active", "Active"),
        ("suspended", "Suspended"),
        ("removed", "Removed"),
    ]

    org_id = models.UUIDField(db_column="org_id")
    clerk_user_id = models.TextField(db_column="clerk_user_id")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="org_viewer")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")

    class Meta:
        db_table = "org_members"
        managed = False
        verbose_name = "Org Member"
        verbose_name_plural = "Org Members"


# =============================================================================
# Zonga-specific auth models (Django-owned)
# =============================================================================


class OrganizationMembers(BaseModel):
    """Zonga organization membership — links Clerk users to local orgs.

    This is the Django-owned membership table for the Zonga backend.
    It syncs from Clerk webhooks with mapped roles.
    """

    ROLE_CHOICES = [
        ("org_admin", "Admin"),
        ("org_secretary", "Secretary"),
        ("org_creator", "Creator"),
        ("org_viewer", "Viewer"),
    ]

    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("suspended", "Suspended"),
    ]

    organization = models.ForeignKey(
        Organizations,
        on_delete=models.CASCADE,
        related_name="members",
    )
    user_id = models.TextField(help_text="Clerk user ID")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="org_viewer")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    is_primary = models.BooleanField(default=True)

    class Meta:
        db_table = "zonga_organization_members"
        unique_together = [("organization", "user_id")]
        verbose_name = "Organization Member"
        verbose_name_plural = "Organization Members"

    def __str__(self):
        return f"{self.user_id} → {self.organization} ({self.role})"
