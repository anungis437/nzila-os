/**
 * @nzila/os-core — Resolution templates (Markdown bodies)
 */
import type { GovernanceActionType } from './types'

export interface ResolutionTemplate {
  title: string
  bodyMarkdown: string
}

const templates: Record<string, (params: Record<string, string>) => ResolutionTemplate> = {
  issue_shares: (p) => ({
    title: `Board Resolution — Issuance of ${p.quantity ?? '___'} ${p.className ?? '___'} Shares`,
    bodyMarkdown: `## Board Resolution — Share Issuance

**WHEREAS** the Corporation wishes to issue shares in accordance with its Articles;

**BE IT RESOLVED THAT:**

1. The Corporation is authorized to issue **${p.quantity ?? '___'}** shares of **${p.className ?? '___'}** class to **${p.recipientName ?? '___'}** at a price of **${p.pricePerShare ?? '___'}** per share.
2. The Secretary is directed to update the share register and issue a share certificate.
3. Any director or officer is authorized to sign all documents necessary to give effect to this resolution.

_Effective Date:_ ${p.effectiveDate ?? '___'}
`,
  }),

  transfer_shares: (p) => ({
    title: `Board Resolution — Transfer of ${p.quantity ?? '___'} ${p.className ?? '___'} Shares`,
    bodyMarkdown: `## Board Resolution — Share Transfer

**WHEREAS** a request has been received to transfer shares;

**BE IT RESOLVED THAT:**

1. The transfer of **${p.quantity ?? '___'}** shares of **${p.className ?? '___'}** from **${p.fromName ?? '___'}** to **${p.toName ?? '___'}** is hereby approved.
2. Right of first refusal has been duly offered and waived / not exercised.
3. The Secretary shall update the share register accordingly.

_Effective Date:_ ${p.effectiveDate ?? '___'}
`,
  }),

  borrow_funds: (p) => ({
    title: `Board Resolution — Borrowing of $${p.amount ?? '___'}`,
    bodyMarkdown: `## Board Resolution — Borrowing

**WHEREAS** the Corporation requires financing;

**BE IT RESOLVED THAT:**

1. The Corporation is authorized to borrow up to **$${p.amount ?? '___'} ${p.currency ?? 'CAD'}** from **${p.lenderName ?? '___'}**.
2. The terms are as set out in the attached term sheet.
3. Any two directors are authorized to execute the loan agreement.

_Effective Date:_ ${p.effectiveDate ?? '___'}
`,
  }),

  elect_directors: (p) => ({
    title: `Shareholder Resolution — Election of Directors`,
    bodyMarkdown: `## Ordinary Resolution — Election of Directors

**BE IT RESOLVED AS AN ORDINARY RESOLUTION THAT:**

1. The following persons are elected as directors of the Corporation to hold office until the next annual meeting or until their successors are elected:
   - ${p.directorNames ?? '___'}
2. The Secretary shall file a Notice of Directors with the registrar within 15 days.

_Effective Date:_ ${p.effectiveDate ?? '___'}
`,
  }),

  amend_constitution: (p) => ({
    title: `Special Resolution — Amendment to Articles`,
    bodyMarkdown: `## Special Resolution — Constitutional Amendment

**BE IT RESOLVED AS A SPECIAL RESOLUTION THAT:**

1. Article **${p.articleNumber ?? '___'}** of the Corporation's Articles is amended as follows:
   > ${p.amendmentText ?? '___'}
2. The Secretary shall file restated Articles with the registrar.

_Effective Date:_ ${p.effectiveDate ?? '___'}
`,
  }),

  dividend: (p) => ({
    title: `Board Resolution — Declaration of Dividend`,
    bodyMarkdown: `## Board Resolution — Dividend

**BE IT RESOLVED THAT:**

1. A dividend of **$${p.amountPerShare ?? '___'}** per share is declared on **${p.className ?? '___'}** shares.
2. The record date is **${p.recordDate ?? '___'}** and payment date is **${p.paymentDate ?? '___'}**.
3. The board has confirmed the Corporation satisfies the solvency test.

_Effective Date:_ ${p.effectiveDate ?? '___'}
`,
  }),
}

export function getResolutionTemplate(
  action: GovernanceActionType,
  params: Record<string, string> = {},
): ResolutionTemplate | null {
  const fn = templates[action]
  if (!fn) return null
  return fn(params)
}

export function listAvailableTemplates(): string[] {
  return Object.keys(templates)
}
