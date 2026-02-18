# 🧩 Technical Architecture Diagram

**Owner:** Aubert

### **1. High-Level System Map**
`+---------------------------------------------------------------+
|                       FRONTEND CLIENTS                        |
|---------------------------------------------------------------|
|   📱 Mobile App (React Native / Flutter)                      |
|   - Game UI (Memory Match, Sequence Builder, Category Sorter)|
|   - Companion Interaction UI (tone-aware prompts)            |
|   - Reflection Journal + Daily Routine Tracker               |
|   - Onboarding (Law 25 consent, walkthroughs)                |
|                                                               |
|   🧑‍🤝‍🧑 Caregiver Portal (Mobile/Web Hybrid)                  |
|   - Linked patient view, weekly summaries                    |
|   - Encouragement toolkit (non-invasive)                     |
|   - Emotional insights, fatigue-aware check-ins              |
+------------------------|-----------------------|--------------+
                         |
+------------------------v-----------------------v--------------+
|                     BACKEND SERVICE LAYER                     |
|---------------------------------------------------------------|
|   🔐 Auth & Session Manager                                   |
|   - Role-based login (Patient, Caregiver, Clinic Admin)      |
|   - Consent validation, audit hooks, RBAC                    |
|                                                               |
|   🕹️ Game Engine Service                                       |
|   - Serves randomized tasks with cognitive fatigue logic     |
|   - Tracks attempts, pause triggers, rest cycles             |
|                                                               |
|   🤖 Companion Logic Engine                                   |
|   - Tone modulation engine (SDT + Octalysis)                 |
|   - Prompt scheduling + gameplay linkage                     |
|   - Light day detection, quiet mode shifts                   |
|                                                               |
|   🔔 Notification Manager                                     |
|   - Companion-based nudging only (no SMS/interruptive logic)|
|   - Respects caregiver time zones and patient rhythms        |
|                                                               |
|   📚 Static Content Service                                   |
|   - Knowledge center & Caregiver Education                   |
|   - Audio mode, localization (EN/FR)                         |
+------------------------|-----------------------|--------------+
                         |
+------------------------v--------------------------------------+
|                     DATABASE & STORAGE LAYER                  |
|---------------------------------------------------------------|
|   🗄️ Encrypted SQL Database                                     |
|   - Patient & caregiver profiles                             |
|   - Game logs, Companion state, consent records              |
|   - De-identified metrics for clinics                        |
|                                                               |
|   🧾 Secure Object Storage                                     |
|   - Media files (journal entries, game assets)               |
|   - Localized Companion content (EN/FR audio + UI)           |
+---------------------------------------------------------------+

+---------------------------------------------------------------+
|                    CLINIC ADMIN DASHBOARD                     |
|---------------------------------------------------------------|
|   - Pilot-only, secure authentication                        |
|   - Weekly patient engagement summaries                      |
|   - View fatigue-adjusted trends (not just raw usage)        |
|   - Exportable CSVs for behavioral feedback                  |
+---------------------------------------------------------------+

+---------------------------------------------------------------+
|                 SECURITY & COMPLIANCE MODULE                  |
|---------------------------------------------------------------|
|   - JWT-based Auth, refresh tokens                           |
|   - DB encryption + encrypted API transmission               |
|   - Law 25 consent flow (bilingual)                          |
|   - Activity audit logging, RBAC per user role               |
|   - Companion transparency (user-resettable memory/log)      |
+---------------------------------------------------------------+`

---

### 📌 Design Considerations

- **Modularity**: Each logic module (Companion, Game, Notification) can be independently scaled or licensed (SDK-ready architecture).
- **Fatigue Awareness**: All interaction logic is shaped by the CareAI Behavioral Pacing Layer and Feedback Loop Engine.
- **Privacy by Design**: The entire system is built for Law 25, PIPEDA, and GDPR readiness, including full de-identification pathways and consent fallback modes.
