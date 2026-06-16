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
    track('settings_screen_viewed');
    trackScreenLoad('settings', screenStart.current);
  }, []);

  // --- Load notification preference from storage ---
  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then((v) => {
      if (v !== null) setNotificationsEnabled(v === 'true');
    });
  }, []);

  // --- Handlers ---

  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem(NOTIF_KEY, String(value));
    track('notifications_toggled', { enabled: value });
  };

  const handleToggleBiometric = async (value: boolean) => {
    await setBiometricPreference(value);
    track('biometric_toggled', { enabled: value });
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          track('signed_out');
        },
      },
    ]);
  };

const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will schedule deletion of your account and all associated data per the deletion policy in your data rights settings. You can cancel within the grace period.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              track('account_deletion_requested');
              await requestAccountDeletion();
              await signOut();
            } catch (err) {
              captureException(err, { context: 'account_deletion' });
              Alert.alert('Error', 'Failed to schedule deletion. Please try again or contact support.');
            }
          },
        },
      ],
    );
  };

  const handleRateApp = async () => {
    try {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
        track('store_review_prompted');
      } else {
        // Fallback: open app store listing
        // DevAgent should replace this URL with the actual store listing
        Alert.alert('Rate Us', 'Thank you for your support! Rating is not available on this device.');
      }
    } catch {
      // Silently fail, store review is best-effort
    }
  };

  const handleUpgrade = async () => {
    track('upgrade_tapped', { from: 'settings' });
    const current = offerings?.current;
    if (!current || current.availablePackages.length === 0) {
      Alert.alert('Upgrade', 'Subscriptions are being set up. Check back soon!', [{ text: 'OK' }]);
      return;
    }
    const pkg = current.availablePackages[0];
    if (!pkg) {
      Alert.alert('No packages', 'No packages available.');
      return;
    }
    try {
      setPurchasing(true);
      await purchase(pkg.identifier);
      Alert.alert('Welcome to Pro!', 'Your subscription is now active.', [{ text: 'Thanks!' }]);
    } catch (e: any) {
      if (!e?.userCancelled) {
        Alert.alert('Purchase failed', e?.message ?? 'Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setPurchasing(true);
      await restore();
      Alert.alert('Restored', 'Your purchases have been restored.', [{ text: 'OK' }]);
    } catch {
      Alert.alert('Restore failed', 'No purchases found to restore.', [{ text: 'OK' }]);
    } finally {
      setPurchasing(false);
    }
  };

  const handleExportData = () => {
    // TODO: DevAgent implements data export via Supabase edge function
    track('data_export_requested');
    Alert.alert(
      'Data Export',
      'Your data export has been requested. You will receive a download link via email.',
    );
  };

  const handleCSVExport = () => {
    if (tier === 'free' && inAppPurchases.enabled) {
      Alert.alert('Pro Feature', 'Upgrade to Pro to export your data as CSV.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: handleUpgrade },
      ]);
      return;
    }
    // TODO: DevAgent implements CSV export
    track('csv_export_requested');
    Alert.alert('Export', 'CSV export is being prepared...');
  };

  // --- Derived values ---
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const tierColor = tier === 'free' ? colors.textSecondary : primary;
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Account';
  const isFreeUser = tier === 'free' || tier === (gasConfig.features.inAppPurchases.tiers[0]?.name.toLowerCase() ?? 'free');

  // Get pro features from gasConfig tiers (second tier if available)
  const proTier = gasConfig.features.inAppPurchases.tiers[1];
  const proFeatures = proTier?.features ?? [];

  // Legal URLs, read from config; hide each row when its URL is empty
  // (never link to a placeholder like example.com).
  const privacyUrl = gasConfig.legal?.privacyUrl?.trim() ?? '';
  const termsUrl = gasConfig.legal?.termsUrl?.trim() ?? '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Screen title */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
            Settings
          </Text>
        </View>

        {/* ── Profile Card ── */}
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 24,
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 20,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {/* Avatar circle */}
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: primary + '18',
              borderWidth: 2,
              borderColor: primary + '30',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <User size={32} color={primary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
            {displayName}
          </Text>
          {/* Subscription tier badge */}
          {inAppPurchases.enabled && (
            <View
              style={{
                marginTop: 8,
                backgroundColor: tierColor + '18',
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 5,
                borderWidth: 1,
                borderColor: tierColor + '30',
              }}
            >
              <Text style={{ color: tierColor, fontSize: 12, fontWeight: '700' }}>
                {tierLabel} Plan
              </Text>
            </View>
          )}
        </View>

        {/* ── Appearance (if darkMode enabled) ── */}
        {darkMode.enabled && (
          <>
            <SectionHeader title="Appearance" />
            <View
              style={{
                marginHorizontal: 16,
                backgroundColor: colors.surface,
                borderRadius: 20,
                overflow: 'hidden',
                marginBottom: 20,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', padding: 8, gap: 8 }}>
                {THEME_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = preference === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        paddingVertical: 12,
                        borderRadius: 14,
                        backgroundColor: active ? primary + '18' : 'transparent',
                        borderWidth: 1,
                        borderColor: active ? primary + '40' : 'transparent',
                      }}
                      onPress={() => setTheme(opt.value)}
                      accessibilityLabel={`${opt.label} theme`}
                    >
                      <Icon size={18} color={active ? primary : colors.textSecondary} />
                      <Text
                        style={{
                          color: active ? primary : colors.textSecondary,
                          fontSize: 12,
                          fontWeight: '600',
                          marginTop: 5,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* ── Preferences ── */}
        <SectionHeader title="Preferences" />
        <View
          style={{
            marginHorizontal: 16,
            backgroundColor: colors.surface,
            borderRadius: 20,
            overflow: 'hidden',
            marginBottom: 20,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {/* Push Notifications toggle */}
          {pushNotifications.enabled && (
            <SettingsRow
              label="Push Notifications"
              icon={Bell}
              switchValue={notificationsEnabled}
              onSwitchChange={handleToggleNotifications}
              showBorder={biometricConfig.enabled || csvExportEnabled}
            />
          )}

          {/* Biometric Lock toggle, only if hardware available */}
          {biometricConfig.enabled && biometricAvailable && (
            <SettingsRow
              label="Biometric Lock"
              description="Locks app after 5 min background"
              icon={Shield}
              iconColor={colors.primary}
              iconBgColor={colors.primary + '15'}
              switchValue={biometricEnabled}
              onSwitchChange={handleToggleBiometric}
              switchActiveColor={colors.primary + '80'}
              showBorder={csvExportEnabled}
            />
          )}

          {/* CSV Export */}
          {csvExportEnabled && (
            <SettingsRow
              label="Export Data (CSV)"
              icon={Download}
              iconColor={colors.success}
              iconBgColor={colors.success + '15'}
              onPress={handleCSVExport}
              badge={isFreeUser && inAppPurchases.enabled ? 'Pro only' : undefined}
              badgeColor={colors.warning}
              showBorder={false}
            />
          )}
        </View>

        {/* ── Help (if helpSystem enabled) ── */}
        {helpSystemEnabled && (
          <>
            <SectionHeader title="Help" />
            <View
              style={{
                marginHorizontal: 16,
                backgroundColor: colors.surface,
                borderRadius: 20,
                overflow: 'hidden',
                marginBottom: 20,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {/* How To Use */}
              <SettingsRow
                label={`How To Use ${gasConfig.app.name}`}
                icon={BookOpen}
                onPress={() => {
                  // TODO: DevAgent connects this to a HowToUseModal
                  track('how_to_use_tapped');
                }}
                showBorder={dismissed}
              />

              {/* Show ? Help Icon (only if previously dismissed) */}
              {dismissed && (
                <SettingsRow
                  label="Show ? Help Icon"
                  icon={HelpCircle}
                  iconColor={colors.textSecondary}
                  iconBgColor={colors.surface}
                  onPress={resetHelp}
                  rightElement={
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginRight: 4 }}>
                      Hidden
                    </Text>
                  }
                  showBorder={false}
                />
              )}
            </View>
          </>
        )}

        {/* ── Upgrade (only for free-tier users with IAP enabled) ── */}
        {inAppPurchases.enabled && isFreeUser && proFeatures.length > 0 && (
          <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
            <SectionHeader title="Upgrade" />
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 20,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: primary + '30',
              }}
            >
              {/* Accent bar at top */}
              <View style={{ height: 3, backgroundColor: primary }} />
              <View style={{ padding: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Star size={18} color={primary} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>
                    {gasConfig.app.name} {proTier?.name ?? 'Pro'}
                  </Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16 }}>
                  Unlock the full experience
                </Text>

                {/* Feature list */}
                {proFeatures.map((f) => (
                  <View key={f} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: gasConfig.design.colors.success + '20',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10,
                      }}
                    >
                      <Text
                        style={{
                          color: gasConfig.design.colors.success,
                          fontSize: 11,
                          fontWeight: '800',
                        }}
                      >
                        {'✓'}
                      </Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: 14 }}>{f}</Text>
                  </View>
                ))}

                {/* Purchase button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: primary,
                    borderRadius: 14,
                    padding: 16,
                    alignItems: 'center',
                    marginTop: 8,
                    opacity: purchasing ? 0.6 : 1,
                  }}
                  onPress={handleUpgrade}
                  disabled={purchasing || subLoading}
                  accessibilityLabel="Upgrade to Pro"
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>
                    {purchasing ? 'Processing...' : `Upgrade to ${proTier?.name ?? 'Pro'}`}
                  </Text>
                </TouchableOpacity>

                {/* Restore purchases */}
                <TouchableOpacity onPress={handleRestore} style={{ alignItems: 'center', paddingTop: 12 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Restore purchases</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── Rate & Legal ── */}
        <SectionHeader title="About" />
        <View
          style={{
            marginHorizontal: 16,
            backgroundColor: colors.surface,
            borderRadius: 20,
            overflow: 'hidden',
            marginBottom: 20,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {/* Rate the app */}
          <SettingsRow
            label="Rate on App Store"
            icon={Star}
            iconColor={colors.warning}
            iconBgColor={colors.warning + '15'}
            onPress={handleRateApp}
          />

          {/* Privacy Policy, only when a real URL is configured */}
          {privacyUrl !== '' && (
            <SettingsRow
              label="Privacy Policy"
              icon={FileText}
              iconColor={colors.textSecondary}
              iconBgColor={colors.textSecondary + '15'}
              onPress={() => {
                Linking.openURL(privacyUrl);
                track('privacy_policy_tapped');
              }}
              showBorder={termsUrl !== '' || compliance.dataExport}
            />
          )}

          {/* Terms of Service, only when a real URL is configured */}
          {termsUrl !== '' && (
            <SettingsRow
              label="Terms of Service"
              icon={ExternalLink}
              iconColor={colors.textSecondary}
              iconBgColor={colors.textSecondary + '15'}
              onPress={() => {
                Linking.openURL(termsUrl);
                track('terms_tapped');
              }}
              showBorder={compliance.dataExport}
            />
          )}

          {/* Data Export (GDPR/compliance) */}
          {compliance.dataExport && (
            <SettingsRow
              label="Export My Data"
              icon={Download}
              iconColor="#6366F1"
              iconBgColor="#6366F115"
              onPress={handleExportData}
              showBorder={false}
            />
          )}
        </View>

        {/* ── Account actions ── */}
        <SectionHeader title="Account" />

        {/* Sign Out */}
        <TouchableOpacity
          style={{
            marginHorizontal: 16,
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 18,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 12,
          }}
          onPress={handleSignOut}
          accessibilityLabel="Sign out"
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#EF444415',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <LogOut size={18} color="#EF4444" />
          </View>
          <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 15, flex: 1 }}>
            Sign Out
          </Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity
          style={{
            marginHorizontal: 16,
            borderRadius: 20,
            padding: 18,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 24,
          }}
          onPress={handleDeleteAccount}
          accessibilityLabel="Delete account"
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#EF444410',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Trash2 size={18} color="#EF444480" />
          </View>
          <Text style={{ color: '#EF444480', fontWeight: '600', fontSize: 15, flex: 1 }}>
            Delete Account
          </Text>
        </TouchableOpacity>

        {/* ── App version footer ── */}
        <View style={{ alignItems: 'center', paddingBottom: 16 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {gasConfig.app.name} v{gasConfig.app.version}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
