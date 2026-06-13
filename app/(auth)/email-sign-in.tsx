import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown, withSpring, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { ArrowLeft, CheckCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useThemeColors } from '@/context/ThemeContext';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';

type Stage = 'input' | 'otp_sent' | 'verifying' | 'error';

export default function EmailSignIn() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const start = useRef(Date.now());

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<Stage>('input');
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isPhone, setIsPhone] = useState(false);
  const [verified, setVerified] = useState(false);

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  useEffect(() => {
    track('screen_view_email_sign_in');
    trackScreenLoad('EmailSignIn', start.current);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const pressIn = () => { btnScale.value = withSpring(0.97, { damping: 15 }); };
  const pressOut = () => { btnScale.value = withSpring(1, { damping: 15 }); };

  const sendOtp = useCallback(async () => {
    if (!name.trim() || !contact.trim()) { setErrorMsg('Please fill in all fields.'); setStage('error'); return; }
    setStage('otp_sent');
    setErrorMsg('');
    try {
      const payload = isPhone
        ? { phone: contact }
        : { email: contact, options: { data: { display_name: name } } };
      const { error } = isPhone
        ? await supabase.auth.signInWithOtp({ phone: contact })
        : await supabase.auth.signInWithOtp({ email: contact, options: { data: { display_name: name } } });
      if (error) throw error;
      track('otp_sent', { method: isPhone ? 'phone' : 'email' });
      setCountdown(30);
    } catch (e) {
      captureException(e as Error, { screen: 'EmailSignIn', action: 'sendOtp' });
      setErrorMsg((e as Error).message ?? 'Failed to send code. Try again.');
      setStage('error');
    }
  }, [name, contact, isPhone, track]);

  const verifyOtp = useCallback(async () => {
    if (otp.length < 6) return;
    setStage('verifying');
    try {
      const { error } = isPhone
        ? await supabase.auth.verifyOtp({ phone: contact, token: otp, type: 'sms' })
        : await supabase.auth.verifyOtp({ email: contact, token: otp, type: 'email' });
      if (error) throw error;
      track('otp_verified', { method: isPhone ? 'phone' : 'email' });
      setVerified(true);
      setTimeout(() => router.replace('/(tabs)/placeholder'), 800);
    } catch (e) {
      captureException(e as Error, { screen: 'EmailSignIn', action: 'verifyOtp' });
      setErrorMsg((e as Error).message ?? 'Invalid code. Please try again.');
      setStage('error');
    }
  }, [otp, contact, isPhone, track]);

  const inputStyle = {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: 12, padding: 16, fontSize: 16, color: colors.text,
    marginBottom: 14, fontFamily: 'Inter_400Regular', minHeight: 52,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 12 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} accessibilityLabel="Go back" accessibilityHint="Returns to previous screen"
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28, minHeight: 44 }}>
            <ArrowLeft size={22} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 16, marginLeft: 6, fontFamily: 'Inter_500Medium' }}>Back</Text>
          </Pressable>

          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <Text style={{ fontSize: 28, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 6 }}>{"Let's get you in"}</Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'Inter_400Regular', marginBottom: 28 }}>{"No password needed, we'll send a quick code."}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <TextInput style={inputStyle} placeholder="Your name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} autoCapitalize="words" editable={stage !== 'verifying'} accessibilityLabel="Full name input" />
            <View style={{ flexDirection: 'row', marginBottom: 14 }}>
              {['Email', 'Phone'].map((label, i) => (
                <Pressable key={label} onPress={() => setIsPhone(i === 1)} accessibilityLabel={`Use ${label}`}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: isPhone === (i === 1) ? colors.primary : colors.surface, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginRight: i === 0 ? 8 : 0 }}>
                  <Text style={{ color: isPhone === (i === 1) ? colors.textOnPrimary : colors.text, fontFamily: 'Inter_500Medium', fontSize: 14 }}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={inputStyle} placeholder={isPhone ? '+1 555 000 0000' : 'you@example.com'} placeholderTextColor={colors.textMuted} value={contact} onChangeText={setContact} keyboardType={isPhone ? 'phone-pad' : 'email-address'} autoCapitalize="none" editable={stage !== 'verifying'} accessibilityLabel="Email or phone input" />
          </Animated.View>

          {stage !== 'input' && stage !== 'error' && (
            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={{ marginBottom: 14 }}>
              <TextInput style={{ ...inputStyle, letterSpacing: 8, textAlign: 'center', fontSize: 22 }} placeholder="------" placeholderTextColor={colors.textMuted} value={otp} onChangeText={t => { setOtp(t); if (t.length === 6) setTimeout(() => verifyOtp(), 100); }} keyboardType="number-pad" maxLength={6} editable={stage !== 'verifying'} accessibilityLabel="6-digit OTP input" accessibilityHint="Enter the code sent to your contact" />
              {verified && <CheckCircle size={28} color={colors.success} style={{ alignSelf: 'center', marginTop: 4 }} />}
            </Animated.View>
          )}

          {(stage === 'error') && <Animated.Text entering={FadeInDown.duration(300)} style={{ color: colors.error, fontSize: 14, marginBottom: 14, fontFamily: 'Inter_400Regular' }}>{errorMsg}</Animated.Text>}

          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={btnStyle}>
            <Pressable onPressIn={pressIn} onPressOut={pressOut} accessibilityLabel={stage === 'otp_sent' ? 'Verify code' : 'Send OTP'} accessibilityHint="Sends a one-time code to your contact"
              onPress={stage === 'otp_sent' ? verifyOtp : sendOtp}
              disabled={stage === 'verifying' || countdown > 0}
              style={{ backgroundColor: stage === 'verifying' || countdown > 0 ? colors.primaryMuted : colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', minHeight: 52 }}>
              {stage === 'verifying' ? <ActivityIndicator color={colors.textOnPrimary} /> :
                <Text style={{ color: colors.textOnPrimary, fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' }}>
                  {stage === 'otp_sent' ? 'Verify Code' : countdown > 0 ? `Resend in ${countdown}s` : 'Send Code'}
                </Text>}
            </Pressable>
          </Animated.View>

          {stage === 'otp_sent' && countdown === 0 && (
            <Pressable onPress={sendOtp} accessibilityLabel="Resend OTP" style={{ marginTop: 16, alignItems: 'center', minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: colors.primary, fontSize: 14, fontFamily: 'Inter_500Medium' }}>Resend Code</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
