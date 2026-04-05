import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
  mockAuth: vi.fn(),
  mockUse: vi.fn(),
}));

// Mock server-only to prevent import error
vi.mock('server-only', () => ({}));

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

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.mockAuth,
}));

vi.mock('@nzila/os-core', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { serverApi } from '../api-server';

describe('ServerApiClient (api-server.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get delegates to axios get', async () => {
    mocks.mockGet.mockResolvedValue({ data: { id: 1 } });
    const result = await serverApi.get('/users');
    expect(result).toEqual({ id: 1 });
  });

  it('post delegates to axios post', async () => {
    mocks.mockPost.mockResolvedValue({ data: { created: true } });
    const result = await serverApi.post('/users', { name: 'test' });
    expect(result).toEqual({ created: true });
  });

  it('put delegates to axios put', async () => {
    mocks.mockPut.mockResolvedValue({ data: { updated: true } });
    const result = await serverApi.put('/users/1', { name: 'updated' });
    expect(result).toEqual({ updated: true });
  });

  it('patch delegates to axios patch', async () => {
    mocks.mockPatch.mockResolvedValue({ data: { patched: true } });
    const result = await serverApi.patch('/users/1', { name: 'patched' });
    expect(result).toEqual({ patched: true });
  });

  it('delete delegates to axios delete', async () => {
    mocks.mockDelete.mockResolvedValue({ data: { deleted: true } });
    const result = await serverApi.delete('/users/1');
    expect(result).toEqual({ deleted: true });
  });
});
