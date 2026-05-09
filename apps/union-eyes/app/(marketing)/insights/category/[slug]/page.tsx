import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type MarketingInsightCategoryRedirectPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function MarketingInsightCategoryRedirectPage({
  params,
}: MarketingInsightCategoryRedirectPageProps) {
  const { slug } = await params;
  redirect(`/en-CA/insights/category/${slug}`);
}
