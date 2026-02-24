/**
 * WebSocket Service
 * 
 * Provides real-time bidirectional communication for the application
 * Supports event-based messaging, rooms, and presence
 */

import { logger } from '@/lib/logger';

// WebSocket configuration
export interface WebSocketConfig {
  pingInterval: number;
  pongTimeout: number;
  maxMessageSize: number;
  allowedOrigins: string[];
}

const DEFAULT_CONFIG: WebSocketConfig = {
  pingInterval: 30000, // 30 seconds
  pongTimeout: 5000,
  maxMessageSize: 1024 * 1024, // 1MB
  allowedOrigins: ['*'],
};

/**
 * WebSocket message types
 */
export type WebSocketMessageType = 
  | 'ping'
  | 'pong'
  | 'subscribe'
  | 'unsubscribe'
  | 'message'
  | 'presence'
  | 'typing'
  | 'notification';

/**
 * WebSocket message
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: unknown;
  timestamp: number;
  roomId?: string;
  userId?: string;
}

/**
 * WebSocket room
 */
export interface WebSocketRoom {
  id: string;
  members: Set<string>;
  createdAt: Date;
}

/**
 * WebSocket connection manager
 */
export class WebSocketManager {
  private config: WebSocketConfig;
  private rooms: Map<string, WebSocketRoom> = new Map();
  private connections: Map<string, Set<WebSocket>> = new Map();

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(socket: WebSocket, userId: string): void {
    logger.info('WebSocket connected', { userId });

    // Set up ping/pong
    const pingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      } else {
        clearInterval(pingInterval);
      }
    }, this.config.pingInterval);

    // Handle messages
    socket.onmessage = (event) => {
      this.handleMessage(socket, event.data, userId);
    };

    // Handle close
    socket.onclose = () => {
      clearInterval(pingInterval);
      this.handleDisconnect(socket, userId);
    };

    // Handle errors
    socket.onerror = (error) => {
      logger.error('WebSocket error', { userId, error });
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(socket: WebSocket, data: string, userId: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(socket, message.roomId!, userId);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(socket, message.roomId!, userId);
          break;
        case 'message':
          this.broadcastToRoom(message.roomId!, message, userId);
          break;
        case 'typing':
          this.handleTyping(message.roomId!, userId);
          break;
        case 'pong':
          // Connection is alive
          break;
        default:
          logger.warn('Unknown message type', { type: message.type });
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message', { error });
    }
  }

  /**
   * Handle subscription to a room
   */
  private handleSubscribe(socket: WebSocket, roomId: string, userId: string): void {
    // Create room if doesn&apos;t exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        members: new Set(),
        createdAt: new Date(),
      });
    }

    const room = this.rooms.get(roomId)!;
    room.members.add(userId);

    // Add to connections
    if (!this.connections.has(roomId)) {
      this.connections.set(roomId, new Set());
    }
    this.connections.get(roomId)!.add(socket);

    // Notify others
    this.broadcastToRoom(roomId, {
      type: 'presence',
      payload: { userId, action: 'joined' },
      timestamp: Date.now(),
      roomId,
    }, userId);

    logger.info('User subscribed to room', { userId, roomId });
  }

  /**
   * Handle unsubscription from a room
   */
  private handleUnsubscribe(socket: WebSocket, roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.members.delete(userId);
    }

    const roomConnections = this.connections.get(roomId);
    if (roomConnections) {
      roomConnections.delete(socket);
    }

    // Notify others
    this.broadcastToRoom(roomId, {
      type: 'presence',
      payload: { userId, action: 'left' },
      timestamp: Date.now(),
      roomId,
    }, userId);

    logger.info('User unsubscribed from room', { userId, roomId });
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: WebSocket, userId: string): void {
    // Remove from all rooms
    for (const [roomId, connections] of this.connections.entries()) {
      if (connections.has(socket)) {
        connections.delete(socket);
        
        const room = this.rooms.get(roomId);
        if (room) {
          room.members.delete(userId);
          
          this.broadcastToRoom(roomId, {
            type: 'presence',
            payload: { userId, action: 'left' },
            timestamp: Date.now(),
            roomId,
          }, userId);
        }
      }
    }

    logger.info('WebSocket disconnected', { userId });
  }

  /**
   * Broadcast message to all in a room
   */
  broadcastToRoom(roomId: string, message: WebSocketMessage, _excludeUserId?: string): void {
    const connections = this.connections.get(roomId);
    if (!connections) return;

    const data = JSON.stringify(message);

    for (const socket of connections) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    }
  }

  /**
   * Handle typing indicator
   */
  private handleTyping(roomId: string, userId: string): void {
    this.broadcastToRoom(roomId, {
      type: 'typing',
      payload: { userId, isTyping: true },
      timestamp: Date.now(),
      roomId,
    }, userId);
  }

  /**
   * Get room info
   */
  getRoomInfo(roomId: string): { memberCount: number; createdAt: Date } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      memberCount: room.members.size,
      createdAt: room.createdAt,
    };
  }

  /**
   * Send notification to user
   */
  sendToUser(userId: string, notification: unknown): void {
    const _message: WebSocketMessage = {
      type: 'notification',
      payload: notification,
      timestamp: Date.now(),
      userId,
    };

    // In production, would find all connections for user
    // and send to each
    logger.debug('Sending notification to user', { userId, notification });
  }
}

/**
 * Factory function
 */
export function createWebSocketManager(config?: Partial<WebSocketConfig>): WebSocketManager {
  return new WebSocketManager(config);
}

// Export singleton
export const webSocketManager = new WebSocketManager();
