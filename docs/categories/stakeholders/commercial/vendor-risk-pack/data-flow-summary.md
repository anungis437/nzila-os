# Data Flow Summary

1. User authenticates via platform-auth (password or optional Entra).
2. Requests are org-scoped and evaluated in API/business layer.
3. Data is persisted in PostgreSQL with org isolation controls.
4. Auditable state transitions and evidence events are sealed.
5. Exports are generated for grievance/evidence workflows.

Control notes:

- AI outputs are advisory and human-reviewed.
- Cross-organization reads are prohibited by design constraints and tests.
