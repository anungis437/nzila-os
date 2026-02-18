# 🧩 Companion Tablet Architecture

**Owner:** Aubert

### 1. 🎯 Purpose

This document defines the deployment and configuration strategy for Memora's Companion Tablet mode. It ensures the platform delivers a **privacy-respecting**, **offline-capable**, and **emotionally consistent** experience when used in shared environments such as clinics, community centers, and waiting rooms.

---

### 2. 🖥️ Device Configuration

| Element | Specification |
| --- | --- |
| **Device Type** | Android tablet (10"+ recommended, mid-range spec or higher) |
| **OS Mode** | Kiosk/Lockdown Mode via MDM |
| **App Mode** | Preloaded, Companion-linked game app (offline-first) |
| **Connectivity** | Wi-Fi optional (sync disabled by default) |
| **Auto-launch** | App launches at startup, restarts on crash |

---

### 3. 🔐 Privacy & Session Safety

| Feature | Implementation |
| --- | --- |
| **Anonymous Sessions** | No login required; all game use is temporary |
| **Session Expiry** | Auto-reset after inactivity (e.g., 5 min idle) |
| **No Local PII** | No personal data stored persistently |
| **Consent Guardrails** | Companion prompts never reference identity; content filtered for public use |
| **Reflection Mode** | Limited journaling; no saved history |

---

### 4. 🎮 Game & Companion Behavior in Tablet Mode

| Area | Behavior |
| --- | --- |
| **Companion Presence** | Active but with reduced personalization (uses tone but not user memory) |
| **Rest Logic** | Enabled; Companion suggests breaks after predefined fatigue signals |
| **Game Loop** | Shorter intervals, softer difficulty ramp |
| **Data Storage** | Local volatile cache, cleared post-session |

---

### 5. 🔄 Optional Cloud Sync (With Consent)

| Option | Trigger |
| --- | --- |
| **Caregiver Link Scan** | QR or device pairing to unlock full Companion mode |
| **Clinic Staff Override** | Admin PIN enables login for specific test cases or usage tracking |
| **Opt-in Upload** | Explicit consent screen before data sync is activated |

---

### 6. 🛠️ MDM & Maintenance Strategy

| Topic | Practice |
| --- | --- |
| **MDM Tooling** | Compatible with Scalefusion, Esper, or TinyMDM |
| **App Update Channel** | OTA via MDM push only (manual install locked) |
| **Device Health** | Logs ping via encrypted heartbeat if network available |
| **Reset Schedule** | Weekly cache wipe enforced by MDM |

---

### 7. 📋 QA & Acceptance Criteria

| Scenario | Expected Behavior |
| --- | --- |
| Tablet unplugged from power | App stays functional (battery threshold warning only) |
| Inactivity timeout | App returns to home/start state, clears session |
| Companion prompt runs in anonymous mode | Tone is gentle and general (no personalization) |
| Clinic admin requests device logs | PIN unlock > Export log (non-PII only) |

---

### 8. 🔗 Linked Documents

- Game Engine SDK: Fatigue Logic & Rest Design
- UI Framework: Accessibility Templates
- Consent & Governance: Anonymous Session Handling
- Cloud Sync Layer: Consent-Scoped Uploads
- 📱 Tablet UX Shell & Kiosk Interaction Patterns
