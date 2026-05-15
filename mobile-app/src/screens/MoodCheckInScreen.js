import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';

// ─── API helper (inline for now — Task 8 moves this to src/utils/api.js) ───
import AsyncStorage from '@react-native-async-storage/async-storage';
const BASE_URL = 'http://192.168.1.XXX:5000'; // Replace with Karthika's backend IP in Task 8

const apiPost = async (path, body) => {
  const token = await AsyncStorage.getItem('token');
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
};
// ─────────────────────────────────────────────────────────────────────────────

const moods = [
  { score: 5, face: '😊', label: 'Great'},
  { score: 4, face: '🙂', label: 'Okay' },
  { score: 3, face: '😔', label: 'Low' },
  { score: 2, face: '😢', label: 'Very low' },
  { score: 1, face: '😰', label: 'Crisis' },
];

const symptoms = [
  { key: 'headache',  label: 'Headache' },
  { key: 'cramps',    label: 'Cramps'},
  { key: 'fatigue',   label: 'Fatigue' },
  { key: 'anxiety',   label: 'Anxiety'},
  { key: 'irritable', label: 'Irritable'},
];

export default function MoodCheckInScreen({ navigation }) {
  const [mood, setMood]               = useState(null);
  const [journal, setJournal]         = useState('');
  const [sleep, setSleep]             = useState('');
  const [selectedSymptoms, setSymptoms] = useState([]);
  const [submitting, setSubmitting]   = useState(false);

  // ── toggle a symptom chip on/off ──
  const toggleSymptom = (key) => {
    setSymptoms(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // ── Task 8 API submit ──
  const handleSubmit = async () => {
    if (!mood) return;
    setSubmitting(true);
    try {
      await apiPost('/api/mood', {
        mood_score:   mood.score,
        journal_text: journal.trim(),
        sleep_hours:  parseFloat(sleep) || null,
        symptoms:     selectedSymptoms,
      });
      navigation.goBack();
    } catch (err) {
      // API not connected yet (Task 1–7) — just go back silently
      // In Task 8 replace this with: Alert.alert('Error', 'Could not save. Try again.');
      console.log('API not connected yet:', err.message);
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      {/* Title */}
      <Text style={styles.heading}>How are you today?</Text>
      

      {/* ── Mood selector ── */}
      <Text style={styles.sectionLabel}>Mood</Text>
      <View style={styles.moodRow}>
        {moods.map(m => (
          <TouchableOpacity
            key={m.score}
            style={[
              styles.moodButton,
              mood?.score === m.score && styles.moodButtonSelected,
            ]}
            onPress={() => setMood(m)}
            activeOpacity={0.7}
          >
            <Text style={styles.moodFace}>{m.face}</Text>
            <Text style={styles.moodLabel}>{m.label}</Text>
            <Text style={styles.moodLabelTa}>{m.labelTa}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Crisis banner — shows only when crisis selected */}
      {mood?.score === 1 && (
        <View style={styles.crisisBanner}>
          <Text style={styles.crisisText}>
            
            We are here for you. You are not alone.
          </Text>
          <Text style={styles.crisisHelpline}>
            iCall helpline: 9152987821
          </Text>
        </View>
      )}

      {/* ── Sleep ── */}
      <Text style={styles.sectionLabel}>
        Sleep last night(hours)
      </Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 7"
        placeholderTextColor={COLORS.muted}
        keyboardType="decimal-pad"
        value={sleep}
        onChangeText={setSleep}
        maxLength={4}
      />

      {/* ── Symptoms ── */}
      <Text style={styles.sectionLabel}>
        Symptoms today (optional)
      </Text>
      <View style={styles.chipRow}>
        {symptoms.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[
              styles.chip,
              selectedSymptoms.includes(s.key) && styles.chipSelected,
            ]}
            onPress={() => toggleSymptom(s.key)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.chipText,
              selectedSymptoms.includes(s.key) && styles.chipTextSelected,
            ]}>
              {s.label} · {s.labelTa}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Journal ── */}
      <Text style={styles.sectionLabel}>
        Journal(optional)
      </Text>
      <TextInput
        style={styles.journalInput}
        placeholder="Write anything in Tamil or English..."
        placeholderTextColor={COLORS.muted}
        multiline
        textAlignVertical="top"
        value={journal}
        onChangeText={setJournal}
      />

      {/* ── Submit ── */}
      <TouchableOpacity
        style={[styles.submitButton, (!mood || submitting) && styles.disabled]}
        disabled={!mood || submitting}
        onPress={handleSubmit}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color={COLORS.warmWhite} />
        ) : (
          <>
            <Text style={styles.submitText}>Submit </Text>
            <Text style={styles.submitSub}>
              {mood ? `Mood: ${mood.label} (${mood.score}/5)` : 'Select a mood above'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: SPACING.lg,
    paddingTop: Platform.OS === 'android' ? 48 : 60,
  },

  // Back
  backBtn: { marginBottom: SPACING.md },
  backText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.primary },

  // Title
  heading: {
    fontFamily: FONTS.heading, fontSize: 38,
    color: COLORS.roseDark, letterSpacing: 1,
  },
  subTamil: {
    fontFamily: FONTS.body, fontSize: 14,
    color: COLORS.muted, marginBottom: SPACING.lg,
  },

  // Section labels
  sectionLabel: {
    fontFamily: FONTS.body, fontSize: 12,
    color: COLORS.muted, marginBottom: 10,
    marginTop: SPACING.md, textTransform: 'uppercase', letterSpacing: 1,
  },

  // Mood row
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  moodButton: {
    flex: 1,
    backgroundColor: '#F4EDE8',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  moodButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '18',
  },
  moodFace: { fontSize: 22, marginBottom: 4 },
  moodLabel: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.text },
  moodLabelTa: { fontFamily: FONTS.body, fontSize: 9, color: COLORS.muted, marginTop: 2 },

  // Crisis banner
  crisisBanner: {
    backgroundColor: COLORS.alert + '18',
    borderRadius: RADIUS.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.alert,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  crisisText: {
    fontFamily: FONTS.body, fontSize: 13,
    color: COLORS.alert, lineHeight: 20,
  },
  crisisHelpline: {
    fontFamily: FONTS.body, fontSize: 13,
    color: COLORS.alert, fontWeight: '500', marginTop: 6,
  },

  // Sleep input
  input: {
    backgroundColor: '#F4EDE8',
    borderRadius: RADIUS.sm,
    padding: 14,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },

  // Symptom chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  chip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.primary + '60',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#F4EDE8',
  },
  chipSelected: {
    backgroundColor: COLORS.lavender + '33',
    borderColor: COLORS.lavender,
  },
  chipText: {
    fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted,
  },
  chipTextSelected: {
    color: COLORS.lavender, fontWeight: '500',
  },

  // Journal
  journalInput: {
    backgroundColor: '#F4EDE8',
    borderRadius: RADIUS.md,
    padding: 14,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    height: 120,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },

  // Submit
  submitButton: {
    backgroundColor: COLORS.roseDark,
    borderRadius: RADIUS.pill,
    padding: 18,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  disabled: { backgroundColor: COLORS.muted },
  submitText: {
    fontFamily: FONTS.body, fontSize: 14,
    color: COLORS.warmWhite, letterSpacing: 1,
  },
  submitSub: {
    fontFamily: FONTS.body, fontSize: 11,
    color: COLORS.warmWhite + 'AA', marginTop: 4,
  },
});