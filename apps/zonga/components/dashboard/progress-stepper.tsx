/**
 * Horizontal step progress bar for Zonga.
 *
 * Visualises lifecycle phases (release workflow, payout pipeline,
 * moderation review, etc.).
 */
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'

export interface Step {
  key: string
  label: string
  icon?: ComponentType<SVGProps<SVGSVGElement>>
}

export function ProgressStepper({
  steps,
  currentIndex,
  className = '',
}: {
  steps: Step[]
  currentIndex: number
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      {steps.map((step, index) => {
        const isComplete = index < currentIndex
        const isCurrent = index === currentIndex
        const Icon = step.icon

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center h-8 w-8 rounded-full transition-colors ${
                  isComplete
                    ? 'bg-electric text-white'
                    : isCurrent
                      ? 'bg-electric/10 text-electric ring-2 ring-electric/30'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isComplete ? (
                  <CheckCircleIcon className="h-4 w-4" />
                ) : Icon ? (
                  <Icon className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-semibold">{index + 1}</span>
                )}
              </div>
              <span
                className={`text-[10px] mt-1.5 font-medium ${
                  isCurrent ? 'text-electric' : isComplete ? 'text-navy' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mt-[-14px] rounded-full ${
                  index < currentIndex ? 'bg-electric' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
