import { AlertTriangle } from 'lucide-react';

const COPY = {
  en: {
    title: 'This information is not available',
    body: 'The service that produces it is not available in this release, so the figures below are not real and must not be relied on. Nothing was changed.',
  },
  fr: {
    title: 'Cette information n’est pas disponible',
    body: 'Le service qui la produit n’est pas disponible dans cette version; les chiffres ci-dessous ne sont donc pas réels et ne doivent pas être utilisés. Rien n’a été modifié.',
  },
} as const;

/** A visible, assistive-technology-announced statement that a page's data could not be produced. */
export function CapabilityUnavailable({ locale, capability }: { locale?: string; capability?: string }) {
  const copy = locale?.toLowerCase().startsWith('fr') ? COPY.fr : COPY.en;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{copy.title}</p>
        <p className="text-sm">{copy.body}</p>
        {capability ? <p className="mt-1 text-xs opacity-80">{capability}</p> : null}
      </div>
    </div>
  );
}
