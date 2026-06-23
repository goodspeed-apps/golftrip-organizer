import React, { useState } from 'react';
import { View, Text, Modal, Platform, Linking } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../gas.config';
import { useSubscription } from '@/hooks/useSubscription';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Paywall } from './Paywall';

let RNPurchases: typeof import('react-native-purchases').default | null = null;
try {
  RNPurchases = require('react-native-purchases').default;
} catch {
  // SDK not available
}

function resolveStoreUrl(): string | undefined {
  // Read Platform lazily inside the handler so test environments (where
  // Platform.OS is patched per spec) and Storybook stories can override
  // platform without snapshotting it at module load.
  return Platform.OS === 'android'
    ? gasConfig.releaseChannels?.storeUrl?.android
    : gasConfig.releaseChannels?.storeUrl?.ios;
}

export function SubscriptionManager() {
  const { colors } = useThemeColors();
  const { tier, trialEndsAt, isTrialing } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  const tiers = gasConfig.features.inAppPurchases.tiers;
  const freeTierName = (tiers[0]?.name ?? 'free').toLowerCase();
  const isFree = tier.toLowerCase() === freeTierName;

  const currentTierConfig = tiers.find(t => t.name.toLowerCase() === tier.toLowerCase());
  const displayName = currentTierConfig?.name ?? tier;
  const billingPeriod = currentTierConfig?.price ?? 'Free';

async function handleManage() {
    const storeUrl = resolveStoreUrl();
    if (Platform.OS === 'web') {
      if (storeUrl) Linking.openURL(storeUrl);
      return;
    }
    if (RNPurchases && typeof (RNPurchases as any).showManageSubscriptions === 'function') {
      try {
        await (RNPurchases as any).showManageSubscriptions();
      } catch {
        if (storeUrl) Linking.openURL(storeUrl);
      }
    } else if (storeUrl) {
      Linking.openURL(storeUrl);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Card variant="elevated" padding={20}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>
          Current plan
        </Text>
        <Text
          style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 8 }}
          testID="current-tier-name"
        >
          {displayName}
        </Text>

        <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 4 }}>
          {billingPeriod}
        </Text>

        {isTrialing && trialEndsAt && (
          <Text style={{ color: colors.warning, fontSize: 13, marginBottom: 4 }}>
            {`Trial ends ${new Date(trialEndsAt).toLocaleDateString()}`}
          </Text>
        )}

        {!isFree && (
          <View style={{ marginTop: 16 }}>
            <Button
              label="Manage subscription"
              onPress={handleManage}
              variant="outline"
              fullWidth
              testID="btn-manage-subscription"
            />
          </View>
        )}

        {isFree && (
          <View style={{ marginTop: 16 }}>
            <Button
              label="Upgrade"
              onPress={() => setShowPaywall(true)}
              fullWidth
              testID="btn-upgrade"
            />
          </View>
        )}
      </Card>

      <Modal
        visible={showPaywall}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPaywall(false)}
      >
        <Paywall onClose={() => setShowPaywall(false)} />
      </Modal>
    </View>
  );
}