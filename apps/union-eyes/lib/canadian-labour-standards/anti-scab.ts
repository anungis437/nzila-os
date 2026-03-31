/**
 * Canadian Labour Standards — Anti-Scab Provisions
 *
 * Only three Canadian jurisdictions have anti-replacement-worker
 * (anti-scab) legislation: Quebec (1977), British Columbia (2024),
 * and the federal jurisdiction (2024). All other provinces/territories
 * allow replacement workers during strikes/lockouts.
 *
 * @module canadian-labour-standards/anti-scab
 */

import type { AntiScabProvision, CanadianJurisdiction } from './types';

export const ANTI_SCAB_PROVISIONS: Record<CanadianJurisdiction, AntiScabProvision> = {
  federal: {
    hasAntiScab: true,
    statute: 'Canada Labour Code, Part I',
    section: 's. 94(2.1)–(2.5)',
    effectiveDate: '2024-06-20',
    description:
      'Prohibits use of replacement workers during strikes/lockouts in federally-regulated industries. ' +
      'Enacted via Bill C-58 (2024). Applies to banking, telecom, inter-provincial transport, federal Crown corps.',
    penalties: 'Up to $100,000/day for employer violations.',
    exceptions: 'Maintenance workers may be permitted if essential to prevent danger to life, health, or property.',
  },
  QC: {
    hasAntiScab: true,
    statute: 'Code du travail du Québec',
    section: 'art. 109.1 et seq.',
    effectiveDate: '1977-01-01',
    description:
      'Oldest anti-scab law in Canada. Prohibits employers from using replacement workers during a lawful ' +
      'strike or lockout. Covers employees of the same employer, employees of another employer, contractors, ' +
      'and managers hired after the negotiation stage.',
    penalties: 'Penal proceedings before TAT; fines per day of violation.',
    exceptions: 'Managers employed before the dispute may continue working in their usual functions.',
  },
  BC: {
    hasAntiScab: true,
    statute: 'Labour Relations Code (British Columbia)',
    section: 's. 68(1)',
    effectiveDate: '2024-03-25',
    description:
      'Enacted via Bill 36 (2024). Prohibits employers from using replacement workers during a lawful ' +
      'strike or lockout. Third-party contractors and transferred employees from related employers are also prohibited.',
    penalties: 'BCLRB may issue cease-and-desist, impose monetary penalties.',
    exceptions: 'Workers needed to prevent imminent danger to life, health, safety, or serious environmental damage.',
  },
  ON: { hasAntiScab: false },
  AB: { hasAntiScab: false },
  SK: { hasAntiScab: false },
  MB: { hasAntiScab: false },
  NB: { hasAntiScab: false },
  NS: { hasAntiScab: false },
  PE: { hasAntiScab: false },
  NL: { hasAntiScab: false },
  YT: { hasAntiScab: false },
  NT: { hasAntiScab: false },
  NU: { hasAntiScab: false },
};

/**
 * Check if a jurisdiction has anti-scab legislation.
 */
export function hasAntiScabLaw(jurisdiction: CanadianJurisdiction): boolean {
  return ANTI_SCAB_PROVISIONS[jurisdiction].hasAntiScab;
}

/**
 * Get jurisdictions with anti-scab legislation.
 */
export function getAntiScabJurisdictions(): CanadianJurisdiction[] {
  return (Object.entries(ANTI_SCAB_PROVISIONS) as [CanadianJurisdiction, AntiScabProvision][])
    .filter(([, p]) => p.hasAntiScab)
    .map(([j]) => j);
}
