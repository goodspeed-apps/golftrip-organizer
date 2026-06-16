import { useEffect, useState } from 'react';
import { Platform, View, Text, Pressable } from 'react-native';
import { recordConsent } from '../lib/consent';
import { addBreadcrumb } from '../lib/sentry';

type Decision = 'accept_all' | 'reject_all' | 'not_required';
const STORAGE_KEY = 'privacy_consent_decision';
const STORAGE_TS_KEY = 'privacy_consent_decided_at';
const COUNTRY_KEY = 'privacy_consent_country';
const GEOIP_TIMEOUT_MS = 2000;

const EU_COUNTRIES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT',
  'LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
  'IS','LI','NO',  // EEA
  'GB',            // UK (post-Brexit but still applies UK GDPR)
  'CH',            // Switzerland (FADP)
]);

async function detectEU(): Promise<boolean> {
  // 1) Cloudflare header if served via CF (rendered into a meta tag by edge worker)
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="cf-ipcountry"]');
    const cc = meta?.getAttribute('content');
    if (cc) {
      const upper = cc.toUpperCase();
      if (typeof localStorage !== 'undefined') localStorage.setItem(COUNTRY_KEY, upper);
      return EU_COUNTRIES.has(upper);
    }
  }
  // 2) Cached country from a previous resolve, skip the external GeoIP call.
  if (typeof localStorage !== 'undefined') {
    const cached = localStorage.getItem(COUNTRY_KEY);
    if (cached) return EU_COUNTRIES.has(cached);
  }
  // 3) Free GeoIP fallback (ipapi.co), rate-limited, so cache the answer.
  try {
    const res = await fetch('https://ipapi.co/country/', { signal: AbortSignal.timeout(GEOIP_TIMEOUT_MS) });
    if (res.ok) {
      const cc = (await res.text()).trim().toUpperCase();
      if (typeof localStorage !== 'undefined' && cc) localStorage.setItem(COUNTRY_KEY, cc);
      return EU_COUNTRIES.has(cc);
    }
  } catch {
    // ignore, fall through to safer default
  }
  // 4) Default: require everywhere (safer than silently skipping)
  return true;
}

async function persistDecision(decision: Decision): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, decision);
    localStorage.setItem(STORAGE_TS_KEY, new Date().toISOString());
  }
  try {
    await recordConsent({ type: 'privacy_banner', consented: decision === 'accept_all' });
  } catch (e) {
    addBreadcrumb('privacy', `consent_record_failed: ${String(e)}`);
  }
}

export function PrivacyConsent({ appName = 'this app' }: { appName?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const prior = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (prior) return;
    detectEU().then((isEU) => {
      if (!isEU) {
        if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'not_required');
        return;
      }
      setVisible(true);
    });
  }, []);

  if (!visible || Platform.OS !== 'web') return null;

  const dismiss = async (d: Decision) => {
    await persistDecision(d);
    setVisible(false);
  };

  return (
    <View style={{
      position: 'absolute',
      bottom: 16, left: 16, right: 16,
      padding: 16,
      backgroundColor: 'rgba(0,0,0,0.92)',
      borderRadius: 8,
      zIndex: 9999,
    }}>
      <Text style={{ color: '#fff', marginBottom: 12 }}>
        We use cookies and similar technologies to operate {appName} and improve your experience.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Pressable
          onPress={() => dismiss('accept_all')}
          style={btnPrimary}
          accessibilityRole="button"
          accessibilityLabel="Accept all cookies"
        >
          <Text style={{ color: '#000' }}>Accept all</Text>
        </Pressable>
        <Pressable
          onPress={() => dismiss('reject_all')}
          style={btnSecondary}
          accessibilityRole="button"
          accessibilityLabel="Reject non-essential cookies"
        >
          <Text style={{ color: '#fff' }}>Reject non-essential</Text>
        </Pressable>
      </View>
    </View>
  );
}

const btnPrimary = {
  paddingVertical: 8,
  paddingHorizontal: 16,
  backgroundColor: '#fff',
  borderRadius: 4,
} as const;

const btnSecondary = {
  paddingVertical: 8,
  paddingHorizontal: 16,
  borderColor: '#fff',
  borderWidth: 1,
  borderRadius: 4,
} as const;