/**
 * Distributed Tracing Service
 * 
 * Provides OpenTelemetry-compatible distributed tracing
 * for debugging and monitoring cross-service requests
 */

import { logger } from '@/lib/logger';

// Trace context
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
}

export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  service: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'ok' | 'error' | 'unset';
  attributes: Record<string, string>;
  events: SpanEvent[];
}

interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string>;
}

/**
 * Distributed Tracing Service
 */
class DistributedTracing {
  private serviceName: string;
  private spans: Map<string, Span> = new Map();
  private currentSpan: Span | null = null;

  constructor(serviceName: string = 'union-eyes') {
    this.serviceName = serviceName;
  }

  /**
   * Start a new trace
   */
  startTrace(name: string, attributes?: Record<string, string>): TraceContext {
    const traceId = this.generateId(32);
    const spanId = this.generateId(16);

    const span: Span = {
      id: spanId,
      traceId,
      name,
      service: this.serviceName,
      startTime: Date.now(),
      status: 'unset',
      attributes: attributes || {},
      events: [],
    };

    this.spans.set(spanId, span);
    this.currentSpan = span;

    logger.debug('Trace started', { traceId, spanId, name });

    return {
      traceId,
      spanId,
      sampled: this.shouldSample(),
    };
  }

  /**
   * Start a child span
   */
  startSpan(name: string, attributes?: Record<string, string>): Span {
    const parentSpan = this.currentSpan;
    const spanId = this.generateId(16);

    const span: Span = {
      id: spanId,
      traceId: parentSpan?.traceId || this.generateId(32),
      parentId: parentSpan?.id,
      name,
      service: this.serviceName,
      startTime: Date.now(),
      status: 'unset',
      attributes: attributes || {},
      events: [],
    };

    this.spans.set(spanId, span);
    this.currentSpan = span;

    logger.debug('Span started', { spanId, name, parentId: parentSpan?.id });

    return span;
  }

  /**
   * End current span
   */
  endSpan(span?: Span, status: 'ok' | 'error' = 'ok', attributes?: Record<string, string>): void {
    const currentSpan = span || this.currentSpan;
    
    if (!currentSpan) {
      logger.warn('No active span to end');
      return;
    }

    currentSpan.endTime = Date.now();
    currentSpan.duration = currentSpan.endTime - currentSpan.startTime;
    currentSpan.status = status;

    if (attributes) {
      currentSpan.attributes = { ...currentSpan.attributes, ...attributes };
    }

    // Export span to backend
    this.exportSpan(currentSpan);

    // Restore parent as current
    if (currentSpan.parentId) {
      this.currentSpan = this.spans.get(currentSpan.parentId) || null;
    } else {
      this.currentSpan = null;
    }

    logger.debug('Span ended', { 
      spanId: currentSpan.id, 
      duration: currentSpan.duration 
    });
  }

  /**
   * Add event to current span
   */
  addEvent(name: string, attributes?: Record<string, string>): void {
    if (!this.currentSpan) return;

    this.currentSpan.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
  }

  /**
   * Add attribute to span
   */
  setAttribute(key: string, value: string, span?: Span): void {
    const targetSpan = span || this.currentSpan;
    if (!targetSpan) return;

    targetSpan.attributes[key] = value;
  }

  /**
   * Record exception
   */
  recordException(error: Error, span?: Span): void {
    const targetSpan = span || this.currentSpan;
    if (!targetSpan) return;

    targetSpan.status = 'error';
    targetSpan.attributes['error'] = 'true';
    targetSpan.attributes['error.message'] = error.message;
    targetSpan.attributes['error.stack'] = error.stack || '';

    this.addEvent('exception', {
      'exception.type': error.name,
      'exception.message': error.message,
    });
  }

  /**
   * Inject trace context into carrier (e.g., HTTP headers)
   */
  injectContext(carrier: Record<string, string>): Record<string, string> {
    const span = this.currentSpan;
    
    if (!span) return carrier;

    carrier['x-trace-id'] = span.traceId;
    carrier['x-span-id'] = span.id;

    return carrier;
  }

  /**
   * Extract trace context from carrier
   */
  extractContext(carrier: Record<string, string>): TraceContext | null {
    const traceId = carrier['x-trace-id'];
    const spanId = carrier['x-span-id'];

    if (!traceId || !spanId) return null;

    return {
      traceId,
      spanId,
      sampled: this.shouldSample(),
    };
  }

  /**
   * Export span to tracing backend
   */
  private exportSpan(span: Span): void {
    // In production, would send to OpenTelemetry collector
    // Example: otlpExporter.send([span])
    
    logger.debug('Exporting span', {
      traceId: span.traceId,
      spanId: span.id,
      duration: span.duration,
    });

    // Clean up old spans
    if (this.spans.size > 1000) {
      const toDelete = Array.from(this.spans.keys()).slice(0, 500);
      toDelete.forEach(key => this.spans.delete(key));
    }
  }

  /**
   * Generate random ID
   */
  private generateId(length: number): string {
    const chars = '0123456789abcdef';
    let id = '';
    for (let i = 0; i < length; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  /**
   * Sample rate check
   */
  private shouldSample(): boolean {
    // 10% sample rate by default
    return Math.random() < 0.1;
  }

  /**
   * Get current trace info
   */
  getCurrentTrace(): TraceContext | null {
    if (!this.currentSpan) return null;
    
    return {
      traceId: this.currentSpan.traceId,
      spanId: this.currentSpan.id,
      sampled: true,
    };
  }
}

// Decorator for automatic tracing
export function trace(spanName?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const name = spanName || `${(target as any).constructor.name}.${propertyKey}`;
      const tracing = tracingService;
      
      tracing.startSpan(name);
      
      try {
        const result = originalMethod.apply(this, args);
        
        // Handle async
        if (result && typeof result.then === 'function') {
          return result
            .then((value: unknown) => {
              tracing.endSpan(undefined, 'ok');
              return value;
            })
            .catch((error: Error) => {
              tracing.recordException(error);
              tracing.endSpan(undefined, 'error');
              throw error;
            });
        }
        
        tracing.endSpan(undefined, 'ok');
        return result;
      } catch (error) {
        tracing.recordException(error as Error);
        tracing.endSpan(undefined, 'error');
        throw error;
      }
    };
    
    return descriptor;
  };
}

// Export singleton
export const tracingService = new DistributedTracing();
