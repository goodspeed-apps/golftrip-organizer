import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { ArrowLeft, CheckCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';

type Step = 'input' | 'otp_sent' | 'verifying' | 'error';

export default function EmailSignInScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const startTime = useRef(Date.now());

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [isPhone, setIsPhone] = useState(false);
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<Step>('input');
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
      setStep('error');
      return;
    }
    btnScale.value = withSpring(0.95, {}, () => { btnScale.value = withSpring(1); });
    try {
      setStep('otp_sent');
      setErrorMsg('');
      if (isPhone) {
        const { error } = await supabase.auth.signInWithOtp({ phone: contact.trim() });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email: contact.trim() });
        if (error) throw error;
      }
      track('otp_sent', { method: isPhone ? 'phone' : 'email' });
      setCountdown(30);
    } catch (e) {
      captureException(e as Error, { screen: 'EmailSignIn', action: 'sendOtp' });
      setErrorMsg((e as Error).message ?? 'Failed to send code.');
      setStep('error');
    }
  };

  const verifyOtp = async () => {
    if (otp.length < 6) return;
    setStep('verifying');
    try {
      let result;
      if (isPhone) {
        result = await supabase.auth.verifyOtp({ phone: contact.trim(), token: otp, type: 'sms' });
      } else {
        result = await supabase.auth.verifyOtp({ email: contact.trim(), token: otp, type: 'email' });
      }
      if (result.error) throw result.error;
      const uid = result.data.user?.id;
      if (uid) {
        await supabase.from('users').upsert({ id: uid, display_name: name.trim(), ...(isPhone ? { phone: contact.trim() } : { email: contact.trim() }) }, { onConflict: 'id' });
      }
      track('otp_verified', { method: isPhone ? 'phone' : 'email' });
      setVerified(true);
      setTimeout(() => router.replace('/(tabs)/placeholder'), 1200);
    } catch (e) {
      captureException(e as Error, { screen: 'EmailSignIn', action: 'verifyOtp' });
      setErrorMsg((e as Error).message ?? 'Invalid code. Please try again.');
      setStep('error');
    }
  };

  const s = {
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
    title: { fontSize: 26, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 4 },
    subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 28 },
    label: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 6 },
    input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, fontFamily: 'Inter_400Regular', color: colors.text, backgroundColor: colors.surface, marginBottom: 16 },
    toggleRow: { flexDirection: 'row' as const, marginBottom: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 4 },
    toggleBtn: (active: boolean) => ({ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: active ? colors.primary : 'transparent', alignItems: 'center' as const }),
    toggleText: (active: boolean) => ({ fontSize: 14, fontFamily: 'Inter_400Regular', color: active ? colors.textOnPrimary : colors.textSecondary }),
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' as const, marginTop: 4 },
    primaryBtnText: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
    error: { fontSize: 14, color: colors.error, fontFamily: 'Inter_400Regular', textAlign: 'center' as const, marginBottom: 12 },
    backLink: { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: 20, justifyContent: 'center' as const },
    backText: { fontSize: 14, color: colors.textSecondary, fontFamily: 'Inter_400Regular', marginLeft: 4 },
    successRow: { alignItems: 'center' as const, marginVertical: 20 },
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Go back" accessibilityHint="Returns to previous screen" hitSlop={12}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.delay(50)}>
            <Text style={s.title}>{"Let's get you in"}</Text>
            <Text style={s.subtitle}>No password needed, just a quick code.</Text>
          </Animated.View>

          {verified ? (
            <Animated.View entering={FadeInDown} style={s.successRow}>
              <CheckCircle size={56} color={colors.success} />
              <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.success, marginTop: 12 }}>{"You're in!"}</Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(100)}>
              <Text style={s.label}>Your name</Text>
              <TextInput style={s.input} placeholder="e.g. Dave Mulligan" placeholderTextColor={colors.textSecondary} value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="next" accessibilityLabel="Name input" />

              <View style={s.toggleRow}>
                <TouchableOpacity style={s.toggleBtn(!isPhone)} onPress={() => setIsPhone(false)} accessibilityLabel="Use email" accessibilityHint="Switch to email input">
                  <Text style={s.toggleText(!isPhone)}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.toggleBtn(isPhone)} onPress={() => setIsPhone(true)} accessibilityLabel="Use phone" accessibilityHint="Switch to phone number input">
                  <Text style={s.toggleText(isPhone)}>Phone</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.label}>{isPhone ? 'Mobile number' : 'Email address'}</Text>
              <TextInput style={s.input} placeholder={isPhone ? '+1 555 000 0000' : 'you@example.com'} placeholderTextColor={colors.textSecondary} value={contact} onChangeText={setContact} keyboardType={isPhone ? 'phone-pad' : 'email-address'} autoCapitalize="none" returnKeyType="done" accessibilityLabel={isPhone ? 'Phone number input' : 'Email address input'} />

              {(step === 'error') && <Text style={s.error}>{errorMsg}</Text>}

              {step === 'input' || step === 'error' ? (
                <Animated.View style={btnStyle}>
                  <TouchableOpacity style={s.primaryBtn} onPress={sendOtp} accessibilityLabel="Send one-time code" accessibilityHint="Sends a 6-digit verification code" activeOpacity={0.85}>
                    <Text style={s.primaryBtnText}>Send Code</Text>
                  </TouchableOpacity>
                </Animated.View>
              ) : null}

              {(step === 'otp_sent' || step === 'verifying') && (
                <Animated.View entering={FadeInDown.delay(50)}>
                  <Text style={s.label}>6-digit code</Text>
                  <TextInput style={s.input} placeholder="••••••" placeholderTextColor={colors.textSecondary} value={otp} onChangeText={v => { setOtp(v); if (v.length === 6) { setStep('verifying'); } }} keyboardType="number-pad" maxLength={6} autoFocus accessibilityLabel="One-time code input" accessibilityHint="Enter the 6-digit code you received" />

                  {step === 'verifying' && otp.length === 6 ? (
                    <TouchableOpacity style={s.primaryBtn} onPress={verifyOtp} accessibilityLabel="Verify code" accessibilityHint="Confirms your identity" activeOpacity={0.85}>
                      {step === 'verifying' ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={s.primaryBtnText}>Verify</Text>}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[s.primaryBtn, { backgroundColor: countdown > 0 ? colors.surfaceSecondary : colors.primary }]} onPress={countdown > 0 ? undefined : sendOtp} disabled={countdown > 0} accessibilityLabel={countdown > 0 ? `Resend in ${countdown} seconds` : 'Resend code'} accessibilityHint="Sends a new 6-digit code" activeOpacity={0.85}>
                      <Text style={[s.primaryBtnText, { color: countdown > 0 ? colors.textSecondary : colors.textOnPrimary }]}>{countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}</Text>
                    </TouchableOpacity>
                  )}
                </Animated.View>
              )}

              <TouchableOpacity style={s.backLink} onPress={() => router.back()} accessibilityLabel="Back to sign in options" accessibilityHint="Returns to the authentication gate">
                <ArrowLeft size={14} color={colors.textSecondary} />
                <Text style={s.backText}>Back to sign-in options</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
