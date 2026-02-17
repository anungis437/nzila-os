# Entertainment — Compliance & Privacy Strategy

> Regulatory compliance framework for CongoWave — music licensing, content rights, data privacy, and platform regulations.

---

## Music Licensing & Copyright

### Copyright Framework
- **Canadian Copyright Act**: Governs reproduction, distribution, and public performance rights
- **Berne Convention**: International copyright protection — automatic protection in 180+ member states
- **WIPO Copyright Treaty**: Digital exploitation rights, anti-circumvention provisions

### Licensing Requirements
| Right | Purpose | Licensor | CongoWave Obligation |
|---|---|---|---|
| **Mechanical** | Reproduce/distribute recordings | Labels/artists | Per-stream royalty ($0.004-0.006) |
| **Performance** | Public performance (streaming = performance) | SOCAN (Canada) | % of gross revenue |
| **Synchronization** | Use in video content | Publishers/artists | Per-use negotiation |
| **Neighboring Rights** | Rights of performers/producers | Re:Sound (Canada) | % of gross revenue |

### Collective Management Organizations
| Organization | Territory | Covers | CongoWave Status |
|---|---|---|---|
| **SOCAN** | Canada | Musical works performance rights | License required before launch |
| **Re:Sound** | Canada | Sound recording performance rights | License required |
| **CMRRA** | Canada | Mechanical reproduction rights | License required |
| **SOCODA** | DRC | Authors' rights (Congolese repertoire) | Partnership needed for DRC launch |
| **SACEM** | France | Musical works (Francophone catalog) | License for French-market expansion |
| **ASCAP/BMI** | US | Performance rights (US expansion) | License for US market |

### Royalty Distribution Engine
```
Stream Event → Attribution → Calculation → Distribution
     │              │              │              │
     ▼              ▼              ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ 30-sec   │ │ Match to │ │ Pro-rata │ │ Monthly  │
│ play =   │→│ rights   │→│ revenue  │→│ payout   │
│ 1 stream │ │ holders  │ │ share    │ │ via bank │
│          │ │ (ISRC)   │ │ calc     │ │ /M-Pesa  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```
- **Per-stream rate**: Pro-rata model (total premium revenue ÷ total streams × per-artist streams)
- **Minimum play**: 30 seconds = 1 countable stream
- **Fraud detection**: Flag artificial streams (bots, loops, manipulation patterns)
- **Payout threshold**: $10 minimum (diaspora bank) / $2 minimum (mobile money)
- **Payout frequency**: Monthly, within 45 days of period end

---

## Content Moderation

### Upload Review Process
1. **Automated checks**: Audio fingerprinting (detect duplicates/piracy), metadata validation
2. **Rights verification**: ISRC code check, label authorization confirmation
3. **Content filtering**: Hate speech detection in lyrics/metadata (NLP-based)
4. **Manual review**: Queue for flagged content — 24-hour SLA
5. **Appeal process**: Artist can dispute takedowns within 14 days

### Prohibited Content
- Content promoting violence, hate, or discrimination
- Unauthorized covers/remixes without licensing
- AI-generated content without disclosure
- Explicit content without proper tagging (allowed with explicit flag)
- Content violating sanctions laws (blocked territories/artists)

### DMCA/Takedown Process
- Designated DMCA agent registered with US Copyright Office
- Takedown requests: respond within 24 hours
- Counter-notification process: 10-14 business day window
- Repeat infringers: three-strike policy → permanent account suspension
- Canadian notice-and-notice regime compliance (Copyright Modernization Act)

---

## Data Privacy & Protection

### PIPEDA Compliance (Canada — Primary Jurisdiction)
- **Consent**: Explicit consent for data collection at signup, granular preferences
- **Purpose limitation**: Data used only for stated purposes (streaming, recommendations, payments)
- **Retention**: Personal data retained only while account active + 2 years post-deletion
- **Access**: Users can export all data within 30 days of request
- **Correction**: Users can update personal info at any time via settings
- **Breach notification**: Privacy Commissioner notified within 72 hours, users notified immediately if significant harm risk

### Data Collection Inventory
| Data Type | Purpose | Retention | Legal Basis |
|---|---|---|---|
| Account info (email, name) | Authentication | Active + 2yr | Consent |
| Listening history | Recommendations, royalties | Active + 1yr | Legitimate interest |
| Payment info (tokenized) | Billing | Active + 7yr (CRA) | Contract |
| Device info | Offline DRM, security | Active + 1yr | Legitimate interest |
| Location (country-level) | Content licensing, pricing | Active | Consent |
| Search queries | Search improvement | 90 days (anonymized) | Legitimate interest |
| Social interactions | Community features | Active + 1yr | Consent |

### International Privacy (Future Markets)
| Market | Regulation | Key Requirements |
|---|---|---|
| France/EU | GDPR | DPO appointment, DPIAs, cross-border transfer mechanisms |
| DRC | Data protection evolving | Compliance monitoring as laws develop |
| Nigeria | NDPR 2019 | Data protection officer, local processing consideration |
| Kenya | DPA 2019 | Registration with data commissioner |
| US (various states) | CCPA/CPRA (California) | Do-not-sell, right to delete, privacy notice |

---

## Platform Compliance

### App Store Compliance
- **Apple App Store**: In-app purchase for subscriptions (30% → 15% small business program)
- **Google Play**: Google Play Billing for subscriptions (15% for first $1M/year)
- **Content ratings**: Age rating submission (music — unrated, explicit content flagged)
- **Privacy labels**: App privacy nutrition labels (iOS) and data safety sections (Android)

### Accessibility Compliance
- **AODA** (Ontario): Accessibility for Ontarians with Disabilities Act — WCAG 2.0 Level AA
- **ACA** (Federal): Accessible Canada Act — barrier-free digital services
- **ADA** (US, future): Americans with Disabilities Act — digital accessibility
- Audit: Annual WCAG 2.1 AA compliance audit by third-party accessibility firm

### Advertising Compliance
- **CASL**: Canadian Anti-Spam Legislation — explicit consent for promotional emails
- **Competition Act**: Truthful advertising, no misleading claims about catalog size or quality
- **COPPA** (US): Children's Online Privacy Protection — no accounts for under-13 without parental consent
- Ad content review: all ads screened for appropriateness (no alcohol, gambling, explicit content)

---

## Artist & Creator Rights

### Artist Agreement Terms
- Non-exclusive licensing (artists retain all rights — CongoWave gets streaming license)
- 70/30 revenue split (70% to artist/rights holder, 30% to CongoWave)
- Transparent analytics: real-time stream counts, geographic breakdown, playlist placements
- Withdrawal rights: artist can remove content with 30-day notice
- No exclusivity requirements for free-tier artists

### Label Partnership Terms
- Revenue share: negotiated per label (typically 60/40 to 65/35 in label's favor)
- Minimum guarantee: annual minimum payment for catalog access
- Reporting: monthly streaming reports with detailed track-level data
- Audit rights: labels can audit CongoWave's royalty calculations annually
- Territory restrictions: respect territorial licensing limitations

---

## Security & Fraud Prevention

### Content Protection
- **DRM**: Widevine L1 (Android/web) + FairPlay (iOS) for downloaded content
- **Stream protection**: Token-based URLs with 24-hour expiry, geo-validation
- **Fingerprinting**: Audio fingerprint database to detect unauthorized uploads
- **Watermarking**: Invisible audio watermarks on Premium content for piracy tracing

### Account Security
- MFA: optional (encouraged for artist/label accounts)
- Brute-force protection: account lockout after 5 failed attempts
- Session management: concurrent device limits (1 stream at a time for Free, 3 for Premium)
- Suspicious activity: ML-based anomaly detection (location jumps, unusual listening patterns)

### Fraud Prevention
```
Stream Fraud Detection Pipeline:
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Collect  │    │ Pattern  │    │ Action   │
│ stream   │ →  │ analysis │ →  │          │
│ events   │    │ (bots,   │    │ Flag/    │
│          │    │ loops,   │    │ suppress/│
│          │    │ farms)   │    │ ban      │
└──────────┘    └──────────┘    └──────────┘

Signals: same-IP bulk plays, <30sec repeated plays,
         midnight bulk streaming, device fingerprint clusters
```

---

## Compliance Roadmap

### 2025 — Launch Compliance
- SOCAN + Re:Sound + CMRRA licensing agreements
- PIPEDA compliance framework + privacy policy
- DMCA agent registration + takedown process
- CASL email marketing compliance
- App Store / Google Play submission compliance

### 2026 — Scale Compliance
- AODA/ACA accessibility audit and remediation
- Expanded label licensing (50+ independent labels)
- Artist royalty transparency dashboard
- Ad revenue compliance (Competition Act, truthful advertising)
- Content moderation automation (NLP hate speech detection)

### 2027 — International Compliance
- SOCODA licensing (DRC market entry)
- SACEM licensing (France expansion)
- GDPR compliance (EU diaspora users)
- Mobile money payment compliance (DRC, Kenya regulations)
- DRM implementation for offline downloads

### 2028 — Mature Compliance
- Multi-territory licensing management system
- Automated royalty calculation across 10+ CMOs
- Privacy compliance across 5+ jurisdictions
- Annual SOC 2 Type II audit
- Blockchain-based rights verification pilot
