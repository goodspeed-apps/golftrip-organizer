/**
 * GAS Template, RatingPrompt
 *
 * In-app rating prompt: asks before triggering OS store review dialog.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Star, MessageCircle } from 'lucide-react-native';
import * as StoreReview from 'expo-store-review';
import { captureEvent } from '../lib/posthog';
import { useThemeColors } from '../context/ThemeContext';
import { gasConfig } from '../gas.config';

export interface RatingPromptProps {
  visible: boolean;
  onDismiss: () => void;
  onFeedback?: () => void;
}

export function RatingPrompt({ visible, onDismiss, onFeedback }: RatingPromptProps) {
  const { colors } = useThemeColors();
  const [step, setStep] = useState<'ask' | 'feedback'>('ask');

  const handleYes = useCallback(async () => {
    captureEvent('rating_prompt', { action: 'yes' });
    try {
      if (await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
      }
    } catch {
      // Store review not available
    }
    onDismiss();
  }, [onDismiss]);

  const handleNo = useCallback(() => {
    captureEvent('rating_prompt', { action: 'no' });
    if (onFeedback) {
      setStep('feedback');
    } else {
      onDismiss();
    }
  }, [onDismiss, onFeedback]);

  const handleFeedback = useCallback(() => {
    captureEvent('rating_prompt', { action: 'feedback' });
    onFeedback?.();
    onDismiss();
  }, [onDismiss, onFeedback]);

  if (!visible) return null;

  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center',
      padding: 24, zIndex: 9999,
    }}>
      <View style={{
        backgroundColor: colors.surface, borderRadius: 24, padding: 28,
        width: '100%', maxWidth: 320, alignItems: 'center',
      }}>
        {step === 'ask' ? (
          <>
            <Star size={32} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>
              Enjoying {gasConfig.app.name}?
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
              Your feedback helps us improve
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' }}>
              <TouchableOpacity
                onPress={handleNo}
                style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                accessibilityRole="button"
                accessibilityLabel="No, not enjoying"
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Not really</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleYes}
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                accessibilityRole="button"
                accessibilityLabel="Yes, enjoying the app"
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Yes!</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <MessageCircle size={32} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>
              How can we improve?
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
              We'd love to hear your thoughts
            </Text>
            <TouchableOpacity
              onPress={handleFeedback}
              style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, width: '100%', alignItems: 'center', marginTop: 20 }}
              accessibilityRole="button"
              accessibilityLabel="Give feedback"
            >
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Share Feedback</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDismiss}
              style={{ minHeight: 44, paddingHorizontal: 16, marginTop: 8, alignItems: 'center', justifyContent: 'center' }}
              accessibilityRole="button"
              accessibilityLabel="Maybe later"
            >
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Maybe later</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}
