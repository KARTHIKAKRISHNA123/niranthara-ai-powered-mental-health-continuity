import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';

const riskColors = { low: COLORS.sage, moderate: COLORS.lavender, high: COLORS.primary, crisis: COLORS.alert };

export default function HomeScreen({ navigation }) {
  const riskLevel = 'moderate';
  const riskScore = 0.42;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      
      <Text style={styles.greetingEn}>Good morning</Text>

      {/* Risk ring */}
      <View style={styles.ringContainer}>
        <View style={[styles.ring, { borderColor: riskColors[riskLevel] }]}>
          <Text style={[styles.ringScore, { color: riskColors[riskLevel] }]}>{Math.round(riskScore * 100)}</Text>
          <Text style={styles.ringLabel}>Risk score</Text>
         
        </View>
        <Text style={[styles.riskBadge, { color: riskColors[riskLevel] }]}>{riskLevel.toUpperCase()}</Text>
      </View>

      {/* Stat cards */}
      <View style={styles.statsRow}>
        {[
          { label: 'Steps', value: '4,210', sub: 'vs 6k baseline' },
          { label: 'Sleep', value: '6.2h', sub: 'vs 7.5h baseline' },
          { label: 'Cycle day', value: 'Day 18', sub: 'Luteal phase' },
        ].map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
            <Text style={styles.statLabelTa}>{s.labelTa}</Text>
            <Text style={styles.statSub}>{s.sub}</Text>
          </View>
        ))}
      </View>

      {/* Mood check-in CTA */}
      <TouchableOpacity style={styles.moodButton} onPress={() => navigation.navigate('MoodCheckIn')}>
        <Text style={styles.moodButtonText}>How are you feeling? </Text>
      </TouchableOpacity>

      {/* Quick nav */}
      <View style={styles.quickRow}>
        {[
          { label: 'Chat', screen: 'Chat' },
          { label: 'Insights', screen: 'Insights' },
          { label: 'Breathe',  screen: 'Breathe' },
        ].map((q) => (
          <TouchableOpacity key={q.label} style={styles.quickCard} onPress={() => navigation.navigate(q.screen)}>
            <Text style={styles.quickLabel}>{q.label}</Text>
            <Text style={styles.quickLabelTa}>{q.labelTa}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: SPACING.lg, paddingTop: 60 },
  greeting: { fontFamily: FONTS.heading, fontSize: 32, color: COLORS.roseDark },
  greetingEn: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted, marginBottom: SPACING.lg },
  ringContainer: { alignItems: 'center', marginBottom: SPACING.lg },
  ring: { width: 140, height: 140, borderRadius: 70, borderWidth: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4EDE8' },
  ringScore: { fontFamily: FONTS.heading, fontSize: 42, fontWeight: '300' },
  ringLabel: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted },
  ringLabelTa: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.muted },
  riskBadge: { fontFamily: FONTS.body, fontSize: 11, letterSpacing: 2, marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.lg },
  statCard: { flex: 1, backgroundColor: '#F4EDE8', borderRadius: RADIUS.md, padding: 12, alignItems: 'center' },
  statValue: { fontFamily: FONTS.heading, fontSize: 20, color: COLORS.text },
  statLabel: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.text },
  statLabelTa: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.muted },
  statSub: { fontFamily: FONTS.body, fontSize: 9, color: COLORS.muted, textAlign: 'center', marginTop: 2 },
  moodButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, padding: 18, alignItems: 'center', marginBottom: SPACING.lg },
  moodButtonText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmWhite },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickCard: { flex: 1, backgroundColor: '#F4EDE8', borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  quickLabel: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.text, fontWeight: '500' },
  quickLabelTa: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted },
});