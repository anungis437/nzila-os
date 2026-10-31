import { LanguageIcon, MapPinIcon, ServerStackIcon, UserGroupIcon } from '@heroicons/react/24/outline';

export default function TrustStrip({ isFr }: { isFr: boolean }) {
  const items = [
    {
      icon: MapPinIcon,
      title: isFr ? 'Conçu au Canada' : 'Built in Canada',
      detail: isFr ? 'Fabriqué au Canada' : 'Made in Canada',
    },
    {
      icon: LanguageIcon,
      title: isFr ? 'Bilingue dès la conception' : 'Bilingual by design',
      detail: isFr ? 'Français et anglais canadiens' : 'Canadian English and French',
    },
    {
      icon: ServerStackIcon,
      title: isFr ? 'Site public hébergé au Canada' : 'Public website hosted in Canada',
      detail: isFr ? 'Région Canada-Centre' : 'Canada Central region',
    },
    {
      icon: UserGroupIcon,
      title: isFr ? 'Les personnes décident' : 'People decide',
      detail: isFr ? 'Examen humain de l’assistance IA' : 'Human review of AI assistance',
    },
  ];

  return (
    <section aria-label={isFr ? 'Nos engagements en bref' : 'Our commitments at a glance'} className="border-b border-slate-200 bg-white">
      <ul className="mx-auto grid max-w-7xl grid-cols-1 gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.title} className="flex items-center gap-4 bg-white px-5 py-5 sm:px-6 lg:px-8">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-electric/10 text-electric">
              <item.icon className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-navy">{item.title}</span>
              <span className="block text-xs text-slate-500">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
