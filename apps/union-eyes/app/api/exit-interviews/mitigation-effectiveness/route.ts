import { cognitionRoute } from '@/lib/api/cognition-route';
import { mitigationEffectivenessEngine } from '@/lib/institutional-operating-intelligence';

export const dynamic = 'force-dynamic';

export const GET = cognitionRoute(mitigationEffectivenessEngine);