import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] })),
  toast: vi.fn(),
}));

describe('hooks/use-toast', () => {
  it('re-exports the toast helpers from the ui module', async () => {
    const mod = await import('../use-toast');
    expect(mod.useToast).toBeTypeOf('function');
    expect(mod.toast).toBeTypeOf('function');
  });
});
