import { ReactNode, useEffect, useState } from 'react';
import { View, Text, Pressable, Switch, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { requestDataExport, requestAccountDeletion, cancelAccountDeletion } from '../../services/api';
import { supabase } from '../../lib/supabase';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

function Section({
  title,
  body,
  colors,
  children,
}: {
  title: string;
  body: string;
  colors: ThemeColors;
  children: ReactNode;
}) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 16, marginBottom: 8, color: colors.text }}>{title}</Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>{body}</Text>
      {children}
    </View>
  );
}

export default function DataRightsScreen() {
  const { colors } = useThemeColors();
  const [pendingDeletion, setPendingDeletion] = useState<string | null>(null);
  const [immediate, setImmediate] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id;
      if (!userId) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('delete_scheduled_for')
        .eq('id', userId)
        .maybeSingle();
      if (profile?.delete_scheduled_for) setPendingDeletion(profile.delete_scheduled_for);
    })();
  }, []);

  const onExport = async () => {
    setBusy(true);
    try {
      const r = await requestDataExport();
      Alert.alert('Export requested', `We'll email you a download link when it's ready (request ${r.requestId.slice(0, 8)}).`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    Alert.alert(
      'Delete account',
      immediate
        ? 'Your account will be deleted immediately. This cannot be undone.'
        : `Your account will be scheduled for deletion in ${gasConfig.compliance.accountDeletionGracePeriod.days} days. Log back in to cancel.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const r = await requestAccountDeletion({ immediate });
              setPendingDeletion(r.scheduled_for);
              Alert.alert('Deletion scheduled', r.immediate ? 'Account deleted.' : `Deletion scheduled for ${r.scheduled_for}.`);
              if (r.immediate) router.replace('/(auth)/login');
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const onCancel = async () => {
    setBusy(true);
    try {
      const r = await cancelAccountDeletion();
      if (r.cancelled) {
        setPendingDeletion(null);
        Alert.alert('Deletion cancelled');
      } else {
        Alert.alert('Could not cancel', r.reason ?? 'window expired');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '600', marginBottom: 16, color: colors.text }}>Your data rights</Text>

        <Section
          title="Export my data"
          body="Get a copy of everything we hold about you, delivered as a JSON file."
          colors={colors}
        >
          <Pressable
            onPress={onExport}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Request data export"
            accessibilityState={{ disabled: busy, busy }}
            style={{ padding: 12, backgroundColor: colors.primary, borderRadius: 6, opacity: busy ? 0.6 : 1 }}
          >
            <Text style={{ color: '#FFFFFF', textAlign: 'center', fontWeight: '600' }}>Request export</Text>
          </Pressable>
        </Section>

        {pendingDeletion ? (
          <View style={{ marginBottom: 24, padding: 12, backgroundColor: colors.warning + '22', borderRadius: 6 }}>
            <Text style={{ fontWeight: '600', marginBottom: 8, color: colors.text }}>Deletion scheduled</Text>
            <Text style={{ marginBottom: 12, color: colors.textSecondary }}>
              Your account will be deleted on {new Date(pendingDeletion).toLocaleString()}.
            </Text>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Cancel scheduled deletion"
              accessibilityState={{ disabled: busy, busy }}
              style={{ padding: 10, backgroundColor: colors.success, borderRadius: 6, opacity: busy ? 0.6 : 1 }}
            >
              <Text style={{ color: '#FFFFFF', textAlign: 'center', fontWeight: '600' }}>Cancel deletion</Text>
            </Pressable>
          </View>
        ) : (
          <Section
            title="Delete my account"
            body={`Schedule deletion. You'll have ${gasConfig.compliance.accountDeletionGracePeriod.days} days to change your mind.`}
            colors={colors}
          >
            {gasConfig.compliance.allowImmediateDeletion ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Switch value={immediate} onValueChange={setImmediate} />
                <Text style={{ marginLeft: 8, color: colors.text }}>Delete immediately (no grace period)</Text>
              </View>
            ) : null}
            <Pressable
              onPress={onDelete}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Delete my account"
              accessibilityState={{ disabled: busy, busy }}
              style={{ padding: 12, backgroundColor: colors.error, borderRadius: 6, opacity: busy ? 0.6 : 1 }}
            >
              <Text style={{ color: '#FFFFFF', textAlign: 'center', fontWeight: '600' }}>Delete my account</Text>
            </Pressable>
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
