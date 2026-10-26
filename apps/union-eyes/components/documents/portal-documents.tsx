'use client';

import { DocumentBrowser } from '@/components/documents/document-browser';

export function PortalDocuments({ locale }: { locale: string }) {
  const french = locale.toLowerCase().startsWith('fr');
  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6" data-testid="portal-documents">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{french ? 'Documents du portail' : 'Portal documents'}</h1>
        <p className="text-sm text-muted-foreground">
          {french
            ? 'Liste, apercu et telechargement autorises pour les membres et le personnel. Les adresses de stockage ne sont pas affichees.'
            : 'Authorized list, preview, and download for members and staff. Storage addresses are not shown.'}
        </p>
      </header>
      <DocumentBrowser selectionMode="multiple" />
    </div>
  );
}
