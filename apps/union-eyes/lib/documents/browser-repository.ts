import { isDocumentId } from '@/lib/documents/canonical-journey';

export type BrowserDocument = {
  id: string;
  title: string;
  documentType: string | null;
  privacyLabel: string | null;
  uploadedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type BrowserSort = 'title' | 'updatedAt' | 'documentType';

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Keep only repository fields the browser may render. Storage URLs and extracted text are dropped. */
export function toBrowserDocument(row: unknown): BrowserDocument | null {
  if (!row || typeof row !== 'object') return null;
  const source = row as Record<string, unknown>;
  const id = readString(source.id);
  if (!id || !isDocumentId(id)) return null;
  const title = readString(source.title) ?? readString(source.name) ?? readString(source.filename) ?? id;
  return {
    id,
    title,
    documentType: readString(source.documentType),
    privacyLabel: readString(source.privacyLabel),
    uploadedBy: readString(source.uploadedBy),
    createdAt: readString(source.createdAt),
    updatedAt: readString(source.updatedAt),
  };
}

export function authorizedBrowserDocuments(body: unknown): BrowserDocument[] | null {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { data?: unknown }).data)) return null;
  return (body as { data: unknown[] }).data
    .map((row) => toBrowserDocument(row))
    .filter((row): row is BrowserDocument => row !== null);
}

export function sortBrowserDocuments(rows: BrowserDocument[], sort: BrowserSort, direction: 'asc' | 'desc'): BrowserDocument[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = (left[sort] ?? '').toLowerCase();
    const b = (right[sort] ?? '').toLowerCase();
    if (a < b) return -1 * factor;
    if (a > b) return 1 * factor;
    return 0;
  });
}

export function pageBrowserDocuments(rows: BrowserDocument[], page: number, pageSize: number): BrowserDocument[] {
  const start = Math.max(0, page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function browserCopy(locale: string) {
  const french = locale.toLowerCase().startsWith('fr');
  if (french) {
    return {
      title: 'Documents',
      search: 'Rechercher dans les documents autorises',
      empty: 'Aucun document autorise.',
      loading: 'Chargement des documents autorises.',
      unavailableFilters: 'Le classement par taille, les dossiers et les etiquettes ne sont pas des filtres du referentiel canonique.',
      pageNote: 'Le tri et la pagination s appliquent au resultat autorise deja renvoye. Le referentiel ne pagine pas cette requete.',
      preview: 'Apercu',
      download: 'Telecharger',
      submit: 'Rechercher',
      sort: 'Tri',
      sortUpdated: 'Mis a jour',
      sortTitle: 'Titre',
      sortType: 'Type',
      share: 'Le partage n est pas disponible.',
      remove: 'La suppression n est pas disponible depuis cet ecran.',
      previewMeta: 'Metadonnees autorisees. Le contenu du fichier n est pas ouvert depuis la liste.',
      close: 'Fermer',
      previous: 'Precedent',
      next: 'Suivant',
      grid: 'Grille',
      list: 'Liste',
    };
  }
  return {
    title: 'Documents',
    search: 'Search authorized documents',
    empty: 'No authorized documents.',
    loading: 'Loading authorized documents.',
    unavailableFilters: 'Size sort, folders, and tags are not filters on the canonical repository.',
    pageNote: 'Sort and pages apply to the authorized result already returned. The repository does not page this query.',
    preview: 'Preview',
    download: 'Download',
    submit: 'Search',
    sort: 'Sort',
    sortUpdated: 'Updated',
    sortTitle: 'Title',
    sortType: 'Type',
    share: 'Sharing is not available.',
    remove: 'Delete is not available from this screen.',
    previewMeta: 'Authorized metadata only. The file is not opened from the list.',
    close: 'Close',
    previous: 'Previous',
    next: 'Next',
    grid: 'Grid',
    list: 'List',
  };
}
