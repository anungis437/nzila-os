'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { ClaimRow } from '@/components/claims/claim-row';
import { claimLabelKey, useClaimLabels } from '@/components/claims/claim-labels';

export { claimLabelKey };

/**
 * Members see only their own cases, so this view deliberately has no member column,
 * selection, export or column controls.
 */
export function MemberCaseList({ data }: { data: ClaimRow[] }) {
  const locale = useLocale();
  const page = useTranslations('claimsPage');
  const { typeLabel, statusLabel, priorityLabel } = useClaimLabels();
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  const href = (claim: ClaimRow) => `/${locale}/dashboard/claims/${encodeURIComponent(claim.claimId)}`;
  const submitted = (claim: ClaimRow) => (Number.isNaN(claim.createdAt.getTime()) ? '' : dateFormat.format(claim.createdAt));
  const number = (claim: ClaimRow) => claim.claimNumber ?? '—';
  const type = (claim: ClaimRow) => (claim.claimType === null ? '—' : typeLabel(claim.claimType));

  return (
    <div data-testid="member-case-list">
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">{page('columnCaseNumber')}</th>
            <th scope="col" className="py-2 pr-4 font-medium">{page('columnType')}</th>
            <th scope="col" className="py-2 pr-4 font-medium">{page('columnStatus')}</th>
            <th scope="col" className="py-2 pr-4 font-medium">{page('columnPriority')}</th>
            <th scope="col" className="py-2 pr-4 font-medium">{page('columnSubmitted')}</th>
            <th scope="col" className="py-2"><span className="sr-only">{page('viewCase')}</span></th>
          </tr>
        </thead>
        <tbody>
          {data.map((claim) => (
            <tr key={claim.claimId} className="border-b last:border-0">
              <td className="py-3 pr-4 font-medium">{number(claim)}</td>
              <td className="py-3 pr-4">{type(claim)}</td>
              <td className="py-3 pr-4"><Badge variant="secondary">{statusLabel(claim.status)}</Badge></td>
              <td className="py-3 pr-4">{priorityLabel(claim.priority)}</td>
              <td className="py-3 pr-4 whitespace-nowrap">{submitted(claim)}</td>
              <td className="py-3 text-right">
                <Link
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  href={href(claim)}
                  aria-label={`${page('viewCase')} ${number(claim)}`}
                >
                  {page('viewCase')}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="space-y-3 md:hidden">
        {data.map((claim) => (
          <li key={claim.claimId} className="rounded-lg border p-4">
            <Link className="block" href={href(claim)}>
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{number(claim)}</span>
                <Badge variant="secondary">{statusLabel(claim.status)}</Badge>
              </div>
              <p className="mt-1 text-sm">{type(claim)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {page('columnPriority')}: {priorityLabel(claim.priority)} · {page('columnSubmitted')}: {submitted(claim)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
