# 🧠 Memory Layer – Core Architecture

**Owner:** Aubert

> “Trust begins with remembering what matters—and forgetting what shouldn’t.”

---

### 🧠 Purpose

The **Memory Layer** enables CareAI to maintain secure, contextual memory across sessions, products, and personas. It acts as a dynamic retrieval system that balances **personalization**, **privacy**, and **performance**—ensuring that every AI interaction feels intelligent and relevant without compromising safety.

---

### 🧩 Key Functions

| Function | Description |
| --- | --- |
| **Session Memory** | Temporary context store for real-time continuity (expires after inactivity) |
| **Long-Term Memory** | Vector-based storage of summaries, preferences, behavior logs |
| **Persona Memory** | Fixed attributes (e.g., tone, language, assistant style) for consistency |
| **Memory Scoping** | Product-level, user-level, or device-level control over what is remembered |
| **Redaction + Consent Engine** | Filters PII and enforces user permission before persistence |

---

### 🧰 Memory Architecture Components

| Component | Description |
| --- | --- |
| **Vector Store** | Supabase (pgvector), Pinecone, or Weaviate (used for embeddings + RAG) |
| **Metadata DB** | PostgreSQL or Firestore, tracking timestamps, sources, consent, and sentiment |
| **Memory Orchestrator** | Governs what to store, when to retrieve, and how to expire old memory |
| **Embedding Model** | OpenAI ADA, Instructor-XL (for multi-lingual), or local BGE-M3 embeddings |

---

### 🧠 Memory Types

| Type | Examples | Retention Policy |
| --- | --- | --- |
| **Conversational** | “I liked that exercise.” “Don’t show me this again.” | 7-day rolling session or opt-in persistent |
| **Behavioral** | Pacing preferences, tone adjustments, time-of-day usage | 30–90 days with retention logs |
| **Structural** | Product role (caregiver, parent, student), language setting | Persistent unless revoked |
| **Emotional** | “I feel anxious.” “That was calming.” | Stored only with explicit consent |

---

### 🔐 Privacy & Safety Controls

- **PII Redaction Before Embedding** (names, emails, dates of birth)
- **Consent-Based Memory Persistence**: No long-term storage without opt-in
- **Memory Wipe Trigger**: "Forget me", "Clear my data", or UI-based reset
- **Audit-Friendly Memory Logs**: Timestamped, human-readable summaries of memory saves
- **Role-Based Memory Rules**: Child users = short-term only; clinic terminals = device-level scope only

---

### 🔍 Retrieval Strategy

- **RAG (Retrieval-Augmented Generation)** integration with vector index
- **Weighted Attention**: Recent memories prioritized, decayed over time
- **Topic Clustering**: Groups similar user interactions for retrieval accuracy
- **Session-Scoped Overrides**: Temporary memory slots override long-term memory if active

---

### 🧠 Memory in Action: Examples

| Scenario | Memory Function Used |
| --- | --- |
| “Remind me to do this later.” | Scheduled ephemeral memory (auto-expire) |
| “You told me that yesterday.” | Contextual back-reference via session memory |
| “I like the calm voice more.” | Tone preference logged in persona memory |
| “Forget everything I’ve said today.” | User-triggered session memory wipe |

---

### 🧭 Manifesto Alignment

| Principle | Implementation Example |
| --- | --- |
| **Empathy** | Emotional logging with explicit consent; mood-aware prompt injection |
| **Integrity** | Transparent logs and ability to revoke/erase |
| **Innovation** | RAG-powered context management + decay-aware summarization |
| **Equity** | Multi-lingual vector search and culturally-tuned memory filters |
| **Sustainability** | Selective memory retention; cost-aware querying and compression logic |

---

### 🔄 Roadmap (Q3–Q4 2025)

- Memory Visualization UI (for admins + users)
- Swahili/Arabic vector search tuning
- Cluster-based memory summarization models
- Integration with Personal Health Records (PHR) in OptivaCare
- Memory Export + Portability Tools (JSON/PDF for compliance)
