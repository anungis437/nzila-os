# ⚙️ Orchestration Layer – Core Architecture

**Owner:** Aubert

> “Precision in flow. Logic in motion. Intelligence, routed with care.”

---

### 🧠 Purpose

The **Orchestration Layer** is the brain of CareAI’s infrastructure—managing how inputs move through the system, how decisions are made, and how outputs are returned safely and efficiently. It ensures that every AI interaction is dynamically constructed, policy-aware, failure-resilient, and product-aligned.

This layer governs the **flow**, **rules**, and **fallbacks** that connect the LLM, Memory, Persona, and Governance layers.

---

### 🧩 Key Functions

| Function | Description |
| --- | --- |
| **Prompt Assembly** | Dynamically builds prompts using Persona, Memory, and Context |
| **Routing Logic** | Chooses which model/provider to send to based on intent + product |
| **Execution Engine** | Handles retries, timeouts, quota awareness, and parallel execution |
| **Fallback Management** | Ensures graceful handling of errors, refusals, or safety triggers |
| **Event Hooks & Logs** | Publishes traceable events for debugging, audit, and learning |

---

### 🧰 Infrastructure Stack

| Component | Description |
| --- | --- |
| **Prompt Builder** | Compiles final prompt from all layers (persona + memory + input + tone rules) |
| **Router Engine** | Decides model route (OpenAI, local, Azure, etc.) based on product + priority |
| **Execution Layer** | Handles prompt call, rate limits, token budgeting, retries |
| **Fallback System** | Uses response classification to reroute, rephrase, or re-prompt if needed |
| **Observability Bus** | Sends telemetry to logs, dashboards, and governance layers |

Built using **TypeScript**, **Node.js**, or **Python FastAPI**, with cloud-native orchestration via **Supabase Functions**, **AWS Lambda**, or **Azure Durable Functions**.

---

### 🔀 Routing Logic Schema

| Input Condition | Routing Action |
| --- | --- |
| `Product = Memora` | Route to GPT-4o with clinical safety checks |
| `Model Latency > 3s` | Retry or fallback to GPT-3.5 |
| `User = Low Bandwidth` | Route to cached response or offline LLM |
| `Query = Sensitive Emotion` | Apply escalation filter or route to scripted fallback |
| `Locale = Swahili` | Inject tone filter + route to multilingual prompt set |

---

### 🔧 Fallback Handling

- **LLM Error** → Retry with adjusted prompt + temp downgrade
- **Safety Rejection** → Replace with scripted fallback or redirect to live agent (if enabled)
- **Empty/No Response** → Use memory recall or repeat previous instruction with clarification
- **Max Token Limit** → Truncate or summarize input; defer response with UI notice

---

### 🎯 Dynamic Prompt Assembly Pipeline

1. **User Input** → Transcribed, filtered, and tagged
1. **Memory Injected** → Relevant facts + emotional state summary
1. **Persona Profile Loaded** → Tone, pacing, safety scope
1. **Contextual Conditions Evaluated** → Product, device, mood, bandwidth
1. **Final Prompt Constructed** → Sent to LLM endpoint
1. **Response Processed** → Safety pass, logging, optional memory update

---

### 🧭 Manifesto Alignment

| Principle | Implementation Example |
| --- | --- |
| **Empathy** | Routes emotional messages with tone-aware rephrasing |
| **Integrity** | Logs all decisions with trace IDs and fallback history |
| **Innovation** | Multi-condition orchestration, layered fallbacks, adaptive flows |
| **Equity** | Includes language-, culture-, and bandwidth-aware routing |
| **Sustainability** | Load-balanced usage, tiered model fallback, reduced token usage |

---

### 📊 Observability & DevOps

- **Trace Logs**: Every execution tagged with prompt ID, timestamp, latency, token count
- **Decision Trees**: Exposed via internal debug dashboard (DevOps only)
- **Telemetry Events**: Sent to Supabase logs, Honeycomb, or OpenTelemetry system
- **Alerting**: Retry loops, failovers, long-latency events trigger dev alerts

---

### 🔄 Roadmap (Q3–Q4 2025)

- Visual Flowbuilder for prompt logic (drag-and-drop for product leads)
- Custom routing layers per deployment (e.g., clinic-only safe prompts)
- Native fallback scripting editor (UI-based for non-devs)
- Orchestration decision explanation layer (for funder trust demos)
- Integration with Human Escalation API (Care pathways)
