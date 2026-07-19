/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next-intl', async () => (await import('@/lib/test/next-intl-mock')).clientMock);

import { ReviewPacketExportControls } from '../ReviewPacketExportControls';

describe('ReviewPacketExportControls', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    document.createElement = originalCreateElement;
  });

  it('does not render controls when caller lacks export permission', () => {
    render(
      <ReviewPacketExportControls
        matterId="inc-1"
        locale="en-CA"
        canExport={false}
        isPacketExternalizable={true}
      />,
    );

    expect(screen.queryByTestId('review-packet-export-controls')).toBeNull();
  });

  it('does not prefetch or auto-invoke export on render', () => {
    render(
      <ReviewPacketExportControls
        matterId="inc-1"
        locale="en-CA"
        canExport={true}
        isPacketExternalizable={true}
      />,
    );

    expect(screen.getByTestId('review-packet-export-controls')).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('invokes export only on explicit user click', async () => {
    const clickSpy = vi.fn();
    document.createElement = vi.fn(((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { value: clickSpy });
      }
      return element;
    }) as typeof document.createElement);

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name === 'content-disposition' ? 'attachment; filename="packet.json"' : null),
      },
      blob: async () => new Blob(['{"ok":true}'], { type: 'application/json' }),
    });

    render(
      <ReviewPacketExportControls
        matterId="inc-1"
        locale="en-CA"
        canExport={true}
        isPacketExternalizable={true}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain('/api/courtlens/matters/inc-1/review-packet?');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
