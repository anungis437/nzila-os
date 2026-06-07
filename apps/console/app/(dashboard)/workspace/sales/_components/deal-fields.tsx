import { PARTNER_STAGES, type EditableDeal } from '../../_lib/sales'

export const STAGE_LABELS: Record<string, string> = {
  registered: 'Registered',
  submitted: 'Submitted',
  approved: 'Approved',
  won: 'Won',
  lost: 'Lost',
}

export const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300'
export const labelClass = 'mb-1 block text-xs font-medium text-gray-600'

/**
 * Shared deal create/edit fields. Rendered inside a `<form action={...}>`.
 * Contact fields only appear on create (they are immutable after registration).
 */
export function DealFields({ deal }: { deal?: EditableDeal }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelClass}>Account name *</label>
        <input name="accountName" type="text" required defaultValue={deal?.accountName} className={inputClass} />
      </div>
      {!deal && (
        <>
          <div>
            <label className={labelClass}>Contact name *</label>
            <input name="contactName" type="text" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Contact email *</label>
            <input name="contactEmail" type="email" required className={inputClass} />
          </div>
        </>
      )}
      <div>
        <label className={labelClass}>Vertical / product *</label>
        <input
          name="vertical"
          type="text"
          required
          defaultValue={deal?.vertical}
          placeholder="union-eyes, flow, cfo…"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Stage</label>
        <select name="stage" defaultValue={deal?.stage ?? 'registered'} className={inputClass}>
          {PARTNER_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Estimated ARR (CAD)</label>
        <input
          name="estimatedArr"
          type="number"
          min="0"
          step="0.01"
          defaultValue={deal ? deal.estimatedArr : undefined}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Owner / reviewer</label>
        <input name="owner" type="text" defaultValue={deal?.owner} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Expected close</label>
        <input name="expectedCloseDate" type="date" defaultValue={deal?.expectedCloseDate ?? undefined} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Notes</label>
        <textarea name="notes" rows={2} defaultValue={deal?.notes} className={inputClass} />
      </div>
    </div>
  )
}
