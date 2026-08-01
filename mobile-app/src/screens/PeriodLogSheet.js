// src/screens/PeriodLogSheet.js
// Full period-day logging: which day, how heavy, what symptoms.
//
// The old flow was a single "Log Period Start Today" button — one tap, one
// timestamp, no way to record day 2 onward, flow, or symptoms. The LSTM could
// only ever learn cycle *interval* from that; period length and symptom load
// were invisible to both the model and the clinician.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, TextInput, Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme/theme';
import { postData, TIMEOUTS } from '../utils/api';

const FLOWS = [
  { id: 'spotting', label: 'Spotting', dots: 1, color: COLORS.roseLight },
  { id: 'light',    label: 'Light',    dots: 2, color: '#E7A9B0' },
  { id: 'medium',   label: 'Medium',   dots: 3, color: COLORS.rose },
  { id: 'heavy',    label: 'Heavy',    dots: 4, color: COLORS.roseDark },
];

const SYMPTOMS = [
  { id: 'cramps',            label: 'Cramps',            icon: 'zap' },
  { id: 'headache',          label: 'Headache',          icon: 'cloud-lightning' },
  { id: 'fatigue',           label: 'Fatigue',           icon: 'battery' },
  { id: 'bloating',          label: 'Bloating',          icon: 'circle' },
  { id: 'mood_swings',       label: 'Mood swings',       icon: 'shuffle' },
  { id: 'breast_tenderness', label: 'Tenderness',        icon: 'alert-circle' },
  { id: 'nausea',            label: 'Nausea',            icon: 'wind' },
  { id: 'back_pain',         label: 'Back pain',         icon: 'activity' },
  { id: 'insomnia',          label: 'Insomnia',          icon: 'moon' },
  { id: 'acne',              label: 'Acne',              icon: 'target' },
  { id: 'anxiety',           label: 'Anxiety',           icon: 'alert-triangle' },
  { id: 'low_mood',          label: 'Low mood',          icon: 'cloud-drizzle' },
  { id: 'food_cravings',     label: 'Cravings',          icon: 'coffee' },
  { id: 'dizziness',         label: 'Dizziness',         icon: 'loader' },
];

const PERIOD_DAYS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function PeriodLogSheet({ visible, onClose, onSaved, defaultDay = 1 }) {
  const [periodDay, setPeriodDay] = useState(defaultDay);
  const [flow, setFlow]           = useState('medium');
  const [symptoms, setSymptoms]   = useState([]);
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const reset = () => {
    setPeriodDay(defaultDay); setFlow('medium');
    setSymptoms([]); setNotes(''); setError('');
  };

  const toggleSymptom = (id) =>
    setSymptoms(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  // Day 1 is the period start — it must also extend the cycle history the LSTM
  // trains on. Later days are day logs only; appending them as starts would
  // corrupt the interval history.
  const isStart = periodDay === 1;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const now = new Date();
    // Day N was N-1 days ago, so back-dating keeps a late entry on the right date.
    const date = new Date(now.getTime() - (periodDay - 1) * 86400000).toISOString();

    const result = isStart
      ? await postData('/cycle/log-period',
          { periodStart: date, flow, symptoms },
          null, { timeout: TIMEOUTS.cycle })
      : await postData('/cycle/log-day',
          { date, periodDay, flow, symptoms, notes: notes.trim() },
          null, { timeout: TIMEOUTS.cycle });

    setSaving(false);

    if (result.success) {
      onSaved?.(result.data, { periodDay, flow, symptoms });
      reset();
      onClose();
    } else {
      setError(result.error || 'Could not save. Check your connection and try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>

          <View style={styles.grabber} />

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Log your period</Text>
              <Text style={styles.subtitle}>
                {isStart
                  ? 'Day 1 starts a new cycle and retrains your model.'
                  : `Recording day ${periodDay} of your current period.`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Close period logging"
            >
              <Feather name="x" size={22} color={COLORS.warmGray} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── Which day ── */}
            <Text style={styles.sectionLabel}>Which day of your period?</Text>
            <View style={styles.dayRow}>
              {PERIOD_DAYS.map(d => {
                const active = periodDay === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    onPress={() => setPeriodDay(d)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Day ${d}`}
                  >
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.dayHint}>
              {isStart
                ? 'Today is day 1.'
                : `Dated ${new Date(Date.now() - (periodDay - 1) * 86400000)
                    .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`}
            </Text>

            {/* ── Flow ── */}
            <Text style={styles.sectionLabel}>Flow</Text>
            <View style={styles.flowRow}>
              {FLOWS.map(f => {
                const active = flow === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.flowCard, active && { borderColor: f.color, borderWidth: 2 }]}
                    onPress={() => setFlow(f.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${f.label} flow`}
                  >
                    <View style={styles.flowDots}>
                      {[1, 2, 3, 4].map(i => (
                        <View
                          key={i}
                          style={[
                            styles.flowDot,
                            { backgroundColor: i <= f.dots ? f.color : COLORS.cream },
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={[styles.flowLabel, active && { color: COLORS.charcoal, fontFamily: FONTS.medium }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Symptoms ── */}
            <Text style={styles.sectionLabel}>
              Symptoms {symptoms.length > 0 && <Text style={styles.count}>· {symptoms.length} selected</Text>}
            </Text>
            <View style={styles.symptomWrap}>
              {SYMPTOMS.map(sy => {
                const active = symptoms.includes(sy.id);
                return (
                  <TouchableOpacity
                    key={sy.id}
                    style={[styles.symptomChip, active && styles.symptomChipActive]}
                    onPress={() => toggleSymptom(sy.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={sy.label}
                  >
                    <Feather
                      name={sy.icon}
                      size={13}
                      color={active ? COLORS.warmWhite : COLORS.warmGray}
                    />
                    <Text style={[styles.symptomText, active && styles.symptomTextActive]}>
                      {sy.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Notes (day logs only — the start path has no notes field) ── */}
            {!isStart && (
              <>
                <Text style={styles.sectionLabel}>Notes (optional)</Text>
                <TextInput
                  style={styles.notes}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Anything else worth remembering about today"
                  placeholderTextColor={COLORS.softGray}
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                />
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              accessibilityLabel="Save period log"
            >
              {saving
                ? <ActivityIndicator color={COLORS.warmWhite} />
                : <>
                    <Feather name="check" size={17} color={COLORS.warmWhite} />
                    <Text style={styles.saveText}>
                      {isStart ? 'Start new cycle' : `Save day ${periodDay}`}
                    </Text>
                  </>}
            </TouchableOpacity>

            <Text style={styles.mlNote}>
              Flow and symptom history train your personal LSTM — predictions
              sharpen with every day you log.
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(44,40,38,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl, paddingTop: SPACING.md,
    maxHeight: '92%',
  },
  grabber: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.softGray,
    alignSelf: 'center', marginBottom: SPACING.lg,
  },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, marginBottom: SPACING.md },
  title:     { fontFamily: FONTS.display, fontSize: 30, color: COLORS.charcoal, lineHeight: 36 },
  subtitle:  { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.warmGray, lineHeight: 18, marginTop: 2 },

  sectionLabel: {
    fontFamily: FONTS.medium, fontSize: 13, color: COLORS.charcoal,
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  count: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.roseDark },

  // Day chips
  dayRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  dayChip: {
    width: 44, height: 44, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.warmWhite, borderWidth: 1, borderColor: COLORS.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  dayChipActive:     { backgroundColor: COLORS.rose, borderColor: COLORS.rose },
  dayChipText:       { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.warmGray },
  dayChipTextActive: { color: COLORS.warmWhite },
  dayHint:           { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.warmGray, marginTop: SPACING.sm },

  // Flow
  flowRow:  { flexDirection: 'row', gap: SPACING.sm },
  flowCard: {
    flex: 1, backgroundColor: COLORS.warmWhite, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingVertical: SPACING.md, alignItems: 'center', gap: 6, minHeight: 68,
    justifyContent: 'center',
  },
  flowDots: { flexDirection: 'row', gap: 3 },
  flowDot:  { width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: COLORS.cardBorder },
  flowLabel:{ fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.warmGray },

  // Symptoms
  symptomWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  symptomChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.warmWhite, borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md, paddingVertical: 9,
    borderWidth: 1, borderColor: COLORS.cardBorder, minHeight: 38,
  },
  symptomChipActive: { backgroundColor: COLORS.rose, borderColor: COLORS.rose },
  symptomText:       { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.warmGray },
  symptomTextActive: { color: COLORS.warmWhite, fontFamily: FONTS.medium },

  notes: {
    backgroundColor: COLORS.warmWhite, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    padding: SPACING.md, minHeight: 76,
    fontFamily: FONTS.body, fontSize: 14, color: COLORS.charcoal,
  },

  error: {
    fontFamily: FONTS.body, fontSize: 13, color: COLORS.alert,
    marginTop: SPACING.md, lineHeight: 19,
  },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.roseDark, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg, marginTop: SPACING.xl, minHeight: 52,
  },
  saveText: { fontFamily: FONTS.medium, fontSize: 15.5, color: COLORS.warmWhite },

  mlNote: {
    fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray,
    textAlign: 'center', lineHeight: 16, marginTop: SPACING.md,
  },
});
