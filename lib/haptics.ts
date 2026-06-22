/**
 * GAS Template, Haptics
 *
 * Thin wrappers around expo-haptics for consistent haptic feedback.
 * All functions are no-ops on web.
 *
 * Dependencies: expo-haptics
 */

import { isWeb } from './platform';

// Conditionally import Haptics only on native
let Haptics: typeof import('expo-haptics') | null = null;
if (!isWeb) {
  try {
    Haptics = require('expo-haptics');
  } catch {
    // Module not available
  }
}

export function lightTap() {
  if (isWeb || !Haptics) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function mediumTap() {
  if (isWeb || !Haptics) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function heavyTap() {
  if (isWeb || !Haptics) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

export function successFeedback() {
  if (isWeb || !Haptics) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function errorFeedback() {
  if (isWeb || !Haptics) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export function selectionFeedback() {
  if (isWeb || !Haptics) return;
  Haptics.selectionAsync();
}
