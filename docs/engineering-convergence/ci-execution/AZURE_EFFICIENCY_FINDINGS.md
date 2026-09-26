# Azure efficiency findings

Repository evidence only. No capacity was changed. No Azure billing export was available, so there are no dollar figures.

| ID | Evidence | Class |
| --- | --- | --- |
| AZ-1 | `deploy-union-eyes.yml` push trigger is `hotfix/fr-cta-locale-redirect`, not `main`. Ordinary main merges do not take that push path | Intentional boundary, not waste |
| AZ-2 | Production is excluded from `auto-promote-union-eyes.yml`. A contract test fails if production is added to that matrix | Intentional resilience / release authority |
| AZ-3 | Auto-promote still rebuilds by calling the full deploy workflow per non-production environment (demo, pilot, staging), up to 3 in parallel, when the path filter matches | Likely duplicate image work across environments. Not measured in ACR. Candidate for digest promotion in a later batch |
| AZ-4 | `gitops-deploy.yml` runs typecheck, lint, and `test:fast` again after CI has already completed on that main SHA, then may build and update Container Apps | Duplicate computation inside the deploy path. The Azure update itself may still be necessary |
| AZ-5 | `trivy.yml` builds images on pull_request and push. Those images are scan inputs, not shown to be the digest GitOps or Union Eyes deploy pushes | Possible second build of equivalent source. Unproven until digests are compared |
| AZ-6 | GitOps run `36254278073` lasted ~40s | Consistent with a short plan or skip. Revision creation `PENDING_MEASUREMENT` |
| AZ-7 | Replica minimums, inactive revisions, Log Analytics retention, and Application Insights sampling | Not in git history as measured consumption. Out of E1. Do not change from this document |

Waste versus capacity: AZ-3 and AZ-4 are execution waste candidates. AZ-1 and AZ-2 are authority and must stay. AZ-7 is unknown, not waste.
