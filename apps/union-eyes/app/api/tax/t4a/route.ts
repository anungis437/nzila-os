/**
 * GET POST /api/tax/t4a
 *
 * The same resource as /api/pension/t4a (pension_t4a_records), under the tax name. It used to be a second copy with
 * its own, weaker rules (any member listed every T4A, a steward generated them and could mark them filed); it now is
 * the pension route, so there is one authority for these records.
 */
export { GET, POST, dynamic } from '../../pension/t4a/route';
