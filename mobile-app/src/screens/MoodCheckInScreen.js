import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';

const moods = [
  { score: 5, face: ':)', label: 'Great'},
  { score: 4, face: ':|', label: 'Okay' },
  { score: 3, face: ':(', label: 'Low'},
  { score: 2, face: ';(', label: 'Very low' },
  { score: 1, face: 'xx', label: 'Crisis'},
];

export default function MoodCheckInScreen({ navigation }) {
  const [mood, setMood] = useState(null);
  const [journal, setJournal] = useState('');
  const [sleep, setSleep] = useState('');

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.heading}>How are you today?</Text>
      

      <View style={styles.moodRow}>
        {moods.map((m) => (
          <TouchableOpacity
            key={m.score}
            style={[styles.moodButton, mood?.score === m.score && styles.moodButtonSelected]}
            onPress={() => setMood(m)}
          >
            <Text style={styles.moodFace}>{m.face}</Text>
            <Text style={styles.moodLabel}>{m.label}</Text>
            <Text style={styles.moodLabelTa}>{m.labelTa}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Sleep last night (hours)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 7"
        placeholderTextColor={COLORS.muted}
        keyboardType="decimal-pad"
        value={sleep}
        onChangeText={setSleep}
      />

      <Text style={styles.label}>Journal(optional)</Text>
      <TextInput
        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
        placeholder="Write anything in Tamil or English..."
        placeholderTextColor={COLORS.muted}
        multiline
        value={journal}
        onChangeText={setJournal}
      />

      <TouchableOpacity
        style={[styles.submitButton, !mood && styles.disabled]}
        disabled={!mood}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.submitText}>Submit</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: SPACING.lg, paddingTop: 60 },
  heading: { fontFamily: FONTS.heading, fontSize: 36, color: COLORS.roseDark },
  subTamil: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.muted, marginBottom: SPACING.lg },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.lg },
  moodButton: { flex: 1, backgroundColor: '#F4EDE8', borderRadius: RADIUS.md, padding: 10, alignItems: 'center', marginHorizontal: 3, borderWidth: 1.5, borderColor: 'transparent' },
  moodButtonSelected: { borderColor: COLORS.primary },
  moodFace: { fontSize: 18, marginBottom: 4 },
  moodLabel: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.text },
  moodLabelTa: { fontFamily: FONTS.body, fontSize: 9, color: COLORS.muted },
  label: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: '#F4EDE8', borderRadius: RADIUS.sm, padding: 14, fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, marginBottom: 4 },
  submitButton: { backgroundColor: COLORS.roseDark, borderRadius: RADIUS.pill, padding: 16, alignItems: 'center', marginTop: SPACING.lg },
  disabled: { backgroundColor: COLORS.muted },
  submitText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmWhite, letterSpacing: 1 },
});