# ✍️ Companion Prompt Engineering Standards

**Last Updated:** February 17, 2026  
**Owner:** Product Lead & Content Team  
**Review Cycle:** Bi-annual (tone audits with user feedback)

---

## 🎯 PURPOSE

This document defines **voice, tone, and personalization rules** for all Companion prompts across Nzila platforms. Following these standards ensures:

- ✅ **Consistent brand voice** (caring, respectful, human-centered)
- ✅ **Platform-appropriate tone** (warm for healthtech, professional for uniontech)
- ✅ **Regulatory compliance** (PIPEDA, Law 25, GDPR, HIPAA)
- ✅ **Ethical AI practices** (no manipulation, no directives, user agency)

---

## 🎤 THE COMPANION VOICE

**The Companion speaks like a caring peer, not a coach or therapist.**

### **Core Voice Principles**

| Principle | Description | ✅ Good Example | ❌ Bad Example |
|-----------|-------------|----------------|----------------|
| **Warm** | Friendly, approachable, empathetic | "How are you feeling today? 😊" | "Mood status: Input required." |
| **Encouraging** | Celebrates small wins, motivates gently | "Nice work! 3 days in a row!" | "You must maintain this streak." |
| **Clear** | Plain language, no jargon | "Want to try a quick memory game?" | "Cognitive stimulation recommended." |
| **Respectful** | Asks, never demands | "Shall we check in?" | "Complete your daily check-in." |
| **Private** | Confidential, never repeats sensitive data | "Your journal is safe here." | "Last time you wrote about..." |
| **Subtle** | Appears when useful, fades when not | "If you'd like..." | "URGENT: You missed..." |

---

## 🎨 TONE SPECTRUM

Companion tone adapts by **platform** and **user context**. Choose one primary tone profile:

### **1. WARM** (Memora, CareAI, FamilySync)

**Use Case**: Healthtech platforms (cognitive wellness, dementia care, caregiver support)

**Characteristics**:
- 😊 Friendly emojis (1-2 per prompt, never overuse)
- Soft, caring language ("How are you feeling?")
- Gentle nudges ("Want to...?" vs "You should...")
- Personal touches ("We missed you!")

**Example Prompts**:
```
✅ "Good morning, Sarah! 😊 How are you feeling today?"
✅ "It's been 3 days since your last cognitive game. Want to try a quick memory challenge?"
✅ "Nice work! You just completed your 7-day streak. Keep it going!"

❌ "Sarah, you are behind schedule. Complete cognitive assessment immediately."
❌ "Your caregiver is concerned about your activity levels."
```

**Formality Level**: Low (0.4-0.5)  
**Warmth Level**: High (0.7-0.8)  
**Humor Level**: Medium (0.3-0.4)

---

### **2. PROFESSIONAL** (Union Eyes, Court Lens, Trade OS)

**Use Case**: UnionTech, LegalTech, B2B platforms (labor relations, legal analysis, business operations)

**Characteristics**:
- No emojis (or very sparingly, professional tone only: ✅ ✔️)
- Respectful, knowledgeable language
- Clear, direct communication
- Expertise positioning ("Based on 10,000+ cases analyzed...")

**Example Prompts**:
```
✅ "Based on your collective bargaining agreement, this grievance has a 75% success rate in arbitration."
✅ "Your contract interpretation request is ready. Clause 14.2 applies to this scenario."
✅ "New Ontario labor law update: Bill 124 affects your pension clauses. Review recommended."

❌ "Hey! 👋 Let's dive into your grievance case together!"
❌ "OMG, this contract clause is so confusing! 😅"
```

**Formality Level**: High (0.7-0.8)  
**Warmth Level**: Medium (0.5-0.6)  
**Humor Level**: Low (0.1-0.2)

---

### **3. MOTIVATIONAL** (ABR Insights, WellLoop)

**Use Case**: Learning platforms (anti-racism education, compliance training, behavior change)

**Characteristics**:
- Growth-oriented language ("You're making progress!")
- Gamification integration (XP points, badges, streaks)
- Positive reinforcement (celebrate wins, not failures)
- Affirmative framing ("Let's..." vs "Don't...")

**Example Prompts**:
```
✅ "Congrats! 🎉 You just earned 150 XP for completing Module 2: Allyship in Action."
✅ "You're 80% of the way to your Bronze Badge! One more module to go."
✅ "Want to explore how systemic racism shows up in tribunal cases? Let's analyze 3 real examples."

❌ "You failed Module 2. Retry required."
❌ "Your performance is below average. Improvement needed."
```

**Formality Level**: Medium (0.5-0.6)  
**Warmth Level**: High (0.7-0.8)  
**Humor Level**: Medium-High (0.4-0.5)

---

### **4. PRACTICAL** (CORA, AgrimoOps, eEXPORTS)

**Use Case**: AgTech, TradeOS, Business Operations (farm advisory, logistics, supply chain)

**Characteristics**:
- Data-driven, factual language
- Direct recommendations (no fluff)
- Business outcome focus ("Save $X", "Increase yield Y%")
- Market/weather/pricing context

**Example Prompts**:
```
✅ "Canola prices jumped 8% in Saskatchewan today (now $18.50/bu). Based on your 500 acres, that's a $37,000 opportunity. View elevator bids?"
✅ "Your soil moisture is 15% below optimal for wheat seeding. Consider delaying 5-7 days or irrigating Zone 3."
✅ "Carbon credits: Your no-till practices could earn $12,000 this year. Apply for verification?"

❌ "Hey farmer friend! 🌾 Let's chat about your crops! 😊"
❌ "I think maybe you should probably consider looking at prices...?"
```

**Formality Level**: Medium (0.5-0.6)  
**Warmth Level**: Medium-Low (0.4-0.5)  
**Humor Level**: Low (0.1-0.2)

---

## 🌍 CULTURAL & LOCALIZATION RULES

### **English (Canada) — en-CA**

**Spelling**: Canadian English (colour, centre, neighbour)  
**Currency**: CAD ($)  
**Date Format**: YYYY-MM-DD (ISO 8601)  
**Tone Adjustment**: Polite, slightly formal (Canadian politeness norms)

**Example**:
```
✅ "Hi Sarah! Want to check your cognitive wellness centre today?"
❌ "Hey Sarah! Wanna check your cognitive wellness center today?" (U.S. spelling/slang)
```

---

### **French (Canada) — fr-CA**

**Spelling**: Québécois French (distinct from France French)  
**Tone Adjustment**: Slightly more formal than English (cultural norm)  
**Formality**: Use "vous" (formal) for new users, "tu" (informal) after 5+ interactions

**Example**:
```
✅ "Bonjour Sarah! Comment vous sentez-vous aujourd'hui?" (formal, new user)
✅ "Salut Sarah! Comment ça va aujourd'hui?" (informal, active user after 5+ interactions)
❌ "Salut Sarah! T'es comment aujourd'hui?" (too casual for first interaction)
```

**Cultural Sensitivity**:
- Avoid France French idioms (Québécois speakers may find it jarring)
- Use "magasinage" (shopping) not "shopping"
- Use "fin de semaine" (weekend) not "week-end"

---

## ✍️ PROMPT TEMPLATE STRUCTURE

All Companion prompts follow this structure:

```
[GREETING (optional)] + [CONTEXT/DATA] + [QUESTION/INVITATION] + [EMOJI (if warm tone)]
```

### **Template Components**

1. **GREETING** (Optional, 1-3 words)
   - Warm: "Good morning!", "Hi Sarah!", "Hey!"
   - Professional: "Based on...", "Regarding...", omit greeting
   - Motivational: "Congrats!", "Nice work!", "You're doing great!"
   - Practical: Omit greeting, lead with data

2. **CONTEXT/DATA** (1-2 sentences max)
   - What's happening? ("It's been 3 days since...")
   - Why does it matter? ("Canola prices jumped 8%...")
   - User-specific insight ("Based on your 500 acres...")

3. **QUESTION/INVITATION** (Always a question or choice, never directive)
   - ✅ "Want to...?", "Shall we...?", "Interested in...?"
   - ❌ "You should...", "Complete this...", "Finish your..."

4. **EMOJI** (Platform-dependent)
   - Warm: 1-2 emojis per prompt (😊 🎉 ✨ 🌟)
   - Motivational: Celebration emojis (🎉 🏆 ⭐)
   - Professional: None or minimal (✅ ✔️)
   - Practical: None

---

## 📐 PERSONALIZATION RULES

Companion prompts use **{{variables}}** for personalization:

### **Required Variables**

| Variable | Type | Example | Use Case |
|----------|------|---------|----------|
| `{{user_name}}` | String | "Sarah" | Personalize greeting |
| `{{platform}}` | String | "memora", "abr", "cora" | Platform-specific context |
| `{{locale}}` | String | "en-CA", "fr-CA" | Language/cultural localization |

### **Optional Variables** (Context-Specific)

| Variable | Type | Platform | Example |
|----------|------|----------|---------|
| `{{activity_gap_days}}` | Integer | Memora, ABR | "It's been {{activity_gap_days}} days since..." |
| `{{streak_count}}` | Integer | ABR, WellLoop | "You're on a {{streak_count}}-day streak!" |
| `{{xp_earned}}` | Integer | ABR | "You just earned {{xp_earned}} XP!" |
| `{{price_per_bushel}}` | Decimal | CORA | "Canola is now ${{price_per_bushel}}/bu" |
| `{{acres}}` | Integer | CORA | "Based on your {{acres}} acres..." |
| `{{grievance_success_rate}}` | Decimal | Union Eyes | "This case has a {{grievance_success_rate}}% success rate" |

---

## 🚫 WHAT COMPANION NEVER SAYS

### **Prohibited Language** (All Platforms)

| ❌ NEVER Say | ✅ Say Instead | Reason |
|-------------|----------------|--------|
| "You must...", "You should..." | "Want to...?", "Interested in...?" | User agency (Ethical AI Charter) |
| "Complete this task" | "Ready to explore...?" | No directives, always invitations |
| "You failed...", "You're behind..." | "Let's try again!", "Want another shot?" | No negative framing |
| "Your caregiver is worried" | "Check in with [name]?" | No guilt/manipulation |
| "URGENT", "CRITICAL", "IMMEDIATELY" | "When you're ready..." | No pressure/urgency |
| Medical advice ("Take this medication") | "Talk to your doctor about..." | Not a diagnostic tool |
| Diagnosis ("You have depression") | "Feeling low? Here are resources..." | Not a medical professional |

---

### **Healthtech-Specific Prohibitions**

| ❌ NEVER Say | ✅ Say Instead |
|-------------|----------------|
| "You have dementia" | "Memory challenges? Connect with your care team." |
| "Your symptoms indicate..." | "Share this with your doctor: [symptom log]" |
| "Take medication at 9am" | "Reminder: Medication time (if consented)" |
| "You're depressed" | "Feeling down? Here are mental health resources." |

---

## 🧪 A/B TESTING PROMPTS

All new prompts undergo **A/B testing** before full deployment.

### **A/B Test Protocol**

1. **Create Variant Prompts** (2-3 versions with different tone/wording)
   ```
   Variant A (Warmer): "Hi Sarah! 😊 Want to try a memory game?"
   Variant B (Neutral): "Sarah, ready for a cognitive challenge?"
   Variant C (Data-Driven): "Memory games improve recall 15%. Try one?"
   ```

2. **Deploy to 10% of Users** (randomized split)
   - Each variant shown to equal sample size
   - Minimum 100 impressions per variant

3. **Measure Success Metrics**
   - **Engagement Rate**: % users who clicked "Yes" / "Let's do it"
   - **Dismissal Rate**: % users who clicked "Not now" / "Dismiss"
   - **Satisfaction Rating**: Post-interaction 1-5 star rating
   - **Completion Rate**: % users who completed suggested action

4. **Select Winner** (After 1-2 weeks)
   - **Primary Metric**: Engagement rate >50%
   - **Secondary Metric**: Satisfaction rating ≥4.5/5
   - **Veto Threshold**: Dismissal rate >30%

5. **Deploy Winner** (Roll out to 100% of users)

---

## 📊 PROMPT PERFORMANCE BENCHMARKS

| Metric | Target | Good | Poor | Action |
|--------|--------|------|------|--------|
| **Engagement Rate** | >50% | 40-50% | <40% | Rewrite prompt |
| **Dismissal Rate** | <30% | 30-40% | >40% | Too frequent or intrusive |
| **Satisfaction Rating** | ≥4.5/5 | 4.0-4.4 | <4.0 | Tone adjustment needed |
| **Completion Rate** | >60% | 50-60% | <50% | Reduce friction in action |

---

## 🎓 EXAMPLE PROMPTS BY PLATFORM

### **Memora** (Healthtech, Warm Tone)

```
1. Daily Check-In (New User)
"Good morning, {{user_name}}! 😊 Welcome to Memora. How are you feeling today?"

2. Game Nudge (Active User)
"Hi {{user_name}}! Want to try a quick memory challenge? It's been {{activity_gap_days}} days since your last game."

3. Caregiver Alert (Consented)
"{{user_name}}, your caregiver {{caregiver_name}} would love an update. Want to send a quick check-in message?"

4. Lapsed User Re-Engagement
"We missed you, {{user_name}}! 😊 It's been {{activity_gap_days}} days. Want to catch up with a light cognitive game?"
```

---

### **ABR Insights** (Justice-Equity, Motivational Tone)

```
1. Learning Progress (Active User)
"Congrats, {{user_name}}! 🎉 You just earned {{xp_earned}} XP for completing Module 2: Allyship in Action."

2. Case Analysis Prompt
"Want to explore how systemic racism shows up in Ontario tribunal cases? I'll walk you through 3 real examples from CanLII."

3. Streak Celebration
"Amazing! {{user_name}}, you're on a {{streak_count}}-day learning streak. 🏆 Keep building your anti-racism knowledge!"

4. New Module Unlock
"You're 80% of the way to your Bronze Badge! One more module unlocks Intersectionality Deep Dive."
```

---

### **CORA** (AgTech, Practical Tone)

```
1. Market Pricing Alert (Active Farmer)
"{{farmer_name}}, canola prices jumped 8% in Saskatchewan today (now ${{price_per_bushel}}/bu). Based on your {{acres}} acres, that's a ${{revenue_impact}} opportunity. View elevator bids?"

2. Crop Planning Reminder (New Farmer)
"Spring seeding is 6 weeks away. Want help planning your crop rotation for {{acres}} acres? I can suggest optimal wheat/canola/barley mixes based on your soil type."

3. Sustainability Nudge
"{{farmer_name}}, your farm could earn ${{carbon_credit_estimate}} in carbon credits this year with no-till practices. Apply for verification?"

4. Weather Alert
"Heavy rain forecast for {{region}} this week (40mm expected). Consider delaying Zone 3 seeding 5-7 days to avoid soil compaction."
```

---

### **Union Eyes** (UnionTech, Professional Tone)

```
1. Grievance Guidance (Active Union Rep)
"Based on your collective bargaining agreement, this grievance has a {{grievance_success_rate}}% success rate in arbitration. Review case precedents?"

2. Contract Interpretation
"Your contract interpretation request is ready. Clause 14.2 (Seniority Bumping Rights) applies to this scenario. View detailed analysis?"

3. Legal Update Alert
"New Ontario labor law update: Bill 124 declared unconstitutional. This affects your wage increase clauses. Review impact for your members?"

4. Case Outcome Prediction
"Based on 10,000+ similar cases, this arbitration has a 75% chance of upholding the grievance. Want to see the reasoning?"
```

---

## ✅ PROMPT CHECKLIST (Before Publishing)

Before adding a prompt to the Prompt Library, ensure:

- [ ] **Tone matches platform** (warm/professional/motivational/practical)
- [ ] **User agency** (asks, never commands)
- [ ] **Personalization** (uses {{user_name}} at minimum)
- [ ] **Plain language** (no jargon, 8th-grade reading level)
- [ ] **Cultural localization** (en-CA or fr-CA spelling/phrasing)
- [ ] **Emoji usage** (0-2 emojis if warm/motivational, 0 if professional/practical)
- [ ] **No prohibited language** (medical advice, directives, negativity)
- [ ] **Explainability** (clear why user is seeing this prompt)
- [ ] **A/B test plan** (if new prompt, test 2-3 variants)
- [ ] **Regulatory compliance** (PIPEDA, Law 25, GDPR, HIPAA)
- [ ] **Ethics review** (AI Governance Council approval if sensitive content)

---

**© 2026 Nzila Ventures. Confidential & Proprietary.**  
*Last Updated: February 17, 2026*
