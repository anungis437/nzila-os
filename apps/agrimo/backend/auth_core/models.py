"""
Auth models for Agrimo backend.

Platform tables (orgs, org_members) are Drizzle-owned → managed = False.
OrganizationMembers is Django-owned for Agrimo-specific memberships.
"""

import uuid

from django.db import models


class Organizations(models.Model):
    """Read-only reference to the platform orgs table (Drizzle-owned)."""

    ORGANIZATION_STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("suspended", "Suspended"),
        ("archived", "Archived"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_name = models.TextField()
    jurisdiction = models.CharField(max_length=255, null=True, blank=True)
    incorporation_number = models.TextField(null=True, blank=True)
    registered_office_address = models.JSONField(null=True, blank=True)
    fiscal_year_end = models.CharField(max_length=10, null=True, blank=True)
    policy_config = models.JSONField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=ORGANIZATION_STATUS_CHOICES, default="active"
    )
    clerk_org_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "orgs"
        verbose_name_plural = "organizations"

    def __str__(self):
        return self.legal_name or str(self.id)


class OrgMembers(models.Model):
    """Read-only reference to org_members (Drizzle-owned)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org_id = models.UUIDField()
    clerk_user_id = models.CharField(max_length=255)
    role = models.CharField(max_length=50)
    status = models.CharField(max_length=50, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "org_members"
        verbose_name_plural = "org members"


class OrganizationMembers(models.Model):
    """Django-owned membership table for Agrimo-specific RBAC."""

    ROLE_CHOICES = [
        ("org_admin", "Administrator"),
        ("org_secretary", "Secretary"),
        ("org_viewer", "Viewer"),
    ]
    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("suspended", "Suspended"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organizations,
        on_delete=models.CASCADE,
        related_name="agrimo_memberships",
    )
    user_id = models.CharField(max_length=255, help_text="Clerk user ID")
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default="org_viewer")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agrimo_organization_members"
        unique_together = [("organization", "user_id")]
        verbose_name_plural = "organization members"

    def __str__(self):
        return f"{self.user_id} — {self.organization.legal_name} ({self.role})"
