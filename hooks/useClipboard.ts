/**
 * GAS Template, useClipboard Hook
 *
 * Copy/paste with auto-resetting "copied" indicator.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { copyToClipboard, getClipboard } from '../lib/clipboard';

export function useClipboard() {
  const [hasCopied, setHasCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const copy = useCallback(async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setHasCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setHasCopied(false), 2000);
    }
    return ok;
  }, []);

  const paste = useCallback(async () => {
    return getClipboard();
  }, []);

  return { copy, paste, hasCopied };
}
