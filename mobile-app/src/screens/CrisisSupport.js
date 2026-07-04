// src/screens/CrisisSupport.js — In-app crisis response
// Detection without response is a liability: this screen surfaces the moment
// the crisis classifier fires, and is always reachable from Chat.
// Design: calm, unhurried, no emojis, large tap targets, works offline.

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../theme/theme';

const HELPLINES = [
  {
    name: 'Tele-MANAS',
    number: '14416',
    sub: 'Government of India · 24/7 · free · multilingual',
  },
  {
    name: 'iCall',
    number: '9152987821',
    sub: 'TISS · Mon-Sat, 10am-8pm · English + regional languages',
  },
  {
    name: 'NIMHANS Helpline',
    number: '08046110007',
    sub: 'National Institute of Mental Health · 24/7',
  },
];

const GROUNDING_STEPS = [
  { count: '5', sense: 'things you can see' },
  { count: '4', sense: 'things you can touch' },
  { count: '3', sense: 'things you can hear' },
  { count: '2', sense: 'things you can smell' },
  { count: '1', sense: 'thing you can taste' },
];

export default function CrisisSupportScreen({ navigation, route }) {
  const fromDetection = route?.params?.fromDetection;

  const call = (number) => {
    Linking.openURL(`tel:${number}`).catch(() => {});
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>You are not alone right now.</Text>
          <Text style={s.sub}>
            What you are feeling is real, and it can change. Support is available
            in this moment — you do not have to carry this by yourself.
          </Text>
          {fromDetection && (
            <View style={s.notifiedRow}>
              <Feather name="check-circle" size={14} color={COLORS.sageDark} />
              <Text style={s.notifiedText}>Your care team has been notified.</Text>
            </View>
          )}
        </View>

        {/* Helplines */}
        <Text style={s.sectionLabel}>TALK TO SOMEONE NOW</Text>
        {HELPLINES.map(h => (
          <TouchableOpacity
            key={h.number}
            style={s.lineCard}
            onPress={() => call(h.number)}
            activeOpacity={0.75}
            accessibilityLabel={`Call ${h.name} at ${h.number}`}
          >
            <View style={s.lineIconBox}>
              <Feather name="phone-call" size={18} color={COLORS.roseDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.lineName}>{h.name}</Text>
              <Text style={s.lineSub}>{h.sub}</Text>
            </View>
            <Text style={s.lineNumber}>{h.number}</Text>
          </TouchableOpacity>
        ))}

        {/* Grounding */}
        <Text style={s.sectionLabel}>WHILE YOU ARE HERE — GROUND YOURSELF</Text>
        <View style={s.groundCard}>
          <Text style={s.groundIntro}>
            Look around slowly and name, out loud or in your head:
          </Text>
          {GROUNDING_STEPS.map(g => (
            <View key={g.count} style={s.groundRow}>
              <View style={s.groundCount}>
                <Text style={s.groundCountText}>{g.count}</Text>
              </View>
              <Text style={s.groundText}>{g.sense}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={s.breatheBtn}
          onPress={() => navigation.navigate('SomaticBreathing')}
          activeOpacity={0.8}
          accessibilityLabel="Begin a guided breathing exercise"
        >
          <Feather name="wind" size={16} color={COLORS.warmWhite} />
          <Text style={s.breatheBtnText}>Breathe with me — 3 minutes</Text>
        </TouchableOpacity>

        {/* Return */}
        <TouchableOpacity
          style={s.returnBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Return to the previous screen"
        >
          <Text style={s.returnText}>I feel safe enough to continue</Text>
        </TouchableOpacity>

        <Text style={s.footer}>
          If you are in immediate danger, call 112 (national emergency number).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },

  header: { marginBottom: SPACING.xxl, marginTop: SPACING.lg },
  title:  { fontFamily: FONTS.display, fontSize: 32, lineHeight: 40, color: COLORS.charcoal },
  sub:    { fontFamily: FONTS.body, fontSize: 14, lineHeight: 22, color: COLORS.warmGray, marginTop: SPACING.md },

  notifiedRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.lg, backgroundColor: COLORS.sageLight, alignSelf: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.pill },
  notifiedText: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.sageDark },

  sectionLabel: { fontFamily: FONTS.body, fontSize: 10, letterSpacing: 1.4, color: COLORS.warmGray, marginBottom: SPACING.md, marginTop: SPACING.sm },

  lineCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.warmWhite, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.cardBorder, minHeight: 72,
    ...SHADOW.sm,
  },
  lineIconBox: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.roseLight, alignItems: 'center', justifyContent: 'center' },
  lineName:    { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.charcoal },
  lineSub:     { fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray, marginTop: 2, lineHeight: 15 },
  lineNumber:  { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.roseDark },

  groundCard: {
    backgroundColor: COLORS.lavenderLight, borderRadius: RADIUS.lg,
    padding: SPACING.xl, marginBottom: SPACING.lg,
  },
  groundIntro:     { fontFamily: FONTS.body, fontSize: 13, color: COLORS.lavenderDark, marginBottom: SPACING.lg, lineHeight: 19 },
  groundRow:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  groundCount:     { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.warmWhite, alignItems: 'center', justifyContent: 'center' },
  groundCountText: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.lavenderDark },
  groundText:      { fontFamily: FONTS.body, fontSize: 14, color: COLORS.charcoal },

  breatheBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.lavenderDark, borderRadius: RADIUS.md,
    padding: SPACING.lg, minHeight: 52, marginBottom: SPACING.xl,
  },
  breatheBtnText: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.warmWhite },

  returnBtn:  { alignItems: 'center', paddingVertical: SPACING.lg, minHeight: 48, justifyContent: 'center' },
  returnText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.sageDark },

  footer: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray, textAlign: 'center', marginTop: SPACING.md },
});
