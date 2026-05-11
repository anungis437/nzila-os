import { cognitionRoute } from '@/lib/api/cognition-route';
import { learningTrajectoryEngine } from '@/lib/institutional-operating-intelligence';

export const dynamic = 'force-dynamic';

export const GET = cognitionRoute(learningTrajectoryEngine);