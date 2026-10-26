/**
 * Pure rules for the dashboard document journey.
 * List rows are not download authority. A file URL on a list row is never issued
 * to the browser. Sharing and classification changes have no canonical action here.
 */

export const DOCUMENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CANONICAL_DOCUMENT_COLLECTION_PATH = '/api/documents/repository';

export type JourneyDenial =
  | 'malformed_id'
  | 'unauthorized'
  | 'storage_failure'
  | 'audit_failure'
  | 'conflict'
  | 'upload_rejected'
  | 'share_blocked'
  | 'classification_change_blocked'
  | 'list_unavailable'
  | 'none_selected'
  | 'reference_rejected'
  | 'bulk_unavailable'
  | 'bulk_limit';

export type JourneyCopy = Record<
  JourneyDenial | 'download' | 'saved' | 'bulk_complete' | 'bulk_partial' | 'bulk_none' | 'retention_unavailable',
  string
>;

/** A bulk download is N independent downloads; the server accepts at most this many at once. */
export const BULK_DOWNLOAD_LIMIT = 25;

export type BulkItemOutcome =
  | 'issued'
  | 'not_found'
  | 'denied'
  | 'download_not_granted'
  | 'storage_unavailable'
  | 'storage_unverified'
  | 'audit_failed';

export type BulkDownloadReport = {
  atomic: false;
  status: 'complete' | 'partial' | 'none';
  requested: number;
  issued: number;
  failed: number;
  items: Array<{ documentId: string; outcome: BulkItemOutcome; downloadUrl?: string }>;
};

const ENGLISH: JourneyCopy = {
  download: 'Download',
  saved: 'The document was saved.',
  malformed_id: 'The document identifier is not valid.',
  unauthorized: 'You do not have permission to open this document.',
  storage_failure: 'The document could not be retrieved from storage. No link was issued.',
  audit_failure: 'The download stopped because the audit record could not be written.',
  conflict: 'The document changed before this request finished. Refresh and try again.',
  upload_rejected: 'The document was not saved.',
  share_blocked: 'Sharing is not available. Changing a privacy label does not grant access.',
  classification_change_blocked:
    'Classification and retention rules cannot be changed from this screen.',
  list_unavailable: 'The document list could not be loaded.',
  none_selected: 'Select a document before downloading.',
  reference_rejected:
    "The file reference or content hash was rejected. Use a file already stored in your organization's document storage; a hash, if given, must be the file's SHA-256.",
  bulk_unavailable: 'The bulk download could not be started. No links were issued.',
  bulk_limit: 'Select at most 25 documents for one bulk download.',
  bulk_complete: '{issued} of {requested} links were issued.',
  bulk_partial:
    '{issued} of {requested} links were issued; {failed} were not. Links already issued stay valid. Each document was checked and recorded separately.',
  bulk_none: 'No links were issued ({failed} of {requested} failed). Each document was checked separately.',
  retention_unavailable:
    'Retention rules and legal holds are not available here. No canonical document retention record exists yet, so nothing on this screen reflects a hold or a rule in force.',
};

const FRENCH: JourneyCopy = {
  download: 'Telecharger',
  saved: 'Le document a ete enregistre.',
  malformed_id: "L'identifiant du document n'est pas valide.",
  unauthorized: "Vous n'avez pas l'autorisation d'ouvrir ce document.",
  storage_failure: "Le document n'a pas pu etre recupere. Aucun lien n'a ete emis.",
  audit_failure: "Le telechargement a ete interrompu parce que l'audit n'a pas pu etre enregistre.",
  conflict: 'Le document a change avant la fin de la demande. Actualisez et reessayez.',
  upload_rejected: "Le document n'a pas ete enregistre.",
  share_blocked:
    "Le partage n'est pas disponible. Modifier une etiquette de confidentialite n'accorde pas d'acces.",
  classification_change_blocked:
    'La classification et les regles de conservation ne peuvent pas etre modifiees depuis cet ecran.',
  list_unavailable: "La liste des documents n'a pas pu etre chargee.",
  none_selected: 'Selectionnez un document avant le telechargement.',
  reference_rejected:
    "La reference du fichier ou l'empreinte a ete refusee. Utilisez un fichier deja stocke dans le stockage de documents de votre organisation; l'empreinte, si fournie, doit etre le SHA-256 du fichier.",
  bulk_unavailable: "Le telechargement groupe n'a pas pu demarrer. Aucun lien n'a ete emis.",
  bulk_limit: 'Selectionnez au plus 25 documents pour un telechargement groupe.',
  bulk_complete: '{issued} liens sur {requested} ont ete emis.',
  bulk_partial:
    "{issued} liens sur {requested} ont ete emis; {failed} ne l'ont pas ete. Les liens deja emis restent valides. Chaque document a ete verifie et consigne separement.",
  bulk_none: "Aucun lien n'a ete emis ({failed} sur {requested} en echec). Chaque document a ete verifie separement.",
  retention_unavailable:
    "Les regles de conservation et les mises en suspens juridiques ne sont pas disponibles ici. Aucun registre canonique de conservation des documents n'existe encore; rien sur cet ecran ne reflete une suspension ou une regle en vigueur.",
};

export function isDocumentId(value: string): boolean {
  return DOCUMENT_ID_PATTERN.test(value);
}

export function canonicalDownloadPath(documentId: string): string {
  return `/api/documents/${documentId}/download`;
}

export function journeyCopy(locale: string): JourneyCopy {
  return locale.toLowerCase().startsWith('fr') ? FRENCH : ENGLISH;
}

export function repositoryRows(body: unknown): Array<{ id: string }> {
  if (!body || typeof body !== 'object') return [];
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  return data.filter(
    (row): row is { id: string } =>
      Boolean(row) && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string',
  );
}

export function authorizedDownloadUrl(status: number, body: unknown): string | null {
  if (status !== 200 || !body || typeof body !== 'object') return null;
  const url = (body as { data?: { downloadUrl?: unknown } }).data?.downloadUrl;
  if (typeof url !== 'string' || url.length === 0) return null;
  return url;
}

export function mutationAccepted(status: number): boolean {
  return status >= 200 && status < 300;
}

/** A write (save, new version) is refused for a different reason than a read: 400 is a rejected reference or hash. */
export function mutationDenialFromStatus(status: number): JourneyDenial {
  if (status === 400) return 'reference_rejected';
  return denialFromStatus(status);
}

export function denialForBulkOutcome(outcome: BulkItemOutcome): JourneyDenial {
  switch (outcome) {
    case 'storage_unavailable':
    case 'storage_unverified':
      return 'storage_failure';
    case 'audit_failed':
      return 'audit_failure';
    default:
      return 'unauthorized';
  }
}

export function bulkReportFrom(status: number, body: unknown): BulkDownloadReport | null {
  if (status !== 200 || !body || typeof body !== 'object') return null;
  const data = (body as { data?: Partial<BulkDownloadReport> }).data;
  if (!data || data.atomic !== false || !Array.isArray(data.items)) return null;
  if (typeof data.requested !== 'number' || typeof data.issued !== 'number' || typeof data.failed !== 'number') return null;
  return data as BulkDownloadReport;
}

export function formatBulkSummary(copy: JourneyCopy, report: BulkDownloadReport): string {
  const template = report.status === 'complete' ? copy.bulk_complete : report.status === 'partial' ? copy.bulk_partial : copy.bulk_none;
  return template
    .replace('{issued}', String(report.issued))
    .replace('{requested}', String(report.requested))
    .replace('{failed}', String(report.failed));
}

export function denialFromStatus(status: number): JourneyDenial {
  if (status === 400) return 'malformed_id';
  if (status === 409) return 'conflict';
  if (status === 502) return 'storage_failure';
  if (status === 503) return 'audit_failure';
  if (status === 401 || status === 403 || status === 404) return 'unauthorized';
  return 'upload_rejected';
}

/** No canonical share or disclosure route exists. Privacy-label PATCH is not sharing. */
export function canonicalShareUnavailable(): { accepted: false; denial: 'share_blocked' } {
  return { accepted: false, denial: 'share_blocked' };
}

/** Retention execution and label downgrades are not a canonical classification action. */
export function canonicalClassificationRewriteUnavailable(): {
  accepted: false;
  denial: 'classification_change_blocked';
} {
  return { accepted: false, denial: 'classification_change_blocked' };
}
