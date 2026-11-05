import { AlertTriangle } from 'lucide-react';

// One statement for every caller: a whole page, a form or action, or a banner above data that depends on the service.
// It says what is true in each case (the service is absent; nothing was read, saved or changed through it) and never
// assumes there are figures, a list or a form beneath it.
const COPY = {
  en: {
    title: 'Not available in this release',
    body: 'The service behind this is not available in this release. Nothing was read, saved or changed through it, and any number or status on this page that depends on it is not real and must not be relied on.',
  },
  fr: {
    title: 'Non disponible dans cette version',
    body: 'Le service qui sous-tend cette fonction n’est pas disponible dans cette version. Rien n’a été lu, enregistré ou modifié par son intermédiaire, et tout chiffre ou statut de cette page qui en dépend n’est pas réel et ne doit pas être utilisé.',
  },
} as const;

/** A visible, assistive-technology-announced statement that the feature or data it stands in for is not available. */
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
