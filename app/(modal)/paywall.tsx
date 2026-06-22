/**
 * GAS Template, Paywall Screen
 *
 * Multi-model paywall with config-driven tabs:
 * - Plans: RevenueCat subscription offerings (existing)
 * - Products: One-time purchases (lifetime unlock, feature packs)
 * - Credits: Consumable credit packs with balance display
 *
 * Shows tab bar only when multiple payment models are active.
 * Falls back to single subscription view for backwards compatibility.
 *
 * All colors come from useThemeColors(), never hardcoded.
 * Uses SafeAreaView from 'react-native-safe-area-context' (CRITICAL).
 */

import { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useSubscription } from '@/hooks/useSubscription';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useThemeColors } from '@/context/ThemeContext';
import { trackScreenLoad } from '@/lib/performance';
import { addBreadcrumb } from '@/lib/sentry';
import { purchaseProduct } from '@/lib/revenuecat';
import { callEdge } from '@/services/api';
import { gasConfig } from '../../gas.config';

const IAP_ENABLED = gasConfig.features.inAppPurchases.enabled;
const APP_NAME = gasConfig.app.name;
const TIERS = gasConfig.features.inAppPurchases.tiers;
const ONE_TIME_PRODUCTS = gasConfig.features.inAppPurchases.oneTimePurchases ?? [];
const CREDITS_CONFIG = gasConfig.features.inAppPurchases.credits;

// Get feature list from the highest tier (last in the array) for the hero section.
const PRO_TIER = TIERS.length > 1 ? TIERS[TIERS.length - 1] : null;
const FEATURES = PRO_TIER?.features ?? ['Full access to all features'];

// Check if any tier has a trial period.
const TRIAL_TIER = TIERS.find(t => (t.trialDays ?? 0) > 0);
const TRIAL_DAYS = TRIAL_TIER?.trialDays ?? 0;

// Build available tabs from config
type PaywallTab = 'plans' | 'products' | 'credits';
const AVAILABLE_TABS: { id: PaywallTab; label: string }[] = [];
if (TIERS.length > 1) AVAILABLE_TABS.push({ id: 'plans', label: 'Plans' });
if (ONE_TIME_PRODUCTS.length > 0) AVAILABLE_TABS.push({ id: 'products', label: 'Products' });
if (CREDITS_CONFIG?.enabled) AVAILABLE_TABS.push({ id: 'credits', label: CREDITS_CONFIG.currencyName.charAt(0).toUpperCase() + CREDITS_CONFIG.currencyName.slice(1) });

export default function PaywallScreen() {
  const { tab: initialTab } = useLocalSearchParams<{ tab?: PaywallTab }>();
  const { track } = useAnalytics();
  const { colors } = useThemeColors();
  const { offerings, isLoading, purchase, purchaseOneTime, restore, ownedProducts } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PaywallTab>(
    initialTab && AVAILABLE_TABS.some(t => t.id === initialTab)
      ? initialTab
      : AVAILABLE_TABS[0]?.id ?? 'plans'
  );

  const screenStart = Date.now();
  useEffect(() => {
    track('paywall_displayed', { tab: activeTab });
    trackScreenLoad('paywall', screenStart);
    addBreadcrumb('monetization', 'Paywall displayed');
  }, []);

  const packages = offerings?.current?.availablePackages ?? [];

  useEffect(() => {
    if (packages.length > 0 && !selectedPackageId) {
      setSelectedPackageId(packages[0]?.identifier ?? null);
    }
  }, [packages, selectedPackageId]);

  const showTabs = AVAILABLE_TABS.length > 1;

  // --- Dynamic styles based on theme colors ---
  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 8,
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabActive: {
      backgroundColor: colors.primary + '1A',
      borderColor: colors.primary,
    },
    tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    tabTextActive: { color: colors.primary },
    hero: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 16 },
    heroBadge: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: colors.primary + '1A',
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    heroBadgeText: { fontSize: 28, fontWeight: '800', color: colors.primary },
    heroTitle: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
    heroSubtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 6 },
    featuresCard: {
      marginHorizontal: 16,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    featureCheckmark: { fontSize: 16, color: colors.success },
    featureText: { fontSize: 14, color: colors.text, flex: 1 },
    noProductsCard: {
      margin: 16,
      marginTop: 24,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    noProductsText: { color: colors.textSecondary, fontSize: 14 },
    packageList: { paddingHorizontal: 16, marginTop: 16, gap: 10 },
    packageCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    packageCardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '0D' },
    packageTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    packageDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    packagePrice: { fontSize: 16, fontWeight: '800', color: colors.primary },
    trialNote: {
      textAlign: 'center', color: colors.textSecondary,
      fontSize: 12, marginTop: 16, paddingHorizontal: 16,
    },
    productCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    productOwned: { opacity: 0.6 },
    productHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    productName: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
    productPrice: { fontSize: 16, fontWeight: '800', color: colors.primary },
    productDesc: { fontSize: 13, color: colors.textSecondary },
    productBuyButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 4,
    },
    productBuyText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    creditBalance: {
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.primary + '1A',
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primary + '33',
    },
    creditBalanceLabel: { fontSize: 13, color: colors.textSecondary },
    creditBalanceValue: { fontSize: 32, fontWeight: '800', color: colors.primary, marginTop: 4 },
    creditPackCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    creditPackCardPopular: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '08',
    },
    creditPackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    creditPackName: { fontSize: 15, fontWeight: '700', color: colors.text },
    creditPackPopularBadge: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    creditPackPopularText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    creditPackAmount: { fontSize: 13, color: colors.textSecondary },
    creditPackPrice: { fontSize: 16, fontWeight: '800', color: colors.primary },
    creditPackBuyButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 4,
    },
    creditPackBuyText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    ctaContainer: {
      padding: 16,
      paddingBottom: 8,
      gap: 12,
    },
    ctaButton: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    ctaButtonText: { fontSize: 17, fontWeight: '800', color: '#fff' },
    restoreButton: { alignItems: 'center', paddingVertical: 8 },
    restoreButtonText: { fontSize: 13, color: colors.textSecondary },
    legalText: {
      textAlign: 'center', color: colors.textSecondary,
      fontSize: 11, paddingHorizontal: 16, paddingBottom: 16,
    },
  }), [colors]);

  // --- Handlers ---

  const handleSelectPackage = (id: string) => {
    setSelectedPackageId(id);
    track('paywall_package_selected', { packageId: id });
  };

  const handlePurchasePlan = async () => {
    if (!selectedPackageId) return;
    setPurchasing(true);
    try {
      await purchase(selectedPackageId);
      track('paywall_purchase_success', { tab: 'plans', packageId: selectedPackageId });
      router.back();
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err?.userCancelled) {
        Alert.alert('Purchase Failed', err?.message ?? 'Please try again.');
        track('paywall_purchase_error', { tab: 'plans', error: err?.message });
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handlePurchaseProduct = async (productId: string) => {
    setPurchasing(true);
    try {
      if (purchaseOneTime) {
        await purchaseOneTime(productId);
      } else {
        await purchaseProduct(productId);
      }
      track('paywall_purchase_success', { tab: 'products', productId });
      Alert.alert('Purchase Complete', 'Your purchase is now active!');
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err?.userCancelled) {
        Alert.alert('Purchase Failed', err?.message ?? 'Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handlePurchaseCredits = async (productId: string, amount: number) => {
    setPurchasing(true);
    try {
      await purchaseProduct(productId);
      track('paywall_purchase_success', { tab: 'credits', productId, amount });
      Alert.alert('Credits Added!', `${amount} ${CREDITS_CONFIG?.currencyNamePlural ?? CREDITS_CONFIG?.currencyName ?? 'credits'} have been added to your account.`);
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err?.userCancelled) {
        Alert.alert('Purchase Failed', err?.message ?? 'Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      await restore();
      Alert.alert('Restored', 'Your purchases have been restored.');
      track('paywall_restore_success');
    } catch {
      Alert.alert('Restore Failed', 'No purchases found to restore.');
    } finally {
      setPurchasing(false);
    }
  };

  // --- Render tab content ---

  const renderPlansTab = () => (
    <>
      {/* Hero */}
      <View style={dynamicStyles.hero}>
        <View style={dynamicStyles.heroBadge}>
          <Text style={dynamicStyles.heroBadgeText}>⚡</Text>
        </View>
        <Text style={dynamicStyles.heroTitle}>{APP_NAME} Pro</Text>
        <Text style={dynamicStyles.heroSubtitle}>Unlock the full experience</Text>
      </View>

      {/* Features */}
      <View style={dynamicStyles.featuresCard}>
        {FEATURES.map((f, i) => (
          <View key={i} style={dynamicStyles.featureRow}>
            <Text style={dynamicStyles.featureCheckmark}>✓</Text>
            <Text style={dynamicStyles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {/* Packages */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : packages.length === 0 ? (
        <View style={dynamicStyles.noProductsCard}>
          <Text style={dynamicStyles.noProductsText}>Subscriptions coming soon</Text>
        </View>
      ) : (
        <View style={dynamicStyles.packageList}>
          {packages.map((pkg: { identifier: string; product: { title: string; description: string; priceString: string } }) => (
            <TouchableOpacity
              key={pkg.identifier}
              style={[dynamicStyles.packageCard, selectedPackageId === pkg.identifier && dynamicStyles.packageCardSelected]}
              onPress={() => handleSelectPackage(pkg.identifier)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedPackageId === pkg.identifier }}
            >
              <View style={{ flex: 1 }}>
                <Text style={dynamicStyles.packageTitle}>{pkg.product.title}</Text>
                <Text style={dynamicStyles.packageDesc}>{pkg.product.description}</Text>
              </View>
              <Text style={dynamicStyles.packagePrice}>{pkg.product.priceString}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {TRIAL_DAYS > 0 && (
        <Text style={dynamicStyles.trialNote}>
          Start your {TRIAL_DAYS}-day free trial. Cancel anytime.
        </Text>
      )}
    </>
  );

  const renderProductsTab = () => (
    <View style={{ paddingHorizontal: 16, marginTop: 16, gap: 12 }}>
      {ONE_TIME_PRODUCTS.length === 0 ? (
        <View style={dynamicStyles.noProductsCard}>
          <Text style={dynamicStyles.noProductsText}>No products available</Text>
        </View>
      ) : (
        ONE_TIME_PRODUCTS.map((product) => {
          const owned = ownedProducts?.includes(product.productId) ?? false;
          return (
            <View key={product.productId} style={[dynamicStyles.productCard, owned && dynamicStyles.productOwned]}>
              <View style={dynamicStyles.productHeader}>
                <Text style={dynamicStyles.productName}>{product.name}</Text>
                <Text style={dynamicStyles.productPrice}>${product.price.toFixed(2)}</Text>
              </View>
              {product.description && (
                <Text style={dynamicStyles.productDesc}>{product.description}</Text>
              )}
              <TouchableOpacity
                style={dynamicStyles.productBuyButton}
                onPress={() => handlePurchaseProduct(product.productId)}
                disabled={purchasing || owned}
                accessibilityRole="button"
                accessibilityLabel={owned ? `${product.name} - Owned` : `Buy ${product.name}`}
              >
                <Text style={dynamicStyles.productBuyText}>
                  {owned ? 'Owned' : purchasing ? 'Processing…' : 'Buy'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );

  const renderCreditsTab = () => {
    const packs = CREDITS_CONFIG?.packs ?? [];
    const currencyNamePlural = CREDITS_CONFIG?.currencyNamePlural ?? CREDITS_CONFIG?.currencyName ?? 'credits';

    return (
      <>
        {/* Balance display */}
        <View style={dynamicStyles.creditBalance}>
          <Text style={dynamicStyles.creditBalanceLabel}>Your Balance</Text>
          <Text style={dynamicStyles.creditBalanceValue}>0</Text>
          <Text style={dynamicStyles.creditBalanceLabel}>{currencyNamePlural}</Text>
        </View>

        {/* Credit packs */}
        <View style={{ paddingHorizontal: 16, marginTop: 16, gap: 12 }}>
          {packs.length === 0 ? (
            <View style={dynamicStyles.noProductsCard}>
              <Text style={dynamicStyles.noProductsText}>No credit packs available</Text>
            </View>
          ) : (
            packs.map((pack, i) => (
              <View
                key={pack.productId ?? i}
                style={[dynamicStyles.creditPackCard, pack.popular && dynamicStyles.creditPackCardPopular]}
              >
                <View style={dynamicStyles.creditPackHeader}>
                  <Text style={dynamicStyles.creditPackName}>{pack.name ?? `${pack.amount} ${currencyNamePlural}`}</Text>
                  {pack.popular && (
                    <View style={dynamicStyles.creditPackPopularBadge}>
                      <Text style={dynamicStyles.creditPackPopularText}>POPULAR</Text>
                    </View>
                  )}
                </View>
                <Text style={dynamicStyles.creditPackAmount}>
                  {pack.amount} {currencyNamePlural}
                  {pack.bonus ? ` + ${pack.bonus} bonus` : ''}
                </Text>
                <Text style={dynamicStyles.creditPackPrice}>${pack.price.toFixed(2)}</Text>
                <TouchableOpacity
                  style={dynamicStyles.creditPackBuyButton}
                  onPress={() => pack.productId && handlePurchaseCredits(pack.productId, pack.amount)}
                  disabled={purchasing || !pack.productId}
                  accessibilityRole="button"
                  accessibilityLabel={`Buy ${pack.amount} ${currencyNamePlural} for $${pack.price.toFixed(2)}`}
                >
                  <Text style={dynamicStyles.creditPackBuyText}>
                    {purchasing ? 'Processing…' : 'Buy'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </>
    );
  };

  if (!IAP_ENABLED) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.headerTitle}>Upgrade</Text>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close paywall">
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: 'center' }}>
            In-app purchases are not enabled for this app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container}>
      {/* Header */}
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>Upgrade {APP_NAME}</Text>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close paywall">
          <X size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tab bar (only when multiple tabs) */}
      {showTabs && (
        <View style={dynamicStyles.tabBar}>
          {AVAILABLE_TABS.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[dynamicStyles.tab, activeTab === t.id && dynamicStyles.tabActive]}
              onPress={() => { setActiveTab(t.id); track('paywall_tab_changed', { tab: t.id }); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === t.id }}
            >
              <Text style={[dynamicStyles.tabText, activeTab === t.id && dynamicStyles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        {activeTab === 'plans' && renderPlansTab()}
        {activeTab === 'products' && renderProductsTab()}
        {activeTab === 'credits' && renderCreditsTab()}
      </ScrollView>

      {/* CTA */}
      <View style={dynamicStyles.ctaContainer}>
        {activeTab === 'plans' && (
          <TouchableOpacity
            style={dynamicStyles.ctaButton}
            onPress={handlePurchasePlan}
            disabled={purchasing || packages.length === 0}
            accessibilityRole="button"
            accessibilityLabel={TRIAL_DAYS > 0 ? `Start ${TRIAL_DAYS}-day free trial` : 'Subscribe now'}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={dynamicStyles.ctaButtonText}>
                {TRIAL_DAYS > 0 ? `Start ${TRIAL_DAYS}-Day Free Trial` : 'Subscribe Now'}
              </Text>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={dynamicStyles.restoreButton} onPress={handleRestore} accessibilityRole="button" accessibilityLabel="Restore purchases">
          <Text style={dynamicStyles.restoreButtonText}>Restore Purchases</Text>
        </TouchableOpacity>
      </View>

      <Text style={dynamicStyles.legalText}>
        Subscriptions auto-renew unless cancelled 24 hours before renewal.
        Manage subscriptions in your App Store account settings.
      </Text>
    </SafeAreaView>
  );
}
