import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { AppEvents, EventBus, eventBus } from '../event-bus';

let bus: EventBus;

beforeEach(() => {
  bus = new EventBus();
});

describe('subscribe + emit', () => {
  it('on registers handler and emit invokes it', async () => {
    const handler = vi.fn();
    const off = bus.on('test.event', handler);
    bus.emit('test.event', { x: 1 });
    await new Promise((r) => setTimeout(r, 0));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].data).toEqual({ x: 1 });
    off();
    expect(bus.getSubscriberCount('test.event')).toBe(0);
  });

  it('emit with no subscribers is a no-op', () => {
    expect(() => bus.emit('none', {})).not.toThrow();
  });

  it('once handler fires a single time', async () => {
    const handler = vi.fn();
    bus.once('one.event', handler);
    bus.emit('one.event', {});
    bus.emit('one.event', {});
    await new Promise((r) => setTimeout(r, 0));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('once returns an unsubscribe function', () => {
    const off = bus.once('x', vi.fn());
    expect(bus.getSubscriberCount('x')).toBe(1);
    off();
    expect(bus.getSubscriberCount('x')).toBe(0);
  });

  it('emit swallows handler errors', async () => {
    bus.on('err.event', () => { throw new Error('boom'); });
    expect(() => bus.emit('err.event', {})).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe('emitAndWait', () => {
  it('awaits all handlers', async () => {
    const order: number[] = [];
    bus.on('wait.event', async () => { await Promise.resolve(); order.push(1); });
    bus.once('wait.event', async () => { order.push(2); });
    await bus.emitAndWait('wait.event', {});
    expect(order.sort()).toEqual([1, 2]);
    expect(bus.getSubscriberCount('wait.event')).toBe(1);
  });

  it('returns early with no subscribers', async () => {
    await expect(bus.emitAndWait('nobody', {})).resolves.toBeUndefined();
  });

  it('captures handler failures without throwing', async () => {
    bus.on('fail.event', async () => { throw new Error('nope'); });
    await expect(bus.emitAndWait('fail.event', {})).resolves.toBeUndefined();
  });
});

describe('management', () => {
  it('off removes all subscribers for a type', () => {
    bus.on('a', vi.fn());
    bus.off('a');
    expect(bus.getSubscriberCount('a')).toBe(0);
  });

  it('clear removes everything', () => {
    bus.on('a', vi.fn());
    bus.on('b', vi.fn());
    bus.clear();
    expect(bus.getEventTypes()).toEqual([]);
  });

  it('getEventTypes lists subscribed types', () => {
    bus.on('a', vi.fn());
    bus.on('b', vi.fn());
    expect(bus.getEventTypes().sort()).toEqual(['a', 'b']);
  });

  it('history records emitted events and can be cleared', () => {
    bus.emit('h.event', { n: 1 });
    bus.emit('h.event', { n: 2 });
    expect(bus.getHistory().length).toBe(2);
    expect(bus.getHistory(1).length).toBe(1);
    bus.clearHistory();
    expect(bus.getHistory()).toEqual([]);
  });
});

describe('module exports', () => {
  it('exposes singleton and AppEvents', () => {
    expect(eventBus).toBeInstanceOf(EventBus);
    expect(AppEvents.CLAIM_CREATED).toBe('claim.created');
  });
});
