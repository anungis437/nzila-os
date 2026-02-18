# 🧪 Test Patient Script (Optional Use)

**Owner:** Aubert

### ⚠️ 1. Test Protocol Overview

| Field | Detail |
| --- | --- |
| Mode | Staged (non-production / demo flag enabled) |
| Purpose | Validate login, Companion prompts, game responsiveness, dashboard reflection |
| Test Account Naming | Use format: `Test_Firstname_ClinicCode` (e.g., `Test_John_RNH1`) |
| Data Retention | All session data is anonymized and purged after testing unless flagged for internal QA |
| Consent Required | No patient consent required (this is a staff-controlled environment) |

---

### 👤 2. Pre-Test Setup

✅ Create a test patient account via internal admin or preloaded account

✅ Ensure **Clinic Dashboard** has access to the test account

✅ Confirm Companion is **enabled and unmuted**

✅ Ensure **Caregiver link is OFF** for clean testing

✅ Ensure **Consent is active** for dashboard to receive data

---

### 🔄 3. Test Sequence

| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Log into app using test account | Companion greets the user in chosen language |
| 2 | Complete the onboarding walkthrough | All consent prompts accepted; landing page loads |
| 3 | Play one session of each core game: |  |
| – Memory Match |  |  |
| – Sequence Builder |  |  |
| – Category Sorter | Session loads, no lag, game results are logged |  |
| 4 | Return to Companion screen | Prompt reflects session completion with encouraging message |
| 5 | Wait 10 minutes, then open app again | Nudge prompt is delivered if session count < 2 |
| 6 | Open Clinic Dashboard | Patient row shows updated activity, streak, and Companion status |
| 7 | Mute Companion via settings | Dashboard reflects mute icon within 1 day |
| 8 | Revoke consent | Dashboard row disappears within minutes |
| 9 | Restore consent | Patient reappears; session continuity resumes |

---

### 📊 4. Verification Checklist

| Item | Confirmed |
| --- | --- |
| Session logs appear on dashboard | ☐ |
| Companion state transitions occurred as expected | ☐ |
| Streak calculation updated | ☐ |
| Mute flag registered | ☐ |
| Consent on/off reflected in dashboard | ☐ |
| No error messages or freeze events | ☐ |

---

### 🧾 Post-Test Notes

- Delete or archive test account to avoid false metrics
- If needed for internal training, flag as `TEST_OK_TO_KEEP` in admin console
- Record any issues in the Pilot QA log or escalate via support@memora.clinic

---

### 📁 Linked Documents

- Clinic Dashboard Walkthrough
- Companion Prompt Trigger Reference
- Consent Flow Map
- Support Escalation Map
- Clinic Admin QA Log Template
