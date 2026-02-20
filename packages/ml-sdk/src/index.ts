/**
 * @nzila/ml-sdk — barrel export
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  USE THIS PACKAGE in apps/web, apps/console, apps/partners.     ║
 * ║  Never query ml* DB tables directly from app code.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
export { createMlClient, type MlSdkConfig, type MlClient } from './client'

export type {
  MlActiveModelResponse,
  MlTrainingRunResponse,
  MlInferenceRunResponse,
  StripeDailyScoreResponse,
  StripeTxnScoreResponse,
  MlScoresDailyParams,
  MlScoresTxnParams,
  MlSdkError,
} from './types'
