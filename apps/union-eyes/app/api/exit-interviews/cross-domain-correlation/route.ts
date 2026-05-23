import { cognitionRoute } from '@/lib/api/cognition-route';
import { crossDomainCorrelationEngine } from '@/lib/organizational-operating-intelligence';

export const dynamic = 'force-dynamic';

export const GET = cognitionRoute(crossDomainCorrelationEngine);