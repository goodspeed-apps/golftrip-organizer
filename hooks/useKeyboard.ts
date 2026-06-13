/**
 * GAS Template, useKeyboard
 *
 * Keyboard visibility + height tracking with platform-aware events.
 * Provides a dismiss() helper for programmatic keyboard dismissal.
 *
 * Dependencies: react-native Keyboard API
 */

import { useState, useEffect, useCallback } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboard() {
  const [visible, setVisible] = useState(false);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setVisible(true);
      setHeight(e.endCoordinates.height);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setVisible(false);
      setHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const dismiss = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  return { visible, height, dismiss };
}
