import { cognitionRoute } from '@/lib/api/cognition-route';
import { operatingRhythmsEngine } from '@/lib/institutional-operating-intelligence';

export const dynamic = 'force-dynamic';

export const GET = cognitionRoute(operatingRhythmsEngine);