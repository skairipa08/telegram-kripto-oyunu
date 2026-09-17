// apps/web/src/game/arcade-haptics.ts
// Telegram WebApp HapticFeedback integration with fallback for standard mobile browsers

interface TelegramHapticFeedback {
  impactOccurred: (
    style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft',
  ) => void;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged: () => void;
}

function getTelegramHaptic(): TelegramHapticFeedback | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    Telegram?: {
      WebApp?: {
        HapticFeedback?: TelegramHapticFeedback;
      };
    };
  };
  return win.Telegram?.WebApp?.HapticFeedback ?? null;
}

function fallbackVibrate(pattern: number | number[]): void {
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  ) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors
    }
  }
}

export function triggerImpact(
  style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light',
): void {
  const haptic = getTelegramHaptic();
  if (haptic && typeof haptic.impactOccurred === 'function') {
    try {
      haptic.impactOccurred(style);
      return;
    } catch {
      // Fallback below
    }
  }

  const durationMap: Record<string, number> = {
    light: 12,
    medium: 24,
    heavy: 45,
    rigid: 18,
    soft: 10,
  };
  fallbackVibrate(durationMap[style] ?? 15);
}

export function triggerNotification(
  type: 'error' | 'success' | 'warning' = 'success',
): void {
  const haptic = getTelegramHaptic();
  if (haptic && typeof haptic.notificationOccurred === 'function') {
    try {
      haptic.notificationOccurred(type);
      return;
    } catch {
      // Fallback below
    }
  }

  if (type === 'success') {
    fallbackVibrate([15, 40, 20]);
  } else if (type === 'error') {
    fallbackVibrate([50, 40, 50]);
  } else {
    fallbackVibrate([25, 30, 25]);
  }
}

export function triggerSelection(): void {
  const haptic = getTelegramHaptic();
  if (haptic && typeof haptic.selectionChanged === 'function') {
    try {
      haptic.selectionChanged();
      return;
    } catch {
      // Fallback
    }
  }
  fallbackVibrate(8);
}

// Convenience arcade actions
export function hapticTap(): void {
  triggerImpact('light');
}

export function hapticCrit(): void {
  triggerImpact('heavy');
}

export function hapticMerge(): void {
  triggerImpact('medium');
}

export function hapticSuccess(): void {
  triggerNotification('success');
}

export function hapticError(): void {
  triggerNotification('error');
}

export function hapticCrash(): void {
  triggerNotification('error');
}

export function triggerHaptic(
  type:
    | 'light'
    | 'medium'
    | 'heavy'
    | 'success'
    | 'error'
    | 'impact_light'
    | 'impact_medium'
    | 'impact_heavy'
    | 'notification_success'
    | 'notification_error' = 'light',
): void {
  if (type === 'success' || type === 'notification_success') {
    triggerNotification('success');
  } else if (type === 'error' || type === 'notification_error') {
    triggerNotification('error');
  } else if (type === 'impact_medium' || type === 'medium') {
    triggerImpact('medium');
  } else if (type === 'impact_heavy' || type === 'heavy') {
    triggerImpact('heavy');
  } else {
    triggerImpact('light');
  }
}
