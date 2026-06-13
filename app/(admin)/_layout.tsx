import { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { requireAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';

export default function AdminLayout() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  // Hold the subscription in a ref so the cleanup runs unconditionally,
  // including when the component unmounts before the session arrives.
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Wait for auth hydration: if the session isn't restored yet, querying
      // profiles returns no row and a real admin would be redirected away.
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (cancelled || !session) return;
          const ok = await requireAdmin();
          if (!cancelled) setAllowed(ok);
        });
        subRef.current = sub.subscription;
        return;
      }
      const ok = await requireAdmin();
      if (!cancelled) setAllowed(ok);
    })();
    return () => {
      cancelled = true;
      subRef.current?.unsubscribe();
      subRef.current = null;
    };
  }, []);

  if (allowed === null) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>;
  }
  if (!allowed) return null;
  return <Stack screenOptions={{ title: 'Admin' }} />;
}
