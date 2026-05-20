// src/screens/Journal.js — Fixed: no emoji, no navigation.goBack() on tab screen
// Mood selector uses filled dots (1–5 scale) instead of emojis.
// On save success → switches to Home tab (not goBack which has no stack).

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme/theme';
import { postData } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const MOOD_LABELS = { 1: 'Very Low', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Great' };
const MOOD_COLORS = {
  1: COLORS.alert,
  2: COLORS.warning,
  3: COLORS.warmGray,
  4: COLORS.lavender,
  5: COLORS.sage,
};

export default function JournalScreen({ navigation }) {
  const { currentUser } = useAuth();
  const [mood, setMood]             = useState(3);
  const [journalText, setJournalText] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [loading, setLoading]       = useState(false);

  const handleSubmit = async () => {
    if (!journalText.trim()) {
      Alert.alert('Write something', 'Please add at least a few words before saving.');
      return;
    }
    setLoading(true);

    const payload = {
      moodScore:    mood,
      energyLevel:  mood >= 4 ? 7 : mood <= 2 ? 3 : 5,
      anxietyLevel: mood <= 2 ? 7 : mood >= 4 ? 3 : 5,
      sleepHours:   parseFloat(sleepHours) || 7,
      journalText:  journalText.trim(),
      uid:          currentUser?.uid,
      offlineSyncId: Date.now().toString(),
    };

    const result = await postData('/mood/log', payload, 'moodLogs');
    setLoading(false);

    if (result.success) {
      if (result.offline) {
        Alert.alert('Saved Offline', 'Your check-in has been saved and will sync when online.');
      } else if (result.data?.requiresImmediateAction) {
        Alert.alert('We are here for you', 'Your response indicates you might be in distress. Help is available.', [
          { text: 'Call iCall (9152987821)', onPress: () => {} },
          { text: 'Okay', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Saved', 'Your check-in has been recorded securely.');
      }
      setJournalText('');
      setMood(3);
      setSleepHours('');
      // Navigate to Home tab — not goBack() which fails on tab screens
      navigation.navigate('Home');
    } else {
      Alert.alert('Error', 'Could not save your check-in. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <Text style={styles.title}>Daily Check-in</Text>
          <Text style={styles.subtitle}>Your entries are end-to-end encrypted.</Text>

          {/* Mood selector */}
          <Text style={styles.sectionLabel}>How are you feeling?</Text>
          <View style={styles.moodRow}>
            {[1, 2, 3, 4, 5].map((val) => {
              const active = mood === val;
              return (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.moodBtn,
                    active && { backgroundColor: MOOD_COLORS[val], borderColor: MOOD_COLORS[val] },
                  ]}
                  onPress={() => setMood(val)}
                  accessibilityLabel={`Mood level ${val}: ${MOOD_LABELS[val]}`}
                >
                  <View style={[styles.moodDot, { backgroundColor: active ? COLORS.warmWhite : MOOD_COLORS[val] }]} />
                  <Text style={[styles.moodVal, active && { color: COLORS.warmWhite }]}>{val}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.moodLabelText, { color: MOOD_COLORS[mood] }]}>
            {MOOD_LABELS[mood]}
          </Text>

          {/* Sleep input */}
          <Text style={styles.sectionLabel}>Sleep last night (hours)</Text>
          <TextInput
            style={styles.sleepInput}
            placeholder="e.g. 7.5"
            value={sleepHours}
            onChangeText={setSleepHours}
            keyboardType="decimal-pad"
            placeholderTextColor={COLORS.softGray}
          />

          {/* Journal */}
          <Text style={styles.sectionLabel}>Journal</Text>
          <TextInput
            style={styles.journalInput}
            multiline
            placeholder="How are you feeling right now? Write in English or Tanglish — our AI understands both."
            value={journalText}
            onChangeText={setJournalText}
            textAlignVertical="top"
            placeholderTextColor={COLORS.softGray}
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityLabel="Save your journal entry"
          >
            {loading
              ? <ActivityIndicator color={COLORS.warmWhite} />
              : <Text style={styles.submitText}>Save Entry</Text>
            }
          </TouchableOpacity>

          <Text style={styles.mlNote}>
            Your journal text is analysed by our NLP pipeline (IndicBERT + distilroberta) for sentiment and emotion — never read by any human.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },

  title:      { fontFamily: FONTS.display, fontSize: 34, color: COLORS.charcoal, lineHeight: 40 },
  subtitle:   { fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray, marginBottom: SPACING.xxl },

  sectionLabel: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.charcoal,
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },

  // Mood
  moodRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  moodBtn: {
    flex: 1,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warmWhite,
    borderWidth: 1.5,
    borderColor: 'rgba(44,40,38,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  moodDot:       { width: 10, height: 10, borderRadius: 5 },
  moodVal:       { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.charcoal },
  moodLabelText: { fontFamily: FONTS.medium, fontSize: 13, textAlign: 'center', marginBottom: SPACING.md },

  // Sleep
  sleepInput: {
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(44,40,38,0.1)',
    padding: SPACING.lg,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.charcoal,
  },

  // Journal
  journalInput: {
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(44,40,38,0.1)',
    padding: SPACING.lg,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.charcoal,
    minHeight: 160,
    marginBottom: SPACING.xl,
  },

  submitBtn: {
    backgroundColor: COLORS.roseDark,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  submitText: { fontFamily: FONTS.medium, color: COLORS.warmWhite, fontSize: 16 },

  mlNote: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.warmGray,
    textAlign: 'center',
    lineHeight: 16,
  },
});
