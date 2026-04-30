import Link from 'next/link'
import type { CommerceModule, DataModelDefinition, RepoSequenceItem, RevenueModelItem, RolloutPhase } from '@/lib/shopmoica-commerce'
import styles from '../experience.module.css'

export function ModuleCardGrid({ locale, modules, actorKey }: { locale: string; modules: CommerceModule[]; actorKey?: string }) {
  return (
    <div className={styles.cardGrid}>
      {modules.map((module) => (
        <Link key={module.slug} href={`/${locale}${module.path}${actorKey ? `?as=${actorKey}` : ''}`} className={styles.card}>
          <span className={styles.cardKicker}>{module.lane === 'internal' ? 'Lane A' : 'Lane B'}</span>
          <h3 className={styles.cardTitle}>{module.title}</h3>
          <p className={styles.cardText}>{module.strapline}</p>
          <ul className={styles.bulletList}>
            {module.components.slice(0, 3).map((component) => (
              <li key={component}>{component}</li>
            ))}
          </ul>
        </Link>
      ))}
    </div>
  )
}

export function DataModelGrid({ models }: { models: DataModelDefinition[] }) {
  return (
    <div className={styles.cardGrid}>
      {models.map((model) => (
        <article key={model.name} className={styles.card}>
          <h3 className={styles.cardTitle}>{model.name}</h3>
          <p className={styles.cardText}>{model.purpose}</p>
          <ul className={styles.bulletList}>
            {model.fields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  )
}

export function RolloutGrid({ phases }: { phases: RolloutPhase[] }) {
  return (
    <div className={styles.cardGrid}>
      {phases.map((phase) => (
        <article key={phase.window} className={styles.card}>
          <span className={styles.cardKicker}>{phase.window}</span>
          <h3 className={styles.cardTitle}>{phase.focus}</h3>
          <ul className={styles.bulletList}>
            {phase.outcomes.map((outcome) => (
              <li key={outcome}>{outcome}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  )
}

export function RepoSequenceGrid({ steps }: { steps: RepoSequenceItem[] }) {
  return (
    <div className={styles.cardGrid}>
      {steps.map((item) => (
        <article key={item.step} className={styles.card}>
          <h3 className={styles.cardTitle}>{item.step}</h3>
          <ul className={styles.bulletList}>
            {item.surfaces.map((surface) => (
              <li key={surface}>{surface}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  )
}

export function RevenueModelGrid({ items }: { items: RevenueModelItem[] }) {
  return (
    <div className={styles.cardGrid}>
      {items.map((item) => (
        <article key={item.lever} className={styles.card}>
          <h3 className={styles.cardTitle}>{item.lever}</h3>
          <p className={styles.cardText}>{item.mechanism}</p>
          <p className={styles.cardText}><strong>Impact:</strong> {item.impact}</p>
        </article>
      ))}
    </div>
  )
}