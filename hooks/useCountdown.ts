/**
 * GAS Template, useCountdown Hook
 *
 * Countdown timer that supports absolute target date or relative seconds.
 */

import { useState, useEffect, useRef } from 'react';

export interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
}

export function useCountdown(target: Date | number): CountdownResult {
  const getRemaining = () => {
    if (typeof target === 'number') return target;
    return Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
  };

  const [totalSeconds, setTotalSeconds] = useState(getRemaining);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    setTotalSeconds(getRemaining());
    const interval = setInterval(() => {
      const remaining = typeof targetRef.current === 'number'
        ? (() => { targetRef.current = Math.max(0, (targetRef.current as number) - 1); return targetRef.current as number; })()
        : Math.max(0, Math.floor((targetRef.current.getTime() - Date.now()) / 1000));
      setTotalSeconds(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [typeof target === 'number' ? 'relative' : target.getTime()]);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, totalSeconds, isExpired: totalSeconds <= 0 };
}
