# Trust Center FAQ

## 1) Where is the platform hosted?
Current operating environment is in Azure Canada Central for the primary staging production-like setup.

## 2) Do you pass secrets during image builds?
Not in the hardened deploy flows. Runtime secrets are injected at deployment/runtime; build now uses non-sensitive placeholders.

## 3) Do you have SOC 2 today?
No. SOC 2 Type II is a roadmap item and is intentionally not represented as achieved.

## 4) How do you handle incidents?
Through detection, triage, containment, remediation, and post-incident review. Current 30-day incident count is 0 in ops snapshot.

## 5) Can you provide uptime evidence?
Current uptime exporter artifact is not yet automated in-repo; this is listed as `source_needed` in ops metrics.

## 6) Is AI autonomous in critical decisions?
No. AI outputs are advisory and intended to remain under human authority.

## 7) Who do we contact for diligence?
Commercial and security contacts are listed in `09-contact-and-sla.md`.
