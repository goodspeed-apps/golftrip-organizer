import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { ArrowLeft, CheckCircle } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';

type UIState = 'input' | 'otp_sent' | 'verifying' | 'error';

export default function EmailSignInScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const startTime = useRef(Date.now());

  const [uiState, setUiState] = useState<UIState>('input');
  const [inputMode, setInputMode] = useState<'email' | 'phone'>('email');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [verified, setVerified] = useState(false);

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  useEffect(() => {
    track('screen_view_email_sign_in');
    trackScreenLoad('EmailSignIn', startTime.current);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendOtp = async () => {
    if (!name.trim() || !contact.trim()) {
      setErrorMsg('Please enter your name and contact info.');
      setUiState('error');
      return;
    }
    btnScale.value = withSpring(0.95, {}, () => { btnScale.value = withSpring(1); });
    try {
      setUiState('otp_sent');
      setErrorMsg('');
      if (inputMode === 'email') {
        const { error } = await supabase.auth.signInWithOtp({ email: contact.trim() });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({ phone: contact.trim() });
        if (error) throw error;
      }
      track('otp_sent', { mode: inputMode });
      setCountdown(30);
    } catch (e) {
      captureException(e as Error, { screen: 'EmailSignIn', action: 'sendOtp' });
      setErrorMsg((e as Error).message ?? 'Failed to send code. Please try again.');
      setUiState('error');
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return;
    setUiState('verifying');
    try {
      let result;
      if (inputMode === 'email') {
        result = await supabase.auth.verifyOtp({ email: contact.trim(), token: otp, type: 'email' });
      } else {
        result = await supabase.auth.verifyOtp({ phone: contact.trim(), token: otp, type: 'sms' });
      }
      if (result.error) throw result.error;
      if (result.data.user) {
        await supabase.from('users').upsert({ id: result.data.user.id, display_name: name.trim(), email: result.data.user.email ?? null, phone: result.data.user.phone ?? null }, { onConflict: 'id' });
      }
      track('otp_verified', { mode: inputMode });
      setVerified(true);
      setTimeout(() => router.replace('/(tabs)/placeholder'), 1200);
    } catch (e) {
      captureException(e as Error, { screen: 'EmailSignIn', action: 'verifyOtp' });
      setErrorMsg((e as Error).message ?? 'Invalid code. Please try again.');
      setUiState('error');
    }
  };

  const s = {
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1, padding: 24 },
    back: { flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 32, minHeight: 44 },
    backText: { fontSize: 16, color: colors.primary, marginLeft: 6 },
    title: { fontSize: 28, fontWeight: '700' as const, color: colors.text, marginBottom: 8 },
    subtitle: { fontSize: 16, color: colors.textSecondary, marginBottom: 32, lineHeight: 24 },
    toggle: { flexDirection: 'row' as const, backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginBottom: 20 },
    toggleBtn: (active: boolean) => ({ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' as const, backgroundColor: active ? colors.primary : 'transparent' }),
    toggleText: (active: boolean) => ({ fontSize: 15, fontWeight: '600' as const, color: active ? colors.textOnPrimary : colors.textSecondary }),
    label: { fontSize: 14, fontWeight: '600' as const, color: colors.textSecondary, marginBottom: 6 },
    input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: colors.text, backgroundColor: colors.surface, marginBottom: 16 },
    ctaWrap: { marginTop: 8 },
    cta: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' as const },
    ctaText: { fontSize: 17, fontWeight: '700' as const, color: colors.textOnPrimary },
    resend: { paddingVertical: 16, alignItems: 'center' as const, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14 },
    resendText: { fontSize: 16, color: colors.textSecondary },
    errorBox: { backgroundColor: colors.warningMuted, borderRadius: 10, padding: 12, marginBottom: 16 },
    errorText: { color: colors.error, fontSize: 14 },
    successWrap: { alignItems: 'center' as const, marginTop: 48 },
    successText: { fontSize: 20, fontWeight: '700' as const, color: colors.success, marginTop: 16 },
  };

  if (verified) {
    return (
      <SafeAreaView style={s.safe}>
        <Animated.View entering={FadeInDown} style={s.successWrap}>
          <CheckCircle size={72} color={colors.success} />
          <Text style={s.successText}>{"You're all set!"}</Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.back} onPress={() => router.back()} accessibilityLabel="Go back" accessibilityHint="Return to previous screen">
            <ArrowLeft size={20} color={colors.primary} />
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>

          <Text style={s.title}>{"Let's get you in"}</Text>
          <Text style={s.subtitle}>{"No password needed, we'll send a quick code to verify it's you."}</Text>

          {(uiState === 'input' || uiState === 'error') && (
            <Animated.View entering={FadeInDown.delay(50)}>
              {uiState === 'error' && errorMsg ? <View style={s.errorBox}><Text style={s.errorText}>{errorMsg}</Text></View> : null}
              <Text style={s.label}>Your Name</Text>
              <TextInput style={s.input} placeholder="Full name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="next" accessibilityLabel="Full name input" />
              <View style={s.toggle}>
                <TouchableOpacity style={s.toggleBtn(inputMode === 'email')} onPress={() => setInputMode('email')} accessibilityLabel="Use email" accessibilityHint="Switch to email sign-in">
                  <Text style={s.toggleText(inputMode === 'email')}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.toggleBtn(inputMode === 'phone')} onPress={() => setInputMode('phone')} accessibilityLabel="Use phone number" accessibilityHint="Switch to phone sign-in">
                  <Text style={s.toggleText(inputMode === 'phone')}>Phone</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.label}>{inputMode === 'email' ? 'Email Address' : 'Phone Number'}</Text>
              <TextInput style={s.input} placeholder={inputMode === 'email' ? 'you@example.com' : '+1 555 000 0000'} placeholderTextColor={colors.textMuted} value={contact} onChangeText={setContact} keyboardType={inputMode === 'email' ? 'email-address' : 'phone-pad'} autoCapitalize="none" autoCorrect={false} accessibilityLabel={inputMode === 'email' ? 'Email address input' : 'Phone number input'} />
              <View style={s.ctaWrap}>
                <Animated.View style={btnStyle}>
                  <TouchableOpacity style={s.cta} onPress={sendOtp} accessibilityLabel="Send one-time code" accessibilityHint="Sends a 6-digit verification code">
                    <Text style={s.ctaText}>Send Code</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </Animated.View>
          )}

          {uiState === 'otp_sent' && (
            <Animated.View entering={FadeInDown.delay(50)}>
              <Text style={s.label}>{"Enter the 6-digit code"}</Text>
              <TextInput style={s.input} placeholder="123456" placeholderTextColor={colors.textMuted} value={otp} onChangeText={v => { setOtp(v.replace(/\D/g, '').slice(0, 6)); if (v.replace(/\D/g, '').length === 6) verifyOtp(); }} keyboardType="number-pad" maxLength={6} accessibilityLabel="OTP code input" accessibilityHint="Enter the 6-digit code we sent you" />
              <View style={s.ctaWrap}>
                <Animated.View style={btnStyle}>
                  <TouchableOpacity style={s.cta} onPress={verifyOtp} accessibilityLabel="Verify code" accessibilityHint="Confirm your identity with the code">
                    <Text style={s.ctaText}>Verify</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
              <TouchableOpacity style={[s.resend, { marginTop: 12, opacity: countdown > 0 ? 0.5 : 1 }]} onPress={countdown > 0 ? undefined : sendOtp} disabled={countdown > 0} accessibilityLabel={countdown > 0 ? `Resend in ${countdown} seconds` : 'Resend code'} accessibilityHint="Request a new verification code">
                <Text style={s.resendText}>{countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {uiState === 'verifying' && (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[s.subtitle, { marginTop: 16, textAlign: 'center' }]}>Verifying your code…</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
