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
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Mail, Link } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';

const AppleAuth = Platform.OS === 'ios' ? require('expo-apple-authentication') : null;

export default function AuthGate() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { signInWithGoogle, signInWithApple } = useAuth() as {
    signInWithGoogle?: () => Promise<void>;
    signInWithApple?: () => Promise<void>;
  };
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startTime = useRef(Date.now());

  useEffect(() => {
    track('screen_view_auth_gate', {});
    trackScreenLoad('AuthGate', startTime.current);
  }, []);

  const handleOAuth = async (provider: 'google' | 'apple') => {
    try {
      setError(null);
      setLoadingProvider(provider);
      if (provider === 'google') await signInWithGoogle?.();
      else await signInWithApple?.();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      captureException(err, { screen: 'AuthGate', action: `oauth_${provider}` });
      setError('Sign-in failed. Please try again.');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleInviteLink = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    track('auth_join_with_link', {});
    router.push('/auth/callback');
  };

  const scale = useSharedValue(1);
  const animatedPress = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800' }}
      style={styles.bg}
    >
      <View style={[styles.overlay, { backgroundColor: colors.shadow }]} />
      <SafeAreaView style={styles.safe}>
        <Animated.View entering={FadeInDown.delay(50)} style={styles.logo}>
          <Text style={[styles.logoText, { color: colors.textOnPrimary, fontFamily: 'PlusJakartaSans_700Bold' }]}>⛳ GolfTrip</Text>
          <Text style={[styles.tagline, { color: colors.textOnPrimary, fontFamily: 'Inter_400Regular' }]}>Organize. Play. Remember.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {error && (
            <Text style={[styles.error, { color: colors.error, fontFamily: 'Inter_400Regular' }]}>{error}</Text>
          )}

          {AppleAuth && (
            <Pressable
              accessibilityLabel="Continue with Apple"
              accessibilityHint="Sign in using your Apple ID"
              onPress={() => handleOAuth('apple')}
              style={[styles.btn, { backgroundColor: colors.text }]}
            >
              {loadingProvider === 'apple' ? <ActivityIndicator color={colors.background} /> : (
                <Text style={[styles.btnText, { color: colors.background, fontFamily: 'Inter_600SemiBold' }]}>Continue with Apple</Text>
              )}
            </Pressable>
          )}

          <Pressable
            accessibilityLabel="Continue with Google"
            accessibilityHint="Sign in using your Google account"
            onPress={() => handleOAuth('google')}
            style={[styles.btn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
          >
            {loadingProvider === 'google' ? <ActivityIndicator color={colors.primary} /> : (
              <Text style={[styles.btnText, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>Continue with Google</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityLabel="Sign in with email or phone"
            accessibilityHint="Navigate to email and phone sign-in screen"
            onPress={() => { track('auth_email_tap', {}); router.push('/(auth)/login'); }}
            style={[styles.btn, { backgroundColor: colors.primary }]}
          >
            <Mail size={18} color={colors.textOnPrimary} />
            <Text style={[styles.btnText, { color: colors.textOnPrimary, fontFamily: 'Inter_600SemiBold', marginLeft: 8 }]}>Email / Phone</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Join with invite link"
            accessibilityHint="Use an invite link to join a golf trip as a guest"
            onPress={handleInviteLink}
            style={[styles.ghostBtn, { borderColor: colors.primary }]}
          >
            <Link size={16} color={colors.primary} />
            <Text style={[styles.ghostText, { color: colors.primary, fontFamily: 'Inter_500Medium', marginLeft: 6 }]}>Join with invite link</Text>
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
  overlay: { ...StyleSheet.absoluteFillObject, opacity: 0.55 },
  safe: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 24 },
  logo: { alignItems: 'center', marginBottom: 28 },
  logoText: { fontSize: 34, lineHeight: 42 },
  tagline: { fontSize: 15, marginTop: 4, opacity: 0.9 },
  card: { borderRadius: 20, padding: 24, borderWidth: 1, gap: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, height: 52, paddingHorizontal: 16 },
  btnText: { fontSize: 16 },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, height: 48, borderWidth: 1.5 },
  ghostText: { fontSize: 15 },
  error: { fontSize: 13, textAlign: 'center' },
  terms: { fontSize: 11, textAlign: 'center', marginTop: 4, lineHeight: 16 },
});
