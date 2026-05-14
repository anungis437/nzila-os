# Zonga — Client Onboarding Script

**Sprint**: Client Launch Readiness | **Date**: 2026-04-19

> This document is for the Nzila OS / Zonga operator (founder / platform team). It covers the end-to-end process of onboarding a new client organisation onto the Zonga platform from first contact through the first 14 days of live operation.

---

## Section 1: Pre-Launch Intake

### Purpose

Gather the minimum required information from the client before provisioning their platform instance.

### Intake Form / Discovery Call Agenda (60 min)

**1. Client Identity**

- [ ] Legal entity name
- [ ] Primary contact name + email
- [ ] Jurisdiction / country of incorporation
- [ ] Estimated launch markets (e.g. Kenya, Nigeria, South Africa, Diaspora-UK, Canada)
- [ ] Preferred platform currency (client billing currency)

**2. Business Model**

- [ ] Creator-focused (music releases, royalties)? Or listener subscription-first?
- [ ] Live events expected at launch? (Required for IVS configuration)
- [ ] Expected catalog size at launch (# tracks)
- [ ] Expected number of creators at launch
- [ ] Expected number of listeners at launch
- [ ] M-Pesa support needed? (Which markets: TZ/MZ/LS/CD)

**3. Content & Rights**

- [ ] Does client own content or is it user-generated?
- [ ] Existing catalog to migrate? (format, quantity)
- [ ] Rights management: who handles takedown requests?
- [ ] Artist/creator onboarding process: invite-only or open registration?

**4. Payments**

- [ ] Stripe account provided by client, or Nzila managing Stripe Connect?
- [ ] Creator payout method: Stripe Connect, M-Pesa, or both?
- [ ] Payout currency: local currency or USD?
- [ ] Minimum payout threshold (use system default or custom)?
- [ ] Who is the designated `finance_admin` for payout approvals?

**5. Legal**

- [ ] ToS and Privacy Policy: client provides, or Nzila provides draft (from Legal Launch Pack)?
- [ ] DMCA designated agent: client's or shared?
- [ ] Data residency requirements: any restriction on processing in Canada/US?

**6. Branding**

- [ ] Platform name / subdomain preference
- [ ] Logo (SVG preferred), colour palette (primary/secondary/accent)
- [ ] Custom domain (requires DNS CNAME record; handled by client)
- [ ] Email sender name and reply-to address

**7. Operator Access**

- [ ] Who will be `platform_operator`? (Name + email)
- [ ] Who will be `client_admin`? (Name + email)
- [ ] Who will be `finance_admin`? (Name + email)

---

## Section 2: Platform Configuration Checklist

Run this checklist before the launch call. Target: complete T-3 days before go-live.

### 2.1 Environment Configuration

```bash
# Required env vars for Zonga Container App
AUTH_SECRET=<generated-32-byte-secret>
DATABASE_URL=<postgres-flexible-server-url>
AZURE_STORAGE_CONNECTION_STRING=<blob-storage-connection>
STRIPE_SECRET_KEY=<stripe-live-or-test-key>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-signing-secret>
AZURE_OPENAI_API_KEY=<openai-api-key>
AZURE_OPENAI_ENDPOINT=<openai-endpoint>
AWS_ACCESS_KEY_ID=<aws-access-key>
AWS_SECRET_ACCESS_KEY=<aws-secret>
AWS_REGION=<aws-region>
AWS_CLOUDFRONT_DOMAIN=<cloudfront-distribution-domain>
AWS_CLOUDFRONT_KEY_PAIR_ID=<cloudfront-key-pair-id>
AWS_CLOUDFRONT_PRIVATE_KEY=<cloudfront-private-key-pem>
AWS_MEDIACONVERT_ENDPOINT=<mediaconvert-endpoint>
AWS_MEDIACONVERT_ROLE_ARN=<mediaconvert-iam-role>

# Optional — M-Pesa
ZONGA_ENABLE_VODACOM_MPESA=true
VODACOM_MPESA_API_KEY=<mpesa-api-key>
VODACOM_MPESA_PARTNER_ID=<partner-id>

# Optional — Live events
AWS_IVS_REGION=<aws-region>
```

### 2.2 Database Setup

- [ ] Run Zonga DB migrations: `pnpm drizzle-kit migrate` (or confirm applied)
- [ ] Verify tables exist: `zonga_track_assets`, `zonga_events`, `zonga_earnings_entries`, `zonga_payout_requests`, `zonga_ownership_splits`
- [ ] Seed initial org record in `organizations` table
- [ ] Create admin users in `auth_users` and `org_members` with roles: `platform_operator`, `client_admin`, `finance_admin`

### 2.3 Stripe Configuration

- [ ] Stripe account in **Live mode** (not test mode for real clients)
- [ ] Webhook endpoint registered: `https://<DOMAIN>/api/stripe/webhook`
- [ ] Webhook events enabled: `payment_intent.succeeded`, `payment_intent.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] Stripe Connect enabled on the account (for creator payouts)
- [ ] At least one test creator payout executed in test mode

### 2.4 Media Pipeline Verification

- [ ] Upload a test audio file (MP3 ~5MB) via the creator upload UI
- [ ] Confirm job queue processes it (check `getUploadHealthPanel()` returns no stuck jobs)
- [ ] Confirm processed variant appears in playback (standard quality)
- [ ] Confirm CloudFront signed URL resolves and plays
- [ ] Confirm blob fallback works (can test by temporarily misconfiguring CloudFront key)

### 2.5 Access Control Verification

- [ ] Login as `finance_admin` → POST `/api/payouts` → success ✅
- [ ] Login as `client_admin` → POST `/api/payouts` → 403 Forbidden ✅
- [ ] Login as `creator` → POST `/api/payouts` → 403 Forbidden ✅
- [ ] Login as unauthenticated → any `/api/*` → 401 Unauthorized ✅
- [ ] Account lockout test: 5 wrong passwords → lockout message ✅

### 2.6 Legal Documents

- [ ] ToS published at `/terms` (or external link configured)
- [ ] Privacy Policy published at `/privacy`
- [ ] ToS acceptance checkbox present on signup form
- [ ] DMCA contact address live and monitored
- [ ] Support email address live and monitored

### 2.7 DNS and Domain

- [ ] Client custom domain CNAME pointing to Container Apps domain
- [ ] SSL certificate provisioned (Azure Container Apps auto-provisions via Let's Encrypt)
- [ ] Test: `https://CLIENTDOMAIN.com` loads login page without cert errors

---

## Section 3: Content Migration (If Applicable)

If the client has an existing catalog to migrate:

### 3.1 Migration Assessment

| Question | Client Answer |
|---|---|
| Format of existing files | (MP3/FLAC/WAV) |
| Number of tracks | |
| Metadata available (artist/title/ISRC)? | |
| Artwork available? | |
| Rights documentation available? | |
| Revenue split agreements in place? | |

### 3.2 Migration Procedure

1. **Prepare migration package**: Directory structure `{artist}/{album}/{track.mp3}` + `metadata.csv` (title, artist, ISRC, release_date, genre, ownership_splits)
2. **Upload via batch script** (contact Nzila for tooling):

   ```bash
   # Run batch upload (uses admin API key)
   node scripts/zonga-batch-upload.mjs \
     --input ./catalog \
     --org-id <CLIENT_ORG_ID> \
     --admin-token <ADMIN_TOKEN>
   ```

3. **Verify**: Check each migrated track plays at standard quality
4. **Ownership splits**: Record split rules in DB for all collaborative works
5. **Metadata QA**: Spot-check 10% of migrated tracks for correct artist/title

### 3.3 Migration Phased Approach (Recommended)

| Phase | Scope | Target |
|---|---|---|
| Phase 1 | Top 50 tracks from anchor artists | Pre-launch |
| Phase 2 | Full back catalog (all other tracks) | Week 2 |
| Phase 3 | Historical earnings data (manual import) | Week 4 |

---

## Section 4: Launch Call Script (90-Minute Call)

**Participants**: Client admin, finance admin, Nzila operator, optionally legal counsel
**Format**: Video call with screen share

### Agenda

**[0:00 – 0:10] Welcome and introductions**

- Confirm all attendees
- Confirm technical prerequisites are met (everyone can access the platform URL)

**[0:10 – 0:20] Platform walkthrough — Admin perspective**

- Login as `client_admin` → show dashboard overview
- Demonstrate: creator management, catalog management, event listing
- Show: moderation queue, compliance panel

**[0:20 – 0:35] Finance walkthrough**

- Login as `finance_admin` → navigate to `/dashboard/payouts`
- Demonstrate: payout request list, approval workflow
- Show: earnings ledger view, revenue breakdown
- Walk through: weekly payout review procedure (from Billing Report Section 4)

**[0:35 – 0:45] Creator onboarding demo**

- Register a test creator account
- Upload a test track
- Set ownership split
- Check earnings dashboard

**[0:45 – 0:55] Incident response briefing**

- Share `/api/health` endpoint URL
- Confirm uptime monitor is set up
- Walk through: who to call in a P0 incident
- Confirm: client has Nzila emergency contact info

**[0:55 – 1:10] Legal review**

- Confirm ToS/Privacy Policy URL is live
- Confirm client has reviewed and approved legal documents
- Confirm DMCA contact is live

**[1:10 – 1:20] Creator communications**

- Review draft welcome email for creators
- Confirm platform support email is monitored
- Set expectation: payout processing SLA (3–7 business days)

**[1:20 – 1:30] Go / No-Go Decision**

- Review checklist: all green?
- If any blockers: triage and set timeline
- **Operator signs off**: "Platform is ready for first creators"
- Set: launch date + time

---

## Section 5: First 14-Day Hypercare Schedule

For the first 14 days post-launch, the Nzila operator (founder) provides elevated support.

### Daily Check (Days 1–7)

Every morning:

- [ ] Check Azure Container Apps health: `az containerapp show -n nzila-os-zonga -g nzila-canada-staging-rg`
- [ ] Check upload health panel: `GET /api/admin/health`
- [ ] Review Stripe dashboard for failed payments
- [ ] Review any new moderation flags
- [ ] Check support inbox for creator/listener issues

### Weekly Review (Day 7 and Day 14)

- [ ] Review payout queue → approve pending payouts
- [ ] Review platform analytics: plays, uploads, active creators, listeners
- [ ] Review earnings ledger reconciliation
- [ ] Check AWS MediaConvert queue for failed transcodes
- [ ] Update client on platform metrics in written summary

### Hypercare Escalation Path

| Issue | Escalation |
|---|---|
| Platform unavailable | Founder — immediate |
| Payment failure | Finance admin → Stripe Dashboard → Founder |
| Creator can't upload | Support agent → check job queue → Founder if systemic |
| Rights/takedown request | Moderation queue → client admin reviews → escalate if legal |
| Data breach suspected | Founder → legal → notify authorities (see Backup/IR Plan) |

### Exit from Hypercare (Day 14)

Criteria to exit hypercare:

- [ ] Zero P0 incidents
- [ ] At least 5 tracks uploaded and playing correctly
- [ ] At least one payout completed end-to-end
- [ ] Client admin able to independently manage: creators, payouts, moderation
- [ ] Support inbox response time <24h established

If criteria not met: extend hypercare by 7 days and reassess.

---

## Appendix: Creator Welcome Email Template

**Subject**: You're now live on [PLATFORM NAME] — here's how to get started

---

Hi [Creator Name],

You've been onboarded as a creator on [PLATFORM NAME] — the music and media platform for [CLIENT DESCRIPTION].

**Your account is ready.** Here's what to do first:

1. **Log in**: [https://DOMAIN.com/login]
2. **Complete your profile**: Add your artist bio, profile photo, and payout information
3. **Upload your first track**: Go to Tracks → Upload New Track
4. **Set up your payout account**: Navigate to Settings → Payout Details to connect your Stripe or M-Pesa account

**Revenue share**: [PLATFORM NAME] retains a platform fee per revenue source (streaming, downloads, tips, events). You keep the rest. Full fee schedule available at [/terms].

**Questions?** Email us at [support@CLIENTDOMAIN.com]. We typically respond within 24 hours.

We're building something great together.

[OPERATOR NAME]
[PLATFORM NAME] Team

---

*Generated by Nzila OS Automation — Zonga Client Launch Readiness Sprint*
