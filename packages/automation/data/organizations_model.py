"""
Organizations Model - Extracted from Union Eyes Legacy Codebase
Source: D:\APPS\Union_Eyes_app_v1-main\Union_Eyes_app_v1-main\db\schema-organizations.ts

This model should be inserted into auth_core/models.py for both platforms.
"""
import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField


class Organizations(models.Model):
    """
    Hierarchical Organizations table for multi-tenancy.
    Supports CLC (Canadian Labour Congress) federation structure.
    
    Migrated from Drizzle schema: schema-organizations.ts
    """
    
    # Enum Choices
    ORGANIZATION_TYPE_CHOICES = [
        ('congress', 'Congress'),
        ('federation', 'Federation'),
        ('union', 'Union'),
        ('local', 'Local'),
        ('region', 'Region'),
        ('district', 'District'),
    ]
    
    CA_JURISDICTION_CHOICES = [
        ('federal', 'Federal'),
        ('AB', 'Alberta'),
        ('BC', 'British Columbia'),
        ('MB', 'Manitoba'),
        ('NB', 'New Brunswick'),
        ('NL', 'Newfoundland and Labrador'),
        ('NS', 'Nova Scotia'),
        ('NT', 'Northwest Territories'),
        ('NU', 'Nunavut'),
        ('ON', 'Ontario'),
        ('PE', 'Prince Edward Island'),
        ('QC', 'Quebec'),
        ('SK', 'Saskatchewan'),
        ('YT', 'Yukon'),
    ]
    
    LABOUR_SECTOR_CHOICES = [
        ('healthcare', 'Healthcare'),
        ('education', 'Education'),
        ('public_service', 'Public Service'),
        ('trades', 'Trades'),
        ('manufacturing', 'Manufacturing'),
        ('transportation', 'Transportation'),
        ('retail', 'Retail'),
        ('hospitality', 'Hospitality'),
        ('technology', 'Technology'),
        ('construction', 'Construction'),
        ('utilities', 'Utilities'),
        ('telecommunications', 'Telecommunications'),
        ('financial_services', 'Financial Services'),
        ('agriculture', 'Agriculture'),
        ('arts_culture', 'Arts and Culture'),
        ('other', 'Other'),
    ]
    
    ORGANIZATION_STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('suspended', 'Suspended'),
        ('archived', 'Archived'),
    ]
    
    # Primary Key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Basic Information
    name = models.TextField()
    slug = models.TextField(unique=True)
    display_name = models.TextField(null=True, blank=True)
    short_name = models.TextField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    
    # Hierarchy
    organization_type = models.CharField(
        max_length=20,
        choices=ORGANIZATION_TYPE_CHOICES
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name='children',
        db_column='parent_id'
    )
    hierarchy_path = ArrayField(
        models.TextField(),
        default=list,
        help_text="Array of ancestor organization IDs from root to this node"
    )
    hierarchy_level = models.IntegerField(
        default=0,
        help_text="Distance from root (0 = root organization)"
    )
    
    # Jurisdiction & Sectors
    # NOTE: 'jurisdiction' field commented out in source - column doesn't exist in DB
    province_territory = models.TextField(null=True, blank=True)
    sectors = ArrayField(
        models.CharField(max_length=30, choices=LABOUR_SECTOR_CHOICES),
        default=list,
        blank=True
    )
    
    # Contact & Metadata
    email = models.TextField(null=True, blank=True)
    phone = models.TextField(null=True, blank=True)
    website = models.TextField(null=True, blank=True)
    address = models.JSONField(
        null=True,
        blank=True,
        help_text="Format: {street, unit, city, province, postal_code, country}"
    )
    
    # CLC Affiliation
    clc_affiliated = models.BooleanField(
        default=False,
        help_text="Whether affiliated with Canadian Labour Congress"
    )
    affiliation_date = models.DateField(null=True, blank=True)
    charter_number = models.TextField(null=True, blank=True)
    
    # Membership Counts (cached)
    member_count = models.IntegerField(default=0)
    active_member_count = models.IntegerField(default=0)
    last_member_count_update = models.DateTimeField(null=True, blank=True)
    
    # Billing & Settings
    subscription_tier = models.TextField(null=True, blank=True)
    billing_contact_id = models.UUIDField(null=True, blank=True)
    settings = models.JSONField(
        default=dict,
        help_text="Flexible config: {perCapitaRate, remittanceDay, fiscalYearEnd, customFields}"
    )
    features_enabled = ArrayField(
        models.TextField(),
        default=list,
        blank=True
    )
    
    # Status & Audit
    status = models.CharField(
        max_length=20,
        choices=ORGANIZATION_STATUS_CHOICES,
        default='active'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.UUIDField(null=True, blank=True)
    
    # Legacy & Migration
    legacy_org_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        db_column='legacy_tenant_id',
        help_text="Original org ID from legacy system"
    )
    
    # CLC Financial Fields
    clc_affiliate_code = models.CharField(max_length=20, null=True, blank=True)
    per_capita_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Default per-capita rate for remittances"
    )
    remittance_day = models.IntegerField(
        default=15,
        help_text="Day of month for remittances (1-31)"
    )
    last_remittance_date = models.DateTimeField(null=True, blank=True)
    fiscal_year_end = models.DateField(
        null=True,
        blank=True,
        help_text="e.g., March 31"
    )
    
    class Meta:
        db_table = 'organizations'
        verbose_name = 'Organization'
        verbose_name_plural = 'Organizations'
        ordering = ['name']
        indexes = [
            models.Index(fields=['parent'], name='idx_organizations_parent'),
            models.Index(fields=['organization_type'], name='idx_organizations_type'),
            models.Index(fields=['slug'], name='idx_organizations_slug'),
            models.Index(fields=['hierarchy_level'], name='idx_organizations_hierarchy_level'),
            models.Index(fields=['status'], name='idx_organizations_status'),
            models.Index(fields=['clc_affiliated'], name='idx_organizations_clc_affiliated'),
            models.Index(fields=['legacy_org_id'], name='idx_organizations_legacy_tenant'),
        ]
    
    def __str__(self):
        return self.name or self.slug
    
    def is_clc_root(self):
        """Check if this is the CLC root organization."""
        return self.organization_type == 'congress' and self.parent_id is None
    
    def is_national_union(self):
        """Check if this is a national union (level 1 under CLC)."""
        return self.organization_type == 'union' and self.hierarchy_level == 1
    
    def is_local_union(self):
        """Check if this is a local union."""
        return self.organization_type == 'local'
    
    def is_federation(self):
        """Check if this is a federation."""
        return self.organization_type == 'federation'


class OrganizationRelationships(models.Model):
    """
    Tracks relationships between organizations beyond hierarchy.
    Examples: affiliations, mergers, splits, joint councils.
    
    Migrated from Drizzle schema: schema-organizations.ts
    """
    
    RELATIONSHIP_TYPE_CHOICES = [
        ('affiliate', 'Affiliate'),
        ('federation', 'Federation'),
        ('local', 'Local'),
        ('chapter', 'Chapter'),
        ('region', 'Region'),
        ('district', 'District'),
        ('joint_council', 'Joint Council'),
        ('merged_from', 'Merged From'),
        ('split_from', 'Split From'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Relationship Parties
    parent_org = models.ForeignKey(
        Organizations,
        on_delete=models.CASCADE,
        related_name='child_relationships',
        db_column='parent_org_id'
    )
    child_org = models.ForeignKey(
        Organizations,
        on_delete=models.CASCADE,
        related_name='parent_relationships',
        db_column='child_org_id'
    )
    
    # Relationship Type
    relationship_type = models.CharField(
        max_length=20,
        choices=RELATIONSHIP_TYPE_CHOICES
    )
    
    # Temporal Tracking
    effective_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    
    # Relationship Details
    notes = models.TextField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.UUIDField(null=True, blank=True)
    
    class Meta:
        db_table = 'organization_relationships'
        verbose_name = 'Organization Relationship'
        verbose_name_plural = 'Organization Relationships'
        indexes = [
            models.Index(fields=['parent_org'], name='idx_org_relationships_parent'),
            models.Index(fields=['child_org'], name='idx_org_relationships_child'),
            models.Index(fields=['relationship_type'], name='idx_org_relationships_type'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['parent_org', 'child_org', 'relationship_type', 'effective_date'],
                name='unique_org_relationship'
            )
        ]
    
    def __str__(self):
        return f"{self.parent_org.name} → {self.child_org.name} ({self.relationship_type})"
