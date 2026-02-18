# 📤 API Reference: Companion, Dashboard, & Telemetry

**Owner:** Aubert

### 1. 📄 Purpose

This API reference outlines the external and internal API endpoints that power:
- Companion messaging logic and prompt interaction tracking
- Dashboard data aggregation and access
- Session telemetry and behavior logging for audit and personalization

---

### 2. 📬 Companion API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/companion/prompt` | Deliver a new prompt to user session |
| `POST` | `/api/companion/dismiss` | Track prompt dismiss or ignore event |
| `GET` | `/api/companion/state/:user_id` | Get current Companion tone/state |
| `PATCH` | `/api/companion/state/:user_id` | Manually update Companion tone/state |
| `POST` | `/api/companion/memory/reset` | Clear Companion memory state |

---

### 3. 📊 Dashboard API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/dashboard/patients` | Return anonymized rollups for dashboard tiles |
| `GET` | `/api/dashboard/activity/:clinic_id` | Return summary activity per patient (anonymized) |
| `POST` | `/api/dashboard/feedback-note` | Submit a note for internal use (clinic only) |
| `GET` | `/api/dashboard/access-log` | Clinic user’s own access log (limited) |

---

### 4. 📈 Telemetry & Logging Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/telemetry/session-start` | Log session start with timestamp & UUID |
| `POST` | `/api/telemetry/event` | Log in-game or in-app behavioral event |
| `GET` | `/api/telemetry/export/:user_id` | Export anonymized activity logs (if permitted) |
| `POST` | `/api/telemetry/companion-trigger` | Log trigger sent to Companion engine |

---

### 5. 🔐 Authentication

- JWT token required for all endpoints
- Role-specific claims (`role=clinic_admin`, `role=internal_admin`, etc.)
- Consent flags must be validated before prompt or telemetry calls

---

### 6. 🔄 Rate Limits & Monitoring

| Scope | Limit |
| --- | --- |
| Companion prompts | 30/min per user |
| Telemetry logs | 100/min per session |
| Dashboard queries | 10/min per clinic user |

Monitoring via **API Gateway metrics**, alerts on spikes or failures.

---

### 7. 📎 Linked Docs

- 📊 [Data Schema Overview]
- 🧠 [Companion Logic Engine Spec]
- 📋 [Audit Logging Strategy]
- 📤 [Research Export & Use Controls]
- 🔐 [Consent & Permissions Model]
- 🧪 [Testing & QA Plan]
- 📄 [API Tokens & Secrets Rotation Guide]
