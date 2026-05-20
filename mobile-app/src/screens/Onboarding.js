// src/screens/Onboarding.js — Persona Select per Build_Guide §23
// Women-first prototype: Women is fully active. Others show "Coming Soon".

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme/theme';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const PERSONAS = [
  {
    id: 'women',
    emoji: '👩',
    name: 'Women',
    description: 'Hormonal cycle tracking, 8 depression triggers, full ML pipeline.',
    features: ['Cycle LSTM active', 'Hormonal risk boost', 'All 8 triggers', 'JITAI personalized'],
    available: true,
    accentColor: COLORS.rose,
    bgColor: COLORS.roseLight,
  },
  {
    id: 'elderly',
    emoji: '👴',
    name: 'Elderly',
    description: 'Voice-first, large tap targets, family view.',
    features: ['Voice-first mode', '72px tap targets', 'Family view'],
    available: false,
    accentColor: COLORS.lavender,
    bgColor: COLORS.lavenderLight,
  },
  {
    id: 'disabled',
    emoji: '♿',
    name: 'Disabled',
    description: 'Full screen reader, voice-only input, WCAG AA.',
    features: ['Voice-only input', 'Screen reader', '64px tap targets'],
    available: false,
    accentColor: COLORS.sage,
    bgColor: COLORS.sageLight,
  },
  {
    id: 'general',
    emoji: '🧑',
    name: 'General',
    description: '7 triggers, standard UI, Crisis + JITAI NLP.',
    features: ['7 triggers', 'Standard UI', 'Crisis + JITAI NLP'],
    available: false,
    accentColor: COLORS.warmGray,
    bgColor: '#F0EDE8',
  },
];

export default function OnboardingScreen({ navigation }) {
  const { currentUser, refreshDbUser } = useAuth();
  const [selected, setSelected] = useState('women'); // Women pre-selected
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (selected !== 'women') {
      Alert.alert(
        'Coming Soon',
        'This persona is not available in the current prototype. Please select Women to continue.',
      );
      return;
    }
    setSaving(true);
    try {
      await api.patch('/auth/update-profile', {
        persona: selected,
        onboardingComplete: true,
      });
      if (refreshDbUser) await refreshDbUser();
    } catch (e) {
      console.warn('Could not save persona (offline):', e.message);
    } finally {
      setSaving(false);
      navigation.replace('MainTabs');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Who are you?</Text>
          <Text style={styles.subtitle}>
            This helps us personalize your ML models and risk detection.
          </Text>
        </View>

        {/* Persona Cards */}
        {PERSONAS.map((p) => {
          const isSelected = selected === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.card,
                isSelected && { borderColor: p.accentColor, borderWidth: 2 },
                !p.available && styles.cardDisabled,
              ]}
              onPress={() => p.available ? setSelected(p.id) : null}
              activeOpacity={p.available ? 0.8 : 1}
              accessibilityLabel={`Select ${p.name} persona`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              {/* Coming Soon badge */}
              {!p.available && (
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>Coming Soon</Text>
                </View>
              )}

              <View style={styles.cardRow}>
                {/* Emoji + selection ring */}
                <View style={[
                  styles.emojiRing,
                  { backgroundColor: isSelected ? p.bgColor : COLORS.cream },
                  isSelected && { borderColor: p.accentColor, borderWidth: 2 },
                ]}>
                  <Text style={styles.emoji}>{p.emoji}</Text>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.personaName, !p.available && styles.muted]}>
                      {p.name}
                    </Text>
                  </View>
                  <Text style={[styles.personaDesc, !p.available && styles.muted]}>
                    {p.description}
                  </Text>

                  {/* Feature pills */}
                  {p.available && (
                    <View style={styles.pills}>
                      {p.features.map((f) => (
                        <View key={f} style={[styles.pill, { backgroundColor: p.bgColor }]}>
                          <Text style={[styles.pillText, { color: p.accentColor }]}>✓ {f}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Selected indicator */}
                {isSelected && (
                  <View style={[styles.checkCircle, { backgroundColor: p.accentColor }]}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Note */}
        <Text style={styles.note}>
          ★ Elderly, Disabled, and General personas will be available in the next update.
        </Text>

        {/* Continue button */}
        <TouchableOpacity
          style={[styles.btn, saving && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={saving}
          accessibilityLabel="Continue with selected persona"
        >
          {saving ? (
            <ActivityIndicator color={COLORS.warmWhite} />
          ) : (
            <Text style={styles.btnText}>Continue →</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },

  header: { marginBottom: SPACING.xxl },
  title: {
    fontFamily: FONTS.display,
    fontSize: 40,
    color: COLORS.charcoal,
    lineHeight: 44,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.warmGray,
    lineHeight: 22,
  },

  card: {
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(44,40,38,0.1)',
  },
  cardDisabled: { opacity: 0.55 },

  comingSoonBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.softGray,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 1,
  },
  comingSoonText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: COLORS.warmGray,
    letterSpacing: 0.5,
  },

  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  emojiRing: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(44,40,38,0.1)',
  },
  emoji: { fontSize: 28 },

  cardBody: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm, marginBottom: 4 },
  personaName: {
    fontFamily: FONTS.medium,
    fontSize: 17,
    color: COLORS.charcoal,
  },
  personaDesc: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.warmGray,
    lineHeight: 19,
    marginBottom: SPACING.sm,
  },
  muted: { color: COLORS.softGray },

  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: { fontFamily: FONTS.medium, fontSize: 10 },

  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  checkMark: { color: COLORS.warmWhite, fontSize: 13, fontWeight: '600' },

  note: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.warmGray,
    textAlign: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
    lineHeight: 18,
  },

  btn: {
    backgroundColor: COLORS.rose,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    fontFamily: FONTS.medium,
    fontSize: 17,
    color: COLORS.warmWhite,
  },
});
