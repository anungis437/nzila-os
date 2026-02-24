/**
 * Mobile Analytics Library
 * 
 * Provides analytics and usage tracking for mobile PWA
 * Tracks user sessions, screen views, events, and performance
 */

import { logger } from '@/lib/logger';

// Analytics configuration
export interface AnalyticsConfig {
  endpoint: string;
  enabled: boolean;
  sampleRate: number;
  sessionTimeout: number;
  batchSize: number;
}

const DEFAULT_CONFIG: AnalyticsConfig = {
  endpoint: '/api/analytics/events',
  enabled: true,
  sampleRate: 1.0,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  batchSize: 10,
};

/**
 * Analytics Event types
 */
export type EventCategory = 
  | 'screen'
  | 'action'
  | 'error'
  | 'performance'
  | 'sync'
  | 'offline';

export interface AnalyticsEvent {
  id: string;
  name: string;
  category: EventCategory;
  timestamp: string;
  sessionId: string;
  userId?: string;
  properties?: Record<string, unknown>;
  deviceInfo?: DeviceInfo;
}

interface DeviceInfo {
  platform: string;
  os: string;
  browser: string;
  screenWidth: number;
  screenHeight: number;
  connectionType?: string;
}

/**
 * Mobile Analytics
 */
export class MobileAnalytics {
  private config: AnalyticsConfig;
  private sessionId: string;
  private sessionStart: number;
  private lastActivity: number;
  private events: AnalyticsEvent[] = [];
  private isInitialized: boolean = false;
  private userId?: string;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
    this.sessionStart = Date.now();
    this.lastActivity = Date.now();
  }

  /**
   * Initialize analytics
   */
  init(userId?: string): void {
    if (this.isInitialized || !this.config.enabled) {
      return;
    }

    this.userId = userId;

    // Track session activity
    const trackActivity = () => {
      this.lastActivity = Date.now();
    };

    window.addEventListener('click', trackActivity);
    window.addEventListener('scroll', trackActivity, { passive: true });
    window.addEventListener('keypress', trackActivity);

    // Session timeout check
    setInterval(() => {
      if (Date.now() - this.lastActivity > this.config.sessionTimeout) {
        this.endSession();
        this.startNewSession();
      }
    }, 60000); // Check every minute

    // Flush events periodically
    setInterval(() => {
      if (this.events.length >= this.config.batchSize) {
        this.flush();
      }
    }, 30000); // Every 30 seconds

    // Flush on page unload
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });

    this.isInitialized = true;
    logger.info('Mobile analytics initialized', { sessionId: this.sessionId });

    // Track initial screen view
    this.trackScreenView('initial', window.location.pathname);
  }

  /**
   * Set user ID
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Track screen view
   */
  trackScreenView(screenName: string, path: string): void {
    this.track('screen_view', 'screen', {
      screenName,
      path,
    });
  }

  /**
   * Track custom event
   */
  trackEvent(
    name: string,
    category: EventCategory,
    properties?: Record<string, unknown>
  ): void {
    this.track(name, category, properties);
  }

  /**
   * Track action
   */
  trackAction(action: string, properties?: Record<string, unknown>): void {
    this.track(action, 'action', properties);
  }

  /**
   * Track error
   */
  trackError(error: string, properties?: Record<string, unknown>): void {
    this.track(error, 'error', properties);
  }

  /**
   * Track performance
   */
  trackPerformance(metric: string, value: number, properties?: Record<string, unknown>): void {
    this.track(metric, 'performance', {
      value,
      ...properties,
    });
  }

  /**
   * Track sync event
   */
  trackSync(type: string, success: boolean, properties?: Record<string, unknown>): void {
    this.track(type, 'sync', {
      success,
      ...properties,
    });
  }

  /**
   * Track offline event
   */
  trackOffline(event: string, properties?: Record<string, unknown>): void {
    this.track(event, 'offline', properties);
  }

  /**
   * Internal track method
   */
  private track(
    name: string,
    category: EventCategory,
    properties?: Record<string, unknown>
  ): void {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) {
      return;
    }

    const event: AnalyticsEvent = {
      id: this.generateId(),
      name,
      category,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      properties,
      deviceInfo: this.getDeviceInfo(),
    };

    this.events.push(event);

    // Flush if batch size reached
    if (this.events.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush events to server
   */
  async flush(): Promise<void> {
    if (this.events.length === 0) {
      return;
    }

    const events = [...this.events];
    this.events = [];

    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });
      
      logger.debug('Analytics events sent', { count: events.length });
    } catch (error) {
      // Re-queue on failure
      this.events.unshift(...events);
      logger.error('Failed to send analytics', { error });
    }
  }

  /**
   * End current session
   */
  private endSession(): void {
    this.track('session_end', 'screen', {
      duration: Date.now() - this.sessionStart,
    });
    this.flush();
  }

  /**
   * Start new session
   */
  private startNewSession(): void {
    this.sessionId = this.generateSessionId();
    this.sessionStart = Date.now();
    this.lastActivity = Date.now();
    
    this.track('session_start', 'screen', {
      previousSession: this.sessionId,
    });
  }

  /**
   * Get device info
   */
  private getDeviceInfo(): DeviceInfo {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connection = (navigator as any).connection || 
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (navigator as any).mozConnection || 
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (navigator as any).webkitConnection;

    return {
      platform: navigator.platform,
      os: this.getOS(),
      browser: this.getBrowser(),
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      connectionType: connection?.effectiveType,
    };
  }

  /**
   * Get OS from user agent
   */
  private getOS(): string {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    if (/Win/.test(ua)) return 'Windows';
    if (/Mac/.test(ua)) return 'macOS';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Unknown';
  }

  /**
   * Get browser from user agent
   */
  private getBrowser(): string {
    const ua = navigator.userAgent;
    if (/Chrome/.test(ua)) return 'Chrome';
    if (/Safari/.test(ua)) return 'Safari';
    if (/Firefox/.test(ua)) return 'Firefox';
    if (/Edge/.test(ua)) return 'Edge';
    return 'Unknown';
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate event ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create analytics instance
 */
export function createMobileAnalytics(config?: Partial<AnalyticsConfig>): MobileAnalytics {
  return new MobileAnalytics(config);
}

// Export singleton
export const mobileAnalytics = new MobileAnalytics();

// Initialize if in browser
if (typeof window !== 'undefined') {
  mobileAnalytics.init();
}
