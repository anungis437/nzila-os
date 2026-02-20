import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { CommandSchema } from '../contract.js'
import { dispatchWorkflow } from '../dispatch.js'
import { createCommand, getCommand, listCommands, updateCommandStatus } from '../store.js'

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
      correlation_id: cmd.correlation_id,
      playbook: cmd.playbook,
      status: 'pending',
      dry_run: cmd.dry_run,
      requested_by: cmd.requested_by,
      args: cmd.args,
      run_id: null,
      run_url: null,
    })

    app.log.info({ correlation_id: cmd.correlation_id, playbook: cmd.playbook }, 'Command accepted')

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
   * (Stub — expand with real approval logic + audit event emission.)
   */
  app.post<{ Params: { id: string } }>('/:id/approve', async (req, reply) => {
    const record = await getCommand(req.params.id)
    if (!record) {
      return reply.status(404).send({ error: 'Command not found' })
    }
    if (record.status !== 'pending') {
      return reply.status(409).send({
        error: `Cannot approve command in status: ${record.status}`,
      })
    }

    const updated = await updateCommandStatus(record.correlation_id, 'dispatched')
    app.log.info({ correlation_id: record.correlation_id }, 'Command approved')

    // Dispatch after approval
    dispatchWorkflow({
      playbook: record.playbook,
      correlation_id: record.correlation_id,
      dry_run: record.dry_run,
      args_json: JSON.stringify(record.args),
    })

    return updated
  })
}
