# Zonga Client Onboarding Script

> **Report type:** Launch readiness — partner and label onboarding  
> **Generated:** 2025-Q2  
> **Scope:** Step-by-step onboarding guide for pilot labels, artist managers, and rights holders

---

## Overview

This document is the official onboarding script for Zonga pilot partners. It covers account setup, rights upload, payout configuration, and platform walkthrough.

---

## Step 1: Account Creation

1. Navigate to `https://zonga.io/partners/signup`
2. Enter organisation name, primary contact email, and select **Label / Rights Holder** as account type
3. Complete email verification
4. A platform admin will approve the account within **1 business day**

---

## Step 2: Pilot Agreement

1. Log in to the Partner Dashboard (`/dashboard`)
2. Navigate to **Settings → Rights & Terms**
3. Review the Pilot Partner Agreement (PDF download available)
4. Accept electronically — signature is binding as of acceptance timestamp
5. Confirm payout currency (CAD / USD) and billing entity details

---

## Step 3: Rights Upload

1. Go to **Catalogue → Upload Rights**
2. Upload a CSV with the following columns:
   - `isrc` — International Standard Recording Code
   - `track_title` — Full track name
   - `artist_name` — Primary artist
   - `label_share_pct` — Label revenue share percentage (0–100)
3. Platform validates ISRCs against the global registry (async; up to 2 hours)
4. Approved tracks appear in **Catalogue → Active**
5. Rights disputes (if any) are flagged in **Catalogue → Disputes**

---

## Step 4: Payout Setup

1. Go to **Settings → Payout**
2. Connect a Stripe account or enter bank details (direct deposit — CA/US only during pilot)
3. Set payout threshold (minimum $25 CAD)
4. Payouts are processed on the **1st and 15th of each month** for the prior period
5. Royalty statements are available under **Reports → Royalty Statements**

---

## Step 5: Platform Walkthrough

| Section | Location | What to Review |
|---------|----------|---------------|
| Catalogue | `/dashboard/catalogue` | Uploaded rights, ISRC validation status |
| Analytics | `/dashboard/analytics` | Stream counts, listener geography, trend data |
| Payouts | `/dashboard/payouts` | Pending, processing, paid breakdown |
| Rights Terms | `/dashboard/rights` | Active agreements, dispute queue |
| Support | `/dashboard/support` | Ticket submission, escalation path |

---

## Frequently Asked Questions

**Q: How long does ISRC validation take?**  
A: Up to 2 hours. You will receive an email notification when complete.

**Q: Can I upload audio files directly?**  
A: Yes — after ISRC validation, audio upload is available in Catalogue → Upload Audio.

**Q: What happens if my payout is below the $25 threshold?**  
A: The balance rolls over to the next period. It is never forfeited.

**Q: Who do I contact for a dispute?**  
A: Submit a ticket via `/dashboard/support` with category **Rights Dispute**. SLA: 3 business days.

**Q: How are stream counts validated?**  
A: Streams are deduplicated by session fingerprint. Plays < 30 seconds are excluded per industry standard.

---

## Support Contacts

| Channel | Use Case |
|---------|----------|
| `partners@zonga.io` | General partner enquiries |
| `/dashboard/support` | Technical issues, rights disputes |
| Slack `#zonga-partners` | Pilot partner real-time updates |

---

*Document owner: Nzila partner success team. Version: Pilot v1.0.*
