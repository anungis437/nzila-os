# 📚 Companion Integration Guide

**Last Updated:** February 17, 2026  
**Owner:** CTO & Product Lead  
**Audience:** Engineering + Product Teams

---

## 🎯 OVERVIEW

This guide provides a **step-by-step integration workflow** for adding the **Companion Engine** to a new Nzila platform. Follow this 4-week timeline to deploy a production-ready Companion experience.

**Expected Timeline**: 4 weeks (1 engineer + 1 product lead)

**Prerequisites**:
- ✅ Platform uses standardized architecture (Django 5 backend + Next.js 14 frontend)
- ✅ Azure OpenAI API access configured
- ✅ PostgreSQL with pgVector extension enabled
- ✅ Clerk authentication integrated

---

## 📅 4-WEEK INTEGRATION TIMELINE

### **WEEK 1: Requirements & Design**

#### **Day 1-2: Define Use Case & Tone Profile**

**Task**: Identify Companion's role in your platform

**Questions to Answer**:
1. **What is Companion's primary use case?**
   - Memora: Cognitive wellness companion (daily check-ins, game nudges)
   - ABR: Anti-racism learning coach (personalized coaching, case analysis)
   - Union Eyes: Grievance guidance (contract interpretation, outcome prediction)
   - CORA: Farm advisory (crop planning, market pricing, sustainability)

2. **What tone profile fits your platform?**
   - **Warm** (Memora): Caring, gentle, encouraging (dementia care, caregiver support)
   - **Professional** (Union Eyes): Respectful, knowledgeable, clear (labor relations)
   - **Motivational** (ABR): Inspiring, growth-oriented, affirmative (learning, DEI)
   - **Practical** (CORA): Direct, helpful, data-driven (agriculture, business decisions)

3. **What user states should Companion handle?**
   - New user: Onboarding, feature discovery
   - Active user: Engagement nudges, personalized recommendations
   - Lapsed user: Re-engagement, gentle check-ins
   - Distressed user: Safe fallback tone, support resources

**Deliverable**: Companion Use Case Document (see `docs/business-guides/companion-use-case-template.md`)

---

#### **Day 3-5: Select/Customize Prompts**

**Task**: Review existing Prompt Library and customize for your platform

**Process**:
1. **Access Prompt Library** (🔴 NDA-required)
   - Request access from CTO/AI Lead
   - Review: `ai/PROMPT_LIBRARY_OVERVIEW.md`
   
2. **Filter Prompts by Domain**
   - Healthtech: `companion_prompts WHERE domain='healthtech'`
   - Justice-Equity: `companion_prompts WHERE domain='justice'`
   - AgTech: `companion_prompts WHERE domain='agtech'`
   - UnionTech: `companion_prompts WHERE domain='uniontech'`
   
3. **Customize or Create New Prompts**
   - Reuse existing prompts where possible (network effects)
   - Create platform-specific prompts for unique features
   - Follow: `ai/PROMPT_ENGINEERING_STANDARDS.md` for tone/voice guidelines

**Example**: CORA Farm Advisory Prompt
```sql
INSERT INTO companion_prompts (platform, domain, category, tone_profile, user_state, prompt_template, variables) VALUES
('cora', 'agtech', 'market_pricing_alert', 'practical', 'active',
 'Hi {{farmer_name}}, canola prices just jumped 8% in Saskatchewan (now ${{price_per_bushel}}/bu). Based on your {{acres}} acres, that's a ${{revenue_impact}} opportunity. Want to see elevator bids?',
 '{"farmer_name": "string", "acres": "integer", "price_per_bushel": "decimal", "revenue_impact": "decimal"}');
```

**Deliverable**: Platform Prompt Catalogue (10-20 prompts minimum for MVP)

---

### **WEEK 2: Backend Integration**

#### **Day 6-7: Deploy Django 5 Companion API Endpoints**

**Task**: Set up backend API infrastructure

**Implementation**:

```python
# platform_name/api/companion.py (Django 5)
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from companion.services import CompanionEngine
import logging

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_companion_prompt(request):
    """Generate personalized Companion prompt"""
    platform = request.data.get('platform')
    category = request.data.get('category')
    user_context = request.data.get('user_context', {})
    
    # Initialize Companion Engine
    companion = CompanionEngine(
        user_id=request.user.id,
        platform=platform
    )
    
    # Generate prompt
    result = companion.generate_prompt(
        category=category,
        context=user_context
    )
    
    # Track telemetry
    logger.info(f"Companion prompt generated", extra={
        'platform': platform,
        'category': category,
        'latency_ms': result['metadata']['latency_ms']
    })
    
    return Response(result)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_personality_profile(request):
    """Update user's Companion personality settings"""
    platform = request.data.get('platform')
    updates = request.data.get('updates', {})
    
    companion = CompanionEngine(
        user_id=request.user.id,
        platform=platform
    )
    
    profile = companion.update_personality(updates)
    
    return Response(profile)
```

**Deliverable**: 
- API endpoints deployed: `/api/companion/generate`, `/api/companion/personality`
- Swagger/OpenAPI documentation

---

#### **Day 8-9: Configure PostgreSQL + pgVector**

**Task**: Set up database schema for Companion data

**Migration**:

```sql
-- migrations/0001_companion_schema.sql
-- Run this migration in your platform's PostgreSQL database

-- 1. Enable pgVector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Companion Personality Profiles (platform-specific)
CREATE TABLE companion_personality_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL DEFAULT 'your_platform_name',
    
    warmth_level DECIMAL(3,2) DEFAULT 0.70,
    formality_level DECIMAL(3,2) DEFAULT 0.50,
    humor_level DECIMAL(3,2) DEFAULT 0.30,
    directness_level DECIMAL(3,2) DEFAULT 0.50,
    
    preferred_time_of_day VARCHAR(20),
    max_nudges_per_day INTEGER DEFAULT 1,
    nudge_frequency_hours INTEGER DEFAULT 24,
    last_interaction_at TIMESTAMP,
    total_interactions INTEGER DEFAULT 0,
    
    consent_caregiver_sync BOOLEAN DEFAULT FALSE,
    consent_mood_tracking BOOLEAN DEFAULT FALSE,
    companion_enabled BOOLEAN DEFAULT TRUE,
    locale VARCHAR(10) DEFAULT 'en-CA',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, platform)
);

-- 3. Companion Memory (user context)
CREATE TABLE companion_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL DEFAULT 'your_platform_name',
    
    memory_type VARCHAR(50) NOT NULL,
    memory_key VARCHAR(100) NOT NULL,
    memory_value JSONB,
    
    embedding VECTOR(1536),
    
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- 4. Companion Nudge Log (audit trail)
CREATE TABLE companion_nudge_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL DEFAULT 'your_platform_name',
    
    prompt_id UUID,
    nudge_type VARCHAR(50) NOT NULL,
    generated_text TEXT NOT NULL,
    tone_profile VARCHAR(50),
    
    user_action VARCHAR(50),
    engagement_duration_seconds INTEGER,
    satisfaction_rating INTEGER,
    
    personality_snapshot JSONB,
    memory_context JSONB,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_companion_personality_user ON companion_personality_profiles(user_id);
CREATE INDEX idx_companion_memory_user ON companion_memory(user_id);
CREATE INDEX idx_companion_memory_embedding ON companion_memory USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_companion_nudge_log_user ON companion_nudge_log(user_id);
```

**Deliverable**: Database schema deployed, migrations run successfully

---

#### **Day 10: Azure OpenAI Configuration**

**Task**: Configure Azure OpenAI API access with per-platform quotas

**Configuration**:

```python
# platform_name/settings/companion.py
import os

AZURE_OPENAI_CONFIG = {
    'endpoint': os.getenv('AZURE_OPENAI_ENDPOINT'),  # https://nzila-openai.openai.azure.com/
    'api_key': os.getenv('AZURE_OPENAI_API_KEY'),    # Stored in Azure Key Vault
    'deployment_name': 'gpt-4-turbo',
    'api_version': '2024-02-15-preview',
    
    # Per-platform quota management
    'max_tokens_per_prompt': 150,
    'max_prompts_per_user_per_day': 20,
    'temperature': 0.7,
    'top_p': 0.9,
}

COMPANION_CONFIG = {
    'platform': 'your_platform_name',
    'default_tone': 'warm',  # warm, professional, motivational, practical
    'max_nudges_per_day': 1,
    'nudge_frequency_hours': 24,
    'enable_mood_tracking': False,
    'enable_caregiver_sync': False,
}
```

**Deliverable**: Azure OpenAI credentials configured, quota limits set

---

### **WEEK 3: Frontend Integration**

#### **Day 11-13: Install Next.js 14 Companion Client SDK**

**Task**: Integrate Companion UI components in your Next.js frontend

**Installation**:

```bash
# Install Companion SDK (internal npm package)
npm install @nzila/companion-client
```

**Usage**:

```tsx
// app/components/CompanionPrompt.tsx
'use client';

import { useCompanion } from '@nzila/companion-client';
import { useState } from 'react';

export function CompanionPrompt({ platform, category, userContext }) {
  const { generatePrompt, loading, error } = useCompanion();
  const [prompt, setPrompt] = useState(null);

  const fetchPrompt = async () => {
    const result = await generatePrompt({
      platform,
      category,
      user_context: userContext
    });
    setPrompt(result);
  };

  return (
    <div className="companion-card">
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {prompt && (
        <div>
          <p className="companion-text">{prompt.generated_text}</p>
          <button onClick={() => handleEngage(prompt.prompt_id)}>
            Let's do it
          </button>
          <button onClick={() => handleDismiss(prompt.prompt_id)}>
            Not now
          </button>
        </div>
      )}
      <button onClick={fetchPrompt}>Get Daily Check-In</button>
    </div>
  );
}
```

**Deliverable**: Companion UI components integrated in platform

---

#### **Day 14-15: Build UI Components**

**Task**: Design platform-specific Companion UI

**Components to Build**:

1. **Companion Card** (Main Interaction)
   ```tsx
   // components/CompanionCard.tsx
   <CompanionCard
     prompt="Hi Sarah! Want to try a cognitive game?"
     tone="warm"
     actions={[
       { label: "Let's play", onClick: handleEngage },
       { label: "Not now", onClick: handleDismiss }
     ]}
   />
   ```

2. **Companion Settings** (User Preferences)
   ```tsx
   // components/CompanionSettings.tsx
   <CompanionSettings
     warmth={0.75}
     maxNudgesPerDay={1}
     companionEnabled={true}
     onUpdate={handleUpdatePersonality}
   />
   ```

3. **Companion Tooltip** (Explainability)
   ```tsx
   // components/CompanionTooltip.tsx
   <CompanionTooltip
     text="Why am I seeing this?"
     explanation="You haven't played a cognitive game in 3 days. Regular activity helps maintain cognitive wellness."
   />
   ```

**Design Principles**:
- ✅ **Non-intrusive**: Subtle card, not modal/popup
- ✅ **Dismissible**: Always allow "Not now" option
- ✅ **Explainable**: "Why this prompt?" tooltip on every nudge
- ✅ **Accessible**: WCAG 2.1 AA compliance (keyboard nav, screen reader support)

**Deliverable**: 3-5 Companion UI components styled and functional

---

### **WEEK 4: Testing & Launch**

#### **Day 16-17: Functional QA**

**Task**: Test Companion across expected use cases

**Test Cases**:

```python
# tests/test_companion_integration.py
import pytest
from api.companion import generate_companion_prompt

def test_new_user_onboarding_prompt():
    """Test Companion prompt for new user"""
    response = generate_companion_prompt(
        user_id='new-user-123',
        platform='your_platform',
        category='onboarding',
        user_context={'user_name': 'Alex', 'days_since_signup': 0}
    )
    
    assert 'Alex' in response['generated_text']
    assert response['tone_profile'] == 'warm'
    assert 'welcome' in response['generated_text'].lower()

def test_lapsed_user_reengagement():
    """Test Companion prompt for lapsed user (7+ days inactive)"""
    response = generate_companion_prompt(
        user_id='lapsed-user-456',
        platform='your_platform',
        category='check_in',
        user_context={'user_name': 'Sarah', 'days_inactive': 10}
    )
    
    assert 'Sarah' in response['generated_text']
    assert 'missed' in response['generated_text'].lower()
```

**Deliverable**: 20+ functional tests passing, code coverage >80%

---

#### **Day 18: Edge Case & Bias Testing**

**Task**: Test rare scenarios and demographic fairness

**Edge Cases**:
- User with special characters in name (`O'Reilly`, `José`)
- User with very low engagement (dismissed 10+ prompts in a row)
- User who disabled Companion but re-enabled
- User in distress (low mood, crisis indicators)

**Bias Testing**:
```python
# tests/test_companion_bias.py
def test_tone_no_gender_bias():
    """Ensure tone doesn't vary by gender (same engagement)"""
    male_tone = calculate_tone('male-user', same_history)
    female_tone = calculate_tone('female-user', same_history)
    
    assert abs(male_tone['warmth'] - female_tone['warmth']) < 0.05

def test_tone_no_age_bias():
    """Ensure tone doesn't vary by age (same engagement)"""
    young_tone = calculate_tone('young-user-25', same_history)
    senior_tone = calculate_tone('senior-user-75', same_history)
    
    assert abs(young_tone['formality'] - senior_tone['formality']) < 0.05
```

**Deliverable**: Edge cases documented, bias tests passing

---

#### **Day 19: Pilot Rollout (10-50 Users)**

**Task**: Launch Companion to small user cohort

**Pilot Checklist**:
- [ ] Select 10-50 pilot users (consent-based)
- [ ] Enable Companion for pilot cohort (`companion_enabled=TRUE`)
- [ ] Set up monitoring dashboard (Application Insights)
- [ ] Send pilot onboarding email (explain Companion, how to disable)
- [ ] Schedule daily check-in calls with Product Lead

**Monitoring**:
- Track: Engagement rate, dismissal rate, satisfaction ratings
- Alert: If >30% dismissals or <3.5/5 satisfaction → pause rollout

**Deliverable**: Pilot launched, 10-50 users actively using Companion

---

#### **Day 20: Production Launch (Gradual Rollout)**

**Task**: Scale Companion to all users (gradual 25% → 50% → 100%)

**Launch Plan**:

1. **Week 1**: 25% of active users
   - Monitor: Latency, error rate, user satisfaction
   - Adjust: Tone profile if <4.0/5 satisfaction

2. **Week 2**: 50% of active users
   - Monitor: Engagement trends, A/B test new prompts
   - Iterate: Add 5-10 new prompts based on feedback

3. **Week 3**: 100% of active users
   - Monitor: Companion disable rate (<5% target)
   - Document: Lessons learned, best practices

**Rollout Script**:
```sql
-- Gradual rollout (25% → 50% → 100%)
-- Week 1: Enable for 25% of users
UPDATE companion_personality_profiles
SET companion_enabled = TRUE
WHERE user_id IN (
    SELECT user_id FROM users
    WHERE RANDOM() < 0.25  -- 25% sample
);
```

**Deliverable**: Companion in production, 100% rollout complete

---

## 🧪 QA CHECKLIST

### **Pre-Launch Checklist** (All must pass ✅)

- [ ] **Functional Tests**: 20+ tests passing, >80% code coverage
- [ ] **Edge Case Tests**: 10+ edge cases documented and tested
- [ ] **Bias Tests**: No gender/age/cultural bias detected (demographic parity)
- [ ] **Security**: API endpoints require authentication, RLS policies enforced
- [ ] **Privacy**: User data logging complies with PIPEDA, Law 25, GDPR
- [ ] **Explainability**: "Why this prompt?" tooltip on all nudges
- [ ] **Consent**: Users can disable/pause Companion anytime
- [ ] **Monitoring**: Application Insights telemetry configured
- [ ] **Audit Trail**: All nudges logged in `companion_nudge_log`
- [ ] **Ethics Review**: AI Governance Council approval (CTO + Legal + Ethics)

---

## 📊 POST-LAUNCH MONITORING

### **Week 1-4 After Launch**

**Daily Monitoring** (Application Insights Dashboard):
- **Latency**: <500ms p95 (alert if >1000ms)
- **Error Rate**: <0.5% (alert if >2%)
- **User Engagement**: >50% weekly active users engage with Companion
- **Dismissal Rate**: <30% (alert if >50%)
- **Disable Rate**: <5/day (alert if >20/day)

**Weekly Reviews** (Product + Engineering):
- User satisfaction surveys (5-question feedback form)
- Top 5 most/least effective prompts
- New prompt ideas from user feedback
- A/B test results for tone variations

---

## 🎓 EXAMPLE: CORA FARM ADVISORY COMPANION

**Use Case**: Farm advisory AI for Canadian farmers (crop planning, market pricing, sustainability)

**Tone Profile**: Practical, data-driven, helpful (not overly warm)

**Sample Prompts**:

```sql
-- 1. Market Pricing Alert (Active Farmer)
INSERT INTO companion_prompts VALUES (
    'cora', 'agtech', 'market_pricing_alert', 'practical', 'active',
    'Hi {{farmer_name}}, canola prices jumped 8% in Saskatchewan today (now ${{price_per_bushel}}/bu). Based on your {{acres}} acres, that's a ${{revenue_impact}} opportunity. Want to see elevator bids?',
    '{"farmer_name": "string", "acres": "integer", "price_per_bushel": "decimal", "revenue_impact": "decimal"}'
);

-- 2. Crop Planning Reminder (New Farmer)
INSERT INTO companion_prompts VALUES (
    'cora', 'agtech', 'crop_planning_reminder', 'practical', 'new',
    'Welcome to CORA, {{farmer_name}}! 👋 Spring seeding is 6 weeks away. Want help planning your crop rotation for {{acres}} acres? I can suggest optimal wheat/canola/barley mixes based on your soil type.',
    '{"farmer_name": "string", "acres": "integer"}'
);

-- 3. Sustainability Nudge (Active Farmer)
INSERT INTO companion_prompts VALUES (
    'cora', 'agtech', 'sustainability_nudge', 'practical', 'active',
    '{{farmer_name}}, your farm could earn ${{carbon_credit_estimate}} in carbon credits this year with no-till practices. Want to see the breakdown?',
    '{"farmer_name": "string", "carbon_credit_estimate": "decimal"}'
);
```

---

## 🚀 NEXT STEPS AFTER LAUNCH

### **Phase 2: Advanced Features** (Months 2-6)

1. **Mood Tracking** (Phase 3 Roadmap)
   - Sentiment analysis on user messages
   - Fatigue detection (adjust tone if user overwhelmed)
   - Caregiver alerts (if consented)

2. **Companion Learning Loop** (Phase 3-4 Roadmap)
   - Adaptive frequency (reduce nudges if dismissal rate high)
   - Adaptive tone (more playful if high engagement)
   - Personalized prompt selection (ML-based ranking)

3. **Multi-Language Support**
   - Expand beyond English/French (Spanish, Mandarin, Arabic)
   - Cultural tone adaptation (formality norms by culture)

4. **Companion API** (B2B Offering, 2027 Roadmap)
   - White-label Companion SDK for third-party platforms
   - Licensing model ($5K-$20K/year per platform)

---

## 📚 ADDITIONAL RESOURCES

| Resource | Purpose |
|----------|---------|
| **ai/PROMPT_ENGINEERING_STANDARDS.md** | Voice, tone, personalization rules |
| **ai/COMPANION_ENGINE_ARCHITECTURE.md** | Technical specs, API contracts |
| **ai/AI_GOVERNANCE_FRAMEWORK.md** | Ethics, safety, bias audits |
| **ai/platform-integrations/memora-companion.md** | Reference implementation (healthtech) |
| **ai/platform-integrations/abr-companion.md** | Reference implementation (justice-equity) |

---

**© 2026 Nzila Ventures. Confidential & Proprietary.**  
*Last Updated: February 17, 2026*
