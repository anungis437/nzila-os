/**
 * Service Worker Registration Hook
 * 
 * Provides React hooks and utilities for PWA service worker management
 */

import { useEffect, useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

export interface ServiceWorkerState {
  isSupported: boolean;
  isReady: boolean;
  isUpdated: boolean;
  registration: ServiceWorkerRegistration | null;
  waitingWorker: ServiceWorker | null;
  updateAvailable: boolean;
}

/**
 * Hook to manage service worker registration and updates
 */
export function useServiceWorker(): ServiceWorkerState {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isReady: false,
    isUpdated: false,
    registration: null,
    waitingWorker: null,
    updateAvailable: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(prev => ({ ...prev, isSupported: false }));
      return;
    }

    setState(prev => ({ ...prev, isSupported: true }));

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
        });

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setState(prev => ({ 
                  ...prev, 
                  updateAvailable: true,
                  waitingWorker: newWorker 
                }));
              }
            });
          }
        });

        // Wait for ready
        const _readyRegistration = await navigator.serviceWorker.ready;

        setState(prev => ({
          ...prev,
          registration,
          isReady: true,
        }));
      } catch (error) {
        logger.error('Service worker registration failed', error);
      }
    };

    registerSW();
  }, []);

  return state;
}

/**
 * Hook to check if app is running as installed PWA
 */
export function usePWAInstall(): {
  isStandalone: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  install: () => Promise<void>;
} {
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running in standalone mode
    const _isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (window.navigator as any).standalone === true;

    // Check if can install
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (deferredPrompt as any).prompt();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { outcome } = await (deferredPrompt as any).userChoice;
    
    if (outcome === 'accepted') {
      setCanInstall(false);
    }
    
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    isStandalone: typeof window !== 'undefined' && 
      (window.matchMedia('(display-mode: standalone)').matches ||
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       (window.navigator as any).standalone === true),
    isInstalled: typeof window !== 'undefined' && 
      window.matchMedia('(display-mode: standalone)').matches,
    canInstall,
    install,
  };
}

/**
 * Hook to track online/offline status
 */
export function useNetworkStatus(): {
  isOnline: boolean;
  isOffline: boolean;
  connectionType: string | null;
} {
  const [status, setStatus] = useState({
    isOnline: true,
    isOffline: false,
    connectionType: null as string | null,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateStatus = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connection = (navigator as any).connection || 
                       // eslint-disable-next-line @typescript-eslint/no-explicit-any
                       (navigator as any).mozConnection || 
                       // eslint-disable-next-line @typescript-eslint/no-explicit-any
                       (navigator as any).webkitConnection;
      
      setStatus({
        isOnline: navigator.onLine,
        isOffline: !navigator.onLine,
        connectionType: connection?.effectiveType || null,
      });
    };

    updateStatus();

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    // Listen for connection changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateStatus);
    }

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      if (connection) {
        connection.removeEventListener('change', updateStatus);
      }
    };
  }, []);

  return status;
}

/**
 * Hook to get device information
 */
export function useDeviceInfo(): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  os: string;
  browser: string;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
} {
  const [info, setInfo] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    os: 'unknown',
    browser: 'unknown',
    screenWidth: 0,
    screenHeight: 0,
    pixelRatio: 1,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isTablet = /iPad|Android/i.test(ua) && !/Mobile/i.test(ua);

    let os = 'unknown';
    if (/iPhone/i.test(ua)) os = 'iOS';
    else if (/iPad/i.test(ua)) os = 'iPadOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Win/i.test(ua)) os = 'Windows';
    else if (/Mac/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = 'unknown';
    if (/Chrome/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua)) browser = 'Safari';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Edge/i.test(ua)) browser = 'Edge';

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInfo({
      isMobile,
      isTablet,
      isDesktop: !isMobile && !isTablet,
      os,
      browser,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      pixelRatio: window.devicePixelRatio || 1,
    });
  }, []);

  return info;
}
