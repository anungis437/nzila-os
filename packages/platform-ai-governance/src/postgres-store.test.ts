import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  registerModel,
  listModels,
  clearRegistry,
} from '../src/modelRegistry'
import {
  createPromptVersion,
  getPromptHistory,
  clearPromptVersions,
} from '../src/promptVersioning'
import {
  logAIDecision,
  getDecisionLog,
  clearDecisionLog,
} from '../src/decisionLog'
import {
  flagForReview,
  getPendingReviewFlags,
  clearReviewFlags,
} from '../src/humanReview'
import {
  resetGovernanceStore,
  setGovernanceStore,
} from '../src/store'
import { PostgresGovernanceStore } from '../src/postgresStore'

type TableRef = { name: string }

function createTable(name: string): TableRef {
  return { name }
}

class MockDb {
  private rows = new Map<string, any[]>()

  constructor(initial: Record<string, any[]>) {
    for (const [table, values] of Object.entries(initial)) {
      this.rows.set(table, values.map((row) => ({ ...row })))
    }
  }

  select() {
    return {
      from: async (table: TableRef) => {
        return (this.rows.get(table.name) ?? []).map((row) => ({ ...row }))
      },
    }
  }

  async delete(table: TableRef): Promise<void> {
    this.rows.set(table.name, [])
  }

  insert(table: TableRef) {
    return {
      values: async (values: any[]) => {
        this.rows.set(table.name, values.map((row) => ({ ...row })))
      },
    }
  }

  getRows(tableName: string): any[] {
    return (this.rows.get(tableName) ?? []).map((row) => ({ ...row }))
  }
}

function waitForPersist(assertion: () => void | Promise<void>, timeoutMs = 500): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        await assertion()
        resolve()
      } catch (error) {
        if (Date.now() - start > timeoutMs) {
          reject(error)
          return
        }
        setTimeout(tick, 10)
      }
    }
    void tick()
  })
}

describe('PostgresGovernanceStore', () => {
  const modelTable = createTable('ai_governance_models')
  const promptTable = createTable('ai_governance_prompt_versions')
  const decisionTable = createTable('ai_governance_decision_log')
  const flagTable = createTable('ai_governance_review_flags')

  let db: MockDb

  beforeEach(async () => {
    db = new MockDb({
      ai_governance_models: [
        {
          id: 'model-seeded',
          name: 'seed-model',
          version: '1',
          provider: 'azure-openai',
          capabilities: ['chat'],
          riskLevel: 'low',
          approvedForProduction: true,
          registeredAt: new Date('2026-01-01T00:00:00.000Z'),
          lastAuditedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
      ai_governance_prompt_versions: [],
      ai_governance_decision_log: [],
      ai_governance_review_flags: [],
    })

    const store = new PostgresGovernanceStore(
      {
        db,
        aiGovernanceModels: modelTable,
        aiGovernancePromptVersions: promptTable,
        aiGovernanceDecisionLog: decisionTable,
        aiGovernanceReviewFlags: flagTable,
      },
      db,
    )

    await store.hydrate()
    setGovernanceStore(store)
  })

  afterEach(() => {
    clearRegistry()
    clearPromptVersions()
    clearDecisionLog()
    clearReviewFlags()
    resetGovernanceStore()
  })

  it('hydrates in-memory views from persisted rows', () => {
    const models = listModels()
    expect(models).toHaveLength(1)
    expect(models[0].id).toBe('model-seeded')
    expect(models[0].approvedForProduction).toBe(true)
  })

  it('persists all governance collections when mutators are used', async () => {
    const model = registerModel({
      name: 'gpt-4.1-mini',
      version: '2026-04',
      provider: 'azure-openai',
      capabilities: ['classification'],
      riskLevel: 'medium',
    })

    const prompt = createPromptVersion({
      promptName: 'risk-eval',
      template: 'Assess: {{input}}',
      author: 'auditor',
      changeReason: 'initial',
    })

    const decision = logAIDecision({
      modelId: model.id,
      promptId: prompt.id,
      app: 'control-plane',
      orgId: 'org-1',
      inputSummary: 'sample input',
      outputSummary: 'sample output',
      confidence: 0.82,
    })

    flagForReview({
      decisionId: decision.id,
      reason: 'manual quality gate',
      flaggedBy: 'reviewer',
      priority: 'high',
    })

    await waitForPersist(() => {
      expect(db.getRows('ai_governance_models').length).toBe(2)
      expect(db.getRows('ai_governance_prompt_versions').length).toBe(1)
      expect(db.getRows('ai_governance_decision_log').length).toBe(1)
      expect(db.getRows('ai_governance_review_flags').length).toBe(1)
    })

    expect(getPromptHistory('risk-eval')).toHaveLength(1)
    expect(getDecisionLog()).toHaveLength(1)
    expect(getPendingReviewFlags()).toHaveLength(1)
  })
})
