import { redirect } from 'next/navigation';

function toQueryString(searchParams: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'undefined') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
      continue;
    }
    query.set(key, value);
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export default async function LegacyContinuityAssessmentStartRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  redirect(`/en-CA/continuity-assessment/start${toQueryString(resolved)}`);
}
