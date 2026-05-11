import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';

export default function ProfileSetupScreen({ navigation, route }) {
  const persona = route?.params?.persona || 'women';
  const [age, setAge] = useState('');
  const [language, setLanguage] = useState('Tamil');

  const langs = ['Tamil', 'English', 'Tanglish'];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Your profile</Text>
      

      <View style={styles.card}>
        <Text style={styles.label}>Age </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 28"
          placeholderTextColor={COLORS.muted}
          keyboardType="number-pad"
          value={age}
          onChangeText={setAge}
        />

        <Text style={styles.label}>Preferred language </Text>
        <View style={styles.langRow}>
          {langs.map((l) => (
            <TouchableOpacity
              key={l}
              style={[styles.langPill, language === l && styles.langPillActive]}
              onPress={() => setLanguage(l)}
            >
              <Text style={[styles.langText, language === l && styles.langTextActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {persona === 'women' && (
          <>
            <Text style={styles.label}>Last period date</Text>
            <TextInput
              style={styles.input}
              placeholder="DD / MM / YYYY"
              placeholderTextColor={COLORS.muted}
            />
          </>
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.buttonText}>Get started</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: SPACING.lg, paddingTop: 60 },
  heading: { fontFamily: FONTS.heading, fontSize: 40, color: COLORS.roseDark, letterSpacing: 2 },
  subTamil: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.muted, marginBottom: SPACING.lg },
  card: { backgroundColor: '#F4EDE8', borderRadius: RADIUS.lg, padding: SPACING.lg },
  label: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.background, borderRadius: RADIUS.sm, padding: 14, fontFamily: FONTS.body, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.primary + '33', marginBottom: 4 },
  langRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  langPill: { borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.primary, paddingVertical: 8, paddingHorizontal: 20 },
  langPillActive: { backgroundColor: COLORS.primary },
  langText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.primary },
  langTextActive: { color: COLORS.warmWhite },
  button: { backgroundColor: COLORS.roseDark, borderRadius: RADIUS.pill, padding: 16, alignItems: 'center', marginTop: SPACING.lg },
  buttonText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmWhite, letterSpacing: 1 },
});