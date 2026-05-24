import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { CommandSchema } from '../contract.js'
import { dispatchWorkflow } from '../dispatch.js'
import { createCommand, getCommand, listCommands, updateCommandStatus } from '../store.js'
import { emitCommandEvent } from '../platform.js'

export async function commandRoutes(app: FastifyInstance) {
  /**
   * POST /commands — Submit a new automation command.
   * Body must conform to CommandSchema.
   */
  app.post('/', async (req, reply) => {
    const parse = CommandSchema.safeParse(req.body)
    if (!parse.success) {
      return reply.status(400).send({
        error: 'Invalid command contract',
        details: parse.error.flatten(),
      })
    }

    const cmd = parse.data
    const id = randomUUID()

    const record = await createCommand({
      id,
      org_id: '00000000-0000-0000-0000-000000000000',
      correlation_id: cmd.correlation_id,
      idempotency_key: cmd.correlation_id,
      playbook: cmd.playbook,
      status: 'pending',
      version: 1,
      attempt_count: 0,
      dry_run: cmd.dry_run,
      requested_by: cmd.requested_by,
      args: cmd.args,
      run_id: null,
      run_url: null,
      error_message: null,
      execution_owner: null,
      lease_expires_at: null,
      last_heartbeat_at: null,
      started_at: null,
      completed_at: null,
    })

    app.log.info({ correlation_id: cmd.correlation_id, playbook: cmd.playbook }, 'Command accepted')

    // Emit platform event for observability
    emitCommandEvent('automation.command.created', {
      correlation_id: cmd.correlation_id,
      playbook: cmd.playbook,
      dry_run: cmd.dry_run,
    }, cmd.requested_by).catch(() => { /* non-blocking */ })

    // Fire-and-forget dispatch (update status async)
    dispatchWorkflow({
      playbook: cmd.playbook,
      correlation_id: cmd.correlation_id,
      dry_run: cmd.dry_run,
      args_json: JSON.stringify(cmd.args),
    }).then((ok) => {
      updateCommandStatus(
        cmd.correlation_id,
        ok ? 'dispatched' : 'failed',
      )
    })

    return reply.status(202).send(record)
  })

  /**
   * GET /commands/:id — Retrieve a command by correlation ID.
   */
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const record = await getCommand(req.params.id)
    if (!record) {
      return reply.status(404).send({ error: 'Command not found' })
    }
    return record
  })

  /**
   * GET /commands — List all commands (most recent first).
   */
  app.get('/', async () => {
    return await listCommands()
  })

  /**
   * POST /commands/:id/approve — Approve a pending command for execution.
   *
   * Requires an `Idempotency-Key` header upstream (enforced by the global
   * `requireIdempotencyKey` guard on mutating routes). Emits an
   * `automation.command.approved` platform event and then triggers
   * dispatch. Approval is rejected for any non-pending command.
   */
  app.post<{ Params: { id: string }; Body: { approver_id?: string } }>(
    '/:id/approve',
    async (req, reply) => {
      const record = await getCommand(req.params.id)
      if (!record) {
        return reply.status(404).send({ error: 'Command not found' })
      }
      if (record.status !== 'pending') {
        return reply.status(409).send({
          error: `Cannot approve command in status: ${record.status}`,
        })
      }

      const approverId = req.body?.approver_id ?? 'system:orchestrator-api'

      const updated = await updateCommandStatus(record.correlation_id, 'dispatched')
      app.log.info(
        { correlation_id: record.correlation_id, approver_id: approverId },
        'Command approved',
      )

      // Audit: record approval as a platform event (hash-chained by store.ts).
      emitCommandEvent(
        'automation.command.approved',
        {
          correlation_id: record.correlation_id,
          playbook: record.playbook,
          approver_id: approverId,
        },
        approverId,
      ).catch(() => {
        /* non-blocking */
      })

      // Dispatch after approval (non-blocking — status moves on dispatch result).
      dispatchWorkflow({
        playbook: record.playbook,
        correlation_id: record.correlation_id,
        dry_run: record.dry_run,
        args_json: JSON.stringify(record.args),
      }).then((ok) => {
        if (!ok) {
          updateCommandStatus(record.correlation_id, 'failed').catch(() => {
            /* non-blocking */
          })
        }
      })

      return updated
    },
  )
}
