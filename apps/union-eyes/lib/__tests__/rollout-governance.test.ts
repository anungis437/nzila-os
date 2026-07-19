import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  promises: {
    access: mocks.access,
    readFile: mocks.readFile,
  },
}));

import {
  loadEnvironmentRegistry,
  loadPilotLedger,
} from '../rollout-governance';

const REGISTRY = {
  environments: {
    pilot: { tier: 'pilot', topology: 't', secret_topology: 's' },
  },
};

function attestation(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    attestation_id: 'a1',
    attestation_type: 'promotion',
    timestamp: '2024-05-01T00:00:00.000Z',
    actor: 'op',
    subject: { tier: 'pilot' },
    outcome: 'ok',
    payload: {},
    ...over,
  });
}

describe('lib/rollout-governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadEnvironmentRegistry', () => {
    it('resolves the repo root and parses the registry JSON', async () => {
      // First candidate root succeeds on access.
      mocks.access.mockResolvedValue(undefined);
      mocks.readFile.mockResolvedValue(JSON.stringify(REGISTRY));

      const result = await loadEnvironmentRegistry();
      expect(result.environments.pilot.tier).toBe('pilot');
    });

    it('falls through candidate roots until one has the registry', async () => {
      mocks.access
        .mockRejectedValueOnce(new Error('nope'))
        .mockResolvedValueOnce(undefined);
      mocks.readFile.mockResolvedValue(JSON.stringify(REGISTRY));

      const result = await loadEnvironmentRegistry();
      expect(result.environments.pilot).toBeDefined();
    });

    it('throws when no candidate root contains the registry', async () => {
      mocks.access.mockRejectedValue(new Error('missing'));
      await expect(loadEnvironmentRegistry()).rejects.toThrow(/cannot locate repo root/);
    });
  });

  describe('loadPilotLedger', () => {
    it('reads, filters, and sorts pilot attestations', async () => {
      mocks.access.mockResolvedValue(undefined);
      mocks.readFile.mockImplementation(async (p: string) => {
        if (p.includes('environments.json')) return JSON.stringify(REGISTRY);
        if (p.includes('promotions-')) {
          return [
            attestation({ timestamp: '2024-05-01T00:00:00.000Z' }),
            attestation({ timestamp: '2024-06-01T00:00:00.000Z' }),
            attestation({ subject: { tier: 'prod' } }), // filtered out
            'not-json', // skipped
          ].join('\n');
        }
        if (p.includes('rollbacks-')) {
          return [
            attestation({ attestation_type: 'rollback', timestamp: '2024-04-01T00:00:00.000Z' }),
            attestation({ attestation_type: 'rollback', timestamp: '2024-07-01T00:00:00.000Z' }),
          ].join('\n');
        }
        return '';
      });

      const ledger = await loadPilotLedger(1);
      expect(ledger.promotions).toHaveLength(2);
      // Sorted newest first.
      expect(ledger.promotions[0].timestamp).toBe('2024-06-01T00:00:00.000Z');
      expect(ledger.rollbacks).toHaveLength(2);
      expect(ledger.rollbacks[0].timestamp).toBe('2024-07-01T00:00:00.000Z');
    });

    it('returns empty ledgers when attestation files are missing', async () => {
      mocks.access.mockResolvedValue(undefined);
      mocks.readFile.mockImplementation(async (p: string) => {
        if (p.includes('environments.json')) return JSON.stringify(REGISTRY);
        throw new Error('ENOENT');
      });

      const ledger = await loadPilotLedger(2);
      expect(ledger.promotions).toEqual([]);
      expect(ledger.rollbacks).toEqual([]);
    });
  });
});
