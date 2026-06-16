import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Trophy, Share2, Star, ChevronLeft } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers, markOnboardingComplete } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { captureException } from '@/lib/sentry';

const { width } = Dimensions.get('window');
const TOTAL_STEPS = 7;
const CURRENT_STEP = 7;

export default function Step7Screen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const startTime = useRef(Date.now());

  const btnScale = useSharedValue(1);
  const btnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  useEffect(() => {
    track('onboarding_step_7');
    trackScreenLoad('OnboardingStep7', startTime.current);
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    try {
      saveOnboardingAnswers({ recap_paywall_seen: true });
      await markOnboardingComplete();
      router.replace('/(auth)/signup');
    } catch (err) {
      captureException(err instanceof Error ? err : new Error(String(err)), {
        screen: 'OnboardingStep7',
        action: 'continue',
      });
    }
  };

  const onPressIn = () => { btnScale.value = withSpring(0.96); };
  const onPressOut = () => { btnScale.value = withSpring(1); };

  const styles = makeStyles(colors);

  const perks = [
    { icon: Trophy, label: 'Recap Card', desc: "A beautiful summary your group will actually share" },
    { icon: Share2, label: 'One-tap sharing', desc: "Send it straight to the group chat, no screenshots needed" },
    { icon: Star, label: 'Trip highlights', desc: "Best rounds, top moments, final expense tally, all in one place" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Progress */}
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.pip,
              i < CURRENT_STEP ? styles.pipActive : styles.pipInactive,
            ]}
          />
        ))}
      </View>

      {/* Back */}
      <Pressable
        onPress={handleBack}
        style={styles.backBtn}
        accessibilityLabel="Go back"
        accessibilityHint="Returns to the previous onboarding step"
      >
        <ChevronLeft size={22} color={colors.textSecondary} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero badge */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.heroBadge}>
          <Trophy size={44} color={colors.accent} />
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(60).springify()} style={styles.heading}>
          {"Your trip's done, \nnow make it legendary."}
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(120).springify()} style={styles.subheading}>
          {"Generate your Recap Card, the shareable summary your group will love. One tap and everyone gets the highlights, the expenses, and the bragging rights."}
        </Animated.Text>

        {/* Perks */}
        <View style={styles.perksContainer}>
          {perks.map(({ icon: Icon, label, desc }, index) => (
            <Animated.View
              key={label}
              entering={FadeInDown.delay(180 + 50 * index).springify()}
              style={styles.perkCard}
            >
              <View style={styles.perkIconWrap}>
                <Icon size={20} color={colors.accent} />
              </View>
              <View style={styles.perkText}>
                <Text style={styles.perkLabel}>{label}</Text>
                <Text style={styles.perkDesc}>{desc}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(340).springify()} style={styles.trustNote}>
          <Text style={styles.trustText}>
            {"Unlock Recap Cards and unlimited trip history with GolfTrip Pro, or keep using the core features free, forever."}
          </Text>
        </Animated.View>
      </ScrollView>

      {/* CTA, NOT wrapped in entering animation */}
      <View style={styles.footer}>
        <Animated.View style={btnAnimStyle}>
          <Pressable
            onPress={handleContinue}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={styles.ctaBtn}
            accessibilityLabel="Create my account"
            accessibilityHint="Finishes onboarding and takes you to the sign-up screen"
          >
            <Text style={styles.ctaText}>{"Create My Account"}</Text>
          </Pressable>
        </Animated.View>
        <Text style={styles.footerNote}>{"No credit card needed to get started."}</Text>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      paddingTop: 16,
      paddingHorizontal: 24,
    },
    pip: {
      height: 4,
      borderRadius: 2,
      flex: 1,
    },
    pipActive: {
      backgroundColor: colors.primary,
    },
    pipInactive: {
      backgroundColor: colors.border,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 4,
      minHeight: 44,
      alignSelf: 'flex-start',
    },
    backText: {
      fontSize: 15,
      fontFamily: 'Manrope_500Medium',
      color: colors.textSecondary,
    },
    scroll: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      alignItems: 'center',
    },
    heroBadge: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      marginBottom: 24,
    },
    heading: {
      fontSize: 28,
      fontFamily: 'Outfit_700Bold',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 36,
      marginBottom: 14,
    },
    subheading: {
      fontSize: 16,
      fontFamily: 'Manrope_400Regular',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 28,
    },
    perksContainer: {
      width: '100%',
      gap: 12,
      marginBottom: 24,
    },
    perkCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    perkIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    perkText: {
      flex: 1,
    },
    perkLabel: {
      fontSize: 15,
      fontFamily: 'Outfit_700Bold',
      color: colors.text,
      marginBottom: 2,
    },
    perkDesc: {
      fontSize: 13,
      fontFamily: 'Manrope_400Regular',
      color: colors.textSecondary,
      lineHeight: 18,
    },
    trustNote: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      width: '100%',
    },
    trustText: {
      fontSize: 13,
      fontFamily: 'Manrope_400Regular',
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    footer: {
      paddingHorizontal: 24,
      paddingBottom: 16,
      paddingTop: 8,
      alignItems: 'center',
      gap: 10,
    },
    ctaBtn: {
      backgroundColor: colors.primary,
      borderRadius: 28,
      paddingVertical: 16,
      paddingHorizontal: 48,
      alignItems: 'center',
      minWidth: width - 48,
      minHeight: 56,
      justifyContent: 'center',
    },
    ctaText: {
      fontSize: 17,
      fontFamily: 'Outfit_700Bold',
      color: colors.textOnPrimary,
      letterSpacing: 0.3,
    },
    footerNote: {
      fontSize: 12,
      fontFamily: 'Manrope_400Regular',
      color: colors.textMuted,
    },
  });
}
