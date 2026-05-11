import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type MarketingInsightRedirectPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function MarketingInsightRedirectPage({ params }: MarketingInsightRedirectPageProps) {
  const { slug } = await params;
  redirect(`/en-CA/insights/${slug}`);
}
