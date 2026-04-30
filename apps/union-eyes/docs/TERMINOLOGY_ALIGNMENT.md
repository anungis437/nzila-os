# UnionEyes — Terminology Alignment Matrix

> Ensures docs, product copy, and APIs describe the current reality:
> members submit intakes, representatives manage casework, and users follow outcomes.

## Product ↔ Docs ↔ Data Alignment

| User Action | Product Label / Surface | Route / API | Doc Reference | Event / Audit Notes |
|-------------|--------------------------|-------------|---------------|---------------------|
| Log in | Sign In | auth surfaces | User Guide §1 | `user_login`, `session_started` |
| Enter the app | Role-based landing | `/dashboard` redirector | User Guide §2 | `session_started` |
| Steward / LRO sees signal queue | Inbox | `/dashboard/inbox` | User Guide §2, FAQ | signal-driven steward/LRO landing; admin and above only |
| Rep sees next actions | Priorities | `/dashboard/priorities` | User Guide §2, Developer Index | role-routed workflow entry |
| Rep manages active casework | Work | `/dashboard/work` | User Guide §5, Developer Index | steward-led casework surface |
| Review results | Outcomes | `/dashboard/outcomes` | User Guide §7 | outcome-oriented follow-through |
| Submit intake | Intake / grievance submission | `POST /api/grievances` | User Guide §3, Quick Start | `intake.submitted`, `grievance.submitted` |
| Create official case | Official case creation | `POST /api/cases` or steward path in `POST /api/grievances` | FAQ, Developer Index | `case.created` |
| Convert intake to case | Intake conversion | `POST /api/grievances/[id]/convert` | FAQ, Developer Index | `intake.converted`, `case.created` |
| Add notes or updates | Timeline / notes | case-related views and APIs | User Guide §6 | `update_added` and audit trail |
| Pilot health review | Pilot Program | `/dashboard/pilot` | Admin Guide, Pilot Overview | pilot metrics and readiness |

## Terminology Rules

1. **"Intake"** is the correct member-facing entry concept for a new issue.
2. **"Case"** is official representative-managed casework.
3. **"Grievance"** is used for formal grievance-style representation workflows.
4. **"Inbox"** is the Steward / LRO default landing surface — admin and above roles only.
5. **"Priorities"** is the steward and officer default landing surface.
6. **"Work"** is the consolidated casework surface and replaces older queue-first language.
7. **"Outcomes"** is the correct label for results and follow-through.
8. Avoid documenting members as directly creating or opening official cases.
9. Members do NOT access the full app. Member-facing features are limited to: the intake submission form and a lightweight case follow-up view.
9. Avoid documenting `/dashboard/claims` or `/dashboard/grievances` as canonical surfaces. They are legacy redirects.

## Flow Verification

### Member path

```
Submit intake (form, no full app login required) -> Lightweight case follow-up view
```

> Members do not access the full application. The app (Inbox, Priorities, Work, Intelligence, Outcomes) is for admin and above roles.

### Steward path

```
Login -> Priorities -> Review intake activity -> Convert or create casework -> Manage in Work -> Record outcome
```

### Pilot monitoring path

```
Officer login -> /dashboard/pilot -> Review health, milestones, and readiness
```

## Validation Checklist

- [x] Member documentation uses intake-first language
- [x] Steward documentation describes Work and Priorities instead of legacy claims/grievances pages
- [x] Docs reflect `/dashboard` role-based redirect behavior
- [x] Docs reflect `/dashboard/pilot` instead of `/admin/pilot`
- [x] Docs distinguish intake submission from official case creation
- [x] Docs align with `POST /api/grievances`, `POST /api/cases`, and intake conversion behavior
- [x] Legacy `/dashboard/claims` and `/dashboard/grievances` are treated as compatibility redirects, not primary UX
