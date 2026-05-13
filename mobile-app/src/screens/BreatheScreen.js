import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';

const PHASES = [
  { label: 'Breathe in', labelTa: 'மூச்சை உள்ளே இழுக்கவும்', duration: 4000 },
  { label: 'Hold', labelTa: 'தடுக்கவும்', duration: 4000 },
  { label: 'Breathe out', labelTa: 'மூச்சை வெளியே விடவும்', duration: 6000 },
];

export default function BreatheScreen({ navigation }) {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!running) return;
    let idx = phase;
    const animate = () => {
      const p = PHASES[idx % 3];
      Animated.timing(scale, { toValue: idx % 3 === 0 ? 1.6 : idx % 3 === 1 ? 1.6 : 1, duration: p.duration, useNativeDriver: true }).start(() => {
        idx++;
        setPhase(idx % 3);
        if (running) animate();
      });
    };
    animate();
    return () => scale.stopAnimation();
  }, [running]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Box breathing</Text>
      <Text style={styles.subTamil}>பெட்டி மூச்சுப் பயிற்சி</Text>

      <Animated.View style={[styles.circle, { transform: [{ scale }] }]}>
        <Text style={styles.phaseLabel}>{PHASES[phase].label}</Text>
        <Text style={styles.phaseLabelTa}>{PHASES[phase].labelTa}</Text>
      </Animated.View>

      <TouchableOpacity style={styles.button} onPress={() => setRunning(r => !r)}>
        <Text style={styles.buttonText}>{running ? 'Pause · நிறுத்து' : 'Start · தொடங்கு'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>Back · திரும்பு</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  heading: { fontFamily: FONTS.heading, fontSize: 36, color: COLORS.roseDark, marginBottom: 4 },
  subTamil: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted, marginBottom: SPACING.xl },
  circle: { width: 180, height: 180, borderRadius: 90, backgroundColor: COLORS.lavender + '44', borderWidth: 3, borderColor: COLORS.lavender, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xl },
  phaseLabel: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.roseDark, textAlign: 'center' },
  phaseLabelTa: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted, textAlign: 'center', marginTop: 4 },
  button: { backgroundColor: COLORS.roseDark, borderRadius: RADIUS.pill, paddingVertical: 14, paddingHorizontal: 48, marginBottom: SPACING.md },
  buttonText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.warmWhite, letterSpacing: 1 },
  back: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.primary },
});