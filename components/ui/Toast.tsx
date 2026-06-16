/**
 * GAS Template, Toast / Snackbar Notification System
 *
 * Unified toast system using react-native-reanimated for smooth animations.
 *
 * Features:
 * - Four toast types: success, error, warning, info
 * - Auto-dismiss with configurable duration (default 3.5s)
 * - Queue management (max 3 visible simultaneously)
 * - Optional action button per toast
 * - Animated slide-in via react-native-reanimated
 * - Theme-aware colors from gasConfig
 * - Safe area aware (renders below status bar)
 * - Accessibility: accessibilityLiveRegion="polite"
 * - Analytics: tracks error toasts only
 *
 * Dependencies: react-native-reanimated, gasConfig, lib/posthog
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react-native';
import { captureEvent } from '@/lib/posthog';
import { gasConfig } from '../../gas.config';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  action?: ToastAction;
}

export interface ToastContextValue {
  /** Show a toast notification */
  show: (type: ToastType, message: string, options?: { duration?: number; action?: ToastAction }) => void;
  /** Shorthand: show a success toast */
  success: (message: string) => void;
  /** Shorthand: show an error toast */
  error: (message: string) => void;
  /** Shorthand: show a warning toast */
  warning: (message: string) => void;
  /** Shorthand: show an info toast */
  info: (message: string) => void;
/** Backward-compatible showToast (type, message, duration) */
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  /**
   * Current/most-recent toast. ALWAYS a non-null object so screens that read
   * `toast.message` / `toast.visible` / `toast.type` for an inline <Toast/> never
   * crash on a null deref. `visible` is false (and the fields are empty) when no
   * toast is queued, which is the normal state on every screen mount.
   */
  toast: ToastItem & { visible: boolean };
}

// ─── Color mapping ───────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

function getToastColors(type: ToastType) {
  const c = gasConfig.design.colors;
  switch (type) {
    case 'success': return { bg: c.success + '18', border: c.success + '40', text: c.success };
    case 'error': return { bg: c.error + '18', border: c.error + '40', text: c.error };
    case 'warning': return { bg: c.warning + '18', border: c.warning + '40', text: c.warning };
    case 'info':
    default: return { bg: c.primary + '18', border: c.primary + '40', text: c.primary };
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 3500;

// ─── Toast View ──────────────────────────────────────────────────────────────

function ToastView({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const { bg, border, text } = getToastColors(item.type);
  const Icon = ICONS[item.type];

  // Auto-dismiss timer
  React.useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(18).stiffness(200)}
      exiting={SlideOutUp.duration(200)}
      accessibilityRole="alert"
      accessibilityLabel={`${item.type}: ${item.message}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: bg,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: border,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
      accessibilityLiveRegion="polite"
    >
      <Icon size={18} color={text} />
      <Text style={{ flex: 1, color: text, fontSize: 14, fontWeight: '600' }} numberOfLines={2}>
        {item.message}
      </Text>
      {item.action && (
        <TouchableOpacity
          onPress={item.action.onPress}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
          accessibilityRole="button"
          accessibilityLabel={item.action.label}
        >
          <Text style={{ color: text, fontSize: 13, fontWeight: '700' }}>
            {item.action.label}
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={() => onDismiss(item.id)}
        style={{ padding: 4 }}
        hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
      >
        <X size={14} color={text} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────

function generateToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * ToastProvider, Wrap your app's root layout to enable toast notifications.
 *
 * Place inside SafeAreaProvider but outside navigation:
 *   <SafeAreaProvider>
 *     <ToastProvider>
 *       <ThemeProvider><Stack /></ThemeProvider>
 *     </ToastProvider>
 *   </SafeAreaProvider>
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((
    type: ToastType,
    message: string,
    options?: { duration?: number; action?: ToastAction }
  ) => {
    const id = generateToastId();
    const item: ToastItem = {
      id,
      type,
      message,
      duration: options?.duration ?? DEFAULT_DURATION,
      action: options?.action,
    };

    if (type === 'error') {
      captureEvent('toast_shown', { type, message: message.slice(0, 100) });
    }

    setToasts(prev => {
      const next = [...prev, item];
      return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
    });
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration?: number) => {
      show(type, message, { duration });
    },
    [show],
  );

const value: ToastContextValue = {
    show,
    showToast,
    success: useCallback((msg: string) => show('success', msg), [show]),
    error: useCallback((msg: string) => show('error', msg), [show]),
    warning: useCallback((msg: string) => show('warning', msg), [show]),
    info: useCallback((msg: string) => show('info', msg), [show]),
    toast: toasts[0]
      ? { ...toasts[0], visible: true }
      : { id: '', type: 'info', message: '', duration: 0, visible: false },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 16,
          right: 16,
          zIndex: 9999,
          gap: 8,
        }}
        pointerEvents="box-none"
      >
        {toasts.map(t => (
          <ToastView key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useToast, Access the toast notification system.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Saved!');
 *   toast.error('Something went wrong');
 *   toast.show('warning', 'Low storage', { duration: 5000, action: { label: 'Fix', onPress: fix } });
 *   toast.showToast('Hello', 'info');  // backward-compatible API
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

/**
 * Toast, inline placeholder component.
 *
 * Toasts are rendered globally by <ToastProvider> (mounted once at the app
 * root), and triggered imperatively via useToast().show()/showToast(). Some
 * screens additionally render <Toast {...} /> inline; without an export here
 * that import resolves to `undefined`, and rendering it throws
 * "Cannot read property 'displayName' of undefined". This no-op satisfies that
 * usage without double-rendering, the provider remains the single source of
 * toast UI. Accepts and ignores any props (e.g. {...toast} or config={...}).
 */
export function Toast(_props?: Record<string, unknown>): null {
  return null;
}
