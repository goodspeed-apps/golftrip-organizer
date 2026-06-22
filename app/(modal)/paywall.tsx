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
      flexDirection: 'row',
      alignItems: 'center',
    },
    creditPackPopular: { borderColor: colors.primary },
    creditPackInfo: { flex: 1 },
    creditPackName: { fontSize: 15, fontWeight: '700', color: colors.text },
    creditPackBonus: { fontSize: 12, color: colors.success, marginTop: 2 },
    creditPackPrice: { fontSize: 16, fontWeight: '800', color: colors.primary, marginLeft: 12 },
    popularBadge: {
      position: 'absolute',
      top: -8,
      right: 12,
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    popularBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    footer: {
      padding: 16,
      paddingBottom: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 4,
    },
    ctaButton: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    ctaButtonDisabled: { opacity: 0.5 },
    ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    restoreButton: { alignItems: 'center', paddingVertical: 10 },
    restoreText: { color: colors.textSecondary, fontSize: 13 },
  }), [colors]);

  // --- Handlers ---

  const handlePurchase = async () => {
    if (!selectedPackageId) return;
    setPurchasing(true);
    try {
      await purchase(selectedPackageId);
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (!msg.includes('cancelled') && !msg.includes('cancel')) {
        Alert.alert('Purchase failed', msg || 'Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleOneTimePurchase = async (productId: string) => {
    setPurchasing(true);
    try {
      await purchaseOneTime(productId);
      Alert.alert('Purchase Complete', 'You now have access to this feature.');
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (!msg.includes('cancelled') && !msg.includes('cancel')) {
        Alert.alert('Purchase failed', msg || 'Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleCreditPurchase = async (packId: string, productId: string) => {
    setPurchasing(true);
    try {
      // Purchase consumable via RevenueCat, then validate server-side
      await purchaseProduct(productId);
      const pack = CREDITS_CONFIG?.packs.find(p => p.id === packId);
      const totalCredits = (pack?.credits ?? 0) + (pack?.bonusCredits ?? 0);
      await callEdge('validate-purchase', {
        product_id: productId,
        type: 'consumable',
        credits_amount: totalCredits,
      });
      Alert.alert('Credits Added', `${totalCredits} ${CREDITS_CONFIG?.currencyNamePlural ?? 'credits'} added to your balance.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (!msg.includes('cancelled') && !msg.includes('cancel')) {
        Alert.alert('Purchase failed', msg || 'Please try again.');
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
      router.back();
    } catch {
      Alert.alert('Nothing to restore', 'No previous purchases found.');
    } finally {
      setPurchasing(false);
    }
  };

  // --- Render sections ---

  const renderPlansTab = () => (
    <>
      {/* Hero section */}
      <View style={dynamicStyles.hero}>
        <View style={dynamicStyles.heroBadge}>
          <Text style={dynamicStyles.heroBadgeText}>{APP_NAME.charAt(0)}</Text>
        </View>
        <Text style={dynamicStyles.heroTitle}>Unlock Full Access</Text>
        <Text style={dynamicStyles.heroSubtitle}>
          Everything {APP_NAME} has to offer
        </Text>
      </View>

      {/* Feature list */}
      <View style={dynamicStyles.featuresCard}>
        {FEATURES.map((feature) => (
          <View key={feature} style={dynamicStyles.featureRow}>
            <Text style={dynamicStyles.featureCheckmark}>✓</Text>
            <Text style={dynamicStyles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* Packages from RevenueCat */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : packages.length === 0 ? (
        <View style={dynamicStyles.noProductsCard}>
          <Text style={dynamicStyles.noProductsText}>Subscription plans coming soon</Text>
        </View>
      ) : (
        <View style={dynamicStyles.packageList}>
          {packages.map((pkg) => (
            <TouchableOpacity
              key={pkg.identifier}
              style={[
                dynamicStyles.packageCard,
                selectedPackageId === pkg.identifier && dynamicStyles.packageCardSelected,
              ]}
              onPress={() => setSelectedPackageId(pkg.identifier)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${pkg.packageType} plan at ${pkg.product.priceString}`}
              accessibilityState={{ selected: selectedPackageId === pkg.identifier }}
            >
              <View style={{ flex: 1 }}>
                <Text style={dynamicStyles.packageTitle}>{pkg.product.title}</Text>
                <Text style={dynamicStyles.packageDesc}>{pkg.product.description}</Text>
              </View>
              <Text style={dynamicStyles.packagePrice}>{pkg.product.priceString}</Text>
              {selectedPackageId === pkg.identifier && (
                <Text style={{ marginLeft: 8, fontSize: 20, color: colors.primary }}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Trial note */}
      {TRIAL_DAYS > 0 && (
        <Text style={dynamicStyles.trialNote}>
          {TRIAL_DAYS}-day free trial · Cancel anytime
        </Text>
      )}
    </>
  );

  const renderProductsTab = () => (
    <View style={dynamicStyles.packageList}>
      {ONE_TIME_PRODUCTS.map((product) => {
        const isOwned = ownedProducts.includes(product.id);
        return (
          <View key={product.id} style={[dynamicStyles.productCard, isOwned && dynamicStyles.productOwned]}>
            <View style={dynamicStyles.productHeader}>
              <Text style={dynamicStyles.productName}>{product.name}</Text>
              <Text style={dynamicStyles.productPrice}>{product.price}</Text>
            </View>
            <Text style={dynamicStyles.productDesc}>{product.description}</Text>
            <TouchableOpacity
              style={[dynamicStyles.productBuyButton, (purchasing || isOwned) && dynamicStyles.ctaButtonDisabled]}
              onPress={() => handleOneTimePurchase(product.productId)}
              disabled={purchasing || isOwned}
              accessibilityRole="button"
              accessibilityLabel={isOwned ? `${product.name} owned` : `Buy ${product.name}`}
              accessibilityState={{ disabled: purchasing || isOwned, busy: purchasing }}
            >
              <Text style={dynamicStyles.productBuyText}>
                {isOwned ? 'Owned' : 'Buy Now'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );

  const renderCreditsTab = () => (
    <>
      {/* Credit balance display */}
      <View style={dynamicStyles.creditBalance}>
        <Text style={dynamicStyles.creditBalanceLabel}>Your Balance</Text>
        <Text style={dynamicStyles.creditBalanceValue}>--</Text>
        <Text style={dynamicStyles.creditBalanceLabel}>{CREDITS_CONFIG?.currencyNamePlural ?? 'credits'}</Text>
      </View>

      {/* Credit packs */}
      <View style={dynamicStyles.packageList}>
        {CREDITS_CONFIG?.packs.map((pack) => (
          <TouchableOpacity
            key={pack.id}
            style={[dynamicStyles.creditPackCard, pack.popular && dynamicStyles.creditPackPopular]}
            onPress={() => handleCreditPurchase(pack.id, pack.productId)}
            disabled={purchasing}
            accessibilityRole="button"
            accessibilityLabel={`Buy ${pack.name} for ${pack.price}`}
            accessibilityState={{ disabled: purchasing, busy: purchasing }}
          >
            {pack.popular && (
              <View style={dynamicStyles.popularBadge}>
                <Text style={dynamicStyles.popularBadgeText}>POPULAR</Text>
              </View>
            )}
            <View style={dynamicStyles.creditPackInfo}>
              <Text style={dynamicStyles.creditPackName}>{pack.name}</Text>
              {(pack.bonusCredits ?? 0) > 0 && (
                <Text style={dynamicStyles.creditPackBonus}>
                  +{pack.bonusCredits} bonus {CREDITS_CONFIG?.currencyNamePlural ?? 'credits'}
                </Text>
              )}
            </View>
            <Text style={dynamicStyles.creditPackPrice}>{pack.price}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  // --- CTA button text and action for active tab ---
  const ctaConfig = useMemo(() => {
    if (activeTab === 'plans') {
      return {
        text: packages.length === 0
          ? 'Coming Soon'
          : TRIAL_DAYS > 0
            ? 'Start Free Trial'
            : 'Subscribe Now',
        disabled: packages.length === 0,
        onPress: handlePurchase,
        label: TRIAL_DAYS > 0 ? 'Start free trial' : 'Subscribe',
      };
    }
    return null; // Products and credits have inline buy buttons
  }, [activeTab, packages.length, handlePurchase]);

  return (
    <SafeAreaView style={dynamicStyles.container}>
      {/* Header with close button */}
      <View style={dynamicStyles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          accessibilityHint="Dismiss paywall"
          style={{ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>
          {activeTab === 'credits'
            ? `Get ${CREDITS_CONFIG?.currencyName ?? 'Credits'}`
            : activeTab === 'products'
              ? 'Premium Features'
              : `${APP_NAME} Pro`}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab bar (only if multiple models active) */}
      {showTabs && (
        <View style={dynamicStyles.tabBar}>
          {AVAILABLE_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[dynamicStyles.tab, activeTab === tab.id && dynamicStyles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
              accessibilityRole="tab"
              accessibilityLabel={`${tab.label} tab`}
              accessibilityState={{ selected: activeTab === tab.id }}
            >
              <Text style={[dynamicStyles.tabText, activeTab === tab.id && dynamicStyles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!IAP_ENABLED ? (
        <View style={[dynamicStyles.noProductsCard, { marginTop: 32 }]}>
          <Text style={dynamicStyles.noProductsText}>In-app purchases are not enabled</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {activeTab === 'plans' && renderPlansTab()}
          {activeTab === 'products' && renderProductsTab()}
          {activeTab === 'credits' && renderCreditsTab()}
        </ScrollView>
      )}

      {/* Footer with CTA and restore */}
      <View style={dynamicStyles.footer}>
        {ctaConfig && (
          <TouchableOpacity
            style={[dynamicStyles.ctaButton, (purchasing || ctaConfig.disabled) && dynamicStyles.ctaButtonDisabled]}
            onPress={ctaConfig.onPress}
            disabled={purchasing || ctaConfig.disabled}
            accessibilityRole="button"
            accessibilityLabel={ctaConfig.label}
            accessibilityState={{ disabled: purchasing || ctaConfig.disabled, busy: purchasing }}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={dynamicStyles.ctaText}>{ctaConfig.text}</Text>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleRestore}
          disabled={purchasing}
          style={dynamicStyles.restoreButton}
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          accessibilityState={{ disabled: purchasing, busy: purchasing }}
        >
          <Text style={dynamicStyles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
