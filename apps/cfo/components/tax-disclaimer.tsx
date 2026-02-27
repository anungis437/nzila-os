/**
 * Tax Disclaimer — Legal notice for any page displaying CRA-sourced data.
 *
 * Required by professional standards whenever tax rates, deadlines,
 * or calculations are shown. Reminds users this is not tax advice.
 */
import { AlertTriangle, Info } from 'lucide-react'

interface TaxDisclaimerProps {
  /** 'compact' = one-line banner, 'full' = expanded with list */
  variant?: 'compact' | 'full'
  /** Override the default className */
  className?: string
}

const DATA_SOURCES = [
  'CRA T4012 — Corporation Income Tax Guide',
  'CRA Schedule 510 — Provincial / Territorial Rates',
  'ITA s.150, s.157 — Filing & Installment Deadlines',
  'CRA RC2 — Business Number Registration',
  'CRA IC07-1 — Prescribed Interest Rates',
  'CRA GI-209 — GST/HST Rate Tables',
  'CRA T4001 — Payroll Remittance Guide',
]

export function TaxDisclaimer({ variant = 'compact', className }: TaxDisclaimerProps) {
  if (variant === 'compact') {
    return (
      <div
        className={`flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400 ${className ?? ''}`}
        role="note"
        aria-label="Tax disclaimer"
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Tax data sourced from publicly available CRA publications. This is not tax advice —
          consult a qualified professional before making tax decisions.
        </span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30 ${className ?? ''}`}
      role="note"
      aria-label="Tax disclaimer"
    >
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold">Important — Not Tax Advice</p>
      </div>
      <p className="mt-2 text-xs text-amber-700/90 dark:text-amber-400/80">
        All tax rates, deadlines, and calculations shown in this application are derived from
        publicly available CRA publications and the <em>Income Tax Act</em>. They are provided for
        informational and planning purposes only. This application does not constitute tax, legal,
        or financial advice. Always consult a qualified tax professional before making decisions.
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-500">
          Data sources
        </summary>
        <ul className="mt-1.5 space-y-0.5 pl-4 text-xs text-amber-700/70 dark:text-amber-400/60">
          {DATA_SOURCES.map((src) => (
            <li key={src} className="list-disc">{src}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}
