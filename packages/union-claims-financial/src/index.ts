type CalculationRule = {
  calculationType?: 'flat' | 'flat_rate' | 'percentage' | 'hourly' | 'tiered' | 'formula' | string
  percentageRate?: number
  flatAmount?: number
  hourlyRate?: number
  hoursPerPeriod?: number
}

type DuesInput = {
  memberId: string
  rule?: CalculationRule
  grossWages?: number
  baseSalary?: number
  hourlyRate?: number
  hoursWorked?: number
}

export class DuesCalculationEngine {
  async calculateMemberDues(input: DuesInput) {
    const amount = this.computeAmount(input)
    return {
      memberId: input.memberId,
      totalAmount: amount,
      baseAmount: amount,
      errors: [] as string[],
    }
  }

  batchCalculateDuesSimple(inputs: DuesInput[]) {
    const results = inputs.map((input) => {
      try {
        return {
          memberId: input.memberId,
          totalAmount: this.computeAmount(input),
          errors: [] as string[],
        }
      } catch (error) {
        return {
          memberId: input.memberId,
          totalAmount: 0,
          errors: [error instanceof Error ? error.message : 'Calculation failed'],
        }
      }
    })

    const failed = results.filter((r) => r.errors.length > 0).length
    const successful = results.length - failed
    const totalAmount = results.reduce((sum, r) => sum + (r.totalAmount || 0), 0)

    return {
      totalProcessed: results.length,
      successful,
      failed,
      results,
      summary: {
        totalAmount,
        successful,
        failed,
      },
    }
  }

  private computeAmount(input: DuesInput): number {
    const rule = input.rule
    const calcType = rule?.calculationType

    if (calcType === 'flat' || calcType === 'flat_rate') {
      return Number(rule?.flatAmount ?? 0)
    }

    if (calcType === 'hourly') {
      const rate = Number(input.hourlyRate ?? rule?.hourlyRate ?? 0)
      const hours = Number(input.hoursWorked ?? rule?.hoursPerPeriod ?? 0)
      return roundMoney(rate * hours)
    }

    if (calcType === 'percentage') {
      const base = Number(input.grossWages ?? input.baseSalary ?? 0)
      const ratePct = Number(rule?.percentageRate ?? 0)
      return roundMoney(base * (ratePct / 100))
    }

    const fallbackBase = Number(input.grossWages ?? input.baseSalary ?? 0)
    return roundMoney(fallbackBase)
  }
}

type ParseResult = {
  success: boolean
  records: Array<Record<string, unknown>>
  summary: Record<string, unknown>
  errors: string[]
}

export class RemittanceParser {
  constructor(private readonly _config: Record<string, unknown> = {}) {}

  async parseCSV(buffer: Buffer): Promise<ParseResult> {
    const text = buffer.toString('utf8')
    return this.parseDelimitedText(text, ',')
  }

  async parseExcel(_buffer: Buffer): Promise<ParseResult> {
    return {
      success: false,
      records: [],
      summary: { totalRows: 0 },
      errors: ['Excel parsing is not enabled in this compatibility package'],
    }
  }

  async parseXML(_buffer: Buffer): Promise<ParseResult> {
    return {
      success: false,
      records: [],
      summary: { totalRows: 0 },
      errors: ['XML parsing is not enabled in this compatibility package'],
    }
  }

  private parseDelimitedText(text: string, delimiter: string): ParseResult {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      return {
        success: false,
        records: [],
        summary: { totalRows: 0 },
        errors: ['Input file is empty'],
      }
    }

    const headers = lines[0].split(delimiter).map((h) => h.trim())
    const records = lines.slice(1).map((line) => {
      const cells = line.split(delimiter)
      const record: Record<string, unknown> = {}
      headers.forEach((header, index) => {
        record[header || `column_${index + 1}`] = (cells[index] || '').trim()
      })
      return record
    })

    return {
      success: true,
      records,
      summary: {
        totalRows: records.length,
        columns: headers,
      },
      errors: [],
    }
  }
}

type ReconcileInput = {
  remittanceRecords: Array<{ memberId?: string; amount?: number | string } & Record<string, unknown>>
  existingTransactions: Array<{ id: string; memberId?: string; amount?: number | string }>
}

type ReconcileMatch = {
  transactionId: string
  memberId?: string
  remittanceAmount: number
  transactionAmount: number
  variance: number
}

type ReconcileResult = {
  success: boolean
  matches: ReconcileMatch[]
  variances: Array<{ memberId?: string; variance: number }>
  summary: {
    matchedCount: number
    unmatchedCount: number
    totalVariance: number
  }
}

export class ReconciliationEngine {
  async reconcile(input: ReconcileInput): Promise<ReconcileResult> {
    const txByMember = new Map(
      input.existingTransactions
        .filter((t) => t.memberId)
        .map((t) => [String(t.memberId), t])
    )

    const matches: ReconcileMatch[] = []
    const variances: Array<{ memberId?: string; variance: number }> = []

    for (const record of input.remittanceRecords) {
      const memberId = record.memberId ? String(record.memberId) : undefined
      if (!memberId) {
        continue
      }

      const tx = txByMember.get(memberId)
      if (!tx) {
        continue
      }

      const remittanceAmount = Number(record.amount ?? 0)
      const transactionAmount = Number(tx.amount ?? 0)
      const variance = roundMoney(remittanceAmount - transactionAmount)

      matches.push({
        transactionId: tx.id,
        memberId,
        remittanceAmount,
        transactionAmount,
        variance,
      })

      if (Math.abs(variance) > 0.01) {
        variances.push({ memberId, variance })
      }
    }

    const totalVariance = roundMoney(variances.reduce((sum, v) => sum + v.variance, 0))

    return {
      success: true,
      matches,
      variances,
      summary: {
        matchedCount: matches.length,
        unmatchedCount: Math.max(input.remittanceRecords.length - matches.length, 0),
        totalVariance,
      },
    }
  }

  generateReport(result: ReconcileResult) {
    return {
      generatedAt: new Date().toISOString(),
      success: result.success,
      matchedCount: result.summary.matchedCount,
      unmatchedCount: result.summary.unmatchedCount,
      totalVariance: result.summary.totalVariance,
      hasVariances: result.variances.length > 0,
    }
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
