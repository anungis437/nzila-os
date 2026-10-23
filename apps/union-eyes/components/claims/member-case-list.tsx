'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { ClaimRow } from '@/components/claims/claim-list-table';

/** `grievance_pay` -> `grievancePay`, matching the `claimTypes` message keys. */
export function claimLabelKey(value: string): string {
  return value.toLowerCase().replace(/[-_\s]+(.)/g, (_match, char: string) => char.toUpperCase());
}

function humanize(value: string): string {
  const spaced = value.replace(/[-_]+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : '';
}

const PRIORITY_KEYS: Record<string, string> = { critical: 'urgent' };

/**
 * Members see only their own cases, so this view deliberately has no member column,
 * selection, export or column controls.
 */
export function MemberCaseList({ data }: { data: ClaimRow[] }) {
  const locale = useLocale();
  const page = useTranslations('claimsPage');
  const types = useTranslations('claimTypes');
  const priorities = useTranslations('priority');
  const statuses = useTranslations('status');
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  const typeLabel = (value: string) => {
    const key = claimLabelKey(value);
    return value && types.has(key) ? types(key) : humanize(value);
  };
  const statusLabel = (value: string) => {
    const key = claimLabelKey(value);
    if (types.has(key)) return types(key);
    if (statuses.has(key)) return statuses(key);
    return humanize(value);
  };
  const priorityLabel = (value: string) => {
    const key = PRIORITY_KEYS[value] ?? value;
    return priorities.has(key) ? priorities(key) : humanize(value);
  };
  const href = (claim: ClaimRow) => `/${locale}/dashboard/claims/${encodeURIComponent(claim.claimId)}`;
  const submitted = (claim: ClaimRow) => (Number.isNaN(claim.createdAt.getTime()) ? '' : dateFormat.format(claim.createdAt));

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
              <td className="py-3 pr-4 font-medium">{claim.claimNumber}</td>
              <td className="py-3 pr-4">{typeLabel(claim.claimType)}</td>
              <td className="py-3 pr-4"><Badge variant="secondary">{statusLabel(claim.status)}</Badge></td>
              <td className="py-3 pr-4">{priorityLabel(claim.priority)}</td>
              <td className="py-3 pr-4 whitespace-nowrap">{submitted(claim)}</td>
              <td className="py-3 text-right">
                <Link
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  href={href(claim)}
                  aria-label={`${page('viewCase')} ${claim.claimNumber}`}
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
                <span className="font-medium">{claim.claimNumber}</span>
                <Badge variant="secondary">{statusLabel(claim.status)}</Badge>
              </div>
              <p className="mt-1 text-sm">{typeLabel(claim.claimType)}</p>
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
