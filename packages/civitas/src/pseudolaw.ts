/**
 * Pseudolaw indicators and prohibited-mechanism rejection.
 *
 * KNOWN_PSEUDOLAW_INDICATORS is a fixed, supplemental list. It is not
 * exhaustive detection. BLACK comes from the prohibited-mechanism doctrine.
 * A premise can be BLACK when none of the indicator strings are present.
 *
 * Response pattern: name the faulty doctrine, explain why it fails,
 * identify the legitimate underlying issue, and redirect to a lawful mechanism.
 * The redirect names the lawful channel. It does not describe how to commit
 * the prohibited act.
 */
import { DOCTRINE_RULES, isCanonicalDoctrine, normalize } from './doctrine'

export interface DoctrineRejection {
  readonly accepted: false
  readonly decisionClass: 'BLACK'
  readonly faultyDoctrine: string
  readonly whyItFails: string
  readonly legitimateUnderlyingIssue: string
  readonly lawfulMechanism: string
}

export interface DoctrineRecognition {
  readonly accepted: true
  readonly decisionClass: null
  readonly ruleId: string
}

export type DoctrineProposal = DoctrineRejection | DoctrineRecognition | {
  readonly accepted: false
  readonly decisionClass: null
  readonly code: 'DOCTRINE_CLOSED'
  readonly reason: string
}

interface FaultyDoctrine {
  readonly id: string
  readonly name: string
  readonly patterns: readonly string[]
  readonly whyItFails: string
  readonly legitimateUnderlyingIssue: string
  readonly lawfulMechanism: string
}

export const KNOWN_PSEUDOLAW_INDICATORS = [
  {
    id: 'sovereign-citizen',
    name: 'Sovereign-citizen doctrine',
    patterns: ['sovereign citizen', 'sovereign-citizen'],
    whyItFails: 'A person cannot opt out of applicable law by self-declaration. Courts decide jurisdiction from law, not from a label.',
    legitimateUnderlyingIssue: 'A real dispute about a debt, charge, tax, or status.',
    lawfulMechanism: 'The statute that applies and the competent court or administrative process.',
  },
  {
    id: 'freeman-on-the-land',
    name: 'Freeman-on-the-Land doctrine',
    patterns: ['freeman on the land', 'freeman-on-the-land', 'freeman of the land'],
    whyItFails: 'Declaring oneself a freeman does not withdraw a person from statutes that apply to them.',
    legitimateUnderlyingIssue: 'A real dispute about legal obligation or state authority.',
    lawfulMechanism: 'The competent forum and the statute or civil code that actually governs the dispute.',
  },
  {
    id: 'strawman-all-caps',
    name: 'ALL-CAPS strawman doctrine',
    patterns: ['strawman account', 'strawman identity', 'all-caps name', 'all caps name', 'name in capitals'],
    whyItFails: 'Capitalization of a name does not split a person into two legal personalities.',
    legitimateUnderlyingIssue: 'A record, identity, or misnomer problem, if one actually exists.',
    lawfulMechanism: 'The lawful process for correcting a civil-status or institutional record.',
  },
  {
    id: 'birth-certificate-account',
    name: 'Birth-certificate account doctrine',
    patterns: ['birth certificate account', 'birth-certificate account', 'birth certificate trust'],
    whyItFails: 'A birth certificate is evidence of birth. It is not a secret commercial account.',
    legitimateUnderlyingIssue: 'A question about civil status or about an actual financial account.',
    lawfulMechanism: 'The civil-status registry, and accounts that a regulated institution actually holds.',
  },
  {
    id: 'secret-treasury-account',
    name: 'Secret Treasury account doctrine',
    patterns: ['secret treasury', 'treasury direct account', 'secret government trust'],
    whyItFails: 'A birth record does not create a hidden public treasury account that a person can draw.',
    legitimateUnderlyingIssue: 'A question about tax, benefits, or a real account balance.',
    lawfulMechanism: 'The tax authority, the benefits program, or the financial institution that holds the account.',
  },
  {
    id: 'unilateral-withdrawal',
    name: 'Unilateral withdrawal from statutory jurisdiction',
    patterns: ['withdraw from statutory', 'opt out of statute', 'unilateral withdrawal', 'not subject to statutes'],
    whyItFails: 'Jurisdiction is not cancelled by a notice that a person is no longer subject to statutes.',
    legitimateUnderlyingIssue: 'Whether a particular statute applies, or whether it contains a real exemption.',
    lawfulMechanism: 'The application and exemption provisions of the statute, read in the competent forum.',
  },
  {
    id: 'fictitious-common-law-court',
    name: 'Fictitious common-law court',
    patterns: ['fictitious common law', 'fictitious common-law', 'de jure court', 'private court of record'],
    whyItFails: 'A private body styled as a court does not displace the superior courts or the civil courts.',
    legitimateUnderlyingIssue: 'A need for adjudication or review.',
    lawfulMechanism: 'The competent court.',
  },
  {
    id: 'maritime-admiralty-misuse',
    name: 'Maritime or admiralty misuse',
    patterns: ['admiralty flag', 'maritime law applies to me', 'gold fringe'],
    whyItFails: 'Labels, flags, and fringe do not convert an ordinary civil or criminal matter into admiralty.',
    legitimateUnderlyingIssue: 'Which court and which body of law actually govern.',
    lawfulMechanism: 'The court and statute or code that govern the matter.',
  },
  {
    id: 'canadian-ucc-sovereignty',
    name: 'Canadian UCC-filing sovereignty',
    patterns: ['ucc filing sovereignty', 'ucc-1 sovereignty', 'ucc financing statement sovereignty'],
    whyItFails: 'The Uniform Commercial Code is United States commercial law. A filing under it does not create sovereignty or discharge a Canadian public obligation.',
    legitimateUnderlyingIssue: 'A security interest, a debt, or a public-law obligation in Canada.',
    lawfulMechanism: 'The Canadian federal or provincial statute that applies, including personal property security legislation where a real security interest exists.',
  },
  {
    id: 'accepted-for-value',
    name: 'Accepted-for-value doctrine',
    patterns: ['accepted for value', 'accept for value'],
    whyItFails: 'Marking a bill or notice "accepted for value" does not discharge the obligation.',
    legitimateUnderlyingIssue: 'A debt, tax, or other sum that is actually owed or disputed.',
    lawfulMechanism: 'Payment, a lawful settlement, or the objection and review process the statute provides.',
  },
  {
    id: 'fictitious-lien',
    name: 'Fictitious lien on an official',
    patterns: ['lien on the judge', 'lien against the official', 'commercial lien on a public officer'],
    whyItFails: 'A lien filed against an official to punish or obstruct their office is not a lawful security interest.',
    legitimateUnderlyingIssue: 'A grievance about an official act.',
    lawfulMechanism: 'The complaint, review, or court process that has authority over that act.',
  },
  {
    id: 'tax-evasion',
    name: 'Tax evasion',
    patterns: ['tax evasion', 'hide income from the tax', 'unreported scheme to defeat tax', 'evade tax'],
    whyItFails: 'Not reporting or concealing tax is evasion. Optimization that depends on concealment is not lawful tax planning.',
    legitimateUnderlyingIssue: 'A wish to reduce or dispute tax within the law.',
    lawfulMechanism: 'Reported planning with a CPA or tax specialist, and the objection or appeal process the taxing statute provides.',
  },
  {
    id: 'fraudulent-conveyance',
    name: 'Fraudulent conveyance',
    patterns: ['fraudulent conveyance', 'transfer to defeat creditors', 'hide assets from creditors'],
    whyItFails: 'A transfer made to defeat creditors is voidable. Asset protection that is really a fraudulent conveyance fails.',
    legitimateUnderlyingIssue: 'A wish to organize ownership without defeating creditors.',
    lawfulMechanism: 'A transfer for real consideration that is disclosed, with advice from a lawyer where creditor or insolvency risk is material.',
  },
  {
    id: 'sham-ownership',
    name: 'Sham ownership',
    patterns: ['sham owner', 'sham ownership', 'nominee in name only', 'paper owner only'],
    whyItFails: 'Ownership that exists only on paper does not create the legal personality or protection the label claims.',
    legitimateUnderlyingIssue: 'A wish to use a corporation or other person for a real purpose.',
    lawfulMechanism: 'A person with real governance, whose registered ownership matches the substance.',
  },
  {
    id: 'beneficial-ownership-concealment',
    name: 'Beneficial-ownership concealment',
    patterns: ['conceal beneficial owner', 'hide the beneficial owner', 'beneficial ownership concealment'],
    whyItFails: 'Hiding a beneficial owner to defeat a disclosure duty is concealment, not privacy.',
    legitimateUnderlyingIssue: 'A question about who must be disclosed, and what privacy law still protects.',
    lawfulMechanism: 'The beneficial-ownership disclosure regime that applies, with privacy limited to what that regime allows.',
  },
  {
    id: 'obstruction',
    name: 'Obstruction of lawful process',
    patterns: ['obstruct the court', 'obstruction of lawful', 'refuse every lawful process'],
    whyItFails: 'Autonomy does not include interfering with a lawful process.',
    legitimateUnderlyingIssue: 'A wish to contest or comply with a process.',
    lawfulMechanism: 'Participation in the process, the disclosure the law requires, and counsel where the matter is professional-risk.',
  },
  {
    id: 'fraud',
    name: 'Fraud',
    patterns: ['commit fraud', 'fraudulent misstatement'],
    whyItFails: 'A false statement made to obtain an advantage is fraud. A lawful structure cannot depend on it.',
    legitimateUnderlyingIssue: 'A wish to achieve the underlying outcome by a true account of the facts.',
    lawfulMechanism: 'An accurate filing or agreement, and a lawyer where the consequence is material.',
  },
  {
    id: 'misrepresentation',
    name: 'Misrepresentation',
    patterns: ['misrepresent the owner', 'false disclosure of'],
    whyItFails: 'A material untruth in a filing, contract, or disclosure is misrepresentation.',
    legitimateUnderlyingIssue: 'A wish to present a structure that will be believed.',
    lawfulMechanism: 'Disclosure that matches the substance of the arrangement.',
  },
] as const satisfies readonly FaultyDoctrine[]

/** Prior name of the indicator list. The list is supplemental, not exhaustive. */
export const FAULTY_DOCTRINES = KNOWN_PSEUDOLAW_INDICATORS

export const BLACK_MECHANISM_IDS = [
  'fraud',
  'concealment',
  'evasion',
  'pseudolaw',
  'obstruction',
  'misrepresentation',
] as const

export type ProhibitedMechanismId = (typeof BLACK_MECHANISM_IDS)[number]

export function indicatorsAreExhaustive(): false {
  return false
}

export const MECHANISM_DISPOSITIONS = [
  'PROHIBITED',
  'AFFIRMATIVELY_EVALUATED_LAWFUL',
  'UNRESOLVED',
] as const

export type MechanismDisposition = (typeof MECHANISM_DISPOSITIONS)[number]

/**
 * Absence of an indicator or a prohibited-mechanism id is not evidence of lawfulness.
 * This function always returns false.
 */
export function indicatorAbsenceIsLawfulEvidence(): false {
  return false
}

export interface MechanismEvaluation {
  readonly disposition: MechanismDisposition
  readonly indicatorAbsenceIsLawfulEvidence: false
  readonly matchedIndicator: boolean
}

/**
 * Deterministic sentinel check. No classifier.
 * An unrecognized free-text mechanism stays UNRESOLVED even if the caller
 * asserts an affirmative lawful basis. That basis is accepted only when
 * there is no free-text mechanism to excuse.
 */
export function evaluateMechanism(input: {
  readonly mechanismText?: string | null
  readonly prohibitedMechanismId?: ProhibitedMechanismId | null
  readonly affirmativeLawfulBasis: boolean
}): MechanismEvaluation {
  if (input.prohibitedMechanismId) {
    return {
      disposition: 'PROHIBITED',
      indicatorAbsenceIsLawfulEvidence: false,
      matchedIndicator: false,
    }
  }

  const text = input.mechanismText?.trim() ?? ''
  if (text.length > 0 && findFaultyDoctrine(text)) {
    return {
      disposition: 'PROHIBITED',
      indicatorAbsenceIsLawfulEvidence: false,
      matchedIndicator: true,
    }
  }

  if (text.length > 0) {
    return {
      disposition: 'UNRESOLVED',
      indicatorAbsenceIsLawfulEvidence: false,
      matchedIndicator: false,
    }
  }

  if (input.affirmativeLawfulBasis) {
    return {
      disposition: 'AFFIRMATIVELY_EVALUATED_LAWFUL',
      indicatorAbsenceIsLawfulEvidence: false,
      matchedIndicator: false,
    }
  }

  return {
    disposition: 'UNRESOLVED',
    indicatorAbsenceIsLawfulEvidence: false,
    matchedIndicator: false,
  }
}

const PROHIBITED_MECHANISM_DOCTRINE: Record<
  ProhibitedMechanismId,
  {
    readonly name: string
    readonly whyItFails: string
    readonly legitimateUnderlyingIssue: string
    readonly lawfulMechanism: string
  }
> = {
  fraud: {
    name: 'Fraud',
    whyItFails: 'A false statement made to obtain an advantage is fraud. A lawful structure cannot depend on it.',
    legitimateUnderlyingIssue: 'A wish to achieve the underlying outcome by a true account of the facts.',
    lawfulMechanism: 'An accurate filing or agreement, and a lawyer where the consequence is material.',
  },
  concealment: {
    name: 'Concealment',
    whyItFails: 'Hiding a fact that the law requires to be disclosed is concealment. Privacy does not authorize it.',
    legitimateUnderlyingIssue: 'A question about what must be disclosed and what privacy law still protects.',
    lawfulMechanism: 'The disclosure regime that applies, with privacy limited to what that regime allows.',
  },
  evasion: {
    name: 'Evasion',
    whyItFails: 'Defeating a mandatory duty by non-disclosure or disguise is evasion. Optimization that depends on that defeat is prohibited.',
    legitimateUnderlyingIssue: 'A wish to reduce or dispute an obligation within the law.',
    lawfulMechanism: 'The statute that imposes the duty, and the objection or review process it provides, with a professional where the matter is professional-risk.',
  },
  pseudolaw: {
    name: 'Pseudolaw',
    whyItFails: 'A self-declared exemption does not displace the statute, code, or court that applies. Courts decide jurisdiction from law.',
    legitimateUnderlyingIssue: 'A real dispute about a debt, charge, tax, status, or obligation.',
    lawfulMechanism: 'The statute or civil code that applies and the competent court or administrative process.',
  },
  obstruction: {
    name: 'Obstruction',
    whyItFails: 'Autonomy does not include interfering with a lawful process.',
    legitimateUnderlyingIssue: 'A wish to contest or comply with a process.',
    lawfulMechanism: 'Participation in the process, the disclosure the law requires, and counsel where the matter is professional-risk.',
  },
  misrepresentation: {
    name: 'Misrepresentation',
    whyItFails: 'A material untruth in a filing, contract, or disclosure is misrepresentation.',
    legitimateUnderlyingIssue: 'A wish to present a structure that will be believed.',
    lawfulMechanism: 'Disclosure that matches the substance of the arrangement.',
  },
}

export function findFaultyDoctrine(text: string): FaultyDoctrine | undefined {
  const normalized = normalize(text)
  return KNOWN_PSEUDOLAW_INDICATORS.find((doctrine) =>
    doctrine.patterns.some((pattern) => normalized.includes(normalize(pattern))),
  )
}

/**
 * BLACK from the closed mechanism doctrine. Indicator strings are not consulted.
 * Scores, preferences, recommendations, sources, and review markers cannot flip it.
 */
export function rejectProhibitedMechanism(mechanismId: ProhibitedMechanismId): DoctrineRejection {
  const doctrine = PROHIBITED_MECHANISM_DOCTRINE[mechanismId]
  return {
    accepted: false,
    decisionClass: 'BLACK',
    faultyDoctrine: doctrine.name,
    whyItFails: doctrine.whyItFails,
    legitimateUnderlyingIssue: doctrine.legitimateUnderlyingIssue,
    lawfulMechanism: doctrine.lawfulMechanism,
  }
}

export function rejectFaultyDoctrine(doctrine: FaultyDoctrine): DoctrineRejection {
  return {
    accepted: false,
    decisionClass: 'BLACK',
    faultyDoctrine: doctrine.name,
    whyItFails: doctrine.whyItFails,
    legitimateUnderlyingIssue: doctrine.legitimateUnderlyingIssue,
    lawfulMechanism: doctrine.lawfulMechanism,
  }
}

/**
 * Doctrine is closed. A canonical rule is recognized. Anything else is refused.
 * Pseudolaw is refused with the lawful-alternative pathway.
 */
const DOCTRINE_STATEMENT_INDEX = new Map(
  DOCTRINE_RULES.map((rule) => [normalize(rule.statement), rule]),
)

export function proposeDoctrine(statement: string): DoctrineProposal {
  const faulty = findFaultyDoctrine(statement)
  if (faulty) return rejectFaultyDoctrine(faulty)
  if (isCanonicalDoctrine(statement)) {
    const rule = DOCTRINE_STATEMENT_INDEX.get(normalize(statement))
    return {
      accepted: true,
      decisionClass: null,
      ruleId: rule?.id ?? 'unknown',
    }
  }
  return {
    accepted: false,
    decisionClass: null,
    code: 'DOCTRINE_CLOSED',
    reason: 'CIVITAS doctrine is a closed set. A new statement is not accepted as doctrine.',
  }
}
