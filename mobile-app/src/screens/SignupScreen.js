import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.appName}>Niranthara</Text>
        
        <Text style={styles.engSub}>YOUR MIND, OUR CARE</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create account</Text>

          <Text style={styles.label}>Your name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Kavitha"
            placeholderTextColor={COLORS.muted}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            placeholder="+91 98765 43210"
            placeholderTextColor={COLORS.muted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <TouchableOpacity
            style={[styles.button, (!name || !phone) && styles.buttonDisabled]}
            disabled={!name || !phone}
            onPress={() => navigation.navigate('OTP', { phone, name })}
          >
            <Text style={styles.buttonText}>Send OTP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.link}>Already have an account?</Text>
            <Text style={styles.linkBold}> Sign in </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    padding: SPACING.lg, paddingTop: 60,
  },
  appName: {
    fontFamily: FONTS.heading, fontSize: 52,
    color: COLORS.roseDark, letterSpacing: 4, marginBottom: 6,
  },
  tamilSub: {
    fontFamily: FONTS.body, fontSize: 14,
    color: COLORS.muted, marginBottom: 2,
  },
  engSub: {
    fontFamily: FONTS.body, fontSize: 10,
    color: COLORS.muted, letterSpacing: 3, marginBottom: SPACING.xl,
  },
  card: {
    width: '100%', backgroundColor: '#F4EDE8',
    borderRadius: RADIUS.lg, padding: SPACING.lg,
  },
  cardTitle: {
    fontFamily: FONTS.heading, fontSize: 22,
    color: COLORS.roseDark, marginBottom: SPACING.md,
  },
  label: {
    fontFamily: FONTS.body, fontSize: 12,
    color: COLORS.muted, marginBottom: 6, marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm, padding: 14,
    fontFamily: FONTS.body, fontSize: 15,
    color: COLORS.text, borderWidth: 1,
    borderColor: COLORS.primary + '40', marginBottom: 4,
  },
  button: {
    backgroundColor: COLORS.roseDark, borderRadius: RADIUS.pill,
    padding: 16, alignItems: 'center', marginTop: SPACING.md,
  },
  buttonDisabled: { backgroundColor: COLORS.muted },
  buttonText: {
    fontFamily: FONTS.body, fontSize: 14,
    color: COLORS.warmWhite, letterSpacing: 1,
  },
  linkRow: {
    flexDirection: 'row', justifyContent: 'center',
    marginTop: SPACING.md, flexWrap: 'wrap',
  },
  link: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted },
  linkBold: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.primary },
});