import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  message: string;
  type?: ToastType;
}

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: ToastState;
  showToast: (msg: ToastMessage | string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'info' });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((msg: ToastMessage | string, type?: ToastType) => {
    const message = typeof msg === 'string' ? msg : msg.message;
    const toastType: ToastType = typeof msg === 'string' ? (type ?? 'info') : (msg.type ?? type ?? 'info');

    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ visible: true, message, type: toastType });
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();

    timerRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      });
    }, 3000);
  }, [opacity]);

  return (
    <ToastContext.Provider value={{ toast, showToast }}>
      {children}
      {toast.visible && (
        <Animated.View style={[styles.container, { opacity }]}>
          <ToastView message={toast.message} type={toast.type} />
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

function ToastView({ message, type }: { message: string; type: ToastType }) {
  const { colors } = useThemeColors();
  const bg =
    type === 'success' ? colors.success :
    type === 'error' ? colors.error :
    type === 'warning' ? colors.warning :
    colors.primary;

  return (
    <View style={[styles.toast, { backgroundColor: bg }]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function Toast({ message, type = 'info' }: { message: string; type?: ToastType }) {
  const { colors } = useThemeColors();
  const bg =
    type === 'success' ? colors.success :
    type === 'error' ? colors.error :
    type === 'warning' ? colors.warning :
    colors.primary;

  return (
    <View style={[styles.toast, { backgroundColor: bg }]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Return a no-op implementation when used outside provider
    return {
      toast: { visible: false, message: '', type: 'info' },
      showToast: () => {},
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    maxWidth: 400,
    width: '100%',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
