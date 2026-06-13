import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  ActivityIndicator,
  ImageBackground,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Mail, Link } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';

const AppleAuth = Platform.OS === 'ios' ? require('expo-apple-authentication') : null;

export default function AuthGateScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { signInWithGoogle, signInWithApple } = useAuth() as {
    signInWithGoogle: () => Promise<void>;
    signInWithApple: () => Promise<void>;
  };
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startTime = useRef(Date.now());

  useEffect(() => {
    track('screen_view_auth_gate');
    trackScreenLoad('AuthGate', startTime.current);
  }, []);

  const handleGoogle = async () => {
    try {
      setError(null);
      setLoading('google');
      track('auth_google_tap');
      await signInWithGoogle();
    } catch (e) {
      captureException(e as Error, { screen: 'AuthGate', action: 'signInWithGoogle' });
      setError('Google sign-in failed. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleApple = async () => {
    try {
      setError(null);
      setLoading('apple');
      track('auth_apple_tap');
      await signInWithApple();
    } catch (e) {
      captureException(e as Error, { screen: 'AuthGate', action: 'signInWithApple' });
      setError('Apple sign-in failed. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleEmail = () => {
    track('auth_email_tap');
    router.push('/(auth)/login');
  };

  const handleInviteLink = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    track('auth_invite_link_tap');
    router.push('/(auth)/login');
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800' }}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { backgroundColor: colors.shadow }]} />
      <SafeAreaView style={styles.safe}>
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.hero}>
          <Text style={[styles.logo, { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' }]}>⛳ GolfTrip</Text>
          <Text style={[styles.tagline, { color: colors.textOnPrimary, fontFamily: 'Inter_400Regular' }]}>
            {"Plan, play & remember every trip."}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).springify()} style={[styles.card, { backgroundColor: colors.surface }]}>
          {error ? (
            <Text style={[styles.error, { color: colors.error, fontFamily: 'Inter_400Regular' }]}>{error}</Text>
          ) : null}

          {Platform.OS === 'ios' && AppleAuth ? (
            <Pressable
              onPress={handleApple}
              disabled={!!loading}
              accessibilityLabel="Sign in with Apple"
              accessibilityHint="Authenticates using your Apple ID"
              style={[styles.btn, { backgroundColor: colors.text }]}
            >
              {loading === 'apple' ? <ActivityIndicator color={colors.background} /> : (
                <Text style={[styles.btnText, { color: colors.background, fontFamily: 'Inter_600SemiBold' }]}>🍎  Sign in with Apple</Text>
              )}
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleGoogle}
            disabled={!!loading}
            accessibilityLabel="Sign in with Google"
            accessibilityHint="Authenticates using your Google account"
            style={[styles.btn, { backgroundColor: colors.primary }]}
          >
            {loading === 'google' ? <ActivityIndicator color={colors.textOnPrimary} /> : (
              <Text style={[styles.btnText, { color: colors.textOnPrimary, fontFamily: 'Inter_600SemiBold' }]}>🔵  Sign in with Google</Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleEmail}
            accessibilityLabel="Sign in with email or phone"
            accessibilityHint="Opens email and phone sign-in screen"
            style={[styles.btn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Mail size={16} color={colors.text} />
            <Text style={[styles.btnText, { color: colors.text, fontFamily: 'Inter_600SemiBold', marginLeft: 8 }]}>Email or Phone</Text>
          </Pressable>

          <Pressable
            onPress={handleInviteLink}
            accessibilityLabel="Join with invite link"
            accessibilityHint="Join a trip using an invite link without creating an account"
            style={[styles.ghostBtn]}
          >
            <Link size={15} color={colors.primary} />
            <Text style={[styles.ghostText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>  Join with invite link</Text>
          </Pressable>

          <Text style={[styles.terms, { color: colors.textMuted, fontFamily: 'Inter_400Regular' }]}>
            {"By continuing you agree to our Terms & Privacy Policy."}
          </Text>
        </Animated.View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, opacity: 0.45 },
  safe: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 24 },
  hero: { alignItems: 'center', marginBottom: 28 },
  logo: { fontSize: 34 },
  tagline: { fontSize: 16, marginTop: 6, opacity: 0.9 },
  card: { borderRadius: 20, padding: 24, gap: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 12, paddingHorizontal: 16 },
  btnText: { fontSize: 16 },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  ghostText: { fontSize: 15 },
  error: { fontSize: 13, textAlign: 'center' },
  terms: { fontSize: 11, textAlign: 'center', marginTop: 4, opacity: 0.7 },
});
