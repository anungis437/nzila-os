/**
 * Push Notification Hook
 * 
 * Provides React hooks for managing push notification subscriptions
 */

import { useEffect, useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

export interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  subscription: PushSubscription | null;
  permission: NotificationPermission;
}

/**
 * Hook to manage push notification subscription
 */
export function usePushNotifications(): PushSubscriptionState & {
  subscribe: () => Promise<PushSubscription | null>;
  unsubscribe: () => Promise<void>;
  requestPermission: () => Promise<NotificationPermission>;
} {
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    subscription: null,
    permission: 'default',
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('PushManager' in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(prev => ({ ...prev, isSupported: false }));
      return;
    }

    // Check current permission
    const permission = Notification.permission;
    
    // Check for existing subscription
    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        setState(prev => ({
          ...prev,
          isSupported: true,
          isSubscribed: !!subscription,
          subscription,
          permission,
        }));
      } catch (error) {
        logger.error('Failed to check push subscription', error);
        setState(prev => ({ ...prev, isSupported: true, permission }));
      }
    };

    checkSubscription();
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined') return 'denied';
    
    const permission = await Notification.requestPermission();
    setState(prev => ({ ...prev, permission }));
    return permission;
  }, []);

  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    if (typeof window === 'undefined' || !('PushManager' in window)) {
      return null;
    }

    try {
      // Request permission first
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(prev => ({ ...prev, permission }));
        return null;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          // This would be your VAPID public key
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
        ) as BufferSource,
      });

      // Send to server
      await fetch('/api/mobile/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });

      setState(prev => ({
        ...prev,
        isSubscribed: true,
        subscription,
        permission: 'granted',
      }));

      return subscription;
    } catch (error) {
      logger.error('Failed to subscribe to push', error);
      return null;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!state.subscription) return;

    try {
      await state.subscription.unsubscribe();

      // Notify server
      await fetch('/api/mobile/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: state.subscription.endpoint }),
      });

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        subscription: null,
      }));
    } catch (error) {
      logger.error('Failed to unsubscribe', error);
    }
  }, [state.subscription]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    requestPermission,
  };
}

/**
 * Hook to request notification permission
 */
export function useNotificationPermission(): {
  permission: NotificationPermission;
  request: () => Promise<NotificationPermission>;
  isGranted: boolean;
  isDenied: boolean;
} {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermission(Notification.permission);
  }, []);

  const request = useCallback(async (): Promise<NotificationPermission> => {
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  return {
    permission,
    request,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
  };
}

/**
 * Hook to show local notifications
 */
export function useLocalNotifications() {
  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (typeof window === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    // Use service worker for better support
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          ...options,
        });
      });
    } else {
      // Fallback to standard notification
      new Notification(title, {
        icon: '/icons/icon-192x192.png',
        ...options,
      });
    }
  }, []);

  return { showNotification };
}

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
