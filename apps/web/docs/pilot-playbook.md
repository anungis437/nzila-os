# Web (Marketing Site) — Pilot Playbook

## Overview
Step-by-step guide for piloting the Nzila OS marketing website. Target: validate lead capture, content publishing, and analytics workflows.

## Prerequisites
- [ ] Nzila OS platform running (Docker or staging)
- [ ] Platform auth configured with content roles (admin, editor, viewer)
- [ ] PostgreSQL database seeded with demo data
- [ ] Platform policy-engine enabled for content operations

## Pilot Setup

### Step 1: Seed Demo Data
```bash
pnpm --filter @nzila/web demo:seed
```
Creates demo organizations, users, content articles, leads, and analytics.

### Step 2: Verify Health
```bash
curl http://localhost:3000/api/health
# Expect: { "status": "healthy", "service": "web" }
```

### Step 3: Assign Roles
- **Admin**: Full access — content publishing, analytics, lead management
- **Editor**: Create/edit content, view leads
- **Viewer**: Read-only access to published content

### Step 4: Configure Policies
Verify policy enforcement is active:
- Content publishing requires editor or admin role
- Admin analytics access requires admin role

## Key Workflows

1. **Lead Capture** — Submit lead form with validation (name, email, phone format)
2. **Content Publishing** — Create article, generate slug, publish/archive lifecycle
3. **Analytics Dashboard** — View page views, bounce rate, lead conversion metrics
4. **Evidence Export** — Export site data with evidence pack
5. **XSS Protection** — Verify HTML sanitization on lead form inputs

## Success Criteria
- [ ] Landing page renders correctly with SEO metadata
- [ ] Lead form validates all required fields
- [ ] Phone format validation rejects invalid numbers
- [ ] XSS attempts are sanitized from form inputs
- [ ] Content slug is auto-generated from title
- [ ] Publish/archive lifecycle transitions work correctly
- [ ] Evidence pack includes SBOM and policy check results

## Rollback Plan
1. Remove demo content and leads from database
2. Disable content-specific platform roles
3. Revert policy engine configuration
