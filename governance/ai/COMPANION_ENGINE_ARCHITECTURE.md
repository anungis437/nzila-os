# 🏗️ Companion Engine — Technical Architecture

**Last Updated:** February 17, 2026  
**Owner:** CTO & AI Lead  
**Review Cycle:** Quarterly (Engineering + Product)

---

## 🎯 OVERVIEW

The **Companion Engine** is Nzila's proprietary AI personalization layer, providing adaptive voice, tone, and behavior change capabilities across 12+ platforms. This document details the technical architecture, API contracts, data models, and integration patterns.

**Key Capabilities**:
- ✅ **Adaptive Voice & Tone** (Companion Personality Graph: warmth/formality/humor spectrum)
- ✅ **200+ GPT-4 Prompts** (domain-specific, categorized by platform, tone, user state)
- ✅ **Behavior Change Architecture** (nudge engine, gamification, memory/context)
- ✅ **Multi-Platform Consistency** (single deployment, domain-specific customization)
- ✅ **Privacy-First** (Law 25, PIPEDA, GDPR, HIPAA compliant, de-identified training data)

---

## 🏗️ SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT APPLICATIONS                             │
│  (Memora, ABR Insights, CareAI, Union Eyes, CORA, FamilySync, etc.)    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (Next.js 14 Client SDK)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPANION API GATEWAY (Django 5)                      │
│  - Authentication (Clerk JWT validation)                                 │
│  - Rate limiting (per-platform quotas)                                   │
│  - Request routing (prompt generation, memory retrieval, nudge delivery) │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
        ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
        │ PROMPT GENERATOR │ │ PERSONALITY  │ │ MEMORY ENGINE    │
        │                  │ │ GRAPH ENGINE │ │                  │
        │ - Prompt lookup  │ │ - Tone adapt │ │ - User context   │
        │ - Template merge │ │ - Cultural   │ │ - Interaction    │
        │ - Variable inject│ │   localize   │ │   history        │
        └──────────────────┘ └──────────────┘ └──────────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    ▼
            ┌───────────────────────────────────────────────┐
            │      AZURE OPENAI SERVICE (GPT-4 Turbo)       │
            │  - Text generation (personalized responses)   │
            │  - Embeddings (semantic search, context)      │
            │  - Content Safety (harmful content filter)    │
            └───────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │        POSTGRESQL (Azure Flexible Server)                │
        │  - Prompt Library (200+ prompts, RLS policies)           │
        │  - User Memory (preferences, interaction history)        │
        │  - Personality Profiles (tone settings, engagement)      │
        │  - pgVector (semantic search, prompt similarity)         │
        └─────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │     AZURE APPLICATION INSIGHTS (Telemetry)               │
        │  - Prompt performance (latency, user satisfaction)       │
        │  - Error tracking (API failures, edge cases)             │
        │  - Bias monitoring (demographic metrics, tone audits)    │
        └─────────────────────────────────────────────────────────┘
```

---

## 🗄️ DATA MODELS

### **1. Prompt Library Schema**

```sql
-- Companion Prompt Library (🔴 Trade Secret, NDA-required access)
CREATE TABLE companion_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(50) NOT NULL,        -- 'memora', 'abr', 'union_eyes', 'cora', 'shared'
    domain VARCHAR(50) NOT NULL,          -- 'healthtech', 'justice', 'uniontech', 'agtech'
    category VARCHAR(100) NOT NULL,       -- 'check_in', 'game_nudge', 'learning_coach', 'grievance_guide'
    tone_profile VARCHAR(50) NOT NULL,    -- 'warm', 'professional', 'motivational', 'neutral'
    user_state VARCHAR(50) NOT NULL,      -- 'new', 'active', 'lapsed', 'distressed'
    prompt_template TEXT NOT NULL,        -- GPT-4 prompt with {{variables}}
    variables JSONB,                      -- {"user_name": "string", "activity_gap_days": "integer"}
    locale VARCHAR(10) DEFAULT 'en-CA',   -- 'en-CA', 'fr-CA'
    version INTEGER DEFAULT 1,            -- Versioning for A/B tests
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    -- Row-Level Security (RLS) for multi-tenant isolation
    CONSTRAINT rls_policy_companion_prompts CHECK (platform IN (SELECT platform FROM user_platform_access WHERE user_id = current_user_id()))
);

-- Indexes
CREATE INDEX idx_companion_prompts_platform ON companion_prompts(platform);
CREATE INDEX idx_companion_prompts_category ON companion_prompts(category);
CREATE INDEX idx_companion_prompts_tone ON companion_prompts(tone_profile);

-- Example Prompt
INSERT INTO companion_prompts (platform, domain, category, tone_profile, user_state, prompt_template, variables) VALUES
('memora', 'healthtech', 'check_in', 'warm', 'active', 
 'Good morning, {{user_name}}! 😊 How are you feeling today? I noticed it's been {{activity_gap_days}} days since your last cognitive game. Want to try a quick memory challenge?',
 '{"user_name": "string", "activity_gap_days": "integer"}');
```

### **2. Companion Personality Profile**

```sql
-- Companion Personality Graph (🔴 Trade Secret, tone adaptation algorithm)
CREATE TABLE companion_personality_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    
    -- Tone Spectrum (0.0 to 1.0, adaptive based on user interaction patterns)
    warmth_level DECIMAL(3,2) DEFAULT 0.70,      -- 0.0 = formal, 1.0 = very warm
    formality_level DECIMAL(3,2) DEFAULT 0.50,   -- 0.0 = casual, 1.0 = professional
    humor_level DECIMAL(3,2) DEFAULT 0.30,       -- 0.0 = serious, 1.0 = playful
    directness_level DECIMAL(3,2) DEFAULT 0.50,  -- 0.0 = gentle, 1.0 = direct
    
    -- Engagement Patterns
    preferred_time_of_day VARCHAR(20),            -- 'morning', 'afternoon', 'evening'
    max_nudges_per_day INTEGER DEFAULT 1,
    nudge_frequency_hours INTEGER DEFAULT 24,
    last_interaction_at TIMESTAMP,
    total_interactions INTEGER DEFAULT 0,
    
    -- User Preferences
    consent_caregiver_sync BOOLEAN DEFAULT FALSE,
    consent_mood_tracking BOOLEAN DEFAULT FALSE,
    companion_enabled BOOLEAN DEFAULT TRUE,
    locale VARCHAR(10) DEFAULT 'en-CA',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_companion_personality_user ON companion_personality_profiles(user_id);
CREATE INDEX idx_companion_personality_platform ON companion_personality_profiles(platform);
```

### **3. Companion Memory (User Context)**

```sql
-- Companion Memory Engine (user interaction history, preferences)
CREATE TABLE companion_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    
    -- Memory Types
    memory_type VARCHAR(50) NOT NULL,  -- 'preference', 'interaction', 'milestone', 'caregiver_note'
    memory_key VARCHAR(100) NOT NULL,  -- 'favorite_game', 'last_check_in_mood', 'streak_count'
    memory_value JSONB,                -- Flexible storage for any context
    
    -- Semantic Search (pgVector for prompt similarity)
    embedding VECTOR(1536),            -- OpenAI text-embedding-ada-002 (1536 dimensions)
    
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP               -- Optional expiration (e.g., 90-day interaction history)
);

-- Indexes
CREATE INDEX idx_companion_memory_user ON companion_memory(user_id);
CREATE INDEX idx_companion_memory_type ON companion_memory(memory_type);
CREATE INDEX idx_companion_memory_embedding ON companion_memory USING ivfflat (embedding vector_cosine_ops);

-- Example Memory
INSERT INTO companion_memory (user_id, platform, memory_type, memory_key, memory_value) VALUES
('user-123', 'memora', 'preference', 'favorite_game', '{"game_type": "word_association", "difficulty": "medium"}'),
('user-123', 'memora', 'interaction', 'last_check_in_mood', '{"mood": "good", "timestamp": "2026-02-17T09:30:00Z"}');
```

### **4. Companion Nudge Log (Audit Trail)**

```sql
-- Companion Nudge Audit Log (every nudge/alert logged for transparency)
CREATE TABLE companion_nudge_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    
    -- Nudge Details
    prompt_id UUID REFERENCES companion_prompts(id),
    nudge_type VARCHAR(50) NOT NULL,       -- 'check_in', 'game_nudge', 'caregiver_alert', 'learning_coach'
    generated_text TEXT NOT NULL,          -- Actual text shown to user
    tone_profile VARCHAR(50),              -- 'warm', 'professional', 'motivational'
    
    -- User Response
    user_action VARCHAR(50),               -- 'engaged', 'dismissed', 'disabled_companion'
    engagement_duration_seconds INTEGER,   -- How long user interacted
    satisfaction_rating INTEGER,           -- 1-5 user rating (optional)
    
    -- Context
    personality_snapshot JSONB,            -- Snapshot of personality profile at nudge time
    memory_context JSONB,                  -- Relevant memory used for nudge
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_companion_nudge_log_user ON companion_nudge_log(user_id);
CREATE INDEX idx_companion_nudge_log_platform ON companion_nudge_log(platform);
CREATE INDEX idx_companion_nudge_log_created ON companion_nudge_log(created_at);
```

---

## 🔌 API ENDPOINTS

### **Base URL**: `https://api.nzila.com/v1/companion`

All endpoints require **Clerk JWT authentication** (Bearer token).

---

### **1. Generate Companion Prompt**

**POST** `/companion/generate`

Generate a personalized Companion prompt based on user context, tone profile, and memory.

**Request**:
```json
{
  "platform": "memora",
  "category": "check_in",
  "user_context": {
    "user_name": "Sarah",
    "activity_gap_days": 3,
    "last_mood": "neutral"
  }
}
```

**Response**:
```json
{
  "prompt_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "generated_text": "Good morning, Sarah! 😊 How are you feeling today? I noticed it's been 3 days since your last cognitive game. Want to try a quick memory challenge?",
  "tone_profile": "warm",
  "personality_snapshot": {
    "warmth_level": 0.75,
    "formality_level": 0.40,
    "humor_level": 0.35
  },
  "metadata": {
    "model_version": "gpt-4-turbo-2024-04-09",
    "latency_ms": 450,
    "token_count": 52
  }
}
```

---

### **2. Update Personality Profile**

**PATCH** `/companion/personality`

Update user's Companion personality profile (tone preferences, nudge frequency).

**Request**:
```json
{
  "platform": "memora",
  "warmth_level": 0.80,
  "max_nudges_per_day": 2,
  "preferred_time_of_day": "morning"
}
```

**Response**:
```json
{
  "user_id": "user-123",
  "platform": "memora",
  "warmth_level": 0.80,
  "formality_level": 0.50,
  "humor_level": 0.30,
  "max_nudges_per_day": 2,
  "preferred_time_of_day": "morning",
  "updated_at": "2026-02-17T10:30:00Z"
}
```

---

### **3. Store Memory**

**POST** `/companion/memory`

Store user context, preferences, or interaction history for future personalization.

**Request**:
```json
{
  "platform": "memora",
  "memory_type": "preference",
  "memory_key": "favorite_game",
  "memory_value": {
    "game_type": "word_association",
    "difficulty": "medium"
  }
}
```

**Response**:
```json
{
  "memory_id": "mem-abc123",
  "user_id": "user-123",
  "platform": "memora",
  "memory_type": "preference",
  "memory_key": "favorite_game",
  "created_at": "2026-02-17T10:35:00Z"
}
```

---

### **4. Retrieve Memory**

**GET** `/companion/memory?platform=memora&memory_key=favorite_game`

Retrieve stored user memory by key (or semantic search via embeddings).

**Response**:
```json
{
  "memories": [
    {
      "memory_id": "mem-abc123",
      "memory_type": "preference",
      "memory_key": "favorite_game",
      "memory_value": {
        "game_type": "word_association",
        "difficulty": "medium"
      },
      "created_at": "2026-02-17T10:35:00Z"
    }
  ]
}
```

---

### **5. Log Nudge Interaction**

**POST** `/companion/nudge/log`

Log user's interaction with a Companion nudge (for audit trail, analytics).

**Request**:
```json
{
  "platform": "memora",
  "prompt_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "nudge_type": "check_in",
  "user_action": "engaged",
  "engagement_duration_seconds": 120,
  "satisfaction_rating": 5
}
```

**Response**:
```json
{
  "nudge_log_id": "log-xyz789",
  "user_id": "user-123",
  "platform": "memora",
  "user_action": "engaged",
  "created_at": "2026-02-17T10:40:00Z"
}
```

---

### **6. Disable/Enable Companion**

**PATCH** `/companion/toggle`

Enable or disable Companion for a specific platform.

**Request**:
```json
{
  "platform": "memora",
  "companion_enabled": false
}
```

**Response**:
```json
{
  "user_id": "user-123",
  "platform": "memora",
  "companion_enabled": false,
  "updated_at": "2026-02-17T10:45:00Z"
}
```

---

## 🧠 COMPANION PERSONALITY GRAPH ALGORITHM

**🔴 TRADE SECRET — NDA-REQUIRED ACCESS**

The **Companion Personality Graph** adapts tone based on user interaction patterns using a proprietary algorithm:

### **Tone Adaptation Logic**

```python
# ai/companion/personality_graph.py (🔴 Trade Secret)
from typing import Dict
from decimal import Decimal

def calculate_adaptive_tone(
    user_id: str,
    platform: str,
    interaction_history: List[Dict],
    current_profile: Dict
) -> Dict[str, Decimal]:
    """
    Adaptive Tone Algorithm (🔴 Trade Secret)
    
    Adjusts warmth/formality/humor based on:
    - User engagement patterns (high engagement → more playful)
    - Time since last interaction (lapsed → gentler re-engagement)
    - User-reported satisfaction (low rating → warmer, less formal)
    - Cultural context (French Canadian → slightly more formal)
    
    Returns updated personality profile.
    """
    
    # Baseline tone (platform defaults)
    warmth = current_profile.get('warmth_level', Decimal('0.70'))
    formality = current_profile.get('formality_level', Decimal('0.50'))
    humor = current_profile.get('humor_level', Decimal('0.30'))
    
    # Factor 1: Engagement Rate
    avg_engagement_duration = calculate_avg_engagement(interaction_history)
    if avg_engagement_duration > 60:  # High engagement (>60 seconds)
        humor += Decimal('0.10')  # More playful
        warmth += Decimal('0.05')
    elif avg_engagement_duration < 20:  # Low engagement (<20 seconds)
        formality -= Decimal('0.10')  # Less formal, more approachable
        warmth += Decimal('0.10')     # Warmer to re-engage
    
    # Factor 2: Lapsed User Re-Engagement
    days_since_last_interaction = calculate_days_since_last(interaction_history)
    if days_since_last_interaction > 7:  # Lapsed >7 days
        warmth += Decimal('0.15')     # Much warmer ("We missed you!")
        formality -= Decimal('0.10')  # More casual
        humor -= Decimal('0.10')      # Less playful, more gentle
    
    # Factor 3: User Satisfaction Ratings
    avg_satisfaction = calculate_avg_satisfaction(interaction_history)
    if avg_satisfaction < 3.5:  # Low satisfaction (<3.5/5)
        warmth += Decimal('0.10')     # Warmer to improve experience
        formality -= Decimal('0.05')  # Slightly less formal
    elif avg_satisfaction >= 4.5:  # High satisfaction (4.5+/5)
        # Maintain current tone (it's working)
        pass
    
    # Factor 4: Cultural Localization
    locale = current_profile.get('locale', 'en-CA')
    if locale == 'fr-CA':  # French Canadian
        formality += Decimal('0.05')  # Slightly more formal (cultural norm)
        warmth += Decimal('0.05')     # Warmer (relational culture)
    
    # Clamp values to [0.0, 1.0]
    warmth = max(Decimal('0.0'), min(Decimal('1.0'), warmth))
    formality = max(Decimal('0.0'), min(Decimal('1.0'), formality))
    humor = max(Decimal('0.0'), min(Decimal('1.0'), humor))
    
    return {
        'warmth_level': warmth,
        'formality_level': formality,
        'humor_level': humor
    }
```

**Differentiators vs. Competitors**:
- Generic chatbots use **one-size-fits-all tone** (same response for all users)
- Companion adapts tone based on **individual user behavior** (engagement, satisfaction, cultural context)
- **Network effects**: More interactions across platforms → better tone adaptation for all users

---

## 🧪 TESTING & QA

### **Functional Testing**

```python
# tests/test_companion_engine.py
import pytest
from companion.api import generate_prompt

def test_prompt_generation_memora_check_in():
    """Test Companion prompt generation for Memora daily check-in"""
    response = generate_prompt(
        user_id="test-user-123",
        platform="memora",
        category="check_in",
        user_context={
            "user_name": "Sarah",
            "activity_gap_days": 3,
            "last_mood": "neutral"
        }
    )
    
    assert response['tone_profile'] == 'warm'
    assert 'Sarah' in response['generated_text']
    assert '3 days' in response['generated_text']
    assert response['metadata']['latency_ms'] < 1000  # <1 second
```

### **Bias Testing**

```python
# tests/test_companion_bias.py
import pytest
from companion.personality_graph import calculate_adaptive_tone

def test_tone_adaptation_no_gender_bias():
    """Ensure tone adaptation doesn't vary by gender"""
    male_user_history = [...]  # Same engagement patterns
    female_user_history = [...]
    
    male_tone = calculate_adaptive_tone('user-male', 'memora', male_user_history, {...})
    female_tone = calculate_adaptive_tone('user-female', 'memora', female_user_history, {...})
    
    assert abs(male_tone['warmth_level'] - female_tone['warmth_level']) < Decimal('0.05')
    assert abs(male_tone['formality_level'] - female_tone['formality_level']) < Decimal('0.05')
```

### **Edge Case Testing**

```python
# tests/test_companion_edge_cases.py
import pytest
from companion.api import generate_prompt

def test_prompt_generation_user_distress():
    """Test Companion falls back to neutral tone if user distress detected"""
    response = generate_prompt(
        user_id="test-user-distress",
        platform="memora",
        category="check_in",
        user_context={
            "user_name": "John",
            "last_mood": "very_low",
            "distress_flag": True
        }
    )
    
    assert response['tone_profile'] == 'neutral'  # Safe fallback
    assert 'How can I support you?' in response['generated_text']
    assert '😊' not in response['generated_text']  # No emojis if distress
```

---

## 📊 MONITORING & TELEMETRY

### **Azure Application Insights Integration**

```python
# companion/telemetry.py
from azure.monitor.opentelemetry import ApplicationInsightsTelemetry
import logging

logger = logging.getLogger(__name__)

def track_prompt_generation(
    platform: str,
    category: str,
    latency_ms: int,
    token_count: int,
    user_satisfaction: int = None
):
    """Track Companion prompt generation metrics"""
    logger.info("Companion prompt generated", extra={
        'platform': platform,
        'category': category,
        'latency_ms': latency_ms,
        'token_count': token_count,
        'user_satisfaction': user_satisfaction,
        'custom_dimensions': {
            'service': 'companion-engine',
            'operation': 'generate_prompt'
        }
    })
```

### **Key Metrics Dashboard** (Azure Application Insights)

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **Prompt Generation Latency** | <500ms (p95) | >1000ms |
| **API Success Rate** | >99.5% | <98% |
| **User Satisfaction (Avg)** | ≥4.5/5 | <4.0 |
| **Nudge Dismissal Rate** | <30% | >50% |
| **Companion Disables (Daily)** | <5 users/day | >20 users/day |
| **Bias Incidents** | 0 | ≥1 |
| **Safety Incidents (Harmful Content)** | 0 | ≥1 |

---

## 🚀 DEPLOYMENT

### **Azure Container Apps Configuration**

```yaml
# azure-container-apps/companion-api.yaml
apiVersion: 2023-05-01
kind: ContainerApp
metadata:
  name: companion-api
spec:
  containers:
  - name: companion-django
    image: nzilaregistry.azurecr.io/companion-api:latest
    env:
    - name: OPENAI_API_KEY
      secretRef: openai-api-key
    - name: DATABASE_URL
      secretRef: postgres-connection-string
    - name: CLERK_SECRET_KEY
      secretRef: clerk-secret-key
    resources:
      cpu: 2.0
      memory: 4Gi
    
  scale:
    minReplicas: 2
    maxReplicas: 10
    rules:
    - http:
        concurrent: 100
```

---

**© 2026 Nzila Ventures. Confidential & Proprietary.**  
**Companion Personality Graph Algorithm: 🔴 Trade Secret (NDA-Required)**  
*Last Updated: February 17, 2026*
