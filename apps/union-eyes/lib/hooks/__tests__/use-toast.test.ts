// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useToast } from '../../hooks/use-toast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty toasts', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  it('adds a toast with generated id', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Hello', description: 'World' });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Hello');
    expect(result.current.toasts[0].description).toBe('World');
    expect(result.current.toasts[0].variant).toBe('default');
    expect(result.current.toasts[0].id).toBeTruthy();
  });

  it('supports destructive variant', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Error', variant: 'destructive' });
    });

    expect(result.current.toasts[0].variant).toBe('destructive');
  });

  it('auto-removes toast after 5 seconds', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Temporary' });
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('can add multiple toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'First' });
      result.current.toast({ title: 'Second' });
    });

    expect(result.current.toasts).toHaveLength(2);
  });

  it('removes only the expired toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'First' });
    });

    // Add second toast 2 seconds later
    act(() => {
      vi.advanceTimersByTime(2000);
      result.current.toast({ title: 'Second' });
    });

    // 3 more seconds: first toast should be gone, second still present
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Second');
  });
});
