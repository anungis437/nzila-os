# 🔐 Security & Lockdown Protocol

**Owner:** Aubert

This protocol defines how every Memora device is secured before deployment — ensuring **user safety**, **data protection**, and **caregiver control** across all use cases. Whether used in memory clinics, homes, or remote field programs, this protocol guarantees that **no unwanted access, updates, or behavior drift can occur**.

---

## 🔒 Security Objectives

| Objective | Description |
| --- | --- |
| **Prevent Data Leakage** | No raw memory, emotional, or prompt data may leave the device unless consented |
| **Limit Device Abuse or Repurposing** | Devices are locked to Companion-only mode with no general system access |
| **Protect Caregiver Control** | Caregivers can override or shut down with a passcode or printed recovery card |
| **Support Offline Safety** | Local-only encryption, offline reset, and no reliance on cloud identity systems |

---

## 🧱 Lockdown Layers

| Layer | Controls |
| --- | --- |
| **Operating System** | Android 11/12 (tablet) or Raspbian Lite (Pi) with root-level restrictions |
| **Kiosk Launcher** | Custom launcher loads directly into Memora Companion or "Safe Start" screen |
| **App Lockdown** | No multitasking, app switching, system settings, or browser access |
| **System Updates Disabled** | OS updates disabled to prevent UI drift or untested behavior |
| **Storage Encryption** | Device-level encryption for Companion data folder (AES-256) |

---

## 🔐 Security Setup Steps

### 1. ✅ Disable System-Level Access

| Action | Tool |
| --- | --- |
| Disable pull-down menu and notifications | System UI tuner or Kiosk profile |
| Remove Settings app and file explorer | ADB uninstall or kiosk config |
| Disable Google Play Store and Chrome | Blocked via Device Policy Manager |
| Remove gestures, 3-finger screenshots | Accessibility settings off |
| Prevent factory reset without override code | Enabled via device admin profile |

---

### 2. 🧩 Lock to Memora-Only Mode

- Set **default launcher** to Memora (via kiosk wrapper or admin policy)
- Enable **autostart** of Memora app on boot
- Block long-press, recent apps button, and system tray
- Disable power menu access (Android 11+ allows via OEM config tools)

---

### 3. 🛡️ Encryption & Data Handling

| Area | Security Feature |
| --- | --- |
| **Prompt History / Memory Graph** | Stored in local AES-encrypted SQLite DB |
| **Caregiver Notes** | Encrypted with local key derived from device + consent profile |
| **Offline Logs** | Not syncable unless manually exported by caregiver or admin |
| **Voice / Mood Inputs** | Temporarily cached for <60 seconds, never stored unless journaling is enabled and consented |

---

### 4. 🆘 Caregiver Override Protocol

Each device ships with:
- **Passcode for Override Access** (e.g., for memory reset, tone change, Companion re-pairing)
- **Printed Reset Card** with visual steps for hard reboot and Companion recovery
- Optional **Bluetooth Key** pairing for caregivers in connected setups

---

### 5. 🧪 Final Security Test

Before deployment, every device must pass:

| Test | Pass Criteria |
| --- | --- |
| Attempt settings access | Blocked |
| Attempt factory reset via buttons | Blocked or leads to Memora boot |
| Attempt app switch | Blocked |
| Companion override PIN test | Works only with defined caregiver profile |
| Companion data export | Blocked unless caregiver export toggle enabled |
| Power loss recovery | Reboots into Companion without prompts |

---

## 📄 Supporting Docs & Templates

- Admin Profile Config (Android XML + Pi setup scripts)
- Memora Launcher APK / Kiosk Settings File
- Reset Card Printable Template (per region)
- Security Audit Checklist (Staging Lead Use)
- Companion Override Guide (for caregivers)
- Offline Recovery Protocols Sheet
- Passcode Vaulting Protocol (for deployments with remote override coordination)
