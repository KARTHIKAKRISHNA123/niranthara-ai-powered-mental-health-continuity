import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';

const steps = [
  { n: 5, sense: 'See', senseTa: 'பார்க்கவும்', prompt: 'Name 5 things you can see around you', promptTa: 'உங்களைச் சுற்றி 5 பொருட்களைப் பாருங்கள்' },
  { n: 4, sense: 'Touch', senseTa: 'தொடவும்', prompt: 'Name 4 things you can touch', promptTa: '4 பொருட்களைத் தொடுங்கள்' },
  { n: 3, sense: 'Hear', senseTa: 'கேளுங்கள்', prompt: 'Name 3 things you can hear', promptTa: '3 ஒலிகளைக் கேளுங்கள்' },
  { n: 2, sense: 'Smell', senseTa: 'நுகரவும்', prompt: 'Name 2 things you can smell', promptTa: '2 வாசனைகளை நுகரவும்' },
  { n: 1, sense: 'Taste', senseTa: 'சுவைக்கவும்', prompt: 'Name 1 thing you can taste', promptTa: '1 சுவையை உணருங்கள்' },
];

export default function GroundingScreen({ navigation }) {
  const [step, setStep] = useState(0);
  const done = step >= steps.length;

  return (
    <View style={styles.container}>
      {!done ? (
        <>
          <Text style={styles.stepNum}>{steps[step].n}</Text>
          <Text style={styles.sense}>{steps[step].sense} · {steps[step].senseTa}</Text>
          <Text style={styles.prompt}>{steps[step].prompt}</Text>
          <Text style={styles.promptTa}>{steps[step].promptTa}</Text>
          <TouchableOpacity style={styles.button} onPress={() => setStep(s => s + 1)}>
            <Text style={styles.buttonText}>Done · முடிந்தது</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.doneTitle}>நீங்கள் நல்லவர்!</Text>
          <Text style={styles.doneEn}>You did it. You're grounded.</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Return home · முகப்புக்கு செல்</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  stepNum: { fontFamily: FONTS.heading, fontSize: 96, color: COLORS.sage, lineHeight: 100 },
  sense: { fontFamily: FONTS.heading, fontSize: 32, color: COLORS.roseDark, marginBottom: SPACING.md },
  prompt: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.text, textAlign: 'center', marginBottom: 6 },
  promptTa: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted, textAlign: 'center', marginBottom: SPACING.xl },
  button: { backgroundColor: COLORS.roseDark, borderRadius: RADIUS.pill, paddingVertical: 14, paddingHorizontal: 48 },
  buttonText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmWhite, letterSpacing: 1 },
  doneTitle: { fontFamily: FONTS.heading, fontSize: 48, color: COLORS.sage, marginBottom: 8 },
  doneEn: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.muted, marginBottom: SPACING.xl },
});