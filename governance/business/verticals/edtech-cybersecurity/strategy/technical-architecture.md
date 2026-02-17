# EdTech-Cybersecurity — Technical Architecture

> System architecture for CyberLearn — multi-tenant cybersecurity training LMS with phishing simulation.

---

## System Overview

### Platform Specifications
- **Entity count**: 50 database tables
- **Codebase**: Python/Django backend with React frontend
- **Database**: PostgreSQL (primary), planned Supabase migration for real-time features
- **Infrastructure**: Azure (aligned with Nzila corporate standards)

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Learner  │  │ Admin    │  │ MSP      │              │
│  │ Portal   │  │ Dashboard│  │ Portal   │              │
│  │ (React)  │  │ (React)  │  │ (React)  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       └──────────────┼──────────────┘                    │
│                      ▼                                   │
│              ┌───────────────┐                           │
│              │ API Gateway   │                           │
│              │ (Azure APIM)  │                           │
│              └───────┬───────┘                           │
├──────────────────────┼──────────────────────────────────┤
│                Service Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Training │  │ Phishing │  │ User Mgmt│  │Reporting│ │
│  │ Engine   │  │ Simulator│  │ & Auth   │  │ Engine  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘ │
├───────┼──────────────┼──────────────┼───────────┼───────┤
│                Data Layer                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │PostgreSQL│  │  Redis   │  │  Azure   │              │
│  │ (Primary)│  │ (Queue)  │  │ Blob     │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

---

## Multi-Tenant Architecture

### MSP Hierarchy
```
MSP Partner (root tenant)
├── Client Organization A
│   ├── Department: IT (10 users)
│   ├── Department: Finance (15 users)
│   └── Department: Operations (30 users)
├── Client Organization B
│   ├── Department: Legal (8 users)
│   └── Department: Admin (12 users)
└── Client Organization C
    └── All Staff (45 users)
```

### Tenant Isolation
- **Database**: Row-level security (RLS) with `tenant_id` on all tables
- **API**: Tenant context injected from JWT claims → scoped querysets
- **Storage**: Blob container per tenant for custom content
- **Branding**: Per-tenant theming (logo, colors, subdomain, custom domain)
- **Data**: Zero cross-tenant data leakage — tenant filter middleware

### Key Schema Design
```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  MSPPartner  │───→│ Organization │───→│  Department  │
│ name,domain  │    │ name,branding│    │ name,manager │
│ billing_plan │    │ msp_id       │    │ org_id       │
└──────────────┘    └──────────────┘    └──────────────┘
       │                   │                    │
       ▼                   ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ MSPAdmin     │    │    User      │    │  Enrollment  │
│ role,perms   │    │ email,name,  │    │ user,course  │
│ msp_id       │    │ dept,role    │    │ status,score │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## Training Engine

### Course Structure
```
Course
├── Module 1: "Recognizing Phishing Emails"
│   ├── Lesson 1.1: Video (3 min)
│   ├── Lesson 1.2: Interactive Scenario (5 min)
│   ├── Lesson 1.3: Knowledge Check (quiz)
│   └── Assessment: Module Quiz (10 questions)
├── Module 2: "Password Security"
│   ├── Lesson 2.1: Animated Infographic
│   ├── Lesson 2.2: Hands-on Lab
│   └── Assessment: Practical Exercise
└── Final Assessment: Course Exam (pass: 80%)
    └── Certificate: Generated on pass
```

### Content Delivery
| Content Type | Format | Delivery | DRM |
|---|---|---|---|
| Video | MP4 (H.264) | Azure Media Services / HLS | Token-auth |
| Interactive | HTML5 / React components | In-browser | Session-bound |
| Documents | PDF | Azure Blob | Watermarked |
| Labs | Docker containers | Browser-based (Guacamole) | Session-isolated |
| Quizzes | JSON schema | React quiz engine | Server-validated |

### Assessment Engine
- Question types: multiple choice, true/false, drag-and-drop, scenario-based, fill-in
- Question bank: randomized selection from pool (anti-cheating)
- Passing threshold: configurable per course (default 80%)
- Retake policy: configurable (unlimited, 3 attempts, 1 attempt)
- Proctoring: optional webcam monitoring for certification exams (2027)

---

## Phishing Simulation Engine

### Architecture
```
Campaign Creation → Template Selection → User Targeting → Email Dispatch
       │                   │                   │               │
       ▼                   ▼                   ▼               ▼
┌──────────┐        ┌──────────┐        ┌──────────┐    ┌──────────┐
│ Schedule │        │ Template │        │ Target   │    │ Mail     │
│ recurring│        │ 200+     │        │ by dept, │    │ delivery │
│ or one-  │        │ phishing │        │ role, or │    │ (SES/    │
│ time     │        │ scenarios│        │ risk lvl │    │ SendGrid)│
└──────────┘        └──────────┘        └──────────┘    └──────────┘
                                                              │
                                                              ▼
                                                        ┌──────────┐
                                                        │ Tracking │
                                                        │ open,    │
                                                        │ click,   │
                                                        │ submit   │
                                                        │ creds    │
                                                        └──────────┘
                                                              │
                                                              ▼
                                                        ┌──────────┐
                                                        │ JIT      │
                                                        │ Training │
                                                        │ (micro-  │
                                                        │ lesson)  │
                                                        └──────────┘
```

### Tracking Pipeline
1. **Email sent**: Track delivery, bounce, out-of-office
2. **Email opened**: Tracking pixel (1x1 transparent GIF)
3. **Link clicked**: Redirect through tracking URL → landing page
4. **Credentials submitted**: Capture event (credentials NOT stored — only event logged)
5. **Attachment opened**: Macro-enabled document tracking (beacon callback)
6. **Report filed**: User reported phishing via Outlook button → positive signal

### Phishing Template Categories
| Category | Example | Difficulty |
|---|---|---|
| Generic | "Your package is delayed" | Easy |
| Business | "Invoice #4029 overdue" | Medium |
| IT Support | "Password expires in 24 hours" | Medium |
| Executive | "CEO requests urgent wire transfer" (BEC) | Hard |
| Seasonal | "Tax refund available" (CRA impersonation) | Hard |
| Targeted | Custom scenario using OSINT | Expert |

---

## Infrastructure

### Azure Architecture
| Component | Azure Service | Purpose |
|---|---|---|
| Web App | Azure App Service | Django API + React frontend |
| Database | Azure Database for PostgreSQL | Primary data store (50 tables) |
| Cache | Azure Cache for Redis | Session, rate limiting, queue |
| Storage | Azure Blob Storage | Course content, video, documents |
| Email | Azure Communication Services + SendGrid | Phishing sim + transactional email |
| CDN | Azure CDN | Static content + video delivery |
| Auth | Azure AD B2C | User authentication, SSO |
| Monitoring | Azure Monitor + Application Insights | Performance, errors, tracing |
| Key Vault | Azure Key Vault | Secrets, certificates |
| Container | Azure Container Instances | Lab sandboxes (Docker) |

### Scaling Strategy
- **Horizontal**: App Service auto-scale based on concurrent users
- **Database**: Read replica for reporting queries, connection pooling
- **Email**: Dedicated IP warmup for phishing simulation delivery
- **Labs**: Container pool pre-provisioned for lab demand
- **Multi-region**: Azure Canada Central (primary), Canada East (DR)

---

## Integration Architecture

### PSA/RMM Integrations
```
CyberLearn API  ←→  Integration Layer  ←→  Partner APIs
                         │
               ┌─────────┼─────────┐
               ▼         ▼         ▼
          ConnectWise   Datto    NinjaRMM
          Manage      Autotask
          
Sync: Organizations, Users, Contacts
Push: Training status, compliance reports
Pull: Device inventory (user-to-device mapping)
Trigger: Create ticket on failed phishing test
```

### API Design
- RESTful API (DRF) with OpenAPI 3.0 documentation
- Authentication: API keys (MSP integration) + OAuth 2.0 (user-facing)
- Rate limiting: 1,000 requests/minute per API key
- Webhooks: enrollment completion, phishing click, certificate issued
- SDKs: Python, JavaScript (planned)

---

## Security Architecture

### Platform Security
- **Encryption at rest**: Azure Storage Service Encryption (AES-256)
- **Encryption in transit**: TLS 1.3 for all connections
- **Authentication**: Azure AD B2C with MFA support
- **Authorization**: RBAC (SuperAdmin, MSPAdmin, OrgAdmin, Manager, Learner)
- **Secrets**: Azure Key Vault for all credentials and API keys
- **WAF**: Azure Web Application Firewall on Application Gateway

### Phishing Simulation Security
- Simulated phishing emails clearly identifiable in logs (X-CyberLearn header)
- No real credential storage — only click/submit events logged
- Email sender reputation management: dedicated IPs, SPF/DKIM/DMARC
- Allowlisting guides for customer email administrators
- Automatic campaign pause if bounce rate exceeds 20%

### Data Protection
- Tenant data isolation: RLS + application-level enforcement
- PII encryption: email addresses, names encrypted at field level
- Audit log: all admin actions logged with IP, timestamp, user
- Backup: daily automated backups, 30-day retention, geo-redundant
- DR: RPO 1 hour, RTO 4 hours (Azure paired region failover)
