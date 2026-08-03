// src/screens/Onboarding.js — profile setup
//
// Niranthara monitors continuity of care for everyone. Cycle tracking is an
// additional signal for people who menstruate, not the shape of the product, so
// onboarding asks who you are and whether that signal applies — it never
// assumes. Users who opt out never see a cycle ring, a Cycle tab, or a
// hormonal-vulnerability nudge anywhere in the app.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme/theme';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { GENDERS, GENDER_LABELS } from '../utils/profile';

// Two options in the PICKER only. The data model still understands non_binary
// and prefer_not_to_say (profile.js CYCLE_ELIGIBLE keeps them), so any account
// already carrying those values keeps working and keeps its cycle features —
// removing them from the enum would silently strip access from existing users.
//
// Product decision, 2 Aug 2026: offering four categories that all resolve to the
// same two feature sets is differentiation theatre. Broader identity options
// return when they change what the product actually does. Tracked in the
// roadmap, not dropped.
const GENDER_OPTIONS = [
  { id: GENDERS.FEMALE, icon: 'user', cycleEligible: true  },
  { id: GENDERS.MALE,   icon: 'user', cycleEligible: false },
];

// Support profile — changes tone, tap-target size and which triggers are
// monitored. Every option is live; none of these gate the core pipeline.
const SUPPORT_PROFILES = [
  {
    id: 'general',
    name: 'Standard',
    description: 'Full monitoring, standard interface.',
    accent: COLORS.rose,
    bg: COLORS.roseLight,
  },
  {
    id: 'student',
    name: 'Student',
    description: 'Exam-period and sleep-debt triggers weighted higher.',
    accent: COLORS.lavender,
    bg: COLORS.lavenderLight,
  },
  {
    id: 'elderly',
    name: 'Senior',
    description: 'Larger text and tap targets, isolation triggers weighted higher.',
    accent: COLORS.sage,
    bg: COLORS.sageLight,
  },
  {
    id: 'caregiver',
    name: 'Caregiver',
    description: 'Burnout and loss-of-follow-up triggers weighted higher.',
    accent: COLORS.warmGray,
    bg: '#F0EDE8',
  },
];

export default function OnboardingScreen({ navigation }) {
  const { refreshDbUser } = useAuth();
  const [gender, setGender]           = useState(null);
  const [wantsCycle, setWantsCycle]   = useState(true);
  const [profile, setProfile]         = useState('general');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const selectedGender = GENDER_OPTIONS.find(g => g.id === gender);
  const cycleEligible  = !!selectedGender?.cycleEligible;
  const tracksCycle    = cycleEligible && wantsCycle;

  const handleContinue = async () => {
    if (!gender) { setError('Please choose an option so we can set up your profile.'); return; }
    setError('');
    setSaving(true);
    try {
      await api.patch('/auth/update-profile', {
        gender,
        tracksCycle,
        personaType: profile,
        onboardingComplete: true,
      });
      await refreshDbUser?.();
      // Navigator swaps the stack once onboardingComplete lands; no manual
      // replace() — that raced the refresh and briefly showed a dead screen.
    } catch (e) {
      setError(`Could not save your profile — ${e.response?.data?.error || e.message}. Please check your connection and try again.`);
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>Set up your care</Text>
          <Text style={styles.subtitle}>
            This shapes which signals we monitor for you. You can change any of
            it later in settings.
          </Text>
        </View>

        {/* ── Gender ── */}
        <Text style={styles.sectionLabel}>How do you identify?</Text>
        <View style={styles.genderGrid}>
          {GENDER_OPTIONS.map((g) => {
            const active = gender === g.id;
            return (
              <TouchableOpacity
                key={g.id}
                style={[styles.genderCard, active && styles.genderCardActive]}
                onPress={() => { setGender(g.id); setError(''); }}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={GENDER_LABELS[g.id]}
              >
                <View style={[styles.genderIcon, active && { backgroundColor: COLORS.roseLight }]}>
                  <Feather
                    name={g.icon}
                    size={18}
                    color={active ? COLORS.roseDark : COLORS.warmGray}
                  />
                </View>
                <Text style={[styles.genderText, active && styles.genderTextActive]}>
                  {GENDER_LABELS[g.id]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Cycle opt-in — only when it can apply ── */}
        {cycleEligible && (
          <View style={styles.cycleCard}>
            <View style={styles.cycleRow}>
              <View style={styles.cycleIconBox}>
                <Feather name="moon" size={18} color={COLORS.roseDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cycleTitle}>Track my cycle</Text>
                <Text style={styles.cycleSub}>
                  Adds a personalised LSTM that learns your cycle and flags
                  hormonal vulnerability windows.
                </Text>
              </View>
              <Switch
                value={wantsCycle}
                onValueChange={setWantsCycle}
                trackColor={{ false: COLORS.softGray, true: COLORS.rose }}
                thumbColor={COLORS.warmWhite}
                accessibilityLabel="Enable cycle tracking"
              />
            </View>
            {!wantsCycle && (
              <Text style={styles.cycleOffNote}>
                Cycle tracking stays off. Everything else works exactly the same.
              </Text>
            )}
          </View>
        )}

        {/* ── Support profile ── */}
        <Text style={styles.sectionLabel}>What best describes your situation?</Text>
        {SUPPORT_PROFILES.map((p) => {
          const active = profile === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.profileCard, active && { borderColor: p.accent, borderWidth: 2 }]}
              onPress={() => setProfile(p.id)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${p.name}. ${p.description}`}
            >
              <View style={[styles.profileDot, { backgroundColor: active ? p.accent : COLORS.softGray }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{p.name}</Text>
                <Text style={styles.profileDesc}>{p.description}</Text>
              </View>
              {active && (
                <View style={[styles.checkCircle, { backgroundColor: p.accent }]}>
                  <Feather name="check" size={13} color={COLORS.warmWhite} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (saving || !gender) && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={saving || !gender}
          accessibilityLabel="Save profile and continue"
        >
          {saving
            ? <ActivityIndicator color={COLORS.warmWhite} />
            : <Text style={styles.btnText}>Continue</Text>}
        </TouchableOpacity>

        <Text style={styles.privacyNote}>
          Your profile stays on your account. Journals and messages are
          encrypted before they ever leave your phone.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },

  header:   { marginBottom: SPACING.xl },
  title:    { fontFamily: FONTS.display, fontSize: 38, color: COLORS.charcoal, lineHeight: 44 },
  subtitle: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmGray, lineHeight: 21, marginTop: 4 },

  sectionLabel: {
    fontFamily: FONTS.medium, fontSize: 13, color: COLORS.charcoal,
    marginTop: SPACING.xl, marginBottom: SPACING.md,
  },

  // Gender
  genderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  genderCard: {
    width: '48%', minHeight: 84,
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder,
    padding: SPACING.md, alignItems: 'flex-start', justifyContent: 'center', gap: 8,
  },
  genderCardActive: { borderColor: COLORS.rose, borderWidth: 2, backgroundColor: COLORS.warmWhite },
  genderIcon: {
    width: 34, height: 34, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center',
  },
  genderText:       { fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray },
  genderTextActive: { fontFamily: FONTS.medium, color: COLORS.charcoal },

  // Cycle opt-in
  cycleCard: {
    backgroundColor: COLORS.roseLight, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginTop: SPACING.lg,
  },
  cycleRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  cycleIconBox: {
    width: 40, height: 40, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.warmWhite, alignItems: 'center', justifyContent: 'center',
  },
  cycleTitle:   { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.roseDark },
  cycleSub:     { fontFamily: FONTS.body, fontSize: 12, color: COLORS.roseDark, lineHeight: 17, opacity: 0.85, marginTop: 2 },
  cycleOffNote: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.roseDark, opacity: 0.8, marginTop: SPACING.md },

  // Support profile
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.warmWhite, borderRadius: RADIUS.md,
    padding: SPACING.lg, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.cardBorder, minHeight: 72,
  },
  profileDot:  { width: 10, height: 10, borderRadius: 5 },
  profileName: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.charcoal },
  profileDesc: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, lineHeight: 17, marginTop: 2 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  error: {
    fontFamily: FONTS.body, fontSize: 13, color: COLORS.alert,
    marginTop: SPACING.lg, lineHeight: 19,
  },

  btn: {
    backgroundColor: COLORS.rose, borderRadius: RADIUS.lg,
    padding: SPACING.lg, alignItems: 'center', marginTop: SPACING.xl, minHeight: 52,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText:     { fontFamily: FONTS.medium, fontSize: 16, color: COLORS.warmWhite },

  privacyNote: {
    fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.warmGray,
    textAlign: 'center', lineHeight: 17, marginTop: SPACING.lg,
  },
});
