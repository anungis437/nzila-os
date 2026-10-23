# UE_VISUAL_ACCEPTANCE_DISPOSITION

Snapshot: 2026-10-23 10:52 UTC. **Visual acceptance: NO_GO.**

This is a checkpoint for the active global-experience mission, not a whole-application certification.

| Identity | Independently observed value |
| --- | --- |
| Worktree | `C:/APPS/nzila-os-navigation` |
| Branch / PR | `fix/ue-global-experience-convergence`, [#995](https://github.com/anungis437/nzila-os/pull/995) |
| Fully checked source baseline | `9f1ad0668af9ee9bb74ae3027883e253a947970d`; the shared-mobile/lifecycle follow-up in this revision still requires final-head qualification |
| Deployed source, verified through `/api/version` | `eacaa2e7202c1deed5f89aaea5132ec9e5e32871` |
| Deployed candidate revision, verified through Azure revision inventory | `nzila-os-union-eyes-staging--ue-rec-eacaa2e720` |
| Frontend digest | `sha256:b4085b5cc7eb7636700785ad68c6d900087b881adc5160caf7078fe6e79101ed` |
| Backend digest | `sha256:9f9c5ac750c11ab6d58e1262c5d9d1d868703a63c7b24243ba89ad0b610ea191` |
| Traffic | Candidate 0%; maintenance revision 100% |
| Distinct native pages qualified on the new visual source | **0 — new source has not been deployed** |

## Evidence and limits

- The actual route census contains 343 page routes, including 203 dashboard routes and 24 dynamic dashboard routes. Static existence does not prove rendering or authorization. Native persona coverage remains incomplete.
- [Before manifest](baselines/before-eacaa2e720.json): 42 captures of three officer pages on the old candidate, EN/FR and seven widths. Redirects do not count as pages. These captures are a baseline, not acceptance of the new source.
- [Canonical design contract](../CANONICAL_DESIGN_SYSTEM_CONTRACT.md): shared shell, semantic colors, typography, headings, spacing, surfaces, navigation, responsive controls and explicit privacy precedence are implemented in the visual branch. Whole-page conformance still requires native review.
- Local synthetic component checks covered EN/FR at 360, 375, 390, 430, 768, 1024 and 1440px. Header bounds, hit testing, touch targets and mobile Escape/focus return passed. These do not establish authenticated page acceptance.
- A broader drawer audit found invalid whitespace-bearing `aria-controls` and undersized controls. Both were corrected. Subsequent EN/FR checks at 375/1440px reported no axe WCAG 2/2.1 A/AA violations, no undersized navigation targets and retained keyboard focus through 30 Tab presses. Manual-review notes concern Radix focus guards and the synthetic account placeholder; native account controls still need review.
- First-visit privacy and detailed preferences each passed 14 local language/width cases: reachable controls, no implicit consent, and explicit rejection leaving all optional categories off. Preferences switches have a 44px hit area. French close labels and long organization names are readable.
- Focused sidebar/privacy tests: 14 passed. Earlier workspace/priorities/navigation tests: 31 passed. Security regression suite: 43 passed on `78923509f`; that earlier result does not qualify `19325a93f`. Pre-commit checks passed on `19325a93f`; the five required repository checks must run on the final branch head.

Evidence files are retained under `C:/APPS/nzila-os.archive/ue-staging-recovery-20261022/`, including `global-component-preview/{drawer-accessibility-r3,privacy-accessibility-r1,preferences-accessibility-r2}.json`, captures and corresponding logs. These are explicitly marked synthetic component evidence. Previous failures and superseded validation runs remain preserved.

## Expanded census and shared-mobile follow-up

- All five required repository commands passed on `9f1ad0668`: lint, typecheck, test:fast (2,284 files and 31,092 tests passed; 19 files and 568 tests skipped), validate:docs and governance:audit. Their separate `global-experience-r3-*-result.json` receipts bind the source and log hashes. Hosted CI, CUPE, four actual Union Eyes E2E workers and required-check publication also passed on that head. These results do not automatically qualify subsequent changes.
- The expanded native **before** census visited 55 officer routes on the old deployed source: 33 rendered captures require review, 12 redirected, five returned HTTP errors and five failed capture. None qualify the new source. Additive `state-and-disposition-corrections.json` preserves original evidence and corrects privacy-visible captures that were initially labeled normal. HTTP errors are not accepted pages.
- The dashboard presentation is extracted into one `OperationalShell`, also used by the existing mobile claims and members layouts. Existing server admission paths remain separate and unchanged. The mobile entry uses the canonical role landing instead of hard-coded statistics and fictional recent activity; it is an expected alias, not another independently qualified page.
- Lifecycle section links now use locale-qualified absolute destinations and exact active selection. Lifecycle and mobile page headings wrap, use the shared hierarchy and preserve accessible controls. Local browser checks passed 14 language/width cases for each prepared component, including pointer geometry and mobile-search Escape/focus return. These are synthetic component checks only.
- Small buttons, select controls and mobile filters now use 44px minimum heights; filter selection is exposed with `aria-pressed`. Independent mobile sticky offsets are removed so the common shell owns navigation layering.
- Focused lifecycle/sidebar assertions passed (16); canonical admission/mobile-shell assertions passed (7); case, document and timeline regression assertions passed (39). Four existing mobile hook warnings remain visible in targeted lint; no rules were suppressed. Final-head repository checks and native whole-page qualification remain required.

Known follow-ups include misleading workbench detail destinations, mobile data failure-versus-empty handling and legacy local caches, incomplete French operational copy, missing runtime governance artifacts or other causes of five observed HTTP errors, and remaining role/state coverage. Cache and disclosure questions are registered security-convergence work; this visual slice does not claim to resolve them.

## Remaining acceptance work

1. Finish all required repository and hosted checks; integrate through branch protection.
2. Build and verify exact images, requalify source-dependent evidence, and deploy through the existing authorized candidate workflow.
3. Crawl the full relevant route/persona inventory with legitimate native sessions. Record expected and actual destinations separately. Record exact missing fixtures and dynamic parameters; do not fabricate permissions.
4. Exercise drawer selection, keyboard focus, native account controls, locale switching, privacy/onboarding precedence and supported normal, empty, loading, validation-error and failure states.
5. Review distinct rendered pages across both languages and all seven widths, capture matching after evidence, and classify visual differences. Claims/documents redirects must be reconciled against actual role authority.
6. Repeat affected security and operational gates on the resulting candidate. The separate [security convergence disposition](../reality-remediation/UE_SECURITY_CONVERGENCE_DISPOSITION.md) adds unresolved qualification work.

Security-related UI defects corrected so far concern truthful navigation destinations, explicit consent and failure-versus-empty presentation. No UI change is evidence that server authorization or storage revocation is qualified. Staging promotion remains on hold; production is outside this mission.
