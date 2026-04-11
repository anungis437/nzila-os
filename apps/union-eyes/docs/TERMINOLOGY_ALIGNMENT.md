# UnionEyes — Terminology Alignment Matrix

> Ensures docs describe EXACT flows, UI reflects EXACT terminology,
> and tracked events reflect REAL actions. No mismatch allowed.

## UI ↔ Docs ↔ Data Alignment

| User Action | UI Label | Route | Doc Reference | Tracked Event |
|-------------|----------|-------|---------------|---------------|
| Log in | Sign In | `/sign-in` | User Guide §1 | `user_login` |
| See dashboard | Pilot Dashboard | `/dashboard` | User Guide §2 | `session_started` |
| View cases | My Cases | `/dashboard/claims` | User Guide §3 | — |
| Create a case | Create Case | `/dashboard/claims/new` | User Guide §4 | `case_created` / `first_case_created` |
| View case detail | Case Detail | `/cases/[id]` | User Guide §5 | `case_viewed` |
| Add an update | Add Update | `/cases/[id]` (timeline) | User Guide §6 | `update_added` / `first_update_added` |
| Log out | — | `/sign-out` | — | `session_ended` |
| Give feedback | Quick feedback | Widget (bottom-right) | — | — (stored in `pilot_feedback`) |
| Complete onboarding | — | Modal (4 steps) | Quick Start | — (stored in localStorage) |

## Terminology Rules

1. **"Case"** is the primary UI term for all workplace issues
2. **"Grievance"** appears only in formal CBA workflow contexts (not in pilot)
3. **"Claim"** is the database/API term for member submissions — mapped to "Case" in UI
4. **"Update"** is the term for any timeline entry on a case
5. **"Create Case"** (not "Submit Claim" or "File Grievance") in pilot UI
6. **"My Cases"** (not "My Claims" or "My Grievances") in pilot UI
7. **"Dashboard"** (not "Home" or "Overview") for the main landing page

## Flow Verification

### User Path: First Case (≤ 2 minutes, ≤ 2 clicks)

```
Login → Dashboard → "Create Case" (1 click) → Fill form → Submit (2 clicks total)
```

### User Path: Add Update (≤ 2 clicks)

```
Dashboard → "My Cases" → Click case → Add update in Timeline
```

### User Path: View Progress (1 click)

```
Dashboard → "My Cases" card shows count + link
```

## Validation Checklist

- [x] Dashboard card says "My Cases" (matches docs)
- [x] Green card says "Create Case" (matches docs)
- [x] Timeline section says "Timeline" (matches docs)
- [x] Events use snake_case matching db schema
- [x] API endpoints use `/claims` (internal) mapped to "cases" (UI)
- [x] Docs use "case" as primary term throughout
- [x] No compliance/surveillance language in UI
- [x] Feedback widget says "Quick feedback" (neutral tone)
- [x] Onboarding wizard matches Quick Start doc steps
