/**
 * Tests for NotificationBell — polling, unread count display, onOpen callback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'
import { NotificationBell } from './NotificationBell'

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders bell button', async () => {
    const fetch = vi.fn().mockResolvedValue(0)
    render(<NotificationBell fetchUnreadCount={fetch} pollInterval={0} />)
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(screen.getByRole('button')).toBeDefined()
  })

  it('displays unread count when > 0', async () => {
    const fetch = vi.fn().mockResolvedValue(5)
    render(<NotificationBell fetchUnreadCount={fetch} pollInterval={0} />)
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(screen.getByText('5')).toBeDefined()
  })

  it('hides badge when count is 0', async () => {
    const fetch = vi.fn().mockResolvedValue(0)
    render(<NotificationBell fetchUnreadCount={fetch} pollInterval={0} />)
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(screen.queryByText('0')).toBeNull()
  })

  it('calls onOpen when clicked', async () => {
    const onOpen = vi.fn()
    const fetch = vi.fn().mockResolvedValue(0)
    render(<NotificationBell fetchUnreadCount={fetch} onOpen={onOpen} pollInterval={0} />)
    await act(() => vi.advanceTimersByTimeAsync(100))
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('polls at the specified interval', async () => {
    const fetch = vi.fn().mockResolvedValue(3)
    render(<NotificationBell fetchUnreadCount={fetch} pollInterval={5_000} />)

    // Initial fetch
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(fetch).toHaveBeenCalledTimes(1)

    // Advance past one poll interval
    await act(() => vi.advanceTimersByTimeAsync(5_100))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not poll when pollInterval is 0', async () => {
    const fetch = vi.fn().mockResolvedValue(1)
    render(<NotificationBell fetchUnreadCount={fetch} pollInterval={0} />)

    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(fetch).toHaveBeenCalledTimes(1)

    // Advance time — should not poll again
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('handles fetch errors gracefully', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    // Should not throw
    render(<NotificationBell fetchUnreadCount={fetch} pollInterval={0} />)
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(screen.getByRole('button')).toBeDefined()
  })

  it('cleans up interval on unmount', async () => {
    const fetch = vi.fn().mockResolvedValue(2)
    const { unmount } = render(
      <NotificationBell fetchUnreadCount={fetch} pollInterval={5_000} />,
    )
    await act(() => vi.advanceTimersByTimeAsync(100))
    unmount()
    // Advance time after unmount — fetch should not be called again
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    const callsAfterUnmount = fetch.mock.calls.length
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(fetch.mock.calls.length).toBe(callsAfterUnmount)
  })
})
