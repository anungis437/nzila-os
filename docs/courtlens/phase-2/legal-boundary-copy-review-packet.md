# CourtLens Legal-Boundary Copy — Counsel Review Packet

## Status
**Approval: NOT OBTAINED.** This document is not itself legal approval. It is a review packet for counsel to review the customer-facing copy that carries CourtLens's legal-boundary framing.

Sign-off table below must be completed by qualified counsel before the customer-facing surfaces are used in an external stakeholder demo or with real clients.

## Purpose

CourtLens is supervised, review-ready access-to-justice infrastructure. It must never present itself as legal advice or as an AI-generated legal opinion. Every customer-facing string listed below carries part of that boundary. Counsel review confirms:

1. No string implies legal advice, legal conclusion, eligibility determination, guaranteed outcome, or attorney-client relationship.
2. Framing of "supervised human review" and "not legal advice" is unambiguous in both EN-CA and FR-CA.
3. Consent language is clear, non-coercive, and appropriate for Canadian access-to-justice context.
4. Error and unavailable states do not create false impressions of service availability or organisational relationships.

## Scope of Review

- Every string in `apps/abr/messages/en-CA.json` under `courtlens.*`.
- Every string in `apps/abr/messages/fr-CA.json` under `courtlens.*`.
- Server-side `LEGAL_BOUNDARY_NOTICE` in `apps/abr/modules/incidents/public-intake.ts`.
- Server-side `MATTER_LEGAL_BOUNDARY_NOTICE` in `apps/abr/modules/incidents/matter-service.ts`.

Out of scope: audit logs, error codes, technical HTTP responses, developer-facing documentation.

## Reviewer Checklist

For each string below:

- [ ] Does not imply legal advice, legal conclusion, or outcome prediction.
- [ ] Does not imply eligibility determination.
- [ ] Does not imply attorney-client or solicitor-client relationship.
- [ ] Does not overstate scope of service.
- [ ] Consent framing is clear and non-coercive.
- [ ] FR translation preserves the same legal boundary as EN.
- [ ] No promise of speed, outcome, or specific action.
- [ ] Complies with applicable Canadian access-to-justice guidance and provincial law society rules on unauthorised practice.

## Explicit Questions for Counsel

1. Is "not legal advice" sufficient framing on a public intake form, or should we add a more explicit disclaimer (e.g. "we are not lawyers")?
2. Is the FR-CA phrase "n'est pas un avis juridique" the correct legal equivalent of "not legal advice" for Canadian access-to-justice context?
3. Does the consent language on the intake form need to be strengthened for provincial privacy law compliance (PIPEDA, Quebec Law 25, Ontario FIPPA/MFIPPA for public sector tenants)?
4. Does the "supervised human review" framing risk being interpreted as a solicitor-client relationship?
5. Should the confirmation legal notice explicitly identify the reviewing organisation as the responsible party, or is the current generic framing acceptable?
6. Do the executive-viewer/auditor role redactions require any additional documented legal basis in the UI copy?
7. Is the AI-packet "draft only" labelling sufficient to signal non-final status under law society advertising and unauthorised-practice rules?

---

## Customer-Facing Copy for Review

### 1. Public Intake Page (`/[locale]/courtlens/t/[slug]/intake`)

**Where it appears**: [apps/abr/app/[locale]/courtlens/t/[tenantSlug]/intake/page.tsx](../../../apps/abr/app/[locale]/courtlens/t/[tenantSlug]/intake/page.tsx)

| Key | EN-CA | FR-CA |
|---|---|---|
| `pageIntro` | CourtLens Access | CourtLens Access |
| `pageTitle` | Start your intake | Démarrer votre demande |
| `pageSubtitle` | Share a bit about your situation so a qualified reviewer can look at it. This is not legal advice. It is a way to get supervised help started. | Partagez quelques renseignements sur votre situation afin qu'une personne qualifiée puisse l'examiner. Ceci n'est pas un avis juridique. C'est un moyen d'obtenir un accompagnement supervisé. |
| `unavailableTitle` | Intake unavailable | Demande d'admission indisponible |
| `unavailableMessage` | This intake is not available at the moment. Please check the link you followed, or contact the organisation directly. | Cette prise en charge n'est pas disponible actuellement. Veuillez vérifier le lien utilisé ou communiquer directement avec l'organisation. |
| `unavailableNotLegalAdvice` | This is not legal advice. | Ceci n'est pas un avis juridique. |

**Risk rationale**: This is the first surface a member of the public sees. Any implication that the form provides legal advice, or that CourtLens is a lawyer, would create UPL and misrepresentation exposure. Framing must be unambiguous.

**Reviewer questions**:
- Is "Start your intake" / "Démarrer votre demande" a sufficiently neutral action label?
- Is the subtitle's phrase "supervised help started" acceptable, or should it read "supervised review started"?

### 2. Public Intake Form Framing

**Where it appears**: [apps/abr/app/[locale]/courtlens/t/[tenantSlug]/intake/PublicIntakeForm.tsx](../../../apps/abr/app/[locale]/courtlens/t/[tenantSlug]/intake/PublicIntakeForm.tsx)

| Key | EN-CA | FR-CA |
|---|---|---|
| `beforeYouStart` | Before you start | Avant de commencer |
| `framingHumanReview` | This form collects information for supervised human review. It is not legal advice. | Ce formulaire recueille des renseignements pour un examen humain supervisé. Il ne s'agit pas d'un avis juridique. |
| `framingReviewer` | A qualified reviewer will look at your intake before any action is taken on your behalf. | Une personne qualifiée examinera votre demande avant qu'une action ne soit entreprise en votre nom. |
| `framingSensitive` | Please share only what you are comfortable sharing. Do not include unnecessary sensitive information. | Ne partagez que ce que vous êtes à l'aise de partager. N'incluez pas de renseignements sensibles non nécessaires. |
| `framingNoAi` | You will not receive an AI-generated legal opinion from this form. | Vous ne recevrez pas d'avis juridique généré par une IA à partir de ce formulaire. |

**Risk rationale**: The four framing bullets are the primary legal-boundary statement. They also cover privacy (sensitive info guidance) and AI (no AI legal opinion). Counsel must confirm the wording matches the actual service and does not overpromise or underpromise.

**Reviewer questions**:
- Should "qualified reviewer" be more specific (e.g., "a supervised reviewer at the organisation named on this page")?
- Should the sensitive-information guidance reference PIPEDA / Law 25 explicitly?

### 3. Consent Statement

**Where it appears**: same file, checkbox above the submit button.

| Key | EN-CA | FR-CA |
|---|---|---|
| `consentLabel` | I understand this is not legal advice and my intake will be reviewed by a qualified person. I consent to this information being sent to the organisation named on this page for supervised review. | Je comprends qu'il ne s'agit pas d'un avis juridique et que ma demande sera examinée par une personne qualifiée. Je consens à ce que ces renseignements soient transmis à l'organisation nommée sur cette page pour un examen supervisé. |

**Risk rationale**: Consent must be an affirmative act. Currently gated by a required checkbox; submit is disabled until checked. Counsel must confirm the consent wording is sufficient for the tenant to be able to receive and act on the intake.

**Reviewer questions**:
- Does this consent cover PIPEDA / Law 25 sufficiently, or does it need a link to a separate privacy notice?
- Should we add a phrase about withdrawal of consent or right to access personal information?

### 4. Confirmation and Server-Side Legal Notice

**Where it appears in code**:
- Client label: [apps/abr/app/[locale]/courtlens/t/[tenantSlug]/intake/PublicIntakeForm.tsx](../../../apps/abr/app/[locale]/courtlens/t/[tenantSlug]/intake/PublicIntakeForm.tsx) confirmation section
- Server text: `LEGAL_BOUNDARY_NOTICE` in [apps/abr/modules/incidents/public-intake.ts](../../../apps/abr/modules/incidents/public-intake.ts)

Server-provided text (returned by the API and rendered verbatim in the confirmation):

> **EN**: Your intake has been received and will be reviewed by a qualified person. This service does not provide legal advice. All information will be handled confidentially and reviewed by a supervised human reviewer before any action is taken on your behalf.

Note: this server string is currently only produced in EN. If external demo requires FR-CA confirmation copy, the server must be updated to return locale-aware text, or the client must ignore the server-provided text and render locale-appropriate framing (with a security tradeoff — server-provided notice is the trustworthy source).

**Reviewer questions**:
- Is a server-side single-language notice acceptable, or must it be locale-aware for public FR-CA users?
- Should the notice add a concrete follow-up expectation (e.g., "you will hear back within X business days") or is that overpromise-risk?

### 5. Matter Detail Legal Notice (Reviewer-Facing)

**Where it appears in code**:
- Server text: `MATTER_LEGAL_BOUNDARY_NOTICE` in [apps/abr/modules/incidents/matter-service.ts](../../../apps/abr/modules/incidents/matter-service.ts)
- Rendered via `buildMatterDetailView` on the detail page

Server-provided text:

> **EN**: AI-generated content in this record is draft-only and requires human reviewer approval before external use. This platform does not provide legal advice.

**Risk rationale**: This is the boundary shown to internal reviewers. It reinforces the human-approval gate on AI content. Counsel should confirm the wording is appropriate for internal legal-service settings.

### 6. Reviewer Workflow Copy

**Where it appears**: [apps/abr/app/[locale]/dashboard/courtlens/matters/[matterId]/ReviewerActions.tsx](../../../apps/abr/app/[locale]/dashboard/courtlens/matters/[matterId]/ReviewerActions.tsx)

| Key | EN-CA | FR-CA |
|---|---|---|
| `sectionTitle` | Reviewer actions | Actions de l'intervenant |
| `sectionHint` | Actions record audited CourtLens events. AI review packet approval requires human sign-off. | Les actions enregistrent des événements CourtLens vérifiés. L'approbation d'un dossier IA nécessite une signature humaine. |
| `groupAi` | AI review packet | Dossier d'examen IA |
| `groupReferral` | Referral | Référence |
| `groupTransition` | Matter status (ABR FSM) | Statut du dossier (ABR FSM) |
| `transitionReason` | Reviewer advanced matter | L'intervenant a fait avancer le dossier |

**Risk rationale**: Reviewer-facing but the framing (esp. "AI review packet approval requires human sign-off") is what protects against downstream customer-facing overreach. Counsel should confirm the sign-off language is appropriate.

### 7. Tenant Queue and Detail Framing

**Where it appears**: matter queue page + detail page (via next-intl catalogs).

| Key | EN-CA | FR-CA |
|---|---|---|
| `tenantQueue.subtitle` | Review-ready operational summary for supervised access-to-justice casework. This surface displays operational status only. It is not legal advice. | Résumé opérationnel prêt à l'examen pour l'accompagnement supervisé en accès à la justice. Cette vue affiche uniquement le statut opérationnel. Il ne s'agit pas d'un avis juridique. |
| `matterDetail.subtitle` | Read-only reviewer view. This surface displays operational status only. It is not legal advice. | Vue en lecture seule pour l'intervenant. Cette vue affiche uniquement le statut opérationnel. Il ne s'agit pas d'un avis juridique. |
| `matterDetail.fieldAiPacketDraftSuffix` | — draft only; requires human review before external use | — brouillon seulement; nécessite un examen humain avant tout usage externe |

### 8. Error / Rate-Limit / Unavailable Copy

**Where it appears**: displayed to public users when submission fails.

| Key | EN-CA | FR-CA |
|---|---|---|
| `publicIntakeInvalid` | Some information was missing or invalid. Please review the form and resubmit. | Certaines informations sont manquantes ou incorrectes. Veuillez vérifier le formulaire et le soumettre à nouveau. |
| `publicIntakeRateLimit` | Too many submissions. Please wait a moment and try again. | Trop de soumissions. Veuillez patienter un moment et réessayer. |
| `publicIntakeUnavailable` | This intake is not available for the requested organisation. | Cette prise en charge n'est pas disponible pour l'organisation demandée. |
| `publicIntakeGeneric` | Your intake could not be submitted. Please try again later. | Votre demande n'a pas pu être soumise. Veuillez réessayer plus tard. |

**Risk rationale**: Error states must not create false impressions (e.g., that the organisation refused service to a specific person). Framing is generic.

---

## Approval Table

To be completed by counsel. Do not modify the customer-facing surfaces to reflect "approved" status until this table is completed and signed.

| Surface | EN-CA reviewed | EN-CA approved | FR-CA reviewed | FR-CA approved | Notes |
|---|---|---|---|---|---|
| 1. Public intake page | ☐ | ☐ | ☐ | ☐ |  |
| 2. Public intake form framing | ☐ | ☐ | ☐ | ☐ |  |
| 3. Consent statement | ☐ | ☐ | ☐ | ☐ |  |
| 4. Confirmation legal notice (server) | ☐ | ☐ | ☐ (N/A — currently EN only) | ☐ |  |
| 5. Matter detail legal notice (server) | ☐ | ☐ | ☐ (N/A — currently EN only) | ☐ |  |
| 6. Reviewer workflow copy | ☐ | ☐ | ☐ | ☐ |  |
| 7. Tenant queue / detail framing | ☐ | ☐ | ☐ | ☐ |  |
| 8. Error / rate-limit / unavailable | ☐ | ☐ | ☐ | ☐ |  |

**Counsel name**: ____________________________________  
**Firm / role**: ____________________________________  
**Jurisdictions considered**: ____________________________________  
**Date of review**: ____________________________________  
**Signature**: ____________________________________

## After Approval

When all rows in the table above are approved:
1. Update [demo-smoke-gate.md](demo-smoke-gate.md) to mark the "Counsel review" gate as PASS with the reviewer name and date.
2. Do not modify approved strings without re-approval. Any change to a customer-facing string carrying legal-boundary framing requires a fresh counsel review.
3. Note that server-provided legal notices (items 4 and 5) currently return English only. If the public demo audience is FR-CA, this must be addressed before demo — either by adding locale-aware server text or by explicitly documenting the EN-only nature of the notice in the demo talk track.

## This Document Is Not Legal Approval

Compiled by the engineering team based on customer-facing copy currently present in the codebase. It is a review packet only. Nothing in this document constitutes legal advice or approval of the underlying copy.

## Related

- [Demo smoke gate](demo-smoke-gate.md)
- [Public intake UI](public-intake-ui.md)
- [Tenant matter UI](tenant-matter-ui.md)
- [Reviewer workflow UI](reviewer-workflow-ui.md)
- [Pilot readiness plan](../pilot-readiness-plan.md)
