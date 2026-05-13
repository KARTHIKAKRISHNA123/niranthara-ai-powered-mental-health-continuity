import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS } from '../constants/theme';

const levelColors = {
  low: COLORS.sage,
  moderate: COLORS.lavender,
  high: COLORS.primary,
  crisis: COLORS.alert,
};

export default function RiskRing({ score = 0.42, level = 'moderate', size = 140 }) {
  const color = levelColors[level] || COLORS.muted;
  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}>
      <Text style={[styles.score, { color, fontSize: size * 0.3 }]}>{Math.round(score * 100)}</Text>
      <Text style={styles.label}>{level}</Text>
      <Text style={styles.labelTa}>
        {level === 'low' ? 'குறைந்த' : level === 'moderate' ? 'மிதமான' : level === 'high' ? 'அதிக' : 'நெருக்கடி'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4EDE8' },
  score: { fontFamily: FONTS.heading, fontWeight: '300' },
  label: { fontFamily: FONTS.body, fontSize: 11, color: '#8A8076', letterSpacing: 1, textTransform: 'uppercase' },
  labelTa: { fontFamily: FONTS.body, fontSize: 10, color: '#8A8076' },
});