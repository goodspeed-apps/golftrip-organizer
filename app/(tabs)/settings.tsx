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

// Cast gasConfig to access optional legal URLs that may not be in the type definition
const gasConfigAny = gasConfig as typeof gasConfig & {
  legal?: { privacyPolicyUrl?: string; termsOfServiceUrl?: string };
};

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
    AsyncStorage.getItem(NOTIF_KEY).then((val) => {
      if (val !== null) setNotificationsEnabled(val === 'true');
    });
  }, []);

  const handleToggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    await AsyncStorage.setItem(NOTIF_KEY, String(val));
    track('toggle_notifications', { enabled: val });
  };

  const handleToggleBiometric = async (val: boolean) => {
    try {
      await setBiometricPreference(val);
      track('toggle_biometric', { enabled: val });
    } catch (e) {
      captureException(e as Error, { screen: 'settings', action: 'toggleBiometric' });
    }
  };

  const handleThemeChange = (theme: 'dark' | 'light' | 'system') => {
    setTheme(theme);
    track('change_theme', { theme });
  };

  const handleRateApp = async () => {
    track('tap_rate_app');
    const available = await StoreReview.isAvailableAsync();
    if (available) {
      await StoreReview.requestReview();
    } else {
      Linking.openURL(
        `https://apps.apple.com/app/id${gasConfig.app.slug}`
      );
    }
  };

  const handleCsvExport = () => {
    track('tap_csv_export');
    Alert.alert('Export Data', 'Your data export will be emailed to you within 24 hours.');
  };

  const handleHowToUse = () => {
    track('tap_how_to_use');
    // Navigate to how-to-use modal
  };

  const handleResetHelp = () => {
    resetHelp();
    track('reset_help_tooltips');
  };

  const handleUpgrade = async () => {
    if (!offerings) return;
    setPurchasing(true);
    try {
      await purchase(offerings);
      track('purchase_success', { screen: 'settings' });
    } catch (e) {
      captureException(e as Error, { screen: 'settings', action: 'purchase' });
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
      track('restore_purchases');
    } catch (e) {
      captureException(e as Error, { screen: 'settings', action: 'restore' });
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          track('sign_out');
          addBreadcrumb('User signed out', 'auth');
          await signOut();
        }
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              track('delete_account');
              addBreadcrumb('User requested account deletion', 'auth');
              await requestAccountDeletion(user?.id ?? '');
              await signOut();
            } catch (e) {
              captureException(e as Error, { screen: 'settings', action: 'deleteAccount' });
              Alert.alert('Error', 'Could not delete account. Please contact support.');
            }
          }
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>Settings</Text>
        </View>

        {/* Profile Card */}
        <View style={{ marginHorizontal: 16, marginBottom: 24, backgroundColor: colors.surface, borderRadius: 16, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryMuted, justifyContent: 'center', alignItems: 'center' }}>
              <User size={24} color={primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>{user?.user_metadata?.display_name ?? 'Golfer'}</Text>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>{user?.email}</Text>
            </View>
            {tier && tier !== 'free' && (
              <View style={{ backgroundColor: primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>{tier}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Appearance */}
        {darkMode?.enabled && (
          <View style={{ marginBottom: 24 }}>
            <SectionHeader title="Appearance" />
            <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', padding: 12, gap: 8 }}>
                {THEME_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = preference === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => handleThemeChange(opt.value)}
                      style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        gap: 6, paddingVertical: 10, borderRadius: 10,
                        backgroundColor: active ? primary : colors.background,
                      }}
                    >
                      <Icon size={16} color={active ? '#fff' : colors.textMuted} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : colors.textMuted }}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Preferences */}
        <View style={{ marginBottom: 24 }}>
          <SectionHeader title="Preferences" />
          <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
            {pushNotifications?.enabled && (
              <SettingsRow
                icon={Bell}
                label="Push Notifications"
                type="toggle"
                value={notificationsEnabled}
                onToggle={handleToggleNotifications}
              />
            )}
            {biometricConfig?.enabled && biometricAvailable && (
              <SettingsRow
                icon={Shield}
                label="Biometric Lock"
                type="toggle"
                value={biometricEnabled ?? false}
                onToggle={handleToggleBiometric}
              />
            )}
            {csvExportEnabled?.enabled && (
              <SettingsRow
                icon={Download}
                label="Export My Data (CSV)"
                type="action"
                onPress={handleCsvExport}
              />
            )}
            <SettingsRow
              icon={Star}
              label="Rate the App"
              type="action"
              onPress={handleRateApp}
            />
          </View>
        </View>

        {/* Help */}
        {helpSystemEnabled?.enabled && (
          <View style={{ marginBottom: 24 }}>
            <SectionHeader title="Help" />
            <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
              <SettingsRow
                icon={BookOpen}
                label="How To Use"
                type="action"
                onPress={handleHowToUse}
              />
              <SettingsRow
                icon={HelpCircle}
                label={`Reset Help Tooltips (${dismissed.size} dismissed)`}
                type="action"
                onPress={handleResetHelp}
              />
            </View>
          </View>
        )}

        {/* Upgrade */}
        {inAppPurchases?.enabled && tier === 'free' && (
          <View style={{ marginBottom: 24 }}>
            <SectionHeader title="Upgrade" />
            <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
              <SettingsRow
                icon={Star}
                label="Upgrade to Pro"
                type="action"
                onPress={handleUpgrade}
              />
              <SettingsRow
                icon={ExternalLink}
                label="Restore Purchases"
                type="action"
                onPress={handleRestore}
              />
            </View>
          </View>
        )}

        {/* Legal */}
        {compliance?.enabled && (
          <View style={{ marginBottom: 24 }}>
            <SectionHeader title="Legal" />
            <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
              {gasConfigAny.legal?.privacyPolicyUrl && (
                <SettingsRow
                  icon={FileText}
                  label="Privacy Policy"
                  type="action"
                  onPress={() => Linking.openURL(gasConfigAny.legal!.privacyPolicyUrl!)}
                />
              )}
              {gasConfigAny.legal?.termsOfServiceUrl && (
                <SettingsRow
                  icon={FileText}
                  label="Terms of Service"
                  type="action"
                  onPress={() => Linking.openURL(gasConfigAny.legal!.termsOfServiceUrl!)}
                />
              )}
            </View>
          </View>
        )}

        {/* Account */}
        <View style={{ marginBottom: 24 }}>
          <SectionHeader title="Account" />
          <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
            <SettingsRow
              icon={LogOut}
              label="Sign Out"
              type="action"
              onPress={handleSignOut}
              destructive
            />
            <SettingsRow
              icon={Trash2}
              label="Delete Account"
              type="action"
              onPress={handleDeleteAccount}
              destructive
            />
          </View>
        </View>

        {/* Version */}
        <Text style={{ textAlign: 'center', color: colors.textMuted, fontSize: 12, marginBottom: 20 }}>
          {gasConfig.app.name} v{gasConfig.app.version}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
