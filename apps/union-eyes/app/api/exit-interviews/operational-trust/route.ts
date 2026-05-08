import { cognitionRoute } from '@/lib/api/cognition-route';
import { operationalTrustEngine } from '@/lib/institutional-operating-intelligence';

export const dynamic = 'force-dynamic';

export const GET = cognitionRoute(operationalTrustEngine);