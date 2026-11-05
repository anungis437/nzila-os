/**
 * GET|POST /api/tax/rl-1/generate
 *
 * This path was a generic CRUD collection over per_capita_remittances, the organization's per-capita remittance
 * ledger, readable by any member and presented as RL-1 slips. It generated no tax document and disclosed the ledger.
 * Tax document generation is not implemented, so the route answers 501 and reads and writes nothing.
 * Capability: UE-ACTION-TAX-DOCUMENTS.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';


const notImplemented = async () => {
  throw ApiError.notImplemented('RL-1 generation is not implemented: nothing was generated or read.');
};

const options = () => ({
  auth: { required: true as const, minRole: 'member' as const },
  openapi: { tags: ['Billing'], summary: 'RL-1 generation (not implemented)', description: 'Not implemented: answers 501.' },
});

export const GET = withApi(options(), notImplemented);
export const POST = withApi(options(), notImplemented);