import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';
import RiskRing from '../components/RiskRing';

const mockMoods = [4, 3, 4, 2, 3, 4, 5, 3, 2, 3, 4, 4, 3, 5, 4, 3, 2, 3, 4, 3, 4, 5, 3, 4, 3, 2, 3, 4, 3, 4];

export default function InsightsScreen() {
  const avg = (mockMoods.reduce((a, b) => a + b, 0) / mockMoods.length).toFixed(1);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Your insights</Text>
      <Text style={styles.subTamil}>உங்கள் நுண்ணறிவு · 30 days</Text>

      <View style={styles.ringRow}>
        <RiskRing score={0.42} level="moderate" size={130} />
        <View style={styles.ringSummary}>
          <Text style={styles.summaryTitle}>Current risk</Text>
          <Text style={styles.summaryTa}>தற்போதைய அபாயம்</Text>
          <Text style={styles.summaryValue}>Moderate</Text>
          <Text style={styles.summaryDetail}>XGBoost · 14 signals</Text>
          <Text style={styles.summaryDetail}>Top factor: Cycle day 18</Text>
        </View>
      </View>

      {/* Mood bar chart — simple native bars */}
      <Text style={styles.sectionTitle}>30-day mood · 30 நாள் மனநிலை</Text>
      <View style={styles.barChart}>
        {mockMoods.map((m, i) => (
          <View key={i} style={styles.barCol}>
            <View style={[styles.bar, { height: m * 10, backgroundColor: m >= 4 ? COLORS.sage : m === 3 ? COLORS.lavender : COLORS.alert }]} />
          </View>
        ))}
      </View>
      <Text style={styles.chartLegend}>Average mood: {avg} / 5</Text>

      {/* SHAP factors */}
      <Text style={styles.sectionTitle}>Top risk factors · முக்கிய காரணங்கள்</Text>
      {[
        { factor: 'Cycle day 18 — luteal phase', factorTa: 'மாதவிடாய் நாள் 18', weight: 0.72 },
        { factor: 'Sleep below baseline (6.2h)', factorTa: 'தூக்கம் குறைவு', weight: 0.58 },
        { factor: 'Steps below baseline', factorTa: 'நடைப்பயிற்சி குறைவு', weight: 0.41 },
      ].map((f) => (
        <View key={f.factor} style={styles.factorCard}>
          <View style={styles.factorRow}>
            <Text style={styles.factorText}>{f.factor}</Text>
            <Text style={styles.factorWeight}>{Math.round(f.weight * 100)}%</Text>
          </View>
          <Text style={styles.factorTa}>{f.factorTa}</Text>
          <View style={styles.factorBar}>
            <View style={[styles.factorFill, { width: `${f.weight * 100}%`, backgroundColor: COLORS.primary }]} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: SPACING.lg, paddingTop: 60 },
  heading: { fontFamily: FONTS.heading, fontSize: 36, color: COLORS.roseDark },
  subTamil: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted, marginBottom: SPACING.lg },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginBottom: SPACING.lg },
  ringSummary: { flex: 1 },
  summaryTitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1 },
  summaryTa: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginBottom: 4 },
  summaryValue: { fontFamily: FONTS.heading, fontSize: 24, color: COLORS.lavender },
  summaryDetail: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginTop: 2 },
  sectionTitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: SPACING.md },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 2, marginBottom: 6 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2, minHeight: 4 },
  chartLegend: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginBottom: SPACING.sm },
  factorCard: { backgroundColor: '#F4EDE8', borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: 10 },
  factorRow: { flexDirection: 'row', justifyContent: 'space-between' },
  factorText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.text, flex: 1 },
  factorWeight: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.primary, fontWeight: '500' },
  factorTa: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginBottom: 6 },
  factorBar: { height: 4, backgroundColor: COLORS.background, borderRadius: 2, overflow: 'hidden' },
  factorFill: { height: 4, borderRadius: 2 },
});