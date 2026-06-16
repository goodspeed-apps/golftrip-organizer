/**
 * GAS Template, Settings Screen
 *
 * Full settings/profile screen that adapts to gasConfig feature flags.
 *
 * Sections (conditionally rendered based on gasConfig):
 * 1. Profile card, user name, email, subscription tier badge
 * 2. Appearance, theme toggle (dark/light/system) if darkMode.enabled
 * 3. Preferences, push notifications, biometric lock, CSV export
 * 4. Help, "How To Use" + reset help icon (if helpSystem enabled)
 * 5. Upgrade, paywall card for free-tier users (if inAppPurchases.enabled)
 * 6. Legal, Privacy Policy, Terms of Service, Data Export
 * 7. Account, Sign Out, Delete Account
 * 8. App version footer
 *
 * Uses the reusable SettingsRow and SectionHeader components for consistency.
 * The DevAgent customizes this screen by adding/removing sections as needed.
 *
 * Extracted from ThreadLift's profile.tsx, generalized and config-driven.
 *
 * Dependencies:
 *   hooks: useAuth, useAnalytics, useSubscription
 *   context: ThemeContext, HelpContext
 *   components: SettingsRow, SectionHeader
 *   libs: expo-store-review, expo-linking, gasConfig
 */

import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Bell,
  Shield,
  LogOut,
  Sun,
  Moon,
  Smartphone,
  BookOpen,
  HelpCircle,
  Star,
  Download,
  ExternalLink,
  FileText,
  Trash2,
} from 'lucide-react-native';
import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useSubscription } from '@/hooks/useSubscription';
import { trackScreenLoad } from '@/lib/performance';
import { addBreadcrumb, captureException } from '@/lib/sentry';
import { requestAccountDeletion } from '@/services/api';
import { useThemeColors } from '@/context/ThemeContext';
import { useHelp } from '@/context/HelpContext';
import { SettingsRow } from '@/components/ui/SettingsRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { gasConfig } from '../../gas.config';

// --- Config-driven feature flags ---
const {
  darkMode,
  pushNotifications,
  inAppPurchases,
  helpSystem: helpSystemEnabled,
  csvExport: csvExportEnabled,
  compliance,
} = gasConfig.features;
const biometricConfig = gasConfig.features.auth.biometric;
const primary = gasConfig.design.colors.primary;

// --- AsyncStorage key for notification preference ---
const NOTIF_KEY = `@${gasConfig.app.slug}:notifications_enabled`;

// --- Theme options ---
const THEME_OPTIONS: Array<{ value: 'dark' | 'light' | 'system'; label: string; icon: typeof Sun }> = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Smartphone },
];

/**
 * SettingsScreen, Main settings/profile tab.
 *
 * This screen reads gasConfig feature flags to conditionally render sections.
 * The DevAgent should:
 * - Add app-specific settings rows as needed
 * - Connect the "How To Use" flow to a custom HowToUseModal
 * - Add privacy policy and terms of service URLs
 * - Customize the upgrade section's feature list from gasConfig tiers
 */
export default function SettingsScreen() {
  // --- Hooks ---
  const { user, biometricAvailable, biometricEnabled, setBiometricPreference, signOut } = useAuth();
  const { track } = useAnalytics();
  const { tier, offerings, purchase, restore, isLoading: subLoading } = useSubscription();
  const { preference, colors, setTheme } = useThemeColors();
  const { dismissed, reset: resetHelp } = useHelp();

  // --- Local state ---
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  // --- Analytics: track screen view ---
  const screenStart = useRef(Date.now());
  useEffect(() => {
    track('settings_screen_view');
    trackScreenLoad('settings', screenStart.current);
  }, []);

  // --- Load notification preference ---
  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then(val => {
      if (val !== null) setNotificationsEnabled(val === 'true');
    });
  }, []);

  const handleToggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    await AsyncStorage.setItem(NOTIF_KEY, String(val));
    track('toggle_notifications', { enabled: val });
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          addBreadcrumb('user_sign_out', 'auth');
          await signOut();
        }
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              addBreadcrumb('delete_account_requested', 'account');
              await requestAccountDeletion();
              await signOut();
            } catch (e) {
              captureException(e as Error, { action: 'delete_account' });
              Alert.alert('Error', 'Could not delete account. Please contact support.');
            }
          }
        },
      ]
    );
  };

  const handleStoreReview = async () => {
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
      track('store_review_requested');
    }
  };

  // Get legal URLs from compliance config if available
  const privacyUrl = (compliance as { privacyPolicyUrl?: string } | undefined)?.privacyPolicyUrl ?? '';
  const termsUrl = (compliance as { termsOfServiceUrl?: string } | undefined)?.termsOfServiceUrl ?? '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>Settings</Text>
        </View>

        {/* Profile Section */}
        <SectionHeader title="Profile" />
        <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryMuted, justifyContent: 'center', alignItems: 'center' }}>
              <User size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{user?.email ?? 'User'}</Text>
              <View style={{ marginTop: 4, backgroundColor: tier === 'pro' ? colors.primary : colors.border, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: tier === 'pro' ? '#fff' : colors.textSecondary, textTransform: 'uppercase' }}>{tier ?? 'free'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Appearance */}
        {darkMode?.enabled && (
          <>
            <SectionHeader title="Appearance" />
            <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', padding: 12, gap: 8 }}>
                {THEME_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setTheme(opt.value)}
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      paddingVertical: 10, borderRadius: 8,
                      backgroundColor: preference === opt.value ? colors.primary : colors.background,
                    }}
                  >
                    <opt.icon size={16} color={preference === opt.value ? '#fff' : colors.textSecondary} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: preference === opt.value ? '#fff' : colors.textSecondary }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Preferences */}
        <SectionHeader title="Preferences" />
        <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' }}>
          {pushNotifications?.enabled && (
            <SettingsRow
              icon={<Bell size={20} color={colors.primary} />}
              label="Push Notifications"
              toggle={{ value: notificationsEnabled, onToggle: handleToggleNotifications }}
            />
          )}
          {biometricConfig?.enabled && biometricAvailable && (
            <SettingsRow
              icon={<Shield size={20} color={colors.primary} />}
              label="Biometric Lock"
              toggle={{ value: !!biometricEnabled, onToggle: (v) => setBiometricPreference(v) }}
            />
          )}
          {csvExportEnabled && (
            <SettingsRow
              icon={<Download size={20} color={colors.primary} />}
              label="Export My Data (CSV)"
              onPress={() => track('tap_csv_export')}
              chevron
            />
          )}
          <SettingsRow
            icon={<Star size={20} color={colors.primary} />}
            label="Rate the App"
            onPress={handleStoreReview}
            chevron
          />
        </View>

        {/* Help */}
        {helpSystemEnabled && (
          <>
            <SectionHeader title="Help" />
            <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' }}>
              <SettingsRow
                icon={<BookOpen size={20} color={colors.primary} />}
                label="How To Use"
                onPress={() => track('tap_how_to_use')}
                chevron
              />
              <SettingsRow
                icon={<HelpCircle size={20} color={colors.primary} />}
                label={`Reset Help Tips (${dismissed} dismissed)`}
                onPress={resetHelp}
              />
            </View>
          </>
        )}

        {/* Upgrade */}
        {inAppPurchases?.enabled && tier !== 'pro' && (
          <>
            <SectionHeader title="Upgrade" />
            <View style={{ marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.primaryMuted, padding: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary, marginBottom: 4 }}>Go Pro 🏌️</Text>
              <Text style={{ fontSize: 14, color: colors.text, marginBottom: 12 }}>Unlock unlimited trips, score history, and more.</Text>
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
                onPress={async () => {
                  if (!offerings?.current) return;
                  setPurchasing(true);
                  try { await purchase(offerings.current.availablePackages[0]); }
                  catch {}
                  finally { setPurchasing(false); }
                }}
                disabled={subLoading || purchasing}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{purchasing ? 'Processing…' : 'Upgrade Now'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => restore()} style={{ marginTop: 8, alignItems: 'center' }}>
                <Text style={{ color: colors.primary, fontSize: 13 }}>Restore Purchase</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Legal */}
        <SectionHeader title="Legal" />
        <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' }}>
          {privacyUrl ? (
            <SettingsRow
              icon={<FileText size={20} color={colors.primary} />}
              label="Privacy Policy"
              onPress={() => Linking.openURL(privacyUrl)}
              chevron
            />
          ) : null}
          {termsUrl ? (
            <SettingsRow
              icon={<FileText size={20} color={colors.primary} />}
              label="Terms of Service"
              onPress={() => Linking.openURL(termsUrl)}
              chevron
            />
          ) : null}
          <SettingsRow
            icon={<ExternalLink size={20} color={colors.primary} />}
            label="Data Export Request"
            onPress={() => track('tap_data_export')}
            chevron
          />
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' }}>
          <SettingsRow
            icon={<LogOut size={20} color={colors.error ?? '#EF4444'} />}
            label="Sign Out"
            onPress={handleSignOut}
            labelStyle={{ color: colors.error ?? '#EF4444' }}
          />
          <SettingsRow
            icon={<Trash2 size={20} color={colors.error ?? '#EF4444'} />}
            label="Delete Account"
            onPress={handleDeleteAccount}
            labelStyle={{ color: colors.error ?? '#EF4444' }}
          />
        </View>

        {/* Footer */}
        <Text style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: colors.textSecondary }}>
          {gasConfig.app.name} v{gasConfig.app.version}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
