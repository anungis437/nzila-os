// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
  mockUse: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mocks.mockGet,
      post: mocks.mockPost,
      put: mocks.mockPut,
      patch: mocks.mockPatch,
      delete: mocks.mockDelete,
      interceptors: {
        request: { use: mocks.mockUse },
        response: { use: mocks.mockUse },
      },
    })),
  },
}));

vi.mock('@/lib/client-logger', () => ({
  createClientLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { api } from '../api';

describe('ApiClient (api.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get delegates to axios get', async () => {
    mocks.mockGet.mockResolvedValue({ data: { id: 1 } });
    const result = await api.get('/users');
    expect(result).toEqual({ id: 1 });
  });

  it('post delegates to axios post', async () => {
    mocks.mockPost.mockResolvedValue({ data: { created: true } });
    const result = await api.post('/users', { name: 'test' });
    expect(result).toEqual({ created: true });
  });

  it('put delegates to axios put', async () => {
    mocks.mockPut.mockResolvedValue({ data: { updated: true } });
    const result = await api.put('/users/1', { name: 'updated' });
    expect(result).toEqual({ updated: true });
  });

  it('patch delegates to axios patch', async () => {
    mocks.mockPatch.mockResolvedValue({ data: { patched: true } });
    const result = await api.patch('/users/1', { name: 'patched' });
    expect(result).toEqual({ patched: true });
  });

  it('delete delegates to axios delete', async () => {
    mocks.mockDelete.mockResolvedValue({ data: { deleted: true } });
    const result = await api.delete('/users/1');
    expect(result).toEqual({ deleted: true });
  });

  it('healthCheck calls auth_core/health endpoint', async () => {
    mocks.mockGet.mockResolvedValue({ data: { status: 'ok' } });
    const result = await api.healthCheck();
    expect(result).toEqual({ status: 'ok' });
    expect(mocks.mockGet).toHaveBeenCalledWith('/auth_core/health/');
  });
});
