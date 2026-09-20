import { useEffect, useRef, useState } from "react";

export interface UseTrackpadBackOptions {
  /** Callback fired when swipe back completes successfully */
  onBack: () => void;
  /** Whether the gesture detection is active */
  enabled?: boolean;
  /** Cumulative deltaX threshold to trigger back navigation (default: 135) */
  threshold?: number;
}

export interface UseTrackpadBackResult {
  /** Gesture progress from 0 (start) to 1 (threshold reached) */
  progress: number;
  /** True when progress >= 1 and navigation is triggered */
  isTriggered: boolean;
  /** True while the user is actively swiping */
  isSwiping: boolean;
}

function isInsideHorizontallyScrollable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  let curr: HTMLElement | null = target;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    const style = window.getComputedStyle(curr);
    const overflowX = style.overflowX;
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      curr.scrollWidth > curr.clientWidth &&
      curr.scrollLeft > 0
    ) {
      return true;
    }
    curr = curr.parentElement;
  }
  return false;
}

export function useTrackpadBack({
  onBack,
  enabled = true,
  threshold = 135,
}: UseTrackpadBackOptions): UseTrackpadBackResult {
  const [progress, setProgress] = useState(0);
  const [isTriggered, setIsTriggered] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const accumulatedRef = useRef(0);
  const isGestureActiveRef = useRef(false);
  const hasTriggeredRef = useRef(false);
  const isCoolingDownRef = useRef(false);

  const resetTimeoutRef = useRef<number | null>(null);
  const cooldownTimeoutRef = useRef<number | null>(null);
  const commitTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset all internal state and timers whenever enabled changes
    accumulatedRef.current = 0;
    isGestureActiveRef.current = false;
    hasTriggeredRef.current = false;
    isCoolingDownRef.current = false;

    if (resetTimeoutRef.current) window.clearTimeout(resetTimeoutRef.current);
    if (cooldownTimeoutRef.current) window.clearTimeout(cooldownTimeoutRef.current);
    if (commitTimeoutRef.current) window.clearTimeout(commitTimeoutRef.current);

    if (!enabled) {
      setProgress(0);
      setIsTriggered(false);
      setIsSwiping(false);
      return;
    }

    const resetState = () => {
      accumulatedRef.current = 0;
      isGestureActiveRef.current = false;
      hasTriggeredRef.current = false;
      setProgress(0);
      setIsTriggered(false);
      setIsSwiping(false);
    };

    const handleWheel = (e: WheelEvent) => {
      const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);

      // ALWAYS prevent default on horizontal wheel events outside horizontally scrollable elements.
      // This completely stops WKWebView/browser from rubber-banding or trying to shift the UI sideways!
      if (isHorizontal && !isInsideHorizontallyScrollable(e.target)) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }

      // If we are currently cooling down after a successful trigger, absorb residual trackpad momentum
      if (isCoolingDownRef.current) {
        return;
      }

      // Swipe right on macOS trackpad produces negative deltaX
      const swipeDelta = -e.deltaX;

      // Start gesture if not active
      if (!isGestureActiveRef.current) {
        // Must be a deliberate horizontal swipe to the right
        if (swipeDelta <= 2) return;
        if (!isHorizontal) return;
        if (document.querySelector('[role="dialog"]')) return;
        if (isInsideHorizontallyScrollable(e.target)) return;

        isGestureActiveRef.current = true;
        accumulatedRef.current = 0;
        hasTriggeredRef.current = false;
        setIsSwiping(true);
      }

      // While gesture is active, accumulate swipe movement
      if (isGestureActiveRef.current && !hasTriggeredRef.current) {
        accumulatedRef.current = Math.max(0, accumulatedRef.current + swipeDelta);

        const currentProgress = Math.min(1, Math.max(0, accumulatedRef.current / threshold));
        setProgress(currentProgress);

        // THRESHOLD REACHED: Complete the circle and give a crisp 110ms confirmation before navigating
        if (accumulatedRef.current >= threshold) {
          hasTriggeredRef.current = true;
          setIsTriggered(true);
          setProgress(1);

          // Brief pause (110ms) so user visually sees the 100% filled circle and pulse
          commitTimeoutRef.current = window.setTimeout(() => {
            onBackRef.current();

            // Enter cooldown to absorb residual trackpad momentum
            isCoolingDownRef.current = true;
            if (cooldownTimeoutRef.current) {
              window.clearTimeout(cooldownTimeoutRef.current);
            }
            cooldownTimeoutRef.current = window.setTimeout(() => {
              isCoolingDownRef.current = false;
              hasTriggeredRef.current = false;
            }, 400);

            resetState();
          }, 110);

          return;
        }

        // If not triggered yet, reset if user stops or reverses gesture
        if (resetTimeoutRef.current) {
          window.clearTimeout(resetTimeoutRef.current);
        }
        resetTimeoutRef.current = window.setTimeout(resetState, 120);
      }
    };

    // Support browser back button on 5-button mice
    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 3) {
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        onBackRef.current();
      }
    };

    // Support Cmd + [ (macOS) and Alt + ArrowLeft (cross-platform)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (document.querySelector('[role="dialog"]')) return;

      const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
      const isBackShortcut =
        (isMac && e.metaKey && e.key === "[") ||
        e.key === "BrowserBack" ||
        (e.altKey && e.key === "ArrowLeft");

      if (isBackShortcut) {
        e.preventDefault();
        onBackRef.current();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("auxclick", handleAuxClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("auxclick", handleAuxClick);
      window.removeEventListener("keydown", handleKeyDown);

      if (resetTimeoutRef.current) window.clearTimeout(resetTimeoutRef.current);
      if (cooldownTimeoutRef.current) window.clearTimeout(cooldownTimeoutRef.current);
      if (commitTimeoutRef.current) window.clearTimeout(commitTimeoutRef.current);

      isCoolingDownRef.current = false;
      hasTriggeredRef.current = false;
      isGestureActiveRef.current = false;
      accumulatedRef.current = 0;
    };
  }, [enabled, threshold]);

  return {
    progress,
    isTriggered,
    isSwiping,
  };
}
