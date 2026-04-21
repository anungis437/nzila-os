/**
 * @nzila/executive-os — Agent Registry
 *
 * In-memory registry of ExecutiveAgent definitions. The console resolves
 * agents by key when scheduling runs.
 */
import type { ExecutiveAgent, ExecutiveDomain } from './contract'

const agents = new Map<string, ExecutiveAgent<any>>()

export function registerAgent<T>(agent: ExecutiveAgent<T>): void {
  if (agents.has(agent.key)) {
    throw new Error(`Executive agent already registered: ${agent.key}`)
  }
  agents.set(agent.key, agent as ExecutiveAgent<any>)
}

export function getAgent(key: string): ExecutiveAgent<any> | undefined {
  return agents.get(key)
}

export function listAgents(domain?: ExecutiveDomain): readonly ExecutiveAgent<any>[] {
  const all = Array.from(agents.values())
  return domain ? all.filter((a) => a.domain === domain) : all
}

export function clearAgents(): void {
  agents.clear()
}
