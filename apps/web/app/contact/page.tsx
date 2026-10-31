import ContactClient from './ContactClient';

type ContactSource = 'contact_page' | 'union_eyes_pilot' | 'civic_briefing' | 'portfolio_inquiry';

/** Resolve only known public referral intents on the server so the initial
 * selector and submitted CRM source agree without hydration side effects. */
function resolveSource(value: string | string[] | undefined): ContactSource {
  const interest = Array.isArray(value) ? value[0] : value;
  switch (interest) {
    case 'union-eyes':
      return 'union_eyes_pilot';
    case 'civic':
      return 'civic_briefing';
    case 'portfolio':
      return 'portfolio_inquiry';
    default:
      return 'contact_page';
  }
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ interest?: string | string[] }>;
}) {
  const params = await searchParams;
  const source = resolveSource(params.interest);
  return <ContactClient key={source} initialSource={source} />;
}
