import React from 'react'
import { OperatorWorkflow } from './operator-workflow'
import type { SyntheticOperatorJourney } from '../../lib/operator-workflow/synthetic-journeys'

export function SyntheticWorkflowGallery({ journeys }: { journeys: SyntheticOperatorJourney[] }) {
  const availableRunIds = journeys.flatMap((journey) =>
    journey.view.access === 'ALLOWED' ? [journey.view.runId] : [],
  )
  return (
    <main>
      <h1>Synthetic Cora workflow reference</h1>
      <p>
        Local synthetic scenarios only. Not a production workflow or evidence of institutional
        acceptance.
      </p>
      <nav aria-label="Synthetic scenarios">
        <ul>
          {journeys.map((journey, index) => (
            <li key={index}>
              <a href={`#scenario-${index}`}>{journey.name}</a>
            </li>
          ))}
        </ul>
      </nav>
      {journeys.map((journey, index) => (
        <section key={index} id={`scenario-${index}`} aria-label={journey.name}>
          <h2>{journey.name}</h2>
          {journey.view.access === 'ALLOWED' &&
            !journeys
              .slice(0, index)
              .some(
                (previous) =>
                  previous.view.access === 'ALLOWED' &&
                  previous.view.runId ===
                    (journey.view.access === 'ALLOWED' ? journey.view.runId : ''),
              ) && <span id={`run-${journey.view.runId}`} />}
          <OperatorWorkflow view={journey.view} availableRunIds={availableRunIds} />
        </section>
      ))}
    </main>
  )
}
