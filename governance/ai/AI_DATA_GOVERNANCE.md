# 🗄️ AI Data Governance & Privacy

**Last Updated:** February 17, 2026  
**Owner:** CTO & Data Protection Officer  
**Review Cycle:** Quarterly (Legal + AI Governance Council)

---

## 🎯 PURPOSE

Nzila's **Companion Engine** processes sensitive user data across healthtech (dementia patients, caregivers), justice-equity (racialized communities, tribunal cases), uniontech (grievances, collective bargaining), and agrotech (farm financials, carbon tracking). This document defines **data handling policies, PII protection, consent management, training data governance, and regulatory compliance** (HIPAA, PIPEDA, Law 25, GDPR, EU AI Act).

---

## 📋 DATA CLASSIFICATION

### **Sensitivity Levels**

| Level | Definition | Examples | Regulations | Storage |
|-------|------------|----------|-------------|---------|
| **🔴 CRITICAL** | Health data, financial records, identifiable user content | Memora health journal entries, Union Eyes grievance details, CORA farm revenue | HIPAA, PIPEDA, Law 25 | PostgreSQL encrypted at rest + in transit, RLS policies, 7-year retention |
| **🟠 SENSITIVE** | Personal identifiers, demographics, behavioral data | User names, emails, IP addresses, interaction logs, prompt history | PIPEDA, GDPR | PostgreSQL encrypted, anonymized after 12 months |
| **🟡 INTERNAL** | Aggregate analytics, de-identified metrics | Platform usage stats, A/B test results, prompt performance | Internal policy only | PostgreSQL, exportable for analysis |
| **🟢 PUBLIC** | Published content, public datasets | CanLII case law, public farm regulations, anonymized research data | Open data policies | Cached in Azure Blob Storage |

---

## 🔐 PII PROTECTION FRAMEWORK

### **PII Detection & Redaction**

**All user inputs are scanned for PII before sending to Azure OpenAI GPT-4:**

**PII Categories Detected**:
- Email addresses (regex: `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`)
- Phone numbers (Canada: `(\\d{3}[-\\.\\s]??\\d{3}[-\\.\\s]??\\d{4}|\\(\\d{3}\\)\\s*\\d{3}[-\\.\\s]??\\d{4})`)
- Social Insurance Numbers (SIN: `\\d{3}-\\d{3}-\\d{3}`)
- Credit card numbers (Luhn algorithm validation)
- Addresses (street, city, postal code via NLP entity recognition)
- Names (via Azure AI Language Named Entity Recognition)

**Implementation** (Django 5 Pre-Processing):

```python
# services/pii_detector.py
import re
from azure.ai.textanalytics import TextAnalyticsClient

def detect_pii(text: str) -> dict:
    """
    Detects PII in user input using regex + Azure AI Language NER.
    Returns: {has_pii: bool, redacted_text: str, entities: list}
    """
    entities = []
    redacted = text
    
    # Regex-based detection
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    emails = re.findall(email_pattern, text)
    for email in emails:
        redacted = redacted.replace(email, "[EMAIL_REDACTED]")
        entities.append({"type": "email", "value": email})
    
    phone_pattern = r'(\d{3}[-\.\s]??\d{3}[-\.\s]??\d{4}|\(\d{3}\)\s*\d{3}[-\.\s]??\d{4})'
    phones = re.findall(phone_pattern, text)
    for phone in phones:
        redacted = redacted.replace(phone, "[PHONE_REDACTED]")
        entities.append({"type": "phone", "value": phone})
    
    # Azure AI Language NER (names, addresses, organizations)
    client = TextAnalyticsClient(endpoint=settings.AZURE_TEXT_ANALYTICS_ENDPOINT, credential=AzureKeyCredential(settings.AZURE_TEXT_ANALYTICS_KEY))
    ner_result = client.recognize_pii_entities([text])[0]
    
    for entity in ner_result.entities:
        if entity.category in ["Person", "Address", "Organization"]:
            redacted = redacted.replace(entity.text, f"[{entity.category.upper()}_REDACTED]")
            entities.append({"type": entity.category, "value": entity.text})
    
    return {
        "has_pii": len(entities) > 0,
        "redacted_text": redacted,
        "entities": entities
    }
```

**Policy**:
- ✅ **User inputs**: Auto-redact PII before sending to GPT-4 (user gets inline notice: "For privacy, I've removed personal details from your message.")
- ✅ **AI outputs**: If GPT-4 outputs PII (e.g., hallucinated address), block and log as 🔴 CRITICAL incident
- ✅ **Logging**: PII entities logged separately in encrypted storage (accessible only to CTO + DPO for audit), never in plain-text logs

---

## 🧾 CONSENT MANAGEMENT

### **Consent Levels**

| Consent Type | Required For | Opt-In/Out | Platforms |
|--------------|--------------|------------|-----------|
| **Basic AI Interaction** | Using Companion Engine (daily check-ins, nudges, coaching) | Opt-in (during onboarding) | All platforms |
| **Data Storage** | Storing user messages, journal entries, interaction history | Opt-in (GDPR/PIPEDA required) | All platforms |
| **Caregiver Sharing** (Memora) | Sharing user data with designated caregiver | Explicit opt-in (layered consent: what data, how often) | Memora, CareAI, FamilySync |
| **Analytics & Product Improvement** | De-identified aggregate analytics (A/B tests, prompt optimization) | Opt-in (default: on, user can disable) | All platforms |
| **AI Training Data** | Using user interactions to improve prompts (de-identified) | Opt-in (default: off, requires explicit consent) | All platforms |
| **Research Participation** | Sharing anonymized data with academic/clinical partners (AGE-WELL, etc.) | Explicit opt-in (separate consent form) | Memora, CareAI, ClinicConnect |

### **Consent Tracking** (Django 5 Data Model)

```python
# models/user_consent.py
class UserConsent(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    consent_type = models.CharField(max_length=50)  # basic_ai, caregiver_sharing, analytics, training_data, research
    granted = models.BooleanField(default=False)
    granted_at = models.DateTimeField(null=True)
    revoked_at = models.DateTimeField(null=True)
    ip_address = models.GenericIPAddressField()  # Audit trail
    consent_version = models.CharField(max_length=20)  # Track changes to consent language
    metadata = models.JSONField(default=dict)  # e.g., {caregiver_id: X, data_types: [messages, mood], frequency: daily}
    
    class Meta:
        unique_together = ('user', 'consent_type')
```

**Consent Workflow**:
1. **Onboarding**: User presented with clear consent options (plain language, toggle switches)
2. **Granular Control**: User can enable/disable each consent type independently (Settings → Privacy)
3. **Revocation**: User can revoke consent anytime → Data deleted within 30 days (GDPR "right to be forgotten")
4. **Caregiver Layered Consent** (Memora specific):
   - User chooses: Which data to share (messages, mood, game scores, journal entries)
   - Frequency: Daily summary, weekly report, emergency alerts only
   - Caregiver must also consent (two-way agreement)

---

## 🎓 TRAINING DATA GOVERNANCE

### **Data Sources for Prompt Development**

| Source | Type | Consent | Use Case |
|--------|------|---------|----------|
| **Synthetic Data** | GPT-4 generated personas, scenarios | None required (no real user data) | Primary training method (80% of prompt development) |
| **De-Identified User Interactions** | Anonymized user messages, AI responses | Opt-in consent required | Prompt optimization, A/B testing (10%) |
| **Clinical Partner Data** | Pilot clinic feedback, anonymized case studies | Research partnership agreement (IRB approved) | Healthtech prompts (Memora, CareAI) (5%) |
| **Public Datasets** | CanLII case law, Statistics Canada, open data | Public domain | Justice-equity (ABR), AgTech (CORA) (5%) |

### **De-Identification Standards**

**Before using user data for training/analysis, apply HIPAA Safe Harbor method:**

1. ✅ **Remove 18 HIPAA identifiers**:
   - Names, addresses (street-level), dates (except year), phone/fax, emails, SSN/SIN, medical record numbers, account numbers, certificate/license numbers, vehicle IDs, device IDs, URLs, IP addresses, biometric IDs, photos, unique identifiers
2. ✅ **K-Anonymity**: Ensure data cannot be re-identified even with external datasets (minimum 5 users per demographic group)
3. ✅ **Expert Determination**: Legal counsel certifies de-identification process (annual review)

**Implementation** (Automated De-ID Pipeline):

```python
# analytics/de_identification.py
def anonymize_user_data(user_interactions: list) -> list:
    """
    De-identifies user interactions for training data.
    Returns: Anonymized dataset compliant with HIPAA Safe Harbor.
    """
    anonymized = []
    
    for interaction in user_interactions:
        # Remove PII
        text = interaction['message']
        pii_result = detect_pii(text)
        redacted = pii_result['redacted_text']
        
        # Generalize demographics (age → age range, location → province)
        age_range = generalize_age(interaction['user_age'])  # e.g., 72 → 70-79
        province_only = interaction['user_province']  # e.g., "Toronto, ON" → "Ontario"
        
        # Remove all dates (except month/year for seasonal analysis)
        created_at = interaction['created_at'].strftime('%Y-%m')  # 2026-02-15 → 2026-02
        
        # Remove unique IDs (user_id, session_id)
        # Keep only: platform, domain, tone, anonymized demographics
        
        anonymized.append({
            "platform": interaction['platform'],
            "domain": interaction['domain'],  # healthtech, justice-equity, etc.
            "tone": interaction['tone'],  # warm, professional, motivational
            "user_age_range": age_range,
            "user_province": province_only,
            "message": redacted,
            "ai_response": interaction['ai_response'],
            "created_month": created_at
        })
    
    return anonymized
```

---

## 📊 DATA RETENTION & DELETION

### **Retention Policies**

| Data Type | Retention Period | Deletion Method | Regulations |
|-----------|-----------------|-----------------|-------------|
| **🔴 CRITICAL Health Data** (Memora journal, mood logs) | 7 years (HIPAA compliance) | Encrypted deletion (NIST 800-88 standards) | HIPAA, PIPEDA |
| **🟠 SENSITIVE User Messages** (Companion chat history) | 12 months (anonymize after) | PostgreSQL hard delete + anonymization | PIPEDA, GDPR |
| **🟡 INTERNAL Analytics** (de-identified aggregate) | 5 years (business intelligence) | Standard database deletion | Internal policy |
| **AI Logs** (prompt inputs/outputs for audit) | 3 years (legal liability) | Encrypted deletion | PIPEDA, Law 25 |
| **Consent Records** | 7 years (legal requirement) | Encrypted archive (read-only after 2 years) | PIPEDA, GDPR |

### **User Data Deletion Workflow**

**User requests account deletion** (GDPR "right to be forgotten"):

1. **30-Day Grace Period**: User account marked for deletion, data inaccessible but recoverable
2. **Hard Delete After 30 Days**:
   - PostgreSQL: `DELETE FROM users WHERE user_id = X;` (cascades to related tables via foreign keys)
   - Azure Blob Storage: Delete user-uploaded files (images, documents)
   - Analytics: Anonymize user from aggregated datasets (replace user_id with hash)
   - Backups: User data purged from next backup cycle (retention: 90 days → user fully removed within 120 days)
3. **Audit Log**: Deletion event recorded (timestamp, IP address, reason: user request vs. inactivity)
4. **Confirmation**: User receives email confirmation (within 48 hours)

**Exceptions** (Data NOT deleted):
- De-identified analytics (already anonymized, no longer personal data under GDPR)
- Legal holds (if user involved in lawsuit, tribunal case → retain until legal matter resolved)
- Financial records (required for tax/audit: 7 years retention)

---

## 🌍 REGULATORY COMPLIANCE

### **Multi-Jurisdictional Framework**

| Regulation | Scope | Nzila Compliance | Status |
|------------|-------|------------------|--------|
| **HIPAA** (US) | Healthtech platforms serving US users (Memora, CareAI) | Business Associate Agreements (BAAs) with US pilot clinics, encrypted PHI, audit logs | ✅ Compliant |
| **PIPEDA** (Canada) | All platforms (Canadian entity) | Consent management, data access requests, privacy officer appointed | ✅ Compliant |
| **Law 25** (Quebec) | All platforms (Quebec users) | Privacy Impact Assessments (PIAs), incident reporting <72 hours, French consent forms | ✅ Compliant |
| **GDPR** (EU) | Platforms with EU users (future expansion) | Data Protection Officer (DPO), GDPR-compliant consent, data portability | ⏳ Ready (no EU users yet) |
| **EU AI Act** (High-Risk AI Systems) | Healthtech AI (Memora, CareAI) | Transparency (AI disclosure), human oversight, bias audits, conformity assessment | ⏳ Monitoring (final rules pending) |

### **Compliance Audits**

**Quarterly Privacy Audit** (Data Protection Officer + Legal):
- [ ] Review 50+ random user accounts (consent status, data accuracy, PII handling)
- [ ] Test data access request workflow (user requests data export → receives within 30 days)
- [ ] Test deletion workflow (user requests deletion → hard delete within 30 days)
- [ ] Review PII detection logs (false positives, false negatives)
- [ ] Validate encryption (PostgreSQL at rest, HTTPS in transit)
- [ ] Check RLS policies (users can only access their own data)
- [ ] Update Privacy Policy (if regulations change, new features added)

**Annual HIPAA Security Risk Assessment** (CTO + HIPAA Officer):
- [ ] Vulnerability scan (Azure Security Center, penetration testing contract)
- [ ] Access control audit (MFA enabled for all admins, least privilege principle)
- [ ] Incident response drill (simulate PHI breach, test notification workflow)
- [ ] Business Associate Agreement review (all subcontractors compliant)
- [ ] Encryption validation (FIPS 140-2 compliant algorithms)
- [ ] Disaster recovery test (restore from backup, verify no data loss)

---

## 🚨 DATA BREACH RESPONSE

### **Breach Notification Timelines**

| Regulation | Timeline | Recipients | Penalties for Non-Compliance |
|------------|----------|-----------|------------------------------|
| **HIPAA** | <60 days (media if >500 users) | Affected users, HHS, media | $100-$50,000 per violation |
| **PIPEDA** | <72 hours (if harm likely) | Privacy Commissioner, affected users | $100,000 per violation |
| **Law 25** (Quebec) | <72 hours | CAI (Commission d'accès à l'information), affected users | Administrative penalties |
| **GDPR** | <72 hours | Supervisory authority, affected users (if high risk) | €20M or 4% revenue |

### **Incident Response Workflow**

**If PII/PHI breach detected** (e.g., unauthorized access, database leak, third-party hack):

**Hour 0-1** (Immediate):
1. **Contain**: Disable affected systems, revoke compromised credentials
2. **Assess**: Number of affected users, data types exposed (PII, PHI, financial)
3. **Notify**: CTO + Data Protection Officer + Legal (Slack #security-incidents + phone call)

**Hour 1-24**:
1. **Forensics**: Determine breach cause (SQL injection, phishing, misconfigured Azure permissions)
2. **Document**: Timeline of breach, systems affected, data exposed
3. **Remediation**: Patch vulnerability, restore from clean backup
4. **Legal Review**: Determine notification obligations (HIPAA, PIPEDA, Law 25, GDPR)

**Hour 24-72**:
1. **Regulatory Notification**: File reports with Privacy Commissioner (PIPEDA), CAI (Law 25), HHS (HIPAA if applicable)
2. **User Notification**: Email affected users (plain language: what happened, what data exposed, what we're doing, what users should do)
3. **Credit Monitoring** (if financial data exposed): Offer 1-year free credit monitoring (Equifax, TransUnion)
4. **Public Disclosure** (if >500 HIPAA users): Media notification, website notice

**Day 7-30**:
1. **Postmortem**: Root cause analysis, lessons learned, update security protocols
2. **Third-Party Audit**: External security firm reviews remediation (required for HIPAA)
3. **Legal Compliance**: Respond to regulator inquiries, cooperate with investigations
4. **Insurance Claim**: File cyber insurance claim (if applicable)

---

## ✅ DATA GOVERNANCE CHECKLIST

**Annual Data Governance Review** (CTO + DPO + Legal):

- [ ] Privacy Policy updated (plain language, accessible, current with features/regulations)
- [ ] Consent forms reviewed (simple language, granular controls, version-tracked)
- [ ] Data inventory current (all databases, storage, third-party processors documented)
- [ ] PII detection accuracy tested (100+ edge cases, false positive rate <5%)
- [ ] De-identification pipeline validated (HIPAA Safe Harbor compliance, k-anonymity ≥5)
- [ ] Retention policies enforced (auto-delete scripts running, audit logs confirm)
- [ ] Encryption validated (PostgreSQL at rest: AES-256, TLS in transit: 1.2+)
- [ ] RLS policies tested (users cannot access other users' data)
- [ ] Breach response plan drilled (tabletop exercise, <72 hour notification ready)
- [ ] Regulatory compliance confirmed (HIPAA, PIPEDA, Law 25, GDPR ready if needed)
- [ ] Third-party processors audited (Azure SOC 2, OpenAI DPA, subcontractors compliant)
- [ ] Training completed (all engineers complete annual privacy training)

---

**© 2026 Nzila Ventures. Confidential & Proprietary.**  
*Privacy-First AI for Sensitive Data*
