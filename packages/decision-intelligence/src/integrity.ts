export interface AggregateIntegrityCheck {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
  metadata?: Record<string, unknown>
}

export interface AggregateIntegrityReport {
  /** False if any check has status 'fail'. */
  valid: boolean
  /** Derived from the worst check status: 'critical' if any fail, 'warning' if any warn, else 'healthy'. */
  severity: 'healthy' | 'warning' | 'critical'
  checks: AggregateIntegrityCheck[]
}

export interface AggregateCompletenessInput {
  /** Expected number of organizations that should have aggregates. */
  expectedOrgCount: number
  /** Actual number of organizations that produced aggregates. */
  actualOrgCount: number
  /** Window keys that are missing aggregates entirely. */
  missingWindowKeys?: string[]
}

export interface AggregateConsistencyInput {
  /** Total input audit records processed. */
  inputRecordCount: number
  /** Total aggregate rows written. */
  outputAggregateCount: number
  /** A non-negative ratio [0, 1]. If output/input drops below this, raise a warning. */
  minOutputRatio?: number
}

export interface AggregateAnomalyInput {
  /** Aggregate rows keyed by org. */
  aggregatesByOrg: Record<
    string,
    {
      totalAmount: number
      recordCount: number
      previousTotalAmount?: number
      previousRecordCount?: number
    }
  >
  /** Fraction drop that triggers suspicious_record_drop. Default 0.5. */
  dropThreshold?: number
}

/**
 * Verifies that every expected organization and window has aggregate coverage.
 */
export function verifyAggregateCompleteness(
  input: AggregateCompletenessInput,
): AggregateIntegrityCheck {
  const missing = input.missingWindowKeys ?? []

  if (input.actualOrgCount < input.expectedOrgCount) {
    return {
      name: 'aggregate_completeness',
      status: 'fail',
      message: `Expected ${input.expectedOrgCount} orgs but only ${input.actualOrgCount} produced aggregates`,
      metadata: {
        expectedOrgCount: input.expectedOrgCount,
        actualOrgCount: input.actualOrgCount,
        missingWindowKeys: missing,
      },
    }
  }

  if (missing.length > 0) {
    return {
      name: 'aggregate_completeness',
      status: 'warn',
      message: `${missing.length} window key(s) missing aggregates`,
      metadata: { missingWindowKeys: missing },
    }
  }

  return {
    name: 'aggregate_completeness',
    status: 'pass',
    message: 'All expected organizations and windows have aggregate coverage',
    metadata: {
      expectedOrgCount: input.expectedOrgCount,
      actualOrgCount: input.actualOrgCount,
    },
  }
}

/**
 * Verifies that the output aggregate count is consistent with input record count.
 */
export function verifyAggregateConsistency(
  input: AggregateConsistencyInput,
): AggregateIntegrityCheck {
  const minRatio = input.minOutputRatio ?? 0.0

  if (input.inputRecordCount === 0 && input.outputAggregateCount > 0) {
    return {
      name: 'aggregate_consistency',
      status: 'fail',
      message: `Output aggregates produced (${input.outputAggregateCount}) with zero input records`,
      metadata: {
        inputRecordCount: input.inputRecordCount,
        outputAggregateCount: input.outputAggregateCount,
      },
    }
  }

  if (input.inputRecordCount > 0 && input.outputAggregateCount === 0) {
    return {
      name: 'aggregate_consistency',
      status: 'fail',
      message: `No aggregates produced from ${input.inputRecordCount} input records`,
      metadata: {
        inputRecordCount: input.inputRecordCount,
        outputAggregateCount: input.outputAggregateCount,
      },
    }
  }

  const ratio =
    input.inputRecordCount > 0 ? input.outputAggregateCount / input.inputRecordCount : 1

  if (ratio < minRatio) {
    return {
      name: 'aggregate_consistency',
      status: 'warn',
      message: `Output/input ratio ${ratio.toFixed(3)} is below threshold ${minRatio.toFixed(3)}`,
      metadata: {
        inputRecordCount: input.inputRecordCount,
        outputAggregateCount: input.outputAggregateCount,
        ratio,
        minRatio,
      },
    }
  }

  return {
    name: 'aggregate_consistency',
    status: 'pass',
    message: `Aggregate output consistent with input (ratio ${ratio.toFixed(3)})`,
    metadata: {
      inputRecordCount: input.inputRecordCount,
      outputAggregateCount: input.outputAggregateCount,
      ratio,
    },
  }
}

/**
 * Detects anomalies such as suspicious record drops relative to prior run.
 */
export function detectAggregateAnomalies(
  input: AggregateAnomalyInput,
): AggregateIntegrityCheck {
  const threshold = input.dropThreshold ?? 0.5
  const suspicious: string[] = []

  for (const [orgId, agg] of Object.entries(input.aggregatesByOrg)) {
    if (
      agg.previousRecordCount !== undefined &&
      agg.previousRecordCount > 0 &&
      agg.recordCount < agg.previousRecordCount * threshold
    ) {
      suspicious.push(
        `org=${orgId}: records dropped from ${agg.previousRecordCount} to ${agg.recordCount}`,
      )
    }
  }

  if (suspicious.length > 0) {
    return {
      name: 'aggregate_anomaly_detection',
      status: 'warn',
      message: `Suspicious record drop detected in ${suspicious.length} org(s)`,
      metadata: { suspicious, dropThreshold: threshold },
    }
  }

  return {
    name: 'aggregate_anomaly_detection',
    status: 'pass',
    message: 'No anomalies detected in aggregate record counts',
    metadata: { orgCount: Object.keys(input.aggregatesByOrg).length, dropThreshold: threshold },
  }
}

/**
 * Combines all integrity checks into a single report.
 * severity: 'critical' if any fail; 'warning' if any warn; 'healthy' otherwise.
 */
export function buildAggregateIntegrityReport(
  checks: AggregateIntegrityCheck[],
): AggregateIntegrityReport {
  const hasFail = checks.some((c) => c.status === 'fail')
  const hasWarn = checks.some((c) => c.status === 'warn')

  const severity: AggregateIntegrityReport['severity'] = hasFail
    ? 'critical'
    : hasWarn
      ? 'warning'
      : 'healthy'

  return {
    valid: !hasFail,
    severity,
    checks,
  }
}
