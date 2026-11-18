import { REWARD_RUNTIME_COLUMN_CONTRACTS, type RewardRuntimeColumnContract } from './rewards-storage-contract'
import { MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS } from './module-admission-storage-contract'

export const RUNTIME_COLUMN_PRIVILEGE_CONTRACTS: Readonly<Record<string, RewardRuntimeColumnContract>> = Object.freeze({
  ...REWARD_RUNTIME_COLUMN_CONTRACTS,
  ...MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS,
})
export {
  REWARD_SIGNATURE_COLUMN_CONTRACTS as SYSTEM_COLUMN_ONLY_READ_CONTRACTS,
} from './rewards-storage-contract'

export const SYSTEM_COLUMN_READ_CONTRACTS = [
  {
    table: 'commercial_contracts',
    columns: ['id', 'contract_number'],
    caller: 'apps/union-eyes/app/api/pilot/apply/[id]/commercial-transition/route.ts',
  },
] as const
