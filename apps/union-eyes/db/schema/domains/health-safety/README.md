# Health & Safety Schema Documentation

## Overview

The Health & Safety module provides a comprehensive database schema for managing workplace health and safety operations within union organizations. This schema is designed to integrate seamlessly with the existing UnionEyes application structure and supports multi-org operations.

## Schema Design

### Tables (11 Core + Extensible)

1. **`workplace_incidents`** - Central incident tracking (injuries, near-misses, property damage)
2. **`safety_inspections`** - Workplace safety audits and inspections
3. **`hazard_reports`** - Worker-reported hazards and unsafe conditions
4. **`safety_committee_meetings`** - H&S committee meeting management
5. **`safety_training_records`** - Safety-specific training completion tracking
6. **`ppe_equipment`** - Personal protective equipment inventory and lifecycle
7. **`safety_audits`** - Formal compliance audits
8. **`injury_logs`** - Detailed injury tracking for WSIB/workers compensation
9. **`safety_policies`** - H&S policy repository with version control
10. **`corrective_actions`** - Follow-up actions from incidents/inspections/audits
11. **`safety_certifications`** - H&S representative certifications and credentials

## Key Features

### Multi-Org Support
- All tables include `organizationId` for data isolation
- RLS (Row Level Security) enabled on all tables
- Organization-based access control

### Standard Fields
Every table includes:
- `id` (UUID) - Primary key
- `organizationId` (UUID) - Org isolation
- `createdAt` (timestamp) - Record creation time
- `updatedAt` (timestamp) - Last update time
- `createdBy` (UUID) - Creator reference
- `updatedBy` (UUID) - Last updater reference

### Integration Points

#### 1. Claims System
```typescript
// Link incidents to claims for compensation tracking
workplaceIncidents.claimId → claims.claimId
injuryLogs.claimId → claims.claimId

// Claim type enum includes 'workplace_safety'
claimTypeEnum: "workplace_safety"
```

#### 2. Education/Certifications
```typescript
// Safety training linked to main training system
safetyTrainingRecords.courseId → trainingCourses.id

// Certifications track H&S rep credentials
safetyCertifications.trainingRecordId → safetyTrainingRecords.id
```

#### 3. Documents System
```typescript
// All tables support document attachments
documentIds: jsonb (array of document IDs)

// Specific document types:
// - Incident photos
// - Inspection reports
// - Policy documents
// - Audit reports
// - Certification documents
```

#### 4. Profiles & Members
```typescript
// Link safety records to users/members
injuredPersonId → profiles.userId
reportedById → profiles.userId
assignedToId → profiles.userId

// H&S representative assignments
leadInspectorId → profiles.userId
investigatorId → profiles.userId
```

### Enums

The schema uses comprehensive enums for data consistency:

- **`incidentSeverityEnum`** - near_miss, minor, moderate, serious, critical, fatal
- **`incidentTypeEnum`** - injury, near_miss, property_damage, environmental, etc.
- **`bodyPartEnum`** - Anatomical body parts for injury classification
- **`injuryNatureEnum`** - cut, fracture, sprain, burn, etc.
- **`inspectionStatusEnum`** - scheduled, in_progress, completed, etc.
- **`hazardLevelEnum`** - low, moderate, high, critical, extreme
- **`hazardCategoryEnum`** - biological, chemical, ergonomic, physical, etc.
- **`correctiveActionStatusEnum`** - open, assigned, in_progress, verified, closed
- **`ppeTypeEnum`** - hard_hat, safety_glasses, respirator, etc.
- **`safetyCertificationTypeEnum`** - health_safety_rep, first_aid, confined_space, etc.

## Usage Examples

### Creating an Incident

```typescript
import { db } from '@/db/database';
import { workplaceIncidents } from '@/db/schema/domains/health-safety';

const incident = await db.insert(workplaceIncidents).values({
  organizationId: 'org-uuid',
  incidentNumber: 'INC-2026-001',
  incidentType: 'injury',
  severity: 'moderate',
  incidentDate: new Date('2026-02-10'),
  reportedDate: new Date(),
  locationDescription: 'Manufacturing floor, line 3',
  injuredPersonName: 'John Worker',
  description: 'Slip and fall on wet surface',
  bodyPartAffected: 'knee',
  injuryNature: 'sprain',
  lostTimeDays: 3,
  status: 'investigating',
  createdBy: 'user-uuid',
}).returning();
```

### Creating a Hazard Report

```typescript
import { hazardReports } from '@/db/schema/domains/health-safety';

const hazard = await db.insert(hazardReports).values({
  organizationId: 'org-uuid',
  reportNumber: 'HAZ-2026-015',
  hazardCategory: 'safety',
  hazardLevel: 'high',
  reportedDate: new Date(),
  specificLocation: 'Warehouse aisle 5, near loading dock',
  hazardDescription: 'Damaged forklift guard creates pinch point hazard',
  whoIsAtRisk: 'Warehouse workers and forklift operators',
  potentialConsequences: 'Crush injury, amputation',
  suggestedCorrections: 'Replace damaged guard immediately, inspect all forklifts',
  isAnonymous: false,
  reportedById: 'user-uuid',
  status: 'reported',
  createdBy: 'user-uuid',
});
```

### Tracking Corrective Actions

```typescript
import { correctiveActions } from '@/db/schema/domains/health-safety';

const action = await db.insert(correctiveActions).values({
  organizationId: 'org-uuid',
  actionNumber: 'CA-2026-042',
  sourceType: 'hazard',
  sourceId: hazard.id,
  actionType: 'corrective',
  priority: 'immediate',
  title: 'Replace damaged forklift guard',
  description: 'Replace guard on forklift FL-003, ensure all guards inspected',
  proposedAction: 'Order replacement guard, install within 24 hours',
  assignedToId: 'maintenance-manager-uuid',
  identifiedDate: new Date(),
  dueDate: new Date(Date.now() + 86400000), // 24 hours
  status: 'assigned',
  createdBy: 'safety-officer-uuid',
});
```

### Managing PPE

```typescript
import { ppeEquipment } from '@/db/schema/domains/health-safety';

const ppe = await db.insert(ppeEquipment).values({
  organizationId: 'org-uuid',
  itemNumber: 'PPE-HH-2026-150',
  ppeType: 'hard_hat',
  itemName: 'Class E Hard Hat - Yellow',
  manufacturer: 'SafetyFirst Inc',
  status: 'issued',
  issuedToId: 'worker-uuid',
  issuedToName: 'Jane Worker',
  issuedDate: new Date('2026-01-15'),
  expiryDate: new Date('2031-01-15'), // 5 year validity
  quantityInStock: 45,
  quantityIssued: 5,
  createdBy: 'admin-uuid',
});
```

## Queries & Reporting

### Find All Open Incidents by Severity

```typescript
import { eq, and, desc } from 'drizzle-orm';

const openIncidents = await db
  .select()
  .from(workplaceIncidents)
  .where(
    and(
      eq(workplaceIncidents.organizationId, organizationId),
      eq(workplaceIncidents.status, 'investigating')
    )
  )
  .orderBy(desc(workplaceIncidents.severity), desc(workplaceIncidents.incidentDate));
```

### Find Overdue Corrective Actions

```typescript
import { lt, ne } from 'drizzle-orm';

const overdueActions = await db
  .select()
  .from(correctiveActions)
  .where(
    and(
      eq(correctiveActions.organizationId, organizationId),
      lt(correctiveActions.dueDate, new Date()),
      ne(correctiveActions.status, 'closed')
    )
  )
  .orderBy(correctiveActions.priority, correctiveActions.dueDate);
```

### Get Expiring Certifications

```typescript
import { lte, gte } from 'drizzle-orm';

const expiringCerts = await db
  .select()
  .from(safetyCertifications)
  .where(
    and(
      eq(safetyCertifications.organizationId, organizationId),
      eq(safetyCertifications.status, 'active'),
      lte(safetyCertifications.expiryDate, thirtyDaysFromNow),
      gte(safetyCertifications.expiryDate, new Date())
    )
  )
  .orderBy(safetyCertifications.expiryDate);
```

### Monthly Incident Statistics

```typescript
import { sql } from 'drizzle-orm';

const monthlyStats = await db
  .select({
    month: sql<string>`TO_CHAR(${workplaceIncidents.incidentDate}, 'YYYY-MM')`,
    totalIncidents: sql<number>`COUNT(*)`,
    lostTimeIncidents: sql<number>`SUM(CASE WHEN ${workplaceIncidents.lostTimeDays} > 0 THEN 1 ELSE 0 END)`,
    totalLostDays: sql<number>`SUM(COALESCE(${workplaceIncidents.lostTimeDays}, 0))`,
  })
  .from(workplaceIncidents)
  .where(eq(workplaceIncidents.organizationId, organizationId))
  .groupBy(sql`TO_CHAR(${workplaceIncidents.incidentDate}, 'YYYY-MM')`)
  .orderBy(sql`TO_CHAR(${workplaceIncidents.incidentDate}, 'YYYY-MM') DESC`);
```

## Index Strategy

All tables include strategic indexes for performance:

### Primary Indexes
- `organizationId` - Fast org filtering
- Status fields - Quick status-based queries
- Date fields - Efficient date range queries

### Composite Indexes
- `(organizationId, incidentDate)` - Optimized for reporting
- `(sourceType, sourceId)` - Fast corrective action lookups
- Foreign key fields - Efficient joins

## Security & RLS

### Row Level Security
All tables should have RLS policies configured at the database level:

```sql
-- Example RLS policy for workplace_incidents
ALTER TABLE workplace_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view incidents in their organization"
  ON workplace_incidents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert incidents"
  ON workplace_incidents
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
      AND role IN ('safety_officer', 'admin', 'system_admin')
    )
  );
```

### Data Access Patterns
- **Members** - Can report hazards anonymously, view their own incidents
- **Safety Representatives** - Can view/edit all H&S records in their organization
- **Supervisors** - Can view incidents in their department, create corrective actions
- **Administrators** - Full access to all H&S data in their organization

## Regulatory Compliance

### OSHA Compliance (US Operations)
- `oshaRecordable` flag on injury logs
- OSHA 300 log support through injury_logs table
- Incident classification matching OSHA requirements

### Canadian Compliance
- Worker's compensation (WSIB/WSIB) tracking
- Provincial reporting requirements supported
- CSA standard references for PPE

### Reporting Requirements
- Immediate reporting for critical/fatal incidents
- 24-hour reporting for serious injuries
- Monthly/annual statistical reporting

## Migration Checklist

When implementing this schema:

1. **Database Setup**
   - [ ] Run Drizzle migration to create tables
   - [ ] Configure RLS policies
   - [ ] Set up indexes
   - [ ] Verify foreign key constraints

2. **Application Integration**
   - [ ] Create API endpoints for CRUD operations
   - [ ] Implement role-based access control
   - [ ] Build admin dashboard views
   - [ ] Create member-facing reporting forms

3. **Data Migration** (if applicable)
   - [ ] Import existing incident data
   - [ ] Link to existing claims records
   - [ ] Migrate training records
   - [ ] Import PPE inventory

4. **Testing**
   - [ ] Unit tests for schema validation
   - [ ] Integration tests for relationships
   - [ ] RLS policy testing
   - [ ] Performance testing with realistic data volumes

5. **Documentation**
   - [ ] API documentation
   - [ ] User guides
   - [ ] Admin procedures
   - [ ] Compliance reporting procedures

## Future Enhancements

Potential additions to consider:

- **Chemical Inventory** - Track hazardous materials (WHMIS/SDS)
- **Emergency Response** - Emergency procedures and drills
- **Safety Performance Indicators** - KPIs and dashboards
- **Risk Assessment Matrix** - Formal risk assessment tools
- **Incident Investigation** - Structured investigation workflows
- **Safety Analytics** - Predictive analytics for incident prevention
- **Mobile App Integration** - Field reporting capabilities
- **Photo/Video Evidence** - Direct media upload integration

## Support & Maintenance

### Schema Updates
- Version all schema changes through Drizzle migrations
- Maintain backward compatibility where possible
- Document breaking changes thoroughly

### Performance Monitoring
- Monitor query performance on large datasets
- Add indexes as needed based on actual usage patterns
- Archive old records per retention policies

### Data Retention
- Define retention periods for different record types
- Implement archival processes for historical data
- Comply with legal retention requirements

## Related Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [OSHA Recordkeeping Requirements](https://www.osha.gov/recordkeeping)
- [Canadian Centre for Occupational Health and Safety](https://www.ccohs.ca)
- [ISO 45001:2018 - Occupational Health and Safety Management](https://www.iso.org/iso-45001-occupational-health-and-safety.html)

---

**Schema Version:** 1.0.0  
**Last Updated:** February 11, 2026  
**Maintainer:** UnionEyes Development Team
