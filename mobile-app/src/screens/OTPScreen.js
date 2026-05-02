import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';

export default function OTPScreen({ navigation, route }) {
  const [otp, setOtp] = useState('');
  const phone = route?.params?.phone || '';
  const name = route?.params?.name || '';
  const inputRef = useRef();

  const isValid = otp.length === 6;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Back button */}
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>Verify OTP</Text>

      <Text style={styles.hint}>
        A 6-digit code was sent to{'\n'}
        <Text style={styles.hintPhone}>{phone}</Text>
      </Text>

      <View style={styles.card}>
        <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
          <Text style={styles.label}>Enter OTP </Text>
          <View style={styles.otpRow}>
            {[0,1,2,3,4,5].map(i => (
              <View
                key={i}
                style={[
                  styles.otpBox,
                  otp[i] ? styles.otpBoxFilled : {},
                ]}
              >
                <Text style={styles.otpChar}>{otp[i] || ''}</Text>
              </View>
            ))}
          </View>
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={otp}
            onChangeText={v => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !isValid && styles.buttonDisabled]}
          disabled={!isValid}
          onPress={() => navigation.navigate('PersonaSelect', { name })}
        >
          <Text style={styles.buttonText}>Verify </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow}>
          <Text style={styles.link}>Didn't receive it? </Text>
          <Text style={styles.linkBold}>Resend OTP</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', padding: SPACING.lg,
  },
  back: { position: 'absolute', top: 56, left: SPACING.lg },
  backText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.primary },
  heading: {
    fontFamily: FONTS.heading, fontSize: 44,
    color: COLORS.roseDark, letterSpacing: 2, marginBottom: 4,
  },
  tamilSub: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted, marginBottom: 8 },
  hint: {
    fontFamily: FONTS.body, fontSize: 13,
    color: COLORS.muted, textAlign: 'center', marginBottom: SPACING.xl,
  },
  hintPhone: { color: COLORS.primary, fontWeight: '500' },
  card: {
    width: '100%', backgroundColor: '#F4EDE8',
    borderRadius: RADIUS.lg, padding: SPACING.lg,
  },
  label: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginBottom: 14 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  otpBox: {
    width: 44, height: 52, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background, borderWidth: 1.5,
    borderColor: COLORS.primary + '40', alignItems: 'center', justifyContent: 'center',
  },
  otpBoxFilled: { borderColor: COLORS.primary },
  otpChar: { fontFamily: FONTS.body, fontSize: 22, color: COLORS.text },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0 },
  button: {
    backgroundColor: COLORS.roseDark, borderRadius: RADIUS.pill,
    padding: 16, alignItems: 'center', marginTop: SPACING.lg,
  },
  buttonDisabled: { backgroundColor: COLORS.muted },
  buttonText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmWhite, letterSpacing: 1 },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.md, flexWrap: 'wrap' },
  link: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted },
  linkBold: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.primary },
});