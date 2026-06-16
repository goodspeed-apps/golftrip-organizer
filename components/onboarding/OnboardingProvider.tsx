import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getCurrentUserId } from '../../lib/supabase';

interface OnboardingState {
  current: number;
  total: number;
  next: () => void;
  prev: () => void;
  skip: () => Promise<void>;
  complete: () => Promise<void>;
  isComplete: boolean;
}

const ONBOARDED_AT_KEY = 'onboarded_at';

const OnboardingContext = createContext<OnboardingState | null>(null);

async function readLocalOnboardedAt(): Promise<string | null> {
  try { return await AsyncStorage.getItem(ONBOARDED_AT_KEY); } catch { return null; }
}

async function writeLocalOnboardedAt(value: string): Promise<void> {
  try { await AsyncStorage.setItem(ONBOARDED_AT_KEY, value); } catch { /* ignore */ }
}

export function OnboardingProvider({ steps, onComplete, children }: { steps: number; onComplete?: () => void; children: ReactNode }) {
  const [current, setCurrent] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await readLocalOnboardedAt();
      if (local && !cancelled) {
        setIsComplete(true);
      }
      const userId = await getCurrentUserId();
      if (!userId || cancelled) return;

      // Read the server-side value once so we can do bidirectional sync
      // without writing the profile every single mount.
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarded_at')
        .eq('id', userId)
        .maybeSingle();
      const remote: string | null = profile?.onboarded_at ?? null;

      if (local && !remote) {
        // Push local up to the server (the original sync direction).
        await supabase.from('profiles').update({ onboarded_at: local }).eq('id', userId);
      } else if (!local && remote) {
        // Seed local from the server so a fresh device install respects an
        // already-onboarded account and doesn't re-show the flow.
        await writeLocalOnboardedAt(remote);
        if (!cancelled) setIsComplete(true);
      }
      // Otherwise (both set, or neither set) there's nothing to write.
    })();
    return () => { cancelled = true; };
  }, []);

  const persistOnboarded = async () => {
    const ts = new Date().toISOString();
    await writeLocalOnboardedAt(ts);
    const userId = await getCurrentUserId();
    if (userId) {
      await supabase.from('profiles').update({ onboarded_at: ts }).eq('id', userId);
    }
  };

  const finish = async () => {
    setIsComplete(true);
    await persistOnboarded();
    onComplete?.();
  };

  return (
    <OnboardingContext.Provider value={{
      current,
      total: steps,
      next: () => setCurrent(c => Math.min(c + 1, steps - 1)),
      prev: () => setCurrent(c => Math.max(c - 1, 0)),
      skip: finish,
      complete: finish,
      isComplete,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingState {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}
