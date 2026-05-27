import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function OcraAliasPage({ params }: PageProps) {
  const { locale } = await params;
  redirect(`/${locale}/organizational-continuity-risk`);
}
