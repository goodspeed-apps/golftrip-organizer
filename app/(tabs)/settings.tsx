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

  // --- Load notification preference from storage ---
  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then((val) => {
      if (val !== null) setNotificationsEnabled(val === 'true');
    });
  }, []);

  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem(NOTIF_KEY, String(value));
    track('toggle_notifications', { enabled: value });
  };

  const handleToggleBiometric = async (value: boolean) => {
    await setBiometricPreference(value);
    track('toggle_biometric', { enabled: value });
  };

  const handleThemeChange = (value: 'dark' | 'light' | 'system') => {
    setTheme(value);
    track('change_theme', { theme: value });
  };

  const handleRateApp = async () => {
    track('tap_rate_app');
    addBreadcrumb('settings', 'rate_app');
    const available = await StoreReview.isAvailableAsync();
    if (available) {
      await StoreReview.requestReview();
    } else {
      Alert.alert('Rate Us', 'Thank you for using the app!');
    }
  };

  const handleCsvExport = async () => {
    track('tap_csv_export');
    Alert.alert('Export Data', 'Your data export will be emailed to you shortly.');
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          track('sign_out');
          await signOut();
        },
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
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              track('delete_account');
              await requestAccountDeletion();
              await signOut();
            } catch (e) {
              captureException(e as Error, { screen: 'settings', action: 'deleteAccount' });
              Alert.alert('Error', 'Could not delete account. Please contact support.');
            }
          },
        },
      ]
    );
  };

  const handlePurchase = async () => {
    if (!offerings?.current) return;
    setPurchasing(true);
    try {
      const pkg = offerings.current.availablePackages[0];
      if (pkg) await purchase(pkg);
      track('purchase_attempt', { screen: 'settings' });
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
      Alert.alert('Restored', 'Your purchases have been restored.');
    } catch (e) {
      captureException(e as Error, { screen: 'settings', action: 'restore' });
      Alert.alert('Error', 'Could not restore purchases.');
    }
  };

  const privacyUrl: string = (gasConfig as unknown as { legal?: { privacyUrl?: string } }).legal?.privacyUrl ?? '';
  const termsUrl: string = (gasConfig as unknown as { legal?: { termsUrl?: string } }).legal?.termsUrl ?? '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ padding: 20, paddingBottom: 0 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>Settings</Text>
        </View>

        {/* Profile Section */}
        <SectionHeader title="Profile" />
        <View style={{ marginHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' }}>
          <SettingsRow
            icon={<User size={18} color={primary} />}
            label={user?.user_metadata?.display_name ?? user?.email ?? 'User'}
            sublabel={user?.email}
            onPress={() => {}}
          />
          {tier && (
            <SettingsRow
              icon={<Star size={18} color={primary} />}
              label="Subscription"
              value={tier}
              onPress={() => {}}
            />
          )}
        </View>

        {/* Appearance Section */}
        {darkMode?.enabled && (
          <>
            <SectionHeader title="Appearance" />
            <View style={{ marginHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' }}>
              {THEME_OPTIONS.map((opt) => (
                <SettingsRow
                  key={opt.value}
                  icon={<opt.icon size={18} color={primary} />}
                  label={opt.label}
                  value={preference === opt.value ? '✓' : undefined}
                  onPress={() => handleThemeChange(opt.value)}
                />
              ))}
            </View>
          </>
        )}

        {/* Preferences Section */}
        <SectionHeader title="Preferences" />
        <View style={{ marginHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' }}>
          {pushNotifications?.enabled && (
            <SettingsRow
              icon={<Bell size={18} color={primary} />}
              label="Push Notifications"
              toggle={notificationsEnabled}
              onToggle={handleToggleNotifications}
            />
          )}
          {biometricConfig?.enabled && biometricAvailable && (
            <SettingsRow
              icon={<Shield size={18} color={primary} />}
              label="Biometric Lock"
              toggle={biometricEnabled}
              onToggle={handleToggleBiometric}
            />
          )}
          {csvExportEnabled && (
            <SettingsRow
              icon={<Download size={18} color={primary} />}
              label="Export My Data (CSV)"
              onPress={handleCsvExport}
            />
          )}
          <SettingsRow
            icon={<Star size={18} color={primary} />}
            label="Rate the App"
            onPress={handleRateApp}
          />
        </View>

        {/* Help Section */}
        {helpSystemEnabled && (
          <>
            <SectionHeader title="Help" />
            <View style={{ marginHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' }}>
              <SettingsRow
                icon={<BookOpen size={18} color={primary} />}
                label="How To Use"
                onPress={() => {}}
              />
              <SettingsRow
                icon={<HelpCircle size={18} color={primary} />}
                label={`Reset Tips (${dismissed.length} dismissed)`}
                onPress={resetHelp}
              />
            </View>
          </>
        )}

        {/* Upgrade Section */}
        {inAppPurchases?.enabled && tier === 'free' && (
          <>
            <SectionHeader title="Upgrade" />
            <View style={{ marginHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' }}>
              <SettingsRow
                icon={<Star size={18} color={primary} />}
                label="Upgrade to Pro"
                sublabel="Unlock all features"
                onPress={handlePurchase}
                loading={purchasing || subLoading}
              />
              <SettingsRow
                icon={<Star size={18} color={primary} />}
                label="Restore Purchases"
                onPress={handleRestore}
              />
            </View>
          </>
        )}

        {/* Legal Section */}
        {compliance?.enabled && (
          <>
            <SectionHeader title="Legal" />
            <View style={{ marginHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' }}>
              {privacyUrl ? (
                <SettingsRow
                  icon={<FileText size={18} color={primary} />}
                  label="Privacy Policy"
                  onPress={() => Linking.openURL(privacyUrl)}
                  rightIcon={<ExternalLink size={14} color={colors.textSecondary} />}
                />
              ) : null}
              {termsUrl ? (
                <SettingsRow
                  icon={<FileText size={18} color={primary} />}
                  label="Terms of Service"
                  onPress={() => Linking.openURL(termsUrl)}
                  rightIcon={<ExternalLink size={14} color={colors.textSecondary} />}
                />
              ) : null}
            </View>
          </>
        )}

        {/* Account Section */}
        <SectionHeader title="Account" />
        <View style={{ marginHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' }}>
          <SettingsRow
            icon={<LogOut size={18} color={colors.error} />}
            label="Sign Out"
            labelStyle={{ color: colors.error }}
            onPress={handleSignOut}
          />
          <SettingsRow
            icon={<Trash2 size={18} color={colors.error} />}
            label="Delete Account"
            labelStyle={{ color: colors.error }}
            onPress={handleDeleteAccount}
          />
        </View>

        {/* Version Footer */}
        <Text style={{ textAlign: 'center', color: colors.textSecondary, fontSize: 12, marginTop: 32 }}>
          {gasConfig.app.name} v{gasConfig.app.version}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
