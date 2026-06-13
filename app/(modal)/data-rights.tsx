import { ReactNode, useEffect, useState } from 'react';
import { View, Text, Pressable, Switch, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { requestDataExport, requestAccountDeletion, cancelAccountDeletion } from '../../services/api';
import { supabase } from '../../lib/supabase';
import { gasConfig } from '../../gas.config';

function Section({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 16, marginBottom: 8 }}>{title}</Text>
      <Text style={{ color: '#666', marginBottom: 12 }}>{body}</Text>
      {children}
    </View>
  );
}

export default function DataRightsScreen() {
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
              if (r.immediate) router.replace('/auth/login');
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
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '600', marginBottom: 16 }}>Your data rights</Text>

      <Section
        title="Export my data"
        body="Get a copy of everything we hold about you, delivered as a JSON file."
      >
        <Pressable onPress={onExport} disabled={busy} style={{ padding: 12, backgroundColor: '#222', borderRadius: 6 }}>
          <Text style={{ color: '#fff', textAlign: 'center' }}>Request export</Text>
        </Pressable>
      </Section>

      {pendingDeletion ? (
        <View style={{ marginBottom: 24, padding: 12, backgroundColor: '#fff4e5', borderRadius: 6 }}>
          <Text style={{ fontWeight: '600', marginBottom: 8 }}>Deletion scheduled</Text>
          <Text style={{ marginBottom: 12 }}>Your account will be deleted on {new Date(pendingDeletion).toLocaleString()}.</Text>
          <Pressable onPress={onCancel} disabled={busy} style={{ padding: 10, backgroundColor: '#0a7', borderRadius: 6 }}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>Cancel deletion</Text>
          </Pressable>
        </View>
      ) : (
        <Section
          title="Delete my account"
          body={`Schedule deletion. You'll have ${gasConfig.compliance.accountDeletionGracePeriod.days} days to change your mind.`}
        >
          {gasConfig.compliance.allowImmediateDeletion ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Switch value={immediate} onValueChange={setImmediate} />
              <Text style={{ marginLeft: 8 }}>Delete immediately (no grace period)</Text>
            </View>
          ) : null}
          <Pressable onPress={onDelete} disabled={busy} style={{ padding: 12, backgroundColor: '#c00', borderRadius: 6 }}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>Delete my account</Text>
          </Pressable>
        </Section>
      )}
    </ScrollView>
  );
}
