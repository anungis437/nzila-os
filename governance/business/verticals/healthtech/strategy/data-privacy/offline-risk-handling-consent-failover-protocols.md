# 📄 Offline Risk Handling & Consent Failover Protocols

**Owner:** Aubert

This page defines how Memora behaves when operating **fully offline** — a core feature for clinics, field programs, or homes with low/no connectivity. It ensures that **consent**, **safety**, and **risk awareness** remain intact even when cloud services, audit systems, or human supervision are temporarily unavailable.

---

## 🌐 **Core Offline Philosophy**

| Principle | Offline Enforcement |
| --- | --- |
| **Consent Must Travel with the System** | All user and caregiver permissions are stored and referenced locally |
| **Risk Must Be Detectable, Not Just Deferrable** | Companions can recognize and log potential distress or breakdown even without sync |
| **Memory Must Be Revocable at Any Time** | All forget commands and redactions must work offline and take precedence |
| **Behavior Must Degrade Gracefully** | When signals are missing, Companions become simpler, gentler, and quieter — never erratic |

---

## 📁 **Offline Consent Architecture**

| Component | Function |
| --- | --- |
| **Local Consent Ledger** | Stores timestamps and signed records for each major action (e.g., “Caregiver allowed journaling”) |
| **On-Device Settings Router** | Companion references this for memory toggles, tone settings, and alert permissions |
| **Offline Consent Scripts** | Pre-written Companion prompts guide consent verbally or visually (e.g., “Is it okay if I remember this?”) |
| **Guardian Confirmation Mode** | For youth profiles, Companion waits for dual adult consent for memory actions or tone changes |

> All consent events are stored and can be synced or exported later — nothing is lost.

---

## 🚨 **Offline Risk Detection Logic**

| Risk Signal | Companion Behavior |
| --- | --- |
| **User distress detected (tone, keywords, inactivity)** | Companion exits session, logs event locally, and softens next session tone |
| **Repeated failed interactions** | Offers “pause” or “reset” suggestions; disables memory for 24 hours |
| **Unsafe keyword (e.g., fear, confusion, pain)** | Logs event, does not escalate (offline), but marks session as "alert-flagged" |
| **No caregiver log-ins for 5+ sessions** | Companion reduces complexity and begins issuing soft re-engagement nudges |

---

## 🛡️ **Failover Safety Mechanisms**

| Scenario | Companion Fallback |
| --- | --- |
| **Missing consent record** | Defaults to memory OFF, emotional tone LOW |
| **Device in shared use (multi-child)** | Hides past sessions, uses anonymized greeting: “Hi there, let’s start fresh.” |
| **Companion behavior anomaly detected** | Reverts to base interaction mode (Core Scripts only), disables adaptive learning |
| **Hardware risk (low storage, audio failure)** | Shifts to text-only mode and disables journaling until resolved |

---

## 🧩 **Post-Offline Reconnection Protocol**

When a device reconnects or is re-synced with caregiver/clinic portals:
1. **Sync Audit Ledger**: Local consent, memory, and event logs merged securely
1. **Flagged Events Review**: Caregivers prompted to review any “alert-flagged” sessions
1. **Memory Merge Options**: Option to import, archive, or selectively forget offline sessions
1. **Consent Integrity Check**: Any discrepancies between cloud and local settings are surfaced and resolved with prompts

---

## 📋 **Supporting Docs & Templates**

- Offline Consent Prompt Library (Multilingual)
- Emergency Session Handling Scripts
- On-Device Consent Schema (JSON + flowchart)
- Printable Consent & Risk Log Sheet (for NGOs/clinics)
- Companion Behavior Fallback Map (Visual Logic Tree)
- Caregiver Offline Kit Setup Guide

---

Memora isn’t just built for online clinics —

it’s built for *care anywhere*.

This protocol ensures we **never compromise consent or care** — even in silence.
