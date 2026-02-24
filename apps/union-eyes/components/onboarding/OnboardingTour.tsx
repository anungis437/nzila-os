/**
 * Onboarding Tour System
 * 
 * Provides interactive product tours to guide new users through key features.
 * Built with driver.js (lightweight alternative to Intro.js)
 * 
 * Usage:
 * ```tsx
 * import { OnboardingTour, tourSteps } from '@/components/onboarding';
 * 
 * <OnboardingTour steps={tourSteps.claimsManagement} />
 * ```
 */

'use client';

import { useEffect, useState } from 'react';
import { driver, type Driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Button } from '@/components/ui/button';
import { X, HelpCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

export interface TourStep extends DriveStep {
  element: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
  };
}

export interface OnboardingTourProps {
  /**
   * Unique identifier for this tour
   */
  tourId: string;

  /**
   * Tour steps
   */
  steps: TourStep[];

  /**
   * Show tour automatically on mount
   */
  autoStart?: boolean;

  /**
   * Skip tour if user has seen it before
   */
  skipIfSeen?: boolean;

  /**
   * Callback when tour is completed
   */
  onComplete?: () => void;

  /**
   * Callback when tour is skipped
   */
  onSkip?: () => void;
}

/**
 * Onboarding Tour Component
 */
export function OnboardingTour({
  tourId,
  steps,
  autoStart = false,
  skipIfSeen = true,
  onComplete,
  onSkip,
}: OnboardingTourProps) {
  const [driverInstance, setDriverInstance] = useState<Driver | null>(null);
  const [isVisible, setIsVisible] = useState(!skipIfSeen);

  useEffect(() => {
    // Check if user has seen this tour
    if (skipIfSeen && hasSeenTour(tourId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(false);
      return;
    }

    // Initialize driver
    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      steps,
      onDestroyStarted: () => {
        if (driverObj.hasNextStep()) {
          // User clicked close before completing
          markTourAsSkipped(tourId);
          onSkip?.();
        } else {
          // User completed the tour
          markTourAsSeen(tourId);
          onComplete?.();
        }
        driverObj.destroy();
      },
    });

    setDriverInstance(driverObj);

    // Auto-start if requested
    if (autoStart) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        driverObj.drive();
      }, 500);
    }

    return () => {
      driverObj.destroy();
    };
  }, [tourId, steps, autoStart, skipIfSeen, onComplete, onSkip]);

  const startTour = () => {
    driverInstance?.drive();
    logger.info('Onboarding tour started', { tourId });
  };

  const dismissTour = () => {
    setIsVisible(false);
    markTourAsSkipped(tourId);
    onSkip?.();
    logger.info('Onboarding tour dismissed', { tourId });
  };

  if (!isVisible || autoStart) {
    return null;
  }

  // Prompt to start tour
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-white p-4 shadow-lg dark:bg-gray-800">
      <button
        onClick={dismissTour}
        className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
        aria-label="Dismiss tour"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="mb-3 flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-blue-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Take a Quick Tour
        </h3>
      </div>
      
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
        Learn how to use this feature in just a few steps.
      </p>
      
      <div className="flex gap-2">
        <Button onClick={startTour} size="sm" className="flex-1">
          Start Tour
        </Button>
        <Button onClick={dismissTour} variant="outline" size="sm">
          Skip
        </Button>
      </div>
    </div>
  );
}

/**
 * Helper to check if user has seen a tour
 */
function hasSeenTour(tourId: string): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const seen = localStorage.getItem(`tour_seen_${tourId}`);
    return seen === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark tour as seen (completed)
 */
function markTourAsSeen(tourId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(`tour_seen_${tourId}`, 'true');
    localStorage.setItem(`tour_completed_${tourId}`, new Date().toISOString());
  } catch (error) {
    logger.error('Failed to save tour state', { tourId, error });
  }
}

/**
 * Mark tour as skipped
 */
function markTourAsSkipped(tourId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(`tour_seen_${tourId}`, 'true');
    localStorage.setItem(`tour_skipped_${tourId}`, new Date().toISOString());
  } catch (error) {
    logger.error('Failed to save tour state', { tourId, error });
  }
}

/**
 * Reset tour (for testing or re-showing)
 */
export function resetTour(tourId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(`tour_seen_${tourId}`);
    localStorage.removeItem(`tour_completed_${tourId}`);
    localStorage.removeItem(`tour_skipped_${tourId}`);
  } catch (error) {
    logger.error('Failed to reset tour', { tourId, error });
  }
}

/**
 * Reset all tours
 */
export function resetAllTours(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('tour_')) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    logger.error('Failed to reset all tours', { error });
  }
}

