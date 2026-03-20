'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircleIcon,
  CubeIcon,
  TruckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { updateOrderAction } from '@/app/actions/orders'
import { checkProductionReadinessAction } from '@/app/actions/workflow-triggers'

const transitions: Record<string, { label: string; next: string; icon?: React.ComponentType<React.SVGProps<SVGSVGElement>> }> = {
  created:     { label: 'Confirm Order',    next: 'confirmed',  icon: CheckCircleIcon },
  confirmed:   { label: 'Start Fulfillment', next: 'fulfillment', icon: CubeIcon },
  fulfillment: { label: 'Ship Order',       next: 'shipped',    icon: TruckIcon },
  shipped:     { label: 'Mark Delivered',    next: 'delivered',  icon: TruckIcon },
  delivered:   { label: 'Complete Order',    next: 'completed',  icon: CheckCircleIcon },
}

export function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const transition = transitions[status]

  function advance() {
    if (!transition) return
    startTransition(async () => {
      await updateOrderAction(orderId, { status: transition.next })
      router.refresh()
    })
  }

  function cancel() {
    if (!confirm('Cancel this order? This cannot be undone.')) return
    startTransition(async () => {
      await updateOrderAction(orderId, { status: 'cancelled' })
      router.refresh()
    })
  }

  function checkReadiness() {
    startTransition(async () => {
      await checkProductionReadinessAction(orderId)
      router.refresh()
    })
  }

  const Icon = transition?.icon

  return (
    <div className="flex items-center gap-2">
      {transition && (
        <button
          onClick={advance}
          disabled={pending}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-electric text-white text-sm font-semibold rounded-lg hover:bg-electric-light transition shadow-sm disabled:opacity-50"
        >
          {Icon && <Icon className="h-4 w-4" />}
          {pending ? 'Updating…' : transition.label}
        </button>
      )}

      {(status === 'confirmed' || status === 'fulfillment') && (
        <button
          onClick={checkReadiness}
          disabled={pending}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition disabled:opacity-50"
        >
          <CubeIcon className="h-4 w-4" />
          Check Readiness
        </button>
      )}

      {status !== 'cancelled' && status !== 'completed' && (
        <button
          onClick={cancel}
          disabled={pending}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
        >
          <XMarkIcon className="h-4 w-4" />
          Cancel
        </button>
      )}
    </div>
  )
}
