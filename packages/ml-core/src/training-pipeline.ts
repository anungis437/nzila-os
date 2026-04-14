/**
 * @nzila/ml-core — Training Pipeline Orchestration
 */

import { randomUUID } from 'node:crypto'

export type TrainingStageStatus = 'pending' | 'running' | 'success' | 'failed'

export interface TrainingStage {
  id: string
  name: string
  run: () => Promise<Record<string, unknown> | void>
}

export interface TrainingStageResult {
  id: string
  name: string
  status: TrainingStageStatus
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  output?: Record<string, unknown>
  error?: string
}

export interface TrainingPipelineRun {
  id: string
  orgId: string
  modelKey: string
  datasetKey: string
  status: 'started' | 'success' | 'failed'
  startedAt: string
  finishedAt?: string
  totalDurationMs?: number
  stages: TrainingStageResult[]
}

export async function runTrainingPipeline(params: {
  orgId: string
  modelKey: string
  datasetKey: string
  stages: readonly TrainingStage[]
}): Promise<TrainingPipelineRun> {
  const startedAtMs = Date.now()
  const run: TrainingPipelineRun = {
    id: randomUUID(),
    orgId: params.orgId,
    modelKey: params.modelKey,
    datasetKey: params.datasetKey,
    status: 'started',
    startedAt: new Date(startedAtMs).toISOString(),
    stages: params.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      status: 'pending',
    })),
  }

  for (let i = 0; i < params.stages.length; i++) {
    const stage = params.stages[i]
    const stageState = run.stages[i]
    const stageStartMs = Date.now()
    stageState.status = 'running'
    stageState.startedAt = new Date(stageStartMs).toISOString()

    try {
      const output = await stage.run()
      const stageEndMs = Date.now()
      stageState.status = 'success'
      stageState.output = output
      stageState.finishedAt = new Date(stageEndMs).toISOString()
      stageState.durationMs = stageEndMs - stageStartMs
    } catch (error) {
      const stageEndMs = Date.now()
      stageState.status = 'failed'
      stageState.error = error instanceof Error ? error.message : String(error)
      stageState.finishedAt = new Date(stageEndMs).toISOString()
      stageState.durationMs = stageEndMs - stageStartMs
      run.status = 'failed'
      run.finishedAt = new Date(stageEndMs).toISOString()
      run.totalDurationMs = stageEndMs - startedAtMs
      return run
    }
  }

  const finishedAtMs = Date.now()
  run.status = 'success'
  run.finishedAt = new Date(finishedAtMs).toISOString()
  run.totalDurationMs = finishedAtMs - startedAtMs
  return run
}
