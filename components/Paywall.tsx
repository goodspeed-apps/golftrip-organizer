import React, { useState } from 'react';
import { View, Text, ScrollView, Platform, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../gas.config';
import { useSubscription } from '@/hooks/useSubscription';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

let RNPurchases: typeof import('react-native-purchases').default | null = null;
try {
  RNPurchases = require('react-native-purchases').default;
} catch {
  // SDK not available (web or not installed)
}

export interface PaywallProps {
  onPurchase?: (tierId: string) => void;
  onClose?: () => void;
  highlightTierId?: string;
}

export function Paywall({ onPurchase, onClose, highlightTierId }: PaywallProps) {
  const { colors } = useThemeColors();
  const { tier, offerings, isLoading, purchase } = useSubscription();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const tiers = gasConfig.features.inAppPurchases.tiers;
  const freeTierName = (tiers[0]?.name ?? 'free').toLowerCase();

  async function handlePurchase(productId: string, tierName: string) {
    if (Platform.OS === 'web' || !RNPurchases) return;
    const pkg = offerings?.current?.availablePackages?.find(
      p => p.product.identifier === productId
    );
    if (!pkg) return;
    setPurchasingId(productId);
    try {
      await purchase(pkg.identifier);
      onPurchase?.(tierName);
    } finally {
      setPurchasingId(null);
    }
  }

  const sdkAvailable = Platform.OS !== 'web' && !!RNPurchases;

  return (
  <ScrollView contentContainerStyle={styles.scroll} testID="paywall-scroll">
    {onClose && (
      <Button
        label="Close"
        onPress={onClose}
        variant="ghost"
        size="sm"
        style={styles.closeBtn}
      />
    )}

    <Text style={[styles.title, { color: colors.text }]}>Choose a plan</Text>

    {tiers.map(t => {
      const tierKey = t.name.toLowerCase();
      const isCurrent = tierKey === tier.toLowerCase();
      const isHighlighted = highlightTierId === t.productId || highlightTierId === tierKey;
      const isFree = tierKey === freeTierName;
      const isPurchasing = purchasingId === t.productId;

      return (
        <Card
          key={t.productId || t.name}
          variant={isHighlighted ? 'elevated' : 'outlined'}
          padding={20}
          style={isHighlighted ? { borderColor: colors.primary, borderWidth: 2 } : undefined}
        >
          <View style={styles.tierHeader}>
            <Text
              style={[styles.tierName, { color: colors.text }]}
              testID={`tier-name-${tierKey}`}
            >
              {t.name}
            </Text>

            {isCurrent && (
              <View
                style={[styles.badge, { backgroundColor: colors.success }]}
                testID={`badge-current-${tierKey}`}
              >
                <Text style={styles.badgeText}>Current plan</Text>
              </View>
            )}

            {isHighlighted && !isCurrent && (
              <View
                style={[styles.badge, { backgroundColor: colors.primary }]}
                testID={`badge-highlight-${tierKey}`}
              >
                <Text style={styles.badgeText}>Best value</Text>
              </View>
            )}
          </View>

          <Text style={[styles.price, { color: colors.textSecondary }]}>{t.price}</Text>

          {(t.features ?? []).map((f, i) => (
            <Text key={i} style={[styles.feature, { color: colors.text }]}>
              {'• ' + f}
            </Text>
          ))}

          <View style={styles.actionRow}>
            {isCurrent ? (
              <Button
                label="Current plan"
                onPress={() => {}}
                variant="secondary"
                disabled
                fullWidth
              />
            ) : isFree ? null : sdkAvailable ? (
              <Button
                label={isPurchasing ? 'Processing…' : `Get ${t.name}`}
                onPress={() => handlePurchase(t.productId, tierKey)}
                loading={isPurchasing}
                disabled={isLoading || isPurchasing}
                fullWidth
              />
            ) : (
              <Button
                label="Manage from a mobile device"
                onPress={() => {}}
                variant="secondary"
                disabled
                fullWidth
                testID={`btn-web-disabled-${tierKey}`}
              />
            )}
          </View>
        </Card>
      );
})}
  </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16 },
  closeBtn: { alignSelf: 'flex-end' },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  tierHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  tierName: { fontSize: 18, fontWeight: '700', flex: 1 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  price: { fontSize: 15, marginBottom: 12 },
  feature: { fontSize: 14, marginBottom: 4 },
  actionRow: { marginTop: 16 },
});