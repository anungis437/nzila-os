# Glossary

> Plain-language definitions of terms used in UnionEyes and the Nzila platform.

## UnionEyes Terms

| Term | Definition | Where You'll See It |
|---|---|---|
| **Case** | A tracked workplace issue — the primary unit of work in UnionEyes | Dashboard, My Cases, Create Case |
| **Grievance** | A formal dispute initiated under a collective bargaining agreement (CBA) with structured steps and deadlines | Grievance Queue, Workbench (not used in pilot) |
| **Claim** | The internal/API term for a member-submitted issue — displayed as "Case" in the UI | API routes, database |
| **Update** | A timestamped note, response, or status change added to a case | Case Timeline |
| **Timeline** | The chronological log of all events on a case (notes, status changes, assignments) | Case Detail View |
| **Dashboard** | The main landing page showing your cases, quick actions, and alerts | Home screen after login |
| **Workbench** | A steward's personal workspace showing assigned cases and action items | Sidebar → Workbench |
| **Queue** | A filterable list of cases or grievances by status and priority | Sidebar → Grievances |
| **Signal** | A real-time alert indicating something needs attention (SLA risk, overdue item, required action) | Dashboard Signals Widget |
| **Deadline** | An SLA or contractual response deadline on a case | Deadline Manager |
| **Pilot** | A time-limited trial deployment with reduced feature scope for validation | Pilot Dashboard |
| **Champion** | A high-engagement pilot user identified for advocacy and adoption support | Internal metric (admin view) |
| **Steward** | A union representative who handles cases on behalf of members | Throughout the app |
| **Member** | A union member who submits cases and tracks their progress | Throughout the app |

## Roles

| Role | What They Can Do |
|---|---|
| **Member** | Create cases, view own cases, add notes, upload attachments |
| **Steward** | All member actions + transition status, internal notes, view assigned cases |
| **Chief Steward** | All steward actions + assign cases, close resolved cases |
| **Officer** | All above + reopen cases, export evidence packs |
| **Admin** | Full access including user management and attachment deletion |

## Platform Terms

| Term | Definition |
|---|---|
| **Organization (Org)** | A tenant — typically one union local. All data is scoped to an org |
| **Control Plane** | The central management layer for org provisioning, billing, and configuration |
| **Feature Flag** | A toggle that enables or disables a feature for specific organizations |
| **RLS (Row-Level Security)** | Database-level access control ensuring users only see their org's data |
| **CBA (Collective Bargaining Agreement)** | The contract between a union and employer defining rights and procedures |

## Terminology Rules

1. **"Case"** is the primary UI term for all workplace issues
2. **"Grievance"** appears only in formal CBA workflow contexts (not in pilot)
3. **"Claim"** is the database/API term — mapped to "Case" in the UI
4. **"Update"** is the term for any timeline entry
5. **"Create Case"** (not "Submit Claim" or "File Grievance") in pilot UI
6. **"My Cases"** (not "My Claims" or "My Grievances") in pilot UI
7. **"Dashboard"** (not "Home" or "Overview") for the main landing page

---

**See also:** [Terminology Alignment Matrix](../../apps/union-eyes/docs/TERMINOLOGY_ALIGNMENT.md) (technical)
