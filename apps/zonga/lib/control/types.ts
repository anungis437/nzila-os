/**
 * Zonga — Control Layer Types
 *
 * Canonical types for the command-driven control layer.
 * All critical business mutations flow through this layer.
 */

export interface CommandContext {
  org_id: string
  actor_id?: string
  correlation_id?: string
  environment?: 'local' | 'dev' | 'staging' | 'prod'
  request_source?: string
}

export interface CommandError {
  code: string
  message: string
  details?: unknown
}

export interface CommandResult {
  success: boolean
  entity_type?: string
  entity_id?: string
  status_after?: string
  emitted_event_ids?: string[]
  audit_ref?: string
  message?: string
  warnings?: string[]
  errors?: CommandError[]
}

export interface CommandHandler<TCommand> {
  readonly commandType: string
  execute(command: TCommand, context: CommandContext): Promise<CommandResult>
}
