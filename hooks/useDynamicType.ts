import { useEffect, useState } from 'react';
import { Platform, PixelRatio, AccessibilityInfo } from 'react-native';

export function useDynamicType(): number {
  const [scale, setScale] = useState<number>(() => {
    if (Platform.OS === 'web') return 1;
    return PixelRatio.getFontScale();
  });

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AccessibilityInfo.addEventListener?.('change', () => {
      setScale(PixelRatio.getFontScale());
    });
    return () => { sub?.remove?.(); };
  }, []);

  return scale;
}