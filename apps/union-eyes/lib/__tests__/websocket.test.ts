import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { WebSocketManager, createWebSocketManager, webSocketManager } from '../websocket';

function createMockSocket(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    onmessage: null as ((ev: MessageEvent) => void) | null,
    onclose: null as (() => void) | null,
    onerror: null as ((ev: Event) => void) | null,
    OPEN: 1,
    CLOSED: 3,
  } as any as WebSocket;
}

describe('WebSocketManager', () => {
  let manager: WebSocketManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    manager = new WebSocketManager({ pingInterval: 5000, pongTimeout: 1000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('constructs with default config', () => {
    const m = new WebSocketManager();
    expect(m).toBeInstanceOf(WebSocketManager);
  });

  it('handleConnection sets up event handlers on socket', () => {
    const socket = createMockSocket();
    manager.handleConnection(socket, 'user-1');

    expect(socket.onmessage).toBeInstanceOf(Function);
    expect(socket.onclose).toBeInstanceOf(Function);
    expect(socket.onerror).toBeInstanceOf(Function);
  });

  it('sends ping messages at configured interval', () => {
    const socket = createMockSocket();
    manager.handleConnection(socket, 'user-1');

    vi.advanceTimersByTime(5000);

    expect(socket.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"ping"'),
    );
  });

  it('handles subscribe message and creates room', () => {
    const socket = createMockSocket();
    manager.handleConnection(socket, 'user-1');

    // Simulate incoming subscribe message
    const handler = socket.onmessage as (ev: MessageEvent) => void;
    handler({ data: JSON.stringify({ type: 'subscribe', roomId: 'room-1' }) } as MessageEvent);

    const info = manager.getRoomInfo('room-1');
    expect(info).not.toBeNull();
    expect(info!.memberCount).toBe(1);
  });

  it('handles unsubscribe removes user from room', () => {
    const socket = createMockSocket();
    manager.handleConnection(socket, 'user-1');

    const handler = socket.onmessage as (ev: MessageEvent) => void;
    handler({ data: JSON.stringify({ type: 'subscribe', roomId: 'room-2' }) } as MessageEvent);
    handler({ data: JSON.stringify({ type: 'unsubscribe', roomId: 'room-2' }) } as MessageEvent);

    const info = manager.getRoomInfo('room-2');
    expect(info!.memberCount).toBe(0);
  });

  it('getRoomInfo returns null for nonexistent room', () => {
    expect(manager.getRoomInfo('no-such-room')).toBeNull();
  });

  it('broadcastToRoom sends to all connections in room', () => {
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();

    manager.handleConnection(socket1, 'user-1');
    manager.handleConnection(socket2, 'user-2');

    const h1 = socket1.onmessage as (ev: MessageEvent) => void;
    const h2 = socket2.onmessage as (ev: MessageEvent) => void;

    h1({ data: JSON.stringify({ type: 'subscribe', roomId: 'room-x' }) } as MessageEvent);
    h2({ data: JSON.stringify({ type: 'subscribe', roomId: 'room-x' }) } as MessageEvent);

    // Reset send counts from subscribe broadcasts
    (socket1.send as ReturnType<typeof vi.fn>).mockClear();
    (socket2.send as ReturnType<typeof vi.fn>).mockClear();

    manager.broadcastToRoom('room-x', {
      type: 'message', payload: 'hello', timestamp: Date.now(),
    });

    expect(socket1.send).toHaveBeenCalled();
    expect(socket2.send).toHaveBeenCalled();
  });

  it('createWebSocketManager factory returns instance', () => {
    const m = createWebSocketManager({ pingInterval: 10000 });
    expect(m).toBeInstanceOf(WebSocketManager);
  });

  it('webSocketManager singleton is an instance', () => {
    expect(webSocketManager).toBeInstanceOf(WebSocketManager);
  });
});
