/**
 * @vitest-environment jsdom
 *
 * Covers the fragment-decoding safety fix in IcraCapabilityBootstrap:
 * malformed percent-encoding must never throw, must never issue an
 * exchange request, and must show the invalid-link state (not crash the
 * component or loop).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

import { extractFragmentCapability, IcraCapabilityBootstrap } from '../IcraCapabilityBootstrap';

function setHash(hash: string) {
  window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setHash('');
});

beforeEach(() => {
  mockRefresh.mockClear();
});

describe('extractFragmentCapability', () => {
  it('does not throw on malformed percent-encoding and reports present-but-undecodable', () => {
    expect(() => extractFragmentCapability('#cap=%ZZ')).not.toThrow();
    expect(extractFragmentCapability('#cap=%ZZ')).toEqual({ present: true, value: null });
  });

  it('reports absent when there is no cap= key at all', () => {
    expect(extractFragmentCapability('')).toEqual({ present: false, value: null });
    expect(extractFragmentCapability('#other=1')).toEqual({ present: false, value: null });
  });

  it('decodes a well-formed fragment value', () => {
    expect(extractFragmentCapability('#cap=abc%2Ddef')).toEqual({ present: true, value: 'abc-def' });
  });
});

describe('IcraCapabilityBootstrap', () => {
  it('shows the invalid-link state and issues no exchange request for a malformed fragment', async () => {
    setHash('#cap=%ZZ');
    const fetchSpy = vi.spyOn(global, 'fetch');
    render(<IcraCapabilityBootstrap assessmentId="a1" />);

    await waitFor(() => {
      expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows the incomplete-link state when there is no fragment at all', async () => {
    setHash('');
    render(<IcraCapabilityBootstrap assessmentId="a1" />);
    await waitFor(() => {
      expect(screen.getByText(/appears to be incomplete/i)).toBeInTheDocument();
    });
  });

  it('exchanges a valid fragment, strips it, and refreshes', async () => {
    setHash('#cap=goodtoken');
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    render(<IcraCapabilityBootstrap assessmentId="a1" />);

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
    expect(window.location.hash).toBe('');
  });

  it('shows the invalid state when the exchange endpoint rejects the token', async () => {
    setHash('#cap=badtoken');
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    render(<IcraCapabilityBootstrap assessmentId="a1" />);

    await waitFor(() => {
      expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
