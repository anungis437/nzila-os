import type { MachineDefinition } from './types'
import { validateMachine } from './engine'

/* ─── Machine registry ────────────────────────────────── */

/**
 * Central registry for all FSM definitions in the platform.
 *
 * Machines are registered at startup and can be looked up by name.
 * Registration validates the machine definition — invalid machines
 * are rejected immediately (fail-fast).
 */

const machines = new Map<string, MachineDefinition>()

/** Register a machine definition. Throws on validation errors. */
export function registerMachine(machine: MachineDefinition): void {
  const errors = validateMachine(machine)
  if (errors.length > 0) {
    throw new Error(
      `Invalid machine "${machine.name}" v${machine.version}:\n  ${errors.join('\n  ')}`,
    )
  }
  machines.set(machine.name, machine)
}

/** Retrieve a registered machine by name. */
export function getMachine(name: string): MachineDefinition | undefined {
  return machines.get(name)
}

/** List all registered machine names. */
export function listMachines(): string[] {
  return [...machines.keys()]
}

/** Remove a machine from the registry (useful in tests). */
export function unregisterMachine(name: string): boolean {
  return machines.delete(name)
}

/** Clear all registered machines (useful in tests). */
export function clearRegistry(): void {
  machines.clear()
}
