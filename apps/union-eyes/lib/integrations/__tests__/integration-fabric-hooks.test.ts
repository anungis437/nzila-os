import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@nzila/platform-integrations/execution-engine', () => ({ IntegrationExecutionEngine: class {} }));
vi.mock('@nzila/platform-integrations/mapping-engine', () => ({ MappingEngine: class {} }));
vi.mock('@nzila/platform-integrations/webhook-engine', () => ({ WebhookEngine: class {} }));
vi.mock('@nzila/platform-integrations/identity-linker', () => ({ IdentityLinker: class {} }));

import { UeIntegrationFabric, UE_ENTITY_TYPES, UE_INTEGRATION_EVENTS } from '../integration-fabric-hooks';

const makeDeps = () => ({
  executionEngine: {} as never,
  mappingEngine: {
    execute: vi.fn(() => ({ errors: [], output: { externalCaseId: 'ext-1' } })),
    preview: vi.fn(() => ({
      output: { a: 1 },
      errors: [{ message: 'err1' }],
      warnings: [{ message: 'warn1' }],
    })),
  } as never,
  webhookEngine: { publishEvent: vi.fn().mockResolvedValue(undefined) } as never,
  identityLinker: {
    link: vi.fn().mockResolvedValue(undefined),
    resolve: vi.fn(),
  } as never,
});

const connection = { orgId: 'org1', id: 'conn1', connectorType: 'workday' } as never;

describe('UeIntegrationFabric', () => {
  let deps: ReturnType<typeof makeDeps>;
  let fabric: UeIntegrationFabric;

  beforeEach(() => {
    deps = makeDeps();
    fabric = new UeIntegrationFabric(deps);
  });

  it('exposes UE entity types and event types', () => {
    expect(UE_ENTITY_TYPES.CASE).toBe('case');
    expect(UE_INTEGRATION_EVENTS['case.created']).toBe('case.created');
  });

  it('processInboundCase applies mapping, links identity and returns a run id', async () => {
    const result = await fabric.processInboundCase(
      connection,
      { foo: 'bar' },
      { id: 'rule1' } as never,
      'actor1'
    );
    expect(result.success).toBe(true);
    expect(result.runId).toBeTruthy();
    expect(deps.mappingEngine.execute).toHaveBeenCalled();
    expect(deps.identityLinker.link).toHaveBeenCalled();
  });

  it('processInboundCase returns failure when mapping has errors', async () => {
    deps.mappingEngine.execute = vi.fn(() => ({ errors: [{ message: 'bad' }], output: {} })) as never;
    const result = await fabric.processInboundCase(
      connection,
      { foo: 'bar' },
      { id: 'rule1' } as never,
      'actor1'
    );
    expect(result.success).toBe(false);
    expect(result.runId).toBe('');
    expect(deps.identityLinker.link).not.toHaveBeenCalled();
  });

  it('processInboundCase without mapping rule or external id skips linking', async () => {
    const result = await fabric.processInboundCase(connection, { foo: 'bar' }, null, 'actor1');
    expect(result.success).toBe(true);
    expect(deps.identityLinker.link).not.toHaveBeenCalled();
  });

  it('emitOutboundEvent publishes via the webhook engine', async () => {
    await fabric.emitOutboundEvent('org1', 'case.created', { id: '1' });
    expect(deps.webhookEngine.publishEvent).toHaveBeenCalledWith('org1', 'case.created', { id: '1' });
  });

  it('resolveExternalId returns the internal id when found', async () => {
    deps.identityLinker.resolve = vi.fn().mockResolvedValue({ found: true, internalId: 'int-1' }) as never;
    const id = await fabric.resolveExternalId('org1', UE_ENTITY_TYPES.CASE, 'ext-1', 'workday');
    expect(id).toBe('int-1');
  });

  it('resolveExternalId returns null when not found', async () => {
    deps.identityLinker.resolve = vi.fn().mockResolvedValue({ found: false }) as never;
    const id = await fabric.resolveExternalId('org1', UE_ENTITY_TYPES.CASE, 'ext-1', 'workday');
    expect(id).toBeNull();
  });

  it('previewMapping maps engine errors and warnings to strings', () => {
    const result = fabric.previewMapping({ foo: 'bar' }, { id: 'rule1' } as never);
    expect(result.errors).toEqual(['err1']);
    expect(result.warnings).toEqual(['warn1']);
    expect(result.output).toEqual({ a: 1 });
  });
});
