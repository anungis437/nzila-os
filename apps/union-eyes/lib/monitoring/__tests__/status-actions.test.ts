import { describe, expect, it, vi } from 'vitest';

const { getSystemStatus } = vi.hoisted(() => ({ getSystemStatus: vi.fn() }));

vi.mock('../status-page', () => ({ getSystemStatus }));

import { getStatusAction } from '../status-actions';

describe('lib/monitoring/status-actions', () => {
  it('delegates to getSystemStatus', async () => {
    getSystemStatus.mockResolvedValue({ ok: true });
    const result = await getStatusAction();
    expect(getSystemStatus).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });
});
