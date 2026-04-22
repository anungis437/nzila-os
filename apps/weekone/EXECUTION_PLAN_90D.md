# WeekOne — 90-Day Execution Plan (CEO Layer v1)

> **Mode:** Execute.
> **Preserved:** Calm brand · Agencies wedge · Mondays-completed north star · Cash discipline.
> **The premise:** Five prior documents are now one ruthless 90-day operating plan. No more planning. The next deliverable from the founder is *shipped work*.

---

## 0. The Operating Stance (read before anything else)

1. **Plans are inventory. Execution is revenue.** The five strategy docs are now read-only. From day 1, every hour goes to ship/sell/serve.
2. **One thing at a time, fully.** The founder does not multi-task across Nzila portfolio companies during the 90-day window. (See §10 Distraction Rules.)
3. **Default action: do the smallest version, today.** Anything bigger competes with shipping.
4. **The product is the demo. The demo is the spec.** No feature is built unless the next demo needs it.
5. **Calm is a non-negotiable competitive advantage.** No 80-hour weeks. No Saturday work. No frantic posts. Calm scales; panic doesn't.

---

## 1. Build Priority Roadmap — What Ships First

Rule: nothing ships that doesn't appear in the demo script (Launch Playbook §4) or the onboarding script (Revenue Engine §6). Everything else waits.

### Week 1 — *The demo must be runnable end-to-end*

| # | Ship | Why | Owner |
|---|---|---|---|
| 1 | **Auth + multi-tenant org model** (already in @nzila/platform-auth) | Day-1 requirement | Founder |
| 2 | **Monday review screen** — 4 pillars on one page, save/complete action | The product *is* this screen | Founder |
| 3 | **Focus pillar v1** — 3 priorities, status, owner | Demo minute 2–5 | Founder |
| 4 | **Money pillar v1** — manual entry: AR, runway weeks, retainer health (no integrations yet) | Demo minute 5–8 | Founder |
| 5 | **Risks pillar v1** — list with severity + status | Demo minute 8–11 | Founder |
| 6 | **Growth pillar v1** — single compounding move, weekly check-in | Demo minute 11–13 | Founder |
| 7 | **`monday_completed` event** wired (PostHog) | Without this, nothing else matters | Founder |

### Week 2 — *Onboarding & first calm Monday*
| # | Ship | Why |
|---|---|---|
| 8 | **5-question intake form** (Revenue Engine §2) — captured to org record | First product conversation |
| 9 | **Welcome email + Calendly Setup-call link** | Within 24h of signup |
| 10 | **Read-only weekly digest** — emailable URL of latest Monday | Teammate adoption without forcing logins |
| 11 | **`account_created`, `trial_started`, `setup_call_booked`, `monday_started`** events live | Activation funnel exists |

### Week 3 — *Conversion & rescue*
| # | Ship | Why |
|---|---|---|
| 12 | **Stripe checkout** — Solo / Team / Growth, monthly + annual | Self-serve revenue |
| 13 | **`trial_to_paid`, `plan_changed`, `cancel_started/completed`** events | Revenue funnel exists |
| 14 | **Yellow auto-nudge** (1 missed Monday → email) | Cheapest churn save |
| 15 | **In-app referral prompt** after first calm Monday | Referral surface #1 |

### Week 4 — *Proof & polish*
| # | Ship | Why |
|---|---|---|
| 16 | **Public case study page** template (`/customers/[slug]`) | First case study lands here on day 14 of customer 1 |
| 17 | **Pricing page** with friction removers (Brand v2 §6) | Inbound conversion |
| 18 | **`/agencies` landing page** (Launch Playbook §2) | Vertical-targeted traffic |
| 19 | **Founder office hours** Calendly + Wed 11am ET recurring | Support deflection seed |

### Weeks 5–13 — *Adopt-as-you-go*
- Ship one improvement per week, **chosen from demo objections, not from imagination**.
- Add Money-pillar integrations (QuickBooks, Stripe) only after 5 customers explicitly request the same one.
- Add weekly digest scheduling, NPS prompt, pause-instead-of-cancel flow, EOS scorecard import — in that order, only when triggered by signal.

### Always-off in 90 days
- No mobile app. No native integrations beyond manual + 1 finance pull. No AI agent that "runs your business for you." No marketplace. No white-label.

---

## 2. Customer Interview Script — 20 Interviews in 30 Days

> Goal: validate language, find the punchline, identify the friction at first Monday. Run **before** spending on ads. Half come from outbound, half from network.

### Logistics
- 30 minutes. Recorded with consent. Calendly + Zoom. No slides.
- 2 per week from week 1, ramping to 8/week by week 4.
- Founder runs every one. No delegation.

### The 12-question script (in this order)

**A — The Monday (5 min)**
1. Walk me through last Monday morning at the agency. Start at when you opened your laptop.
2. What were you trying to figure out? What got in the way?
3. On a scale of 1–10, how chaotic does your average Monday feel?

**B — The current "system" (5 min)**
4. If you had to name the system you use to run the agency today, what would you call it?
5. What's in it? (Notion? Sheets? A Slack channel?) What does it actually do well?
6. What does it fail at, weekly?

**C — The cost of the gap (5 min)**
7. Last 90 days — what did the agency drop? Invoice, lead, hire, renewal, deadline?
8. Do you know your runway right now, in weeks? (Listen for the pause.)
9. What's the last thing you wished you'd seen 2 weeks earlier?

**D — The reaction to WeekOne (10 min)**
10. *(Show 90-second tour, no pitch.)* What did you think? What did you not like?
11. If you imagine running a calm Monday on this in fifteen minutes, what would have to be true?
12. What would make this worth $99/month, beyond a doubt?

**E — Close (5 min)**
- *"Want a free Setup Sprint in exchange for letting us interview you again at day 30?"* (Recruits beta customers from interviews.)

### What we extract from each interview
- One verbatim phrase (added to the swipe file for ads/posts).
- One objection (added to demo prep + landing page FAQ).
- One missing capability (added to backlog with the interviewee's name attached — proof of demand).
- One referral name (always ask: *"Who else should I be having this conversation with?"*).

### Conversion mechanic
- Aim: convert **5 of 20 interviewees** to paying customers (with free Setup Sprint) inside the 30-day window. That's customers 1–5.

---

## 3. Demo Booking Engine

A simple, repeatable funnel. No marketing automation theatre — just enough to catch and convert.

### Inbound
- Every page CTA → Calendly demo link OR self-serve signup.
- Calendly: 30-min slots, founder calendar, max 3/day, blocked Sat/Sun.
- Confirmation email auto-sends a 90-second tour video and the 5-question intake.

### Outbound (per Launch Playbook §5)
- 30 DMs/day from the founder, M–F.
- Reply-to-demo target: 30%.
- Replies acknowledged within 2 business hours, **always**. No exceptions.

### Demo prep ritual (10 min before each call)
- Read intake answers.
- Pull 1 fact from their LinkedIn / website ("you ship X for Y clients").
- Open a fresh tenant pre-named with their agency.
- Goal: the prospect feels seen in the first 60 seconds.

### Demo follow-up (within 4 business hours, every time)

> Subject: *Your calm Monday — quick recap*
> Body: 3-line summary of what we set up + plan recommendation + 1 link (checkout or Setup Sprint). No pitch. No 7-touch sequence. **One follow-up. Then they decide.**

### No-show recovery
- Single email: *"Missed you. Reschedule here. Or 90-second tour [link] — same outcome, less of your time."*
- One re-attempt only. Ghosted = back to nurture (newsletter), not chased.

---

## 4. Founder Content Calendar (90 days, post-by-post)

> 5 hours/week, non-negotiable. Drafted on Sunday night during Operator's Hour. Posted from a single editorial doc.

### Weekly slots (per Revenue Engine §1)

| Day | Channel | Topic pillar | Hook formula |
|---|---|---|---|
| Mon | LinkedIn + X | Calm Monday (emotional) | *"It's 6:47am Monday. Twelve tabs. Sound familiar?"* |
| Tue | LinkedIn | Operator playbook (utility) | *"How to spot {{thing}} {{N}} weeks before it's a fire."* |
| Wed | LinkedIn | Anti-positioning (sharp) | *"{{Tool}} is {{X}}. Your agency needs {{Y}}."* |
| Thu | LinkedIn | Customer story (proof) | *"How {{Agency}} cut {{metric}} from {{X}} to {{Y}}."* |
| Fri | LinkedIn + X | Build-in-public (trust) | *"This week we shipped {{X}}, killed {{Y}}, learned {{Z}}."* |

### 90-day theme arc
- **Weeks 1–4 — Naming the gap.** Establish the category. Heavy use of *too big for spreadsheets / too small for enterprise*. Goal: get 5 strangers to use the phrase "Weekly Operating System" publicly.
- **Weeks 5–8 — Showing the work.** Live Monday recordings. First customer case studies. Open metric drops.
- **Weeks 9–13 — Defending the category.** Anti-positioning vs. EOS, Notion, Asana. Operator playbook essays. Bi-weekly "Calm Monday" newsletter goes long-form.

### Content production rules
- Draft in plain text, not in the LinkedIn editor (preserves voice).
- One-week buffer always. Sunday plans next 7 posts.
- 60% of posts come from real customer conversations that week.
- Never post on Saturday. Never post about MRR. Never punch down.

### Newsletter ("The Calm Monday")
- Bi-weekly, 700–1,200 words.
- Open: a Monday scene. Middle: an operator lesson. Close: a quiet CTA.
- Subscriber goal: 30 by day 30, 150 by day 60, 500 by day 90.

---

## 5. Product Instrumentation Implementation

> Ship the events with the product. A dashboard built on guesses is a story, not a system.

### Stack
- **Tracker:** PostHog Cloud (start), self-host at $1M ARR.
- **Wrapper:** A single `track()` helper in `apps/weekone/lib/analytics.ts`.
- **Schema source of truth:** `apps/weekone/lib/analytics/events.ts` — typed event names + payload shapes. Compile-time enforced.
- **Server-side events** (cancel, plan_changed, trial_to_paid) fire from the Stripe webhook handler — never from the client.

### Sequence
1. **Day 1–3:** wire the helper, the typed schema, and the 7 critical events (`account_created`, `trial_started`, `setup_call_booked`, `setup_call_completed`, `monday_started`, `monday_completed`, `trial_to_paid`).
2. **Day 4–7:** dashboards for *Activation rate* and *Mondays-completed/customer/month* go live in PostHog. Bookmarked. Reviewed Friday.
3. **Day 8–14:** add the rest of the events from Operating Finance §5.
4. **Day 15+:** weekly review — kill any event nobody looks at after 30 days.

### Reviewable signals (live before customer 1)
- Funnel: signup → first login → first Monday completed
- Cohort: weekly retention by signup week
- North star tile: Mondays-completed/customer/month, full-screen, top of dashboard

### Privacy posture
- No verbatim customer text in event payloads.
- Cancel reasons + NPS verbatim stored in DB with consent flag.
- AI features log `ai_inference_run` with model, latency, prompt-template-id (no raw prompt content).

---

## 6. Beta Onboarding Flow (first 20 customers)

The beta is **not free**. It's discounted ($49 Team Operator for 6 months), in exchange for: 14-day case study cooperation, monthly interview, public testimonial.

### Funnel
1. **Apply** — `/agencies/beta` form (8 questions, all from interview script).
2. **Reviewed within 24h** by founder.
3. **Accept email** with Stripe checkout + Setup-call booking.
4. **Setup call** within 5 days of payment. First Monday happens **on the call** (Revenue Engine §6).
5. **Day 7 nudge → Day 14 voice note → Day 14 case study → Day 30 milestone email** (Revenue Engine §2 + §6).

### Beta promises (in writing)
- Founder personally onboards.
- Founder's cell phone for any urgent issue (first 20 only).
- 6 months at beta price; locked at Team Operator $99 thereafter (their choice to convert).
- One published case study, with their approval over every word.

### Beta closing rules
- Beta closes at customer #20 OR day 60, whichever first. After that, Setup Sprint is paid ($2,500), no exceptions. Scarcity is part of the offer.

---

## 7. First 10 Customer Close Plan (week-by-week)

> The first 10 customers come from network + interviews + earliest outbound. They are *manufactured*, not waited for.

### Source mix (target)
- 4 from founder's existing network (warm intros).
- 3 from interview-to-customer conversion.
- 2 from outbound DMs.
- 1 from inbound (organic content).

### Week-by-week target

| Week | New customers | Cumulative | Action focus |
|---|---|---|---|
| W1 | 0 | 0 | Setup, demo env, first 5 interviews booked |
| W2 | 1 | 1 | First friendly close from network |
| W3 | 1 | 2 | Second network close + first interview→demo conversion |
| W4 | 2 | 4 | Beta page live; first paid Setup Sprint sold |
| W5 | 2 | 6 | First case study published → 1 inbound close |
| W6 | 2 | 8 | Outbound conversion #1 |
| W7 | 1 | 9 | Refine demo from objection patterns |
| W8 | 1 | **10** | Beta tier almost full → switch messaging to scarcity |

### The only acceptable reasons to lose a deal in the first 10
- *Not the right size yet* (under 4 people) — refer to nurture.
- *No Monday pain* (rare) — disqualify, save the demo slot.
- *Active EOS implementer relationship* — offer crossover migration (free Setup Sprint).

Every other lost deal = root cause analysis in next Friday review.

---

## 8. Weekly Scorecard Ritual

The Friday review (Operating Finance §10) is the only mandatory recurring meeting in the company.

### Friday, 4:00–5:00pm — Solo, then public
- 4:00–4:30 — Founder fills the scorecard. Honest. Numbers + tripwires + energy.
- 4:30–4:45 — Three sentences: *one decision, one experiment, one cut.*
- 4:45–5:00 — Sanitized version drafted as Friday LinkedIn post (build-in-public).

### Monthly variant (last Friday of each month)
- Pull cohort table. Recompute LTV/CAC. Re-rank tripwires.
- Publish the monthly operator update (newsletter long-form post).

### Quarterly variant (every 13th week)
- Decide: stay in beachhead, expand vertical 2, or hold.
- Decide: pricing tests passed/failed.
- Decide: hire trigger crossed?
- Output: 1-page memo, dated, archived in `apps/weekone/operating-memos/`.

### Sacred rules
- The review never moves. Not for travel. Not for demos. Not for "almost done" features.
- A skipped Friday review = a missed week. Two missed = company is drifting.
- The dashboard hangs (printed, taped) above the founder's desk. Visible to anyone who walks in.

---

## 9. Founder Time Management System

> Time is the binding constraint. Defend it like cash.

### The weekly shape (50 hours)

| Bucket | Hours | Sacred? |
|---|---|---|
| Demos (Tue + spillover) | 8 | Yes |
| Customer touch (Wed) | 10 | Yes |
| Build (Thu + spillover) | 10 | Yes |
| Media output (daily) | 5 | **Most sacred** |
| Inbox + DMs (daily) | 7 | No (delegable to VA from M4) |
| Metrics + Friday review | 5 | Yes |
| Buffer | 5 | Always exists |

### Daily anchors
- **7:00 — Calm Monday** (only Mondays). Founder runs own review on WeekOne, posts the Monday content, then triages.
- **No meetings before 9:30am** any day. Mornings are for shipping or selling.
- **Inbox in batches** — 3x/day max (9:00, 13:00, 17:00). Notifications off otherwise.
- **Slack/email closed during demos and during the 7–8am Monday block.**

### Decision rules (when overloaded)
1. Cut a demo before cutting a customer touch.
2. Cut a feature before cutting media output.
3. Cut "improvements" before cutting customer interviews.
4. Cut sleep zero times. Cut Saturday zero times.

### Calendar template (publish to team when team exists)
- Mon: Calm Monday + content + outbound triage.
- Tue: Demos (3 standard, 5 max).
- Wed: Customer touch + Office Hours 11am.
- Thu: Build day. No external meetings.
- Fri: Compound day → 4pm review.
- Sat: Off (and visibly off).
- Sun: Optional 60-min Operator's Hour.

---

## 10. Anti-Distraction Rules — Other Nzila Ventures

> The single biggest risk to WeekOne in 90 days is portfolio context-switching. The founder is on multiple Nzila apps. WeekOne demands a fence.

### The fence (in writing, signed by founder to founder)

1. **WeekOne is the only product the founder publicly champions** for the next 90 days. No ZongaOS posts. No Union-Eyes demos. No Cora announcements on the founder's personal handle.
2. **Calendar firewall.** WeekOne hours (the 50/week above) are blocked first each Sunday. Other Nzila work fits in residual time, never the reverse.
3. **Inbox segregation.** A separate label/folder for WeekOne. WeekOne customer email gets a 4-hour SLA; other Nzila threads get end-of-day.
4. **No new Nzila product launches** during the 90-day window. Existing ones run on autopilot or pause.
5. **One context switch per day, max.** Either AM = WeekOne / PM = other Nzila, or full days dedicated. Never 4 swaps in a day.
6. **Public commitments are WeekOne-only.** Podcasts, posts, talks, partnerships — all WeekOne.
7. **Money rule.** WeekOne cash stays in WeekOne for the 90-day window. No cross-funding to other Nzila products until M4 review (see §11).

### The trip-wire
- If the founder catches themselves writing a doc/PR for another Nzila product **during a WeekOne sacred block**, they stop, log it in the Friday review, and the next Friday's "one cut" is automatically *that* distraction.

### What this protects
- Brand voice consistency (audience needs to hear the same thing weekly).
- Customer trust (response times don't slip).
- Founder identity in market (the Calm Monday Operator, not "the guy with 12 apps").

---

## 11. Capital Allocation Across Nzila Portfolio (post-90)

> Not for now. For the M4 review. But written here so it's already decided.

### Default policy (until $250K WeekOne ARR)
- 100% of WeekOne cash stays in WeekOne. No cross-funding.
- Founder draw is the only money that leaves WeekOne — and only per Operating Finance §2.

### From $250K → $500K ARR
- Up to 20% of monthly net cash may fund cross-portfolio infrastructure that WeekOne *also* uses (auth, payments, analytics platform). Only shared infrastructure. No funding of separate products.

### From $500K+ ARR
- Treasury policy revisited. Default: keep ≥6 months OpEx in WeekOne. Excess may seed one (1) other Nzila product per year, with a ≥3x return target and a 24-month payback.

### What this prevents
- The founder solving WeekOne's success by spreading it across other ventures before WeekOne is durable.
- Cash leaks that hide as "synergy."

---

## 12. The 90-day deliverables (the only scoreboard that matters)

By day 90, these are the artifacts that prove this plan worked. If they don't exist, the plan didn't run.

| # | Deliverable | Source of truth |
|---|---|---|
| 1 | **50 paying customers** (per Operating Finance ramp) | Stripe |
| 2 | **6 published case studies** | `/customers/` |
| 3 | **`Mondays-completed/customer/month` ≥ 3.5** | PostHog |
| 4 | **Cash-positive every month** since M1 | Bank + bookkeeping |
| 5 | **1,500 LinkedIn followers** on founder handle | LinkedIn |
| 6 | **500 newsletter subscribers** | Email tool |
| 7 | **Sanitized weekly scorecard** posted publicly each Friday (12+ posts) | LinkedIn archive |
| 8 | **20 customer interviews** transcribed and tagged | Repo: `apps/weekone/research/` |
| 9 | **3+ pricing tests run** with documented outcomes | `pricing-tests/` |
| 10 | **All 7 failure tripwires** armed and reviewed weekly | Friday scorecard |

If 8 of 10 are met → continue, open Vertical 2 (Clinics).
If 5–7 of 10 are met → extend agencies-only by 60 days, no expansion.
If <5 of 10 are met → invoke Failure Playbook E (existential signal). Stop. Re-interview. Decide whether the thesis still holds.

---

## 13. Final principle (post it on the wall)

> **The plan is done. From here, the only thing that proves WeekOne is real is a customer running a calm Monday — and another one tomorrow.**
>
> Calm Monday by calm Monday. For 90 days. Then we look up.
