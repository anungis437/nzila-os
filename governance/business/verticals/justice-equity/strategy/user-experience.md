# Justice-Equity Vertical — User Experience Strategy

**Last Updated: February 2026**
**Platform:** ABR Insights
**Design Principles:** Empathy-first, accessible by default, culturally sensitive, engaging through gamification

---

## 1. Learner Personas

### Persona A: HR Manager (Primary Buyer + User)

| Attribute | Detail |
|-----------|--------|
| Role | HR Manager / Director, People & Culture |
| Organization | Mid-market (50-500 employees) |
| Goals | Compliance (Bill 67), reduce workplace incidents, demonstrate DEI ROI |
| Pain Points | Generic DEI content, low completion rates, no compliance tracking |
| Platform Usage | Admin dashboard (70%), learner courses (30%) |
| Success Metric | 90%+ team completion, zero HR complaints related to racism |

### Persona B: DEI Officer

| Attribute | Detail |
|-----------|--------|
| Role | Chief Diversity Officer / DEI Lead |
| Organization | Enterprise (500+ employees) |
| Goals | Systemic culture change, measurable DEI metrics, board reporting |
| Pain Points | Point solutions, no data integration, can't prove impact |
| Platform Usage | Analytics (50%), course curation (30%), learner (20%) |
| Success Metric | Measurable shift in employee sentiment surveys, ESG score improvement |

### Persona C: Frontline Employee (Primary Learner)

| Attribute | Detail |
|-----------|--------|
| Role | Individual contributor, any department |
| Goals | Complete mandatory training, learn actionable allyship skills |
| Pain Points | Boring compliance modules, irrelevant content, no time |
| Platform Usage | Course consumption (90%), tribunal search (10%) |
| Success Metric | Course completion, knowledge retention on post-assessment |

### Persona D: Executive Sponsor

| Attribute | Detail |
|-----------|--------|
| Role | CHRO, CEO, VP |
| Goals | Organizational risk mitigation, ESG compliance, brand reputation |
| Pain Points | No visibility into DEI program effectiveness |
| Platform Usage | Executive dashboard only (quarterly review) |
| Success Metric | Risk reduction, ESG reporting readiness |

### Persona E: Professional Association Member

| Attribute | Detail |
|-----------|--------|
| Role | CPHR member, OAHPP health professional, lawyer (CPD) |
| Goals | Earn CE credits, fulfill professional development requirements |
| Pain Points | Limited relevant CE content, expensive alternatives |
| Platform Usage | CE courses (80%), certificate tracking (20%) |
| Success Metric | CE credits earned, certificate generated and verified |

---

## 2. Learning Journey Design

### Course Structure

```
Module (60-90 min total)
├── Introduction Video (3-5 min) — context setting, learning objectives
├── Core Content (3-4 lessons)
│   ├── Lesson (10-15 min) — video + text + interactive elements
│   ├── Knowledge Check — 3-5 inline questions per lesson
│   └── Reflection Prompt — AI-guided journaling (GPT-4 coach)
├── Case Study — Real tribunal case analysis (CanLII database)
├── Assessment — 15-20 questions, 80% pass threshold
├── Certificate — Auto-generated PDF with QR verification
└── XP + Badge Award — Gamification reward on completion
```

### Assessment Flow

| Stage | Type | Purpose |
|-------|------|---------|
| Pre-Assessment | 10 questions, ungraded | Baseline knowledge measurement, adaptive path calibration |
| Inline Knowledge Checks | 3-5 per lesson, low-stakes | Active recall, engagement maintenance |
| Post-Assessment | 15-20 questions, 80% pass | Certification, knowledge verification |
| Retention Check (30 days) | 5 questions, spaced repetition | Long-term retention measurement |
| Annual Reassessment | Full assessment, recertification | Compliance renewal |

### Certificate Generation

- Auto-generated upon 80%+ assessment score
- PDF with organization branding, learner name, course title, date, CE credits
- QR code linking to verification endpoint (tamper-proof, publicly verifiable)
- Stored permanently in learner profile and HR admin reports
- CE credit integration auto-reports to CPHR/OAHPP systems

---

## 3. GPT-4 Coach UX

### Conversational UI Design

| Element | Specification |
|---------|--------------|
| Entry Point | Floating action button (bottom-right), contextual inline prompts |
| Interface | Chat panel (slide-in from right, 400px width) |
| Message Types | Text, tribunal case cards, reflection prompts, quiz explanations |
| Conversation Memory | Per-course session context (up to 20 messages) |
| Suggested Actions | Contextual quick-reply buttons ("Explain this concept", "Show a case", "Quiz me") |

### Tone Adaptation

| Context | Tone Profile |
|---------|-------------|
| Introductory content | Warm, encouraging, non-judgmental |
| Sensitive topics (trauma, racism) | Empathetic, supportive, resource-linking |
| Assessment prep | Coaching, confidence-building |
| Tribunal case discussion | Analytical, factual, legally precise |
| Gamification celebration | Celebratory, motivating |

### Cultural Sensitivity Framework

- All prompts reviewed by DEI subject matter experts
- Harm-reduction language patterns embedded in Companion Prompt Library
- Trigger warnings before sensitive tribunal case content
- "Pause & Reflect" option during emotionally charged content
- Direct links to support resources (EAP, community organizations)
- Never dismissive of lived experiences — validated through prompt engineering

---

## 4. Gamification UX

### XP Dashboard

| Component | Design |
|-----------|--------|
| XP Progress Bar | Circular progress indicator showing level progress (e.g., Level 5: 1,350/2,000 XP) |
| XP History | Activity feed showing recent XP earned with source labels |
| Level Indicator | Prominent level badge with title (e.g., "Level 5 — Advocate") |
| Next Unlock Preview | Shows what unlocks at next level (teaser for progression) |

### Badge Unlock Animations

| Badge Tier | Animation | Sound |
|------------|-----------|-------|
| Bronze | Fade-in with subtle glow (0.5s) | Soft chime |
| Silver | Spin + scale-up with particle burst (0.8s) | Achievement tone |
| Gold | Full-screen overlay with confetti animation (1.2s) | Triumphant fanfare |
| Platinum (Rare) | Cinematic reveal with custom illustration (2s) | Custom composition |

### Leaderboard Design

- **Scope Toggles:** My Team / My Organization / National
- **Time Period:** This Week / This Month / All Time
- **Privacy:** Opt-in only, display name (not full name), org-anonymous in national view
- **Rank Display:** Top 10 visible, user always sees their position + surrounding 2 ranks
- **Anti-Toxicity:** No negative comparisons, celebrate progress not just position

### Streak Mechanics

| Streak Length | Reward |
|---------------|--------|
| 3 days | 1.15x XP multiplier |
| 7 days | 1.25x XP multiplier + "Weekly Warrior" badge |
| 14 days | 1.35x XP multiplier |
| 30 days | 1.50x XP multiplier + "Monthly Champion" badge |
| 60+ days | 2.0x XP multiplier (cap) + "Dedicated Learner" badge |
| Streak Freeze | 1 free freeze per week (earn more via XP) |

---

## 5. Accessibility

### AODA & WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|---------------|
| Color Contrast | Minimum 4.5:1 ratio (all text), 3:1 (large text), verified with axe-core |
| Keyboard Navigation | Full keyboard accessibility, visible focus indicators, skip-to-content links |
| Screen Reader Support | Semantic HTML, ARIA labels, live regions for dynamic content |
| Closed Captions | All video content captioned (99%+ accuracy), transcript downloadable |
| Audio Descriptions | Descriptive audio track for visual-only video content |
| Text Resize | Functional up to 200% zoom without horizontal scrolling |
| Motion Reduction | Respects `prefers-reduced-motion`, gamification animations optional |
| Dyslexia Support | OpenDyslexic font option, adjustable line spacing |
| Color Blindness | UI never relies solely on color to convey information |

### Testing Protocol

- Automated: axe-core in CI pipeline (zero violations on every deploy)
- Manual: Quarterly screen reader audit (NVDA, VoiceOver, JAWS)
- User testing: Semi-annual accessibility-focused user sessions with disabled learners

---

## 6. Mobile UX

### Progressive Web App (PWA)

| Feature | Specification |
|---------|--------------|
| Install Prompt | iOS Safari / Android Chrome add-to-homescreen |
| Offline Mode | Downloaded courses available offline (service worker caching) |
| Push Notifications | Streak reminders, new course alerts, CE expiry warnings |
| Responsive Breakpoints | Mobile (<768px), Tablet (768-1024px), Desktop (>1024px) |
| Touch Targets | Minimum 44x44px for all interactive elements |
| Video Playback | Adaptive bitrate streaming, background audio for commute learning |

### Mobile-First Features

- **Micro-Lessons:** 5-minute bite-sized lessons for on-the-go learning
- **Swipe Navigation:** Swipe between lesson pages (intuitive, fast)
- **Offline Assessments:** Complete assessments offline, sync on reconnect
- **Quick XP Check:** Widget/notification showing daily XP and streak status

---

## 7. Admin Dashboard UX (HR Managers)

### Dashboard Views

| View | Key Metrics | Update Frequency |
|------|-------------|-----------------|
| **Overview** | Total learners, completion rate, active streaks, avg assessment score | Real-time |
| **Compliance** | Bill 67 compliance %, employees not started, overdue learners | Daily |
| **Team Breakdown** | Department-level completion, assessment scores, engagement | Daily |
| **ROI** | Cost-per-trained, estimated risk reduction, ESG score contribution | Monthly |
| **CE Credits** | Credits issued, programs enrolled, upcoming expirations | Weekly |

### Key Admin Actions

- **Bulk Invite:** CSV upload or HRIS sync for rapid onboarding
- **Deadline Setting:** Set completion deadlines per team/department with auto-reminders
- **Report Export:** One-click PDF/CSV compliance reports for board/audit
- **Learner Nudge:** Send targeted reminders to inactive learners
- **Custom Learning Paths:** Assign role-specific course sequences

### Data Visualization

- Completion rate: horizontal progress bars per department (color-coded: green >80%, yellow 50-80%, red <50%)
- Engagement trends: line chart showing daily/weekly active learners over time
- Assessment distribution: histogram of score ranges with pass/fail threshold line
- ROI calculator: interactive input (hours saved, incident reduction) → projected savings
