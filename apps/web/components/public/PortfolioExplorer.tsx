'use client';

import { useMemo, useState } from 'react';
import { publicPortfolio } from '@/lib/public-portfolio';
import type { Locale } from '@/lib/locales';

const sectorFr: Record<string, string> = {
  Sport: 'Sport',
  Justice: 'Justice',
  Research: 'Recherche',
  'Creator economy': 'Économie créative',
  Governance: 'Gouvernance',
  Care: 'Soins',
  Healthcare: 'Santé',
  Commerce: 'Commerce',
  Agriculture: 'Agriculture',
  'Supply chain': 'Chaîne logistique',
  'Justice and equity': 'Justice et équité',
  Finance: 'Finance',
  'Financial services': 'Services financiers',
  Insurance: 'Assurance',
  Trade: 'Commerce international',
};

export default function PortfolioExplorer({ locale }: { locale: Locale }) {
  const isFr = locale === 'fr-CA';
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('all');

  const sectors = useMemo(
    () => Array.from(new Set(publicPortfolio.map((item) => item.sector))).sort((a, b) => a.localeCompare(b)),
    [],
  );

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return publicPortfolio.filter((entry) => {
      const matchesSector = sector === 'all' || entry.sector === sector;
      const haystack = [entry.name, entry.sector, entry.en, entry.fr].join(' ').toLocaleLowerCase(locale);
      return matchesSector && (!needle || haystack.includes(needle));
    });
  }, [query, sector, locale]);

  return (
    <div>
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] sm:p-6">
        <div>
          <label htmlFor="portfolio-search" className="mb-2 block text-sm font-semibold text-navy">
            {isFr ? 'Rechercher une initiative' : 'Search initiatives'}
          </label>
          <input
            id="portfolio-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isFr ? 'Nom, secteur ou description' : 'Name, sector or description'}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-navy placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
          />
        </div>
        <div>
          <label htmlFor="portfolio-sector" className="mb-2 block text-sm font-semibold text-navy">
            {isFr ? 'Secteur' : 'Sector'}
          </label>
          <select
            id="portfolio-sector"
            value={sector}
            onChange={(event) => setSector(event.target.value)}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
          >
            <option value="all">{isFr ? 'Tous les secteurs' : 'All sectors'}</option>
            {sectors.map((item) => (
              <option key={item} value={item}>{isFr ? (sectorFr[item] ?? item) : item}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 flex min-h-10 items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-sm text-slate-600">
          {isFr
            ? (results.length === 1 ? '1 initiative affichée' : results.length + ' initiatives affichées')
            : (results.length === 1 ? '1 initiative shown' : results.length + ' initiatives shown')}
        </p>
        {(query || sector !== 'all') && (
          <button
            type="button"
            onClick={() => { setQuery(''); setSector('all'); }}
            className="min-h-10 rounded-lg px-3 text-sm font-semibold text-electric hover:bg-electric/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
          >
            {isFr ? 'Effacer les filtres' : 'Clear filters'}
          </button>
        )}
      </div>

      {results.length > 0 ? (
        <div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <article key={item.name} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wider text-electric">{isFr ? (sectorFr[item.sector] ?? item.sector) : item.sector}</p>
              <h3 className="mt-3 text-xl font-semibold text-navy">{item.name}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">{isFr ? item.fr : item.en}</p>
              <p className="mt-auto pt-6 text-xs leading-relaxed text-slate-500">
                {isFr ? 'Initiative du portefeuille · Vérifier la disponibilité' : 'Portfolio initiative · Availability by inquiry'}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="font-semibold text-navy">{isFr ? 'Aucune initiative trouvée.' : 'No matching initiatives.'}</p>
          <p className="mt-2 text-sm text-slate-600">{isFr ? 'Essayez un autre mot ou secteur.' : 'Try another term or sector.'}</p>
        </div>
      )}
    </div>
  );
}
