# Health & Safety Schema - Quick Reference

## 📁 Files Created

```
db/schema/domains/health-safety/
├── health-safety-schema.ts    (2,400+ lines - Complete schema)
├── index.ts                    (Re-exports and type exports)
└── README.md                   (Comprehensive documentation)
```

Updated: `db/schema/domains/index.ts` (Added health-safety export)

---

## 📊 Tables Overview (11 Core Tables)

| Table | Purpose | Key Fields | Links To |
|-------|---------|-----------|----------|
| `workplace_incidents` | Track all workplace incidents | incident_number, severity, incident_type | claims, injury_logs |
| `safety_inspections` | Safety audits & inspections | inspection_type, status, score | corrective_actions |
| `hazard_reports` | Worker-reported hazards | hazard_level, risk_score | corrective_actions |
| `safety_committee_meetings` | H&S committee meetings | meeting_date, attendees, minutes | incidents, hazards |
| `safety_training_records` | Safety training completion | trainee, course, certification | training_courses, certifications |
| `ppe_equipment` | PPE inventory & lifecycle | ppe_type, status, issued_to | profiles/members |
| `safety_audits` | Formal compliance audits | audit_type, findings, rating | corrective_actions |
| `injury_logs` | WSIB/workers comp tracking | wsib_claim, lost_time_days | workplace_incidents, claims |
| `safety_policies` | Policy repository | version, effective_date, status | documents |
| `corrective_actions` | Follow-up actions | priority, due_date, status | incidents, inspections, hazards |
| `safety_certifications` | H&S rep certifications | certification_type, expiry_date | training_records |

---

## 🔗 Integration Points

### 1. Claims System
```typescript
// Link to existing claims
workplaceIncidents.claimId → claims.claimId
injuryLogs.claimId → claims.claimId

// Claim type: "workplace_safety"
```

### 2. Education/Training
```typescript
// Link to training courses
safetyTrainingRecords.courseId → trainingCourses.id
safetyCertifications.trainingRecordId → safetyTrainingRecords.id
```

### 3. Documents
```typescript
// All tables support document attachments
documentIds: jsonb (array of document IDs)
photoUrls: jsonb (array of photo URLs)
```

### 4. Profiles/Members
```typescript
// User/member references
injuredPersonId → profiles.userId
reportedById → profiles.userId
assignedToId → profiles.userId
```

---

## 📋 Enums (21 Total)

### Incident Classification
- `incidentSeverityEnum` - near_miss, minor, moderate, serious, critical, fatal
- `incidentTypeEnum` - injury, near_miss, property_damage, environmental, vehicle, etc.
- `bodyPartEnum` - head, eyes, hand, back, leg, etc. (21 options)
- `injuryNatureEnum` - cut, fracture, burn, sprain, etc. (22 options)

### Inspection & Audit
- `inspectionStatusEnum` - scheduled, in_progress, completed, requires_followup
- `inspectionTypeEnum` - routine, comprehensive, targeted, post_incident, etc.
- `auditStatusEnum` - planned, in_progress, completed
- `auditTypeEnum` - internal, external, certification, compliance

### Hazard Management
- `hazardLevelEnum` - low, moderate, high, critical, extreme
- `hazardCategoryEnum` - biological, chemical, ergonomic, physical, safety, etc.

### Actions & Status
- `correctiveActionStatusEnum` - open, assigned, in_progress, verified, closed
- `correctiveActionPriorityEnum` - immediate, urgent, high, normal, low
- `trainingStatusEnum` - scheduled, in_progress, completed, expired

### Equipment & Certification
- `ppeTypeEnum` - hard_hat, safety_glasses, respirator, gloves, boots, etc.
- `ppeStatusEnum` - in_stock, issued, in_use, damaged, expired
- `safetyCertificationTypeEnum` - health_safety_rep, first_aid, confined_space, etc.
- `certificationStatusEnum` - active, expired, suspended, revoked

### Meetings
- `meetingTypeEnum` - regular, special, inspection, incident_review, training

---

## 🔧 Standard Fields (All Tables)

```typescript
{
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}
```

---

## 📈 Key Indexes

### Performance Indexes (Every Table)
- `idx_*_org` - organizationId
- `idx_*_status` - Status field
- `idx_*_date` - Primary date field

### Specialized Indexes
- `idx_incidents_severity` - Incident severity
- `idx_hazards_risk_score` - Risk scoring
- `idx_corrective_actions_due_date` - Due date tracking
- `idx_certifications_expiry` - Expiry monitoring

---

## 🔐 Security Features

### Row Level Security (RLS)
- Organization-level isolation
- Role-based access control
- Anonymous reporting support (hazards)

### Data Privacy
- Optional anonymization for reporters
- Sensitive data in encrypted fields
- Audit trail on all modifications

---

## 📊 Common Queries

### Find Open High-Priority Incidents
```typescript
const incidents = await db.select()
  .from(workplaceIncidents)
  .where(and(
    eq(workplaceIncidents.organizationId, orgId),
    eq(workplaceIncidents.severity, 'critical'),
    ne(workplaceIncidents.status, 'closed')
  ));
```

### Get Overdue Corrective Actions
```typescript
const overdue = await db.select()
  .from(correctiveActions)
  .where(and(
    eq(correctiveActions.organizationId, orgId),
    lt(correctiveActions.dueDate, new Date()),
    ne(correctiveActions.status, 'closed')
  ));
```

### Find Expiring Certifications (Next 30 Days)
```typescript
const expiring = await db.select()
  .from(safetyCertifications)
  .where(and(
    eq(safetyCertifications.organizationId, orgId),
    lte(safetyCertifications.expiryDate, thirtyDaysFromNow),
    gte(safetyCertifications.expiryDate, today)
  ));
```

---

## 🚀 Implementation Steps

### Phase 1: Database Setup
1. Run Drizzle migration
2. Configure RLS policies
3. Create indexes
4. Seed initial data (enum values, default policies)

### Phase 2: API Layer
1. Create CRUD endpoints
2. Implement role-based access
3. Add validation middleware
4. Build search/filter functionality

### Phase 3: UI Components
1. Incident reporting form
2. Hazard reporting form
3. Inspection checklist interface
4. Dashboard widgets (KPIs, charts)
5. Corrective action tracker
6. Certification expiry alerts

### Phase 4: Integration
1. Link to claims system
2. Connect to document storage
3. Integrate with notifications
4. Set up automated reminders

---

## 📊 Reporting Capabilities

### Compliance Reports
- OSHA 300 Log (US)
- Provincial injury reporting (Canada)
- Lost time injury frequency rate (LTIFR)
- Total recordable incident rate (TRIR)

### Management Reports
- Incident trends by type/severity
- Corrective action status
- Inspection compliance rates
- Training completion rates
- Certification expiry tracking

### Analytics
- Risk heat maps
- Near-miss trending
- Cost analysis (WSIB claims)
- Department safety comparisons

---

## 💡 Best Practices

### Data Entry
1. Use unique identifiers (INC-2026-001, HAZ-2026-015)
2. Complete all required fields
3. Attach photos/documents immediately
4. Assign corrective actions promptly

### Workflow
1. Report incident → Investigate → Create corrective actions → Verify → Close
2. Report hazard → Assess risk → Assign for correction → Verify → Close
3. Schedule inspection → Conduct → Record findings → Follow up → Complete

### Maintenance
1. Review open corrective actions weekly
2. Send certification expiry reminders monthly
3. Archive closed incidents annually
4. Update policies during annual review

---

## 🎯 Key Features

✅ **Complete Incident Lifecycle** - From report to closure  
✅ **WSIB/Workers Comp Integration** - Full claim tracking  
✅ **Regulatory Compliance** - OSHA, provincial requirements  
✅ **Risk Management** - Hazard assessment & mitigation  
✅ **PPE Lifecycle** - From purchase to disposal  
✅ **Certification Tracking** - Automated expiry alerts  
✅ **Audit Trail** - Full history on all records  
✅ **Document Management** - Photos, reports, policies  
✅ **Multi-Tenant** - Organization-level isolation  
✅ **Role-Based Access** - Granular permissions  

---

## 📞 Support

For questions or issues:
- Review the detailed [README.md](./README.md)
- Check Drizzle ORM documentation
- Consult UnionEyes development team

**Schema Version:** 1.0.0  
**Created:** February 11, 2026
