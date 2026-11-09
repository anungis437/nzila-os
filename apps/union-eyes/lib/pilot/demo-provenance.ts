/** Central production-data predicate. Demo rows remain usable in their explicit fixture UI but never enter search, analytics, reports or AI. */
import { isNull } from 'drizzle-orm';
import { employers, grievances } from '@/db/schema';

export const productionGrievanceCondition = () => isNull(grievances.demoSeedId);
export const productionEmployerCondition = () => isNull(employers.demoSeedId);
