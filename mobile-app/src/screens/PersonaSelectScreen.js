import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';

const personas = [
  { key: 'women',   label: 'Women',         labelTa: 'பெண்கள்',        desc: 'Cycle-aware mental health support' },
  { key: 'elderly', label: 'Elderly',        labelTa: 'முதியோர்',       desc: 'Family view · voice-first' },
  { key: 'disabled',label: 'Differently abled', labelTa: 'மாற்றுத்திறனாளி', desc: 'Voice-only · screen reader' },
  { key: 'general', label: 'General',        labelTa: 'பொது',           desc: 'Standard mental health support' },
];

export default function PersonaSelectScreen({ navigation }) {
  const [selected, setSelected] = useState(null);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Who are you?</Text>
      <Text style={styles.subTamil}>நீங்கள் யார்?</Text>
      <Text style={styles.hint}>We personalise everything for you</Text>

      {personas.map((p) => (
        <TouchableOpacity
          key={p.key}
          style={[styles.card, selected === p.key && styles.cardSelected]}
          onPress={() => setSelected(p.key)}
        >
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>{p.label}</Text>
            <Text style={styles.cardLabelTa}>{p.labelTa}</Text>
          </View>
          <Text style={styles.cardDesc}>{p.desc}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[styles.button, !selected && styles.buttonDisabled]}
        disabled={!selected}
        onPress={() => navigation.navigate('ProfileSetup', { persona: selected })}
      >
        <Text style={styles.buttonText}>Continue · தொடர்க</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: SPACING.lg, paddingTop: 60, alignItems: 'center' },
  heading: { fontFamily: FONTS.heading, fontSize: 40, color: COLORS.roseDark, letterSpacing: 2 },
  subTamil: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.muted, marginBottom: 4 },
  hint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginBottom: SPACING.lg, letterSpacing: 1 },
  card: { width: '100%', backgroundColor: '#F4EDE8', borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: 12, borderWidth: 1.5, borderColor: 'transparent' },
  cardSelected: { borderColor: COLORS.primary },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardLabel: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.text, fontWeight: '500' },
  cardLabelTa: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted },
  cardDesc: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted },
  button: { backgroundColor: COLORS.roseDark, borderRadius: RADIUS.pill, padding: 16, alignItems: 'center', width: '100%', marginTop: SPACING.md },
  buttonDisabled: { backgroundColor: COLORS.muted },
  buttonText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmWhite, letterSpacing: 1 },
});