// src/screens/Cycle.js — Clue-style segmented cycle ring per Build_Guide §22 + Feature Map
// Four phase arcs around a full circle, current day as a highlighted dot.
// Colors strictly follow style guide: rose (menstrual), lavender (follicular),
// sage (ovulatory), rose-dark (luteal), alert (late luteal / vulnerability).

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Text as SvgText, G, Line } from 'react-native-svg';
import { COLORS, FONTS, SPACING, RADIUS, theme } from '../theme/theme';
import { api, postData } from '../utils/api';
import { auth } from '../utils/firebase';

// ─── Phase definitions (style guide compliant) ───────────────────────────────
const PHASES = [
  {
    id:    'menstrual',
    label: 'Menstrual',
    days:  [1, 5],
    color: COLORS.rose,
    bg:    COLORS.roseLight,
    tip:   'Rest and be gentle with yourself. Warmth and light stretching can ease cramps.',
  },
  {
    id:    'follicular',
    label: 'Follicular',
    days:  [6, 13],
    color: COLORS.lavender,
    bg:    COLORS.lavenderLight,
    tip:   'Energy is rising. Great time to start new projects and social activities.',
  },
  {
    id:    'ovulatory',
    label: 'Ovulatory',
    days:  [14, 16],
    color: COLORS.sage,
    bg:    COLORS.sageLight,
    tip:   'Peak energy and confidence. You may feel most like yourself today.',
  },
  {
    id:    'luteal',
    label: 'Luteal',
    days:  [17, 28],
    color: COLORS.roseDark,
    bg:    '#F5E0E2',
    tip:   'Energy slows. Prioritize rest, boundaries, and nourishing foods.',
  },
];

// ─── Polar helpers ────────────────────────────────────────────────────────────
function polarToXY(angleDeg, r, cx, cy) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startDeg, endDeg) {
  const s = polarToXY(startDeg, r, cx, cy);
  const e = polarToXY(endDeg,   r, cx, cy);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

// ─── Full Clue-style ring ─────────────────────────────────────────────────────
function ClueRing({ cycleLength = 28, currentDay = 1, vulnerabilityScore = 0, size = 260 }) {
  const cx = size / 2, cy = size / 2;
  const R  = size * 0.38;       // arc radius
  const SW = size * 0.085;      // stroke width
  const GAP = 1.5;              // gap between segments in degrees

  const totalDays  = cycleLength;
  const degPerDay  = 360 / totalDays;

  // Which phase does the current day belong to?
  const currentPhaseId = (() => {
    for (const p of PHASES) {
      if (currentDay >= p.days[0] && currentDay <= p.days[1]) return p.id;
    }
    return 'luteal';
  })();

  const currentAngle = currentDay * degPerDay;
  const dotPos = polarToXY(currentAngle, R, cx, cy);

  // Vulnerability ring (inner, thin)
  const vulnCircumference = 2 * Math.PI * (R - SW - 4);
  const vulnFill = vulnCircumference * Math.min(vulnerabilityScore, 1);
  const vulnColor = vulnerabilityScore >= 0.7 ? COLORS.alert : vulnerabilityScore >= 0.4 ? COLORS.warning : COLORS.sage;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>

        {/* ── Phase arcs ── */}
        {PHASES.map((phase) => {
          // Map phase day range to cycle of `totalDays`
          const d0 = Math.min(phase.days[0], totalDays);
          const d1 = Math.min(phase.days[1], totalDays);
          const startDeg = (d0 - 1) * degPerDay + GAP / 2;
          const endDeg   = d1 * degPerDay - GAP / 2;
          if (endDeg <= startDeg) return null;

          const isActive = phase.id === currentPhaseId;

          return (
            <Path
              key={phase.id}
              d={describeArc(cx, cy, R, startDeg, endDeg)}
              stroke={phase.color}
              strokeWidth={isActive ? SW + 4 : SW}
              strokeLinecap="round"
              fill="none"
              opacity={isActive ? 1 : 0.35}
            />
          );
        })}

        {/* ── Vulnerability inner ring ── */}
        <Circle
          cx={cx} cy={cy}
          r={R - SW - 6}
          stroke="rgba(44,40,38,0.07)"
          strokeWidth={5}
          fill="none"
        />
        <Circle
          cx={cx} cy={cy}
          r={R - SW - 6}
          stroke={vulnColor}
          strokeWidth={5}
          fill="none"
          strokeDasharray={`${vulnFill} ${vulnCircumference}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx},${cy}`}
          opacity={0.85}
        />

        {/* ── Current day dot ── */}
        <Circle cx={dotPos.x} cy={dotPos.y} r={SW / 2 + 3} fill={COLORS.warmWhite} />
        <Circle cx={dotPos.x} cy={dotPos.y} r={SW / 2}     fill={COLORS.charcoal} />

        {/* ── Centre text ── */}
        <SvgText
          x={cx} y={cy - 14}
          textAnchor="middle"
          fontSize={size * 0.13}
          fontWeight="300"
          fill={COLORS.charcoal}
        >
          Day {currentDay}
        </SvgText>
        <SvgText
          x={cx} y={cy + 8}
          textAnchor="middle"
          fontSize={size * 0.05}
          fill={COLORS.warmGray}
        >
          of {totalDays}
        </SvgText>
        <SvgText
          x={cx} y={cy + size * 0.11}
          textAnchor="middle"
          fontSize={size * 0.047}
          fill={vulnColor}
          fontWeight="500"
        >
          {(vulnerabilityScore * 100).toFixed(0)}% vuln
        </SvgText>
      </Svg>

      {/* Phase legend dots */}
      <View style={styles.phaseLegend}>
        {PHASES.map((p) => (
          <View key={p.id} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: p.color }]} />
            <Text style={[styles.legendText, p.id === currentPhaseId && { color: p.color, fontFamily: FONTS.medium }]}>
              {p.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Compact ring for Home screen (exported) ─────────────────────────────────
export function CompactCycleRing({ cycleLength = 28, currentDay = 1, vulnerabilityScore = 0, size = 100 }) {
  const cx = size / 2, cy = size / 2;
  const R  = size * 0.38;
  const SW = size * 0.1;
  const GAP = 2;
  const totalDays = cycleLength;
  const degPerDay = 360 / totalDays;

  const currentPhaseId = (() => {
    for (const p of PHASES) {
      if (currentDay >= p.days[0] && currentDay <= p.days[1]) return p.id;
    }
    return 'luteal';
  })();
  const currentAngle = currentDay * degPerDay;
  const dotPos = polarToXY(currentAngle, R, cx, cy);
  const currentPhase = PHASES.find(p => p.id === currentPhaseId);

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {PHASES.map((phase) => {
          const d0 = Math.min(phase.days[0], totalDays);
          const d1 = Math.min(phase.days[1], totalDays);
          const startDeg = (d0 - 1) * degPerDay + GAP / 2;
          const endDeg   = d1 * degPerDay - GAP / 2;
          if (endDeg <= startDeg) return null;
          const isActive = phase.id === currentPhaseId;
          return (
            <Path
              key={phase.id}
              d={describeArc(cx, cy, R, startDeg, endDeg)}
              stroke={phase.color}
              strokeWidth={isActive ? SW + 2 : SW}
              strokeLinecap="round"
              fill="none"
              opacity={isActive ? 1 : 0.3}
            />
          );
        })}
        <Circle cx={dotPos.x} cy={dotPos.y} r={SW / 2 + 2} fill={COLORS.warmWhite} />
        <Circle cx={dotPos.x} cy={dotPos.y} r={SW / 2}     fill={COLORS.charcoal} />
        <SvgText x={cx} y={cy + 5} textAnchor="middle" fontSize={size * 0.14} fontWeight="300" fill={COLORS.charcoal}>
          {currentDay}
        </SvgText>
      </Svg>
      {currentPhase && (
        <Text style={[styles.compactPhaseLabel, { color: currentPhase.color }]}>
          {currentPhase.label}
        </Text>
      )}
    </View>
  );
}

// ─── Main Cycle Screen ────────────────────────────────────────────────────────
export default function CycleScreen() {
  const [cycleData, setCycleData]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [logging, setLogging]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCycleData = useCallback(async () => {
    try {
      if (!auth.currentUser) return;
      const res = await api.get(`/cycle/today/${auth.currentUser.uid}`);
      setCycleData(res.data);
    } catch (e) {
      console.warn('Could not fetch cycle data (offline).');
      // Fallback demo data so ring is visible
      setCycleData({ currentDay: 14, cycleLength: 28, vulnerabilityScore: 0.3, currentPhase: 'ovulatory' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCycleData(); }, [fetchCycleData]);

  const onRefresh = () => { setRefreshing(true); fetchCycleData(); };

  const logPeriodStart = async () => {
    setLogging(true);
    const result = await postData('/cycle/log-period', { periodStart: new Date().toISOString() }, 'cycleLogs');
    setLogging(false);
    if (result.success) {
      Alert.alert('Period Logged ✓', 'Your period has been recorded. Your ML predictions will be updated.');
      fetchCycleData();
    } else {
      Alert.alert('Saved Offline', 'Period will sync when you are back online.');
    }
  };

  const currentDay    = cycleData?.currentDay || 1;
  const cycleLength   = cycleData?.cycleLength || 28;
  const vulnScore     = cycleData?.vulnerabilityScore || 0;
  const currentPhaseObj = PHASES.find(p =>
    currentDay >= p.days[0] && currentDay <= p.days[1]
  ) || PHASES[3];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.rose} />}
      >
        {/* Header */}
        <Text style={styles.title}>Cycle Tracking</Text>
        <Text style={styles.subtitle}>Personalized LSTM predictions · Pull to refresh</Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.rose} size="large" />
        ) : (
          <>
            {/* ── Clue-style ring ── */}
            <View style={styles.ringWrap}>
              <ClueRing
                cycleLength={cycleLength}
                currentDay={currentDay}
                vulnerabilityScore={vulnScore}
                size={280}
              />
            </View>

            {/* Current Phase card */}
            <View style={[styles.phaseCard, { backgroundColor: currentPhaseObj.bg, borderColor: currentPhaseObj.color }]}>
              <View style={[styles.phaseAccent, { backgroundColor: currentPhaseObj.color }]} />
              <View style={styles.phaseCardBody}>
                <View style={styles.phaseNameRow}>
                  <Text style={[styles.phaseName, { color: currentPhaseObj.color }]}>
                    {currentPhaseObj.label}
                  </Text>
                </View>
                <Text style={[styles.phaseTip, { color: currentPhaseObj.color }]}>
                  {currentPhaseObj.tip}
                </Text>
              </View>
            </View>

            {/* ── Stats row ── */}
            <View style={styles.statsRow}>
              {[
                { label: 'Cycle Day',   value: `${currentDay}` },
                { label: 'Cycle Length', value: `${cycleLength}d` },
                { label: 'Vulnerability', value: `${(vulnScore * 100).toFixed(0)}%` },
              ].map(stat => (
                <View key={stat.label} style={styles.statBox}>
                  <Text style={styles.statVal}>{stat.value}</Text>
                  <Text style={styles.statKey}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* LSTM model note */}
            <View style={styles.mlNote}>
              <Text style={styles.mlNoteText}>
                Powered by your personalized LSTM model — trained on your own cycle history.
                Predictions improve with every period logged.
              </Text>
            </View>

            {/* Log period button */}
            <TouchableOpacity
              style={styles.logBtn}
              onPress={logPeriodStart}
              disabled={logging}
              accessibilityLabel="Log period start today"
            >
              {logging
                ? <ActivityIndicator color={COLORS.warmWhite} />
                : <Text style={styles.logBtnText}>Log Period Start Today</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl, alignItems: 'center' },

  // Header
  title: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.charcoal,
    alignSelf: 'flex-start',
    lineHeight: 40,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.warmGray,
    alignSelf: 'flex-start',
    marginBottom: SPACING.xl,
  },

  // Ring
  ringWrap: {
    marginBottom: SPACING.xl,
    alignItems: 'center',
  },

  // Phase legend (inside ring component)
  phaseLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray },

  // Compact ring label (used on Home)
  compactPhaseLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },

  // Phase card
  phaseCard: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    padding: 0,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  phaseAccent: {
    width: 5,
    borderTopLeftRadius: RADIUS.lg,
    borderBottomLeftRadius: RADIUS.lg,
  },
  phaseCardBody: {
    flex: 1,
    padding: SPACING.xl,
  },
  phaseNameRow:  { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm, marginBottom: 4 },
  phaseName:     { fontFamily: FONTS.display, fontSize: 26, lineHeight: 30 },
  phaseTip:      { fontFamily: FONTS.body, fontSize: 13, lineHeight: 20 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(44,40,38,0.07)',
  },
  statVal: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.charcoal },
  statKey: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.warmGray, marginTop: 2, textAlign: 'center' },

  // ML note
  mlNote: {
    width: '100%',
    backgroundColor: COLORS.lavenderLight,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  mlNoteText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.lavenderDark,
    lineHeight: 18,
  },

  // Log button
  logBtn: {
    width: '100%',
    backgroundColor: COLORS.rose,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  logBtnIcon: { fontSize: 18 },
  logBtnText: { fontFamily: FONTS.medium, color: COLORS.warmWhite, fontSize: 16 },
});
