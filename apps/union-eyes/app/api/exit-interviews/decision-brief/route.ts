import { cognitionRoute } from '@/lib/api/cognition-route';
import { decisionBriefEngine } from '@/lib/organizational-operating-intelligence';

export const dynamic = 'force-dynamic';

export const GET = cognitionRoute(decisionBriefEngine);