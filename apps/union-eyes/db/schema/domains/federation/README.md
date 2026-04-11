# Federation Management Schema

## Overview

The Federation Management Schema provides a comprehensive database structure for managing provincial/regional labor federations within the Canadian labor movement hierarchy.

### Hierarchy

```
CLC (Canadian Labour Congress) - National
    ↓
Federation (Provincial/Regional) - Provincial/Regional
    ↓
Union (National/International) - Industry-wide
    ↓
Local (Union Local) - Workplace-level
```

## Purpose

Federations serve crucial coordinating functions:
- **Regional Coordination**: Unite labor efforts across a province or region
- **Financial Aggregation**: Collect per-capita payments from member unions and remit to CLC
- **Campaign Support**: Organize provincial/regional campaigns (organizing, political, solidarity)
- **Resource Sharing**: Provide templates, toolkits, and best practices to member unions
- **Representation**: Advocate for labor interests at provincial/regional government level

## Schema Components

### 1. Core Tables (8 Primary Tables)

#### **federations**
Provincial/Regional Labor Federation organizations
- Links to `organizations` table (type: 'federation')
- Stores federation details, jurisdiction, membership counts
- Tracks CLC affiliation status and codes
- **Key Fields**: `organizationId`, `province`, `federationType`, `clcAffiliateCode`

#### **federation_memberships**
Union affiliations with federations
- Links unions to their parent federations
- Tracks membership status, dues obligations, voting rights
- Manages delegate counts and executive representation
- **Key Fields**: `federationId`, `unionOrganizationId`, `status`, `delegateCount`

#### **federation_executives**
Federation officers and board members
- Tracks elected and appointed leadership
- Links to user profiles via `profileUserId`
- Manages terms of office, portfolios, permissions
- **Key Fields**: `federationId`, `profileUserId`, `position`, `termStart`, `termEnd`

#### **federation_meetings**
Conventions, council meetings, and gatherings
- Records all federation meetings and conventions
- Tracks attendance, quorum, decisions
- Supports in-person, virtual, and hybrid meetings
- **Key Fields**: `federationId`, `meetingType`, `startDate`, `quorumMet`

#### **federation_remittances**
Per-capita payments between unions and federations
- Tracks financial flows: Union → Federation → CLC
- Links to CLC `per_capita_remittances` for federation→CLC payments
- Manages approval workflows and payment status
- **Key Fields**: `federationId`, `fromOrganizationId`, `toOrganizationId`, `perCapitaRemittanceId`

#### **federation_campaigns**
Provincial/regional organizing and political campaigns
- Manages organizing drives, legislative advocacy, solidarity actions
- Tracks campaign metrics, budgets, outcomes
- Links to coordinating unions and participating unions
- **Key Fields**: `federationId`, `campaignType`, `status`, `targetWorkers`

#### **federation_communications**
Regional announcements, newsletters, bulletins
- Manages all federation communications to members
- Supports multiple communication types (announcements, alerts, newsletters)
- Tracks engagement metrics (opens, clicks)
- **Key Fields**: `federationId`, `communicationType`, `publishedAt`, `sendToAllMembers`

#### **federation_resources**
Shared templates, toolkits, and best practices
- Central repository of federation resources
- Supports multiple file types and versions
- Tracks usage metrics and ratings
- **Key Fields**: `federationId`, `resourceType`, `fileUrl`, `accessLevel`

### 2. Enums

- **federation_type**: provincial, regional, sectoral, international
- **federation_membership_status**: active, pending, suspended, withdrawn, expelled, inactive
- **federation_meeting_type**: convention, executive_meeting, general_meeting, committee_meeting, emergency_meeting, workshop, conference, webinar
- **federation_campaign_type**: organizing, political, legislative, public_awareness, solidarity, strike_support, health_safety, equity
- **federation_communication_type**: announcement, alert, newsletter, bulletin, press_release, internal_memo, survey, event_notice
- **federation_resource_type**: template, toolkit, policy, training, research, best_practice, legal, organizing

## Integration Points

### Organizations Table
- Federations link to `organizations` table via `organizationId`
- Member unions link via `unionOrganizationId`
- Maintains organizational hierarchy

### Profiles Table
- Federation executives link to user profiles via `profileUserId`
- Supports authentication and user management

### CLC Per-Capita Remittances
- `federation_remittances.perCapitaRemittanceId` links to `per_capita_remittances.id`
- Enables tracking federation→CLC payments
- Maintains financial flow visibility: Union → Federation → CLC

### CLC Partnership Data
- Federation data can be used for benchmarking against CLC partnership metrics
- Supports provincial/regional comparisons

## Standard Fields

All tables include:
- **id**: UUID primary key
- **createdAt**: Timestamp with timezone
- **updatedAt**: Timestamp with timezone
- **createdBy**: User ID (VARCHAR(255))
- **updatedBy**: User ID (VARCHAR(255))

All tables with organization references include:
- **organizationId** or **federationId**: UUID foreign key

## Row-Level Security (RLS) Strategy

### Access Patterns

1. **Federation Executives**
   - Full access to their own federation's data
   - Can manage memberships, campaigns, communications, resources

2. **Member Union Officials**
   - Read access to federation data they belong to
   - Can view meetings, communications, resources
   - Can submit remittances

3. **CLC Staff**
   - Read access to all federation data
   - Required for national oversight and benchmarking

4. **System Admins**
   - Full access for platform administration

### Implementation Notes
- Enable RLS on all tables
- Create policies based on user roles and federation membership
- Use `auth.uid()` for user identification
- Implement service role bypass for backend operations

## Indexes

Each table includes strategic indexes:
- Primary relationships (federationId, organizationId)
- Query-heavy fields (status, dates, types)
- Foreign key fields for join performance
- Unique constraints where appropriate

## JSON Metadata Fields

Flexible `metadata` JSONB fields support:
- **settings**: Federation-specific configuration
- **Custom fields**: Organization-specific data extensions
- **Arrays**: Participating entities, milestones, outcomes
- **Nested objects**: Complex structured data

Example metadata structures:
```typescript
// federations.metadata
{
  sectors: ['healthcare', 'education'],
  languages: ['en', 'fr'],
  affiliations: [{ name: 'CLC', code: 'CLC-123' }],
  socialMedia: [{ platform: 'twitter', handle: '@OFLabour' }]
}

// federation_campaigns.metadata
{
  participatingUnions: [
    { unionId: '...', unionName: 'CUPE Local 1234', role: 'lead' }
  ],
  keyMilestones: [
    { date: '2024-01-15', description: 'Campaign launch', achieved: true }
  ],
  outcomes: [
    { metric: 'cards_signed', target: 100, actual: 87 }
  ]
}
```

## Usage Examples

### 1. Create a Provincial Federation

```typescript
import { db } from '@/db';
import { federations, organizations } from '@/db/schema';

// First create organization record
const [org] = await db.insert(organizations).values({
  name: 'Ontario Federation of Labour',
  slug: 'ofl',
  organizationType: 'federation',
  provinceTerritory: 'ON',
}).returning();

// Then create federation record
const [ofl] = await db.insert(federations).values({
  organizationId: org.id,
  name: 'Ontario Federation of Labour',
  shortName: 'OFL',
  slug: 'ofl',
  federationType: 'provincial',
  province: 'ON',
  affiliatedWithClc: true,
  clcAffiliateCode: 'CLC-ON-001',
  perCapitaRate: '2.50',
  currency: 'CAD',
  email: 'info@ofl.ca',
  phone: '416-555-0100',
  website: 'https://ofl.ca',
}).returning();
```

### 2. Add Union Membership to Federation

```typescript
import { federationMemberships } from '@/db/schema';

await db.insert(federationMemberships).values({
  federationId: ofl.id,
  unionOrganizationId: cupeLocalOrg.id,
  status: 'active',
  joinedDate: '2024-01-01',
  membershipType: 'full',
  votingRights: true,
  perCapitaRate: '2.50',
  delegateCount: 3,
  primaryContactUserId: contactUser.userId,
});
```

### 3. Record Federation Remittance

```typescript
import { federationRemittances } from '@/db/schema';

// Union paying to Federation
await db.insert(federationRemittances).values({
  federationId: ofl.id,
  fromOrganizationId: cupeLocalOrg.id,
  toOrganizationId: ofl.organizationId,
  remittanceMonth: 1,
  remittanceYear: 2024,
  dueDate: '2024-02-15',
  totalMembers: 500,
  remittableMembers: 450,
  perCapitaRate: '2.50',
  totalAmount: '1125.00',
  status: 'pending',
  approvalStatus: 'draft',
});
```

### 4. Create Provincial Campaign

```typescript
import { federationCampaigns } from '@/db/schema';

await db.insert(federationCampaigns).values({
  federationId: ofl.id,
  name: 'Fair Contract Now - Healthcare Workers',
  slug: 'fair-contract-healthcare-2024',
  campaignType: 'organizing',
  description: 'Provincial campaign to organize healthcare workers',
  startDate: '2024-03-01',
  targetSector: 'healthcare',
  targetWorkers: 5000,
  status: 'active',
  leadOrganizerId: organizerUser.userId,
  budget: '50000.00',
  metadata: {
    participatingUnions: [
      { unionId: opseuOrg.id, unionName: 'OPSEU', role: 'lead' },
      { unionId: cupeOrg.id, unionName: 'CUPE', role: 'support' },
    ],
    tactics: ['digital_ads', 'phone_banking', 'workplace_visits'],
  },
});
```

### 5. Query Federation Data with Joins

```typescript
import { eq, and, gte } from 'drizzle-orm';

// Get all active member unions for a federation
const memberUnions = await db
  .select({
    membership: federationMemberships,
    union: organizations,
  })
  .from(federationMemberships)
  .innerJoin(
    organizations,
    eq(federationMemberships.unionOrganizationId, organizations.id)
  )
  .where(
    and(
      eq(federationMemberships.federationId, ofl.id),
      eq(federationMemberships.status, 'active')
    )
  );

// Get federation remittances for current year
const remittances = await db
  .select()
  .from(federationRemittances)
  .where(
    and(
      eq(federationRemittances.federationId, ofl.id),
      eq(federationRemittances.remittanceYear, 2024)
    )
  )
  .orderBy(federationRemittances.dueDate);
```

## Migration Considerations

### Phase 1: Schema Creation
- Create all tables with proper indexes
- Set up foreign key relationships
- Define enums

### Phase 2: RLS Policies
- Enable RLS on all tables
- Create role-based access policies
- Test with different user roles

### Phase 3: Data Migration
- Import existing federation data from legacy systems
- Map CLC affiliate codes
- Establish membership relationships
- Link historical remittance data

### Phase 4: Integration
- Connect to CLC per-capita system
- Integrate with organization hierarchy
- Link user profiles to executives
- Enable campaign tracking

## Performance Optimization

### Suggested Indexes (Already Included)
- Federation lookups: `idx_federations_organization_id`
- Provincial queries: `idx_federations_province`
- Membership status: `idx_federation_memberships_status`
- Remittance due dates: `idx_federation_remittances_due_date`
- Campaign tracking: `idx_federation_campaigns_status`

### Query Optimization Tips
1. Use `.select()` to limit columns retrieved
2. Add `.where()` filters to reduce rows scanned
3. Use proper joins instead of multiple queries
4. Cache federation metadata for read-heavy operations
5. Implement pagination for large result sets

## API Endpoint Suggestions

### Federation Management
- `GET /api/federations` - List all federations
- `GET /api/federations/:id` - Get federation details
- `POST /api/federations` - Create new federation
- `PUT /api/federations/:id` - Update federation
- `GET /api/federations/:id/members` - List member unions

### Membership Management
- `GET /api/federations/:id/memberships` - List memberships
- `POST /api/federations/:id/memberships` - Add member union
- `PUT /api/memberships/:id` - Update membership
- `DELETE /api/memberships/:id` - Remove membership

### Remittance Tracking
- `GET /api/federations/:id/remittances` - List remittances
- `POST /api/federations/:id/remittances` - Submit remittance
- `PUT /api/remittances/:id/approve` - Approve remittance
- `PUT /api/remittances/:id/pay` - Record payment

### Campaign Management
- `GET /api/federations/:id/campaigns` - List campaigns
- `POST /api/federations/:id/campaigns` - Create campaign
- `PUT /api/campaigns/:id` - Update campaign
- `GET /api/campaigns/:id/metrics` - Get campaign metrics

## Future Enhancements

1. **Federation Dashboard**
   - Member union directory
   - Remittance tracking dashboard
   - Campaign performance metrics
   - Meeting calendar

2. **Automated Remittance Calculations**
   - Auto-calculate per-capita based on member counts
   - Generate remittance invoices
   - Send automated reminders

3. **Campaign Collaboration Tools**
   - Shared campaign resources
   - Multi-union coordination
   - Progress tracking dashboards

4. **Resource Library**
   - Searchable resource database
   - Version control for templates
   - Usage analytics

5. **Communication Hub**
   - Email newsletter integration
   - SMS broadcast capabilities
   - Member engagement tracking

## Related Documentation

- [CLC Per-Capita Schema](../../clc-per-capita-schema.ts)
- [Organizations Schema](../../../schema-organizations.ts)
- [Profiles Schema](../../profiles-schema.ts)
- [Governance Schema](../governance/)

## Support & Contributions

For questions or contributions to the Federation schema:
- Review integration patterns in existing schemas
- Follow Drizzle ORM conventions
- Maintain comprehensive JSDoc comments
- Include RLS considerations in schema design
- Add appropriate indexes for query performance

---

**Schema Version**: 1.0.0  
**Last Updated**: February 11, 2026  
**Author**: UnionEyes Development Team
