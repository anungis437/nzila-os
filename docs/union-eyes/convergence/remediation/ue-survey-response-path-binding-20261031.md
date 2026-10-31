# Union Eyes Gate 0: nested survey response identity

Defect: DEF-0B5-SURVEY-RESPONSES-ROUTE-IGNORES-SURVEY-ID. Frozen 777-defect population unchanged. Source change only; no CLOSED verdict.

A POST to /communications/surveys/{surveyId}/responses derives the parent surveyId from the path. Missing or blank path IDs and mismatched JSON survey IDs fail with HTTP 400 before the tenant-bound survey lookup and insert. A matching legacy JSON survey ID is accepted. The factory reasserts the bound ID after the create hook, preventing a future hook from changing the target. Existing tenant ownership, publication window and anonymity checks remain.

Added focused unit cases for omitted, matching, mismatched and missing path IDs, plus a source contract assertion that the route opts into path binding. No executable local Vitest, native PG15/16, HTTP/browser, staging or institutional acceptance was performed in this run. Keep the defect PARTIAL pending exact-HEAD qualification and independent approval.
