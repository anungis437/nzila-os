import { cognitionRoute } from '@/lib/api/cognition-route';
import { multiDomainCognitionEngine } from '@/lib/organizational-operating-intelligence';

export const dynamic = 'force-dynamic';

export const GET = cognitionRoute(multiDomainCognitionEngine);