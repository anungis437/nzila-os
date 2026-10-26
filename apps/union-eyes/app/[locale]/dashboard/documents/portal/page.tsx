import { PortalDocuments } from '@/components/documents/portal-documents';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Member and staff portal document journey.
 * The dashboard documents layout only checks that a session exists.
 * Listing, preview, and download stay on the canonical repository and download routes.
 */
export default async function PortalDocumentsPage({ params }: PageProps) {
  const { locale } = await params;
  return <PortalDocuments locale={locale} />;
}
