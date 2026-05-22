// src/screens/Cycle.js — Clue-style segmented cycle ring per Build_Guide §22
// Redesign: uniform stroke width (no active bulge), separated vulnerability bar,
// small phase-colored day dot, clean center typography.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme/theme';
import { api, postData } from '../utils/api';
import { auth } from '../utils/firebase';

// ─── Phase definitions ────────────────────────────────────────────────────────
const PHASES = [
  {
    id:    'menstrual',
    label: 'Menstrual',
    days:  [1, 5],
    color: COLORS.rose,
    bg:    COLORS.roseLight,
    tip:   'Rest and be gentle with yourself. Warmth and light stretching can ease cramps.',
    icon:  'droplet',
  },
  {
    id:    'follicular',
    label: 'Follicular',
    days:  [6, 13],
    color: COLORS.lavender,
    bg:    COLORS.lavenderLight,
    tip:   'Energy is rising. A good time to start new projects and social activities.',
    icon:  'sun',
  },
  {
    id:    'ovulatory',
    label: 'Ovulatory',
    days:  [14, 16],
    color: COLORS.sage,
    bg:    COLORS.sageLight,
    tip:   'Peak energy and confidence. You may feel most like yourself today.',
    icon:  'star',
  },
  {
    id:    'luteal',
    label: 'Luteal',
    days:  [17, 28],
    color: COLORS.roseDark,
    bg:    '#F5E0E2',
    tip:   'Energy slows. Prioritize rest, boundaries, and nourishing foods.',
    icon:  'moon',
  },
];

// ─── Geometry helpers ─────────────────────────────────────────────────────────
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

function getPhaseId(day, cycleLength) {
  // Scale phases proportionally to cycle length
  const scale = cycleLength / 28;
  for (const p of PHASES) {
    const d0 = Math.round(p.days[0] * scale);
    const d1 = Math.round(p.days[1] * scale);
    if (day >= d0 && day <= d1) return p.id;
  }
  return 'luteal';
}

// ─── Phase Ring — single ring, uniform stroke, no overlapping ────────────────
function PhaseRing({ cycleLength = 28, currentDay = 1, vulnerabilityScore = 0, size = 260 }) {
  const cx = size / 2;
  const cy = size / 2;

  // Single ring geometry — consistent stroke for all arcs
  const R  = size * 0.37;   // ring radius
  const SW = size * 0.075;  // uniform stroke width (no active bulge)
  const GAP_DEG = 2.5;      // visual gap between phase segments

  const degPerDay = 360 / cycleLength;
  const currentPhaseId = getPhaseId(currentDay, cycleLength);
  const currentPhase   = PHASES.find(p => p.id === currentPhaseId) || PHASES[3];

  // Day dot position — sits on the ring, small and phase-colored
  const dotAngle = currentDay * degPerDay;
  const dotPos   = polarToXY(dotAngle, R, cx, cy);

  // Vulnerability arc — inner ring, clearly separated, very thin
  const R_VULN = R - SW - 10;                         // well inside the phase ring
  const VULN_CIRC = 2 * Math.PI * R_VULN;
  const vulnFill = VULN_CIRC * Math.min(vulnerabilityScore, 1);
  const vulnColor = vulnerabilityScore >= 0.7
    ? COLORS.alert
    : vulnerabilityScore >= 0.4
    ? COLORS.warning
    : COLORS.sage;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>

        {/* ── Background track (faint full circle) ── */}
        <Circle
          cx={cx} cy={cy} r={R}
          stroke="rgba(44,40,38,0.07)"
          strokeWidth={SW}
          fill="none"
        />

        {/* ── Phase arcs — uniform stroke, opacity signals active ── */}
        {PHASES.map((phase) => {
          const scale = cycleLength / 28;
          const d0 = Math.max(1, Math.round(phase.days[0] * scale));
          const d1 = Math.min(cycleLength, Math.round(phase.days[1] * scale));
          if (d1 < d0) return null;

          const startDeg = (d0 - 1) * degPerDay + GAP_DEG;
          const endDeg   = d1 * degPerDay - GAP_DEG;
          if (endDeg <= startDeg) return null;

          const isActive = phase.id === currentPhaseId;

          return (
            <Path
              key={phase.id}
              d={describeArc(cx, cy, R, startDeg, endDeg)}
              stroke={phase.color}
              strokeWidth={SW}          // same width for ALL phases — no ring jumping
              strokeLinecap="round"
              fill="none"
              opacity={isActive ? 1 : 0.25}
            />
          );
        })}

        {/* ── Vulnerability inner ring — thin, clearly separate ── */}
        <Circle
          cx={cx} cy={cy} r={R_VULN}
          stroke="rgba(44,40,38,0.07)"
          strokeWidth={3}
          fill="none"
        />
        {vulnerabilityScore > 0.05 && (
          <Circle
            cx={cx} cy={cy} r={R_VULN}
            stroke={vulnColor}
            strokeWidth={3}
            fill="none"
            strokeDasharray={`${vulnFill} ${VULN_CIRC}`}
            strokeLinecap="round"
            rotation="-90"
            origin={`${cx},${cy}`}
            opacity={0.75}
          />
        )}

        {/* ── Day dot — small, phase-colored, clean white outline ── */}
        <Circle cx={dotPos.x} cy={dotPos.y} r={7} fill={COLORS.warmWhite} />
        <Circle cx={dotPos.x} cy={dotPos.y} r={5} fill={currentPhase.color} />

        {/* ── Centre: Day number + cycle length ── */}
        <SvgText
          x={cx} y={cy - size * 0.07}
          textAnchor="middle"
          fontSize={size * 0.095}
          fontWeight="300"
          fontFamily="serif"
          fill={COLORS.charcoal}
          letterSpacing="1"
        >
          Day
        </SvgText>
        <SvgText
          x={cx} y={cy + size * 0.07}
          textAnchor="middle"
          fontSize={size * 0.19}
          fontWeight="300"
          fontFamily="serif"
          fill={COLORS.charcoal}
        >
          {currentDay}
        </SvgText>
        <SvgText
          x={cx} y={cy + size * 0.14}
          textAnchor="middle"
          fontSize={size * 0.048}
          fill={COLORS.warmGray}
        >
          of {cycleLength}
        </SvgText>
      </Svg>

      {/* Phase legend — horizontal row of colored dots */}
      <View style={styles.phaseLegend}>
        {PHASES.map((p) => {
          const isActive = p.id === currentPhaseId;
          return (
            <View key={p.id} style={styles.legendItem}>
              <View style={[
                styles.legendDot,
                { backgroundColor: p.color },
                isActive && styles.legendDotActive,
              ]} />
              <Text style={[
                styles.legendText,
                isActive && { color: p.color, fontFamily: FONTS.medium },
              ]}>
                {p.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Compact ring for Home screen (exported) ─────────────────────────────────
export function CompactCycleRing({ cycleLength = 28, currentDay = 1, vulnerabilityScore = 0, size = 100 }) {
  const cx = size / 2;
  const cy = size / 2;
  const R  = size * 0.38;
  const SW = size * 0.1;
  const GAP = 2.5;
  const degPerDay = 360 / cycleLength;
  const currentPhaseId = getPhaseId(currentDay, cycleLength);
  const currentPhase   = PHASES.find(p => p.id === currentPhaseId) || PHASES[3];
  const dotAngle = currentDay * degPerDay;
  const dotPos   = polarToXY(dotAngle, R, cx, cy);

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cy} r={R} stroke="rgba(44,40,38,0.07)" strokeWidth={SW} fill="none" />
        {PHASES.map((phase) => {
          const scale = cycleLength / 28;
          const d0 = Math.max(1, Math.round(phase.days[0] * scale));
          const d1 = Math.min(cycleLength, Math.round(phase.days[1] * scale));
          if (d1 < d0) return null;
          const startDeg = (d0 - 1) * degPerDay + GAP;
          const endDeg   = d1 * degPerDay - GAP;
          if (endDeg <= startDeg) return null;
          const isActive = phase.id === currentPhaseId;
          return (
            <Path
              key={phase.id}
              d={describeArc(cx, cy, R, startDeg, endDeg)}
              stroke={phase.color}
              strokeWidth={SW}
              strokeLinecap="round"
              fill="none"
              opacity={isActive ? 1 : 0.25}
            />
          );
        })}
        <Circle cx={dotPos.x} cy={dotPos.y} r={5} fill={COLORS.warmWhite} />
        <Circle cx={dotPos.x} cy={dotPos.y} r={3.5} fill={currentPhase.color} />
        <SvgText x={cx} y={cy + 5} textAnchor="middle" fontSize={size * 0.2} fontWeight="300" fontFamily="serif" fill={COLORS.charcoal}>
          {currentDay}
        </SvgText>
      </Svg>
      <Text style={[styles.compactPhaseLabel, { color: currentPhase.color }]}>
        {currentPhase.label}
      </Text>
    </View>
  );
}

// ─── Vulnerability bar ────────────────────────────────────────────────────────
function VulnBar({ score = 0 }) {
  const pct = Math.min(score, 1);
  const color = pct >= 0.7 ? COLORS.alert : pct >= 0.4 ? COLORS.warning : COLORS.sage;
  const label = pct >= 0.7 ? 'High vulnerability' : pct >= 0.4 ? 'Moderate vulnerability' : 'Low vulnerability';

  return (
    <View style={styles.vulnWrap}>
      <View style={styles.vulnHeader}>
        <Text style={styles.vulnLabel}>Cycle Vulnerability</Text>
        <Text style={[styles.vulnPct, { color }]}>{(pct * 100).toFixed(0)}%</Text>
      </View>
      <View style={styles.vulnTrack}>
        <View style={[styles.vulnFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.vulnHint, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CycleScreen() {
  const [cycleData,  setCycleData]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [logging,    setLogging]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCycleData = useCallback(async () => {
    try {
      if (!auth.currentUser) return;
      const res = await api.get(`/cycle/today/${auth.currentUser.uid}`);
      setCycleData(res.data);
    } catch {
      setCycleData({
        currentDay: 14,
        cycleLength: 28,
        vulnerabilityScore: 0.3,
        currentPhase: 'ovulatory',
      });
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
    if (result.success || !result.offline) {
      Alert.alert('Period Logged', 'Your period has been recorded. Your ML predictions will be updated.');
      fetchCycleData();
    } else {
      Alert.alert('Saved Offline', 'Period will sync when you are back online.');
    }
  };

  const currentDay      = cycleData?.currentDay  || 1;
  const cycleLength     = cycleData?.cycleLength  || 28;
  const vulnScore       = cycleData?.vulnerabilityScore || 0;
  const currentPhaseId  = getPhaseId(currentDay, cycleLength);
  const currentPhaseObj = PHASES.find(p => p.id === currentPhaseId) || PHASES[3];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.rose} />
        }
      >
        {/* ── Header ── */}
        <Text style={styles.title}>Cycle Tracking</Text>
        <Text style={styles.subtitle}>Personalized LSTM predictions · Pull to refresh</Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.rose} size="large" />
        ) : (
          <>
            {/* ── Ring ── */}
            <View style={styles.ringWrap}>
              <PhaseRing
                cycleLength={cycleLength}
                currentDay={currentDay}
                vulnerabilityScore={vulnScore}
                size={272}
              />
            </View>

            {/* ── Current Phase card ── */}
            <View style={[styles.phaseCard, { backgroundColor: currentPhaseObj.bg }]}>
              <View style={[styles.phaseAccent, { backgroundColor: currentPhaseObj.color }]} />
              <View style={styles.phaseCardBody}>
                <Text style={[styles.phaseName, { color: currentPhaseObj.color }]}>
                  {currentPhaseObj.label}
                </Text>
                <Text style={[styles.phaseTip, { color: currentPhaseObj.color }]}>
                  {currentPhaseObj.tip}
                </Text>
              </View>
              <View style={styles.phaseIconBox}>
                <Feather name={currentPhaseObj.icon} size={20} color={currentPhaseObj.color} />
              </View>
            </View>

            {/* ── Stats row ── */}
            <View style={styles.statsRow}>
              {[
                { label: 'Cycle Day',    value: `${currentDay}` },
                { label: 'Cycle Length', value: `${cycleLength}d` },
              ].map(stat => (
                <View key={stat.label} style={styles.statBox}>
                  <Text style={styles.statVal}>{stat.value}</Text>
                  <Text style={styles.statKey}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* ── Vulnerability bar (replaces inner ring for clarity) ── */}
            <VulnBar score={vulnScore} />

            {/* ── LSTM note ── */}
            <View style={styles.mlNote}>
              <Feather name="cpu" size={14} color={COLORS.lavenderDark} style={{ marginRight: SPACING.sm }} />
              <Text style={styles.mlNoteText}>
                Powered by your personalized LSTM model — trained on your own cycle history.
                Predictions improve with every period logged.
              </Text>
            </View>

            {/* ── Log period button ── */}
            <TouchableOpacity
              style={styles.logBtn}
              onPress={logPeriodStart}
              disabled={logging}
              accessibilityLabel="Log period start today"
            >
              {logging ? (
                <ActivityIndicator color={COLORS.warmWhite} />
              ) : (
                <>
                  <Feather name="droplet" size={18} color={COLORS.warmWhite} />
                  <Text style={styles.logBtnText}>Log Period Start Today</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl, alignItems: 'center' },

  // Header
  title: {
    fontFamily:  FONTS.display,
    fontSize:    34,
    color:       COLORS.charcoal,
    alignSelf:   'flex-start',
    lineHeight:  40,
  },
  subtitle: {
    fontFamily:  FONTS.body,
    fontSize:    13,
    color:       COLORS.warmGray,
    alignSelf:   'flex-start',
    marginBottom: SPACING.xl,
  },

  // Ring
  ringWrap: {
    width: '100%',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },

  // Phase legend
  phaseLegend: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'center',
    gap:            SPACING.md,
    marginTop:      SPACING.lg,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendDotActive: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray },

  // Compact ring label
  compactPhaseLabel: {
    fontFamily: FONTS.medium,
    fontSize:   11,
    marginTop:  4,
    textAlign:  'center',
  },

  // Phase card
  phaseCard: {
    width:          '100%',
    borderRadius:   RADIUS.lg,
    overflow:       'hidden',
    flexDirection:  'row',
    alignItems:     'stretch',
    marginBottom:   SPACING.lg,
  },
  phaseAccent: {
    width: 5,
  },
  phaseCardBody: {
    flex:    1,
    padding: SPACING.xl,
  },
  phaseIconBox: {
    justifyContent: 'center',
    paddingRight:   SPACING.xl,
    opacity: 0.7,
  },
  phaseName: {
    fontFamily:   FONTS.display,
    fontSize:     26,
    lineHeight:   30,
    marginBottom: 4,
  },
  phaseTip: {
    fontFamily: FONTS.body,
    fontSize:   13,
    lineHeight: 20,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    width:         '100%',
    gap:           SPACING.sm,
    marginBottom:  SPACING.lg,
  },
  statBox: {
    flex:            1,
    backgroundColor: COLORS.warmWhite,
    borderRadius:    RADIUS.md,
    padding:         SPACING.lg,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     'rgba(44,40,38,0.07)',
  },
  statVal: {
    fontFamily: FONTS.display,
    fontSize:   26,
    color:      COLORS.charcoal,
    lineHeight: 30,
  },
  statKey: {
    fontFamily: FONTS.body,
    fontSize:   11,
    color:      COLORS.warmGray,
    marginTop:  3,
    textAlign:  'center',
  },

  // Vulnerability bar
  vulnWrap: {
    width:           '100%',
    backgroundColor: COLORS.warmWhite,
    borderRadius:    RADIUS.md,
    padding:         SPACING.lg,
    marginBottom:    SPACING.lg,
    borderWidth:     1,
    borderColor:     'rgba(44,40,38,0.07)',
  },
  vulnHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   SPACING.sm,
  },
  vulnLabel: {
    fontFamily: FONTS.medium,
    fontSize:   13,
    color:      COLORS.charcoal,
  },
  vulnPct: {
    fontFamily: FONTS.medium,
    fontSize:   13,
  },
  vulnTrack: {
    height:          7,
    backgroundColor: 'rgba(44,40,38,0.07)',
    borderRadius:    RADIUS.pill,
    overflow:        'hidden',
    marginBottom:    SPACING.xs,
  },
  vulnFill: {
    height:       7,
    borderRadius: RADIUS.pill,
  },
  vulnHint: {
    fontFamily: FONTS.body,
    fontSize:   11,
    opacity:    0.8,
  },

  // ML note
  mlNote: {
    width:           '100%',
    backgroundColor: COLORS.lavenderLight,
    borderRadius:    RADIUS.md,
    padding:         SPACING.lg,
    marginBottom:    SPACING.xl,
    flexDirection:   'row',
    alignItems:      'flex-start',
  },
  mlNoteText: {
    flex:       1,
    fontFamily: FONTS.body,
    fontSize:   12,
    color:      COLORS.lavenderDark,
    lineHeight: 18,
  },

  // Log button
  logBtn: {
    width:           '100%',
    backgroundColor: COLORS.rose,
    borderRadius:    RADIUS.lg,
    paddingVertical: SPACING.lg,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.sm,
  },
  logBtnText: {
    fontFamily: FONTS.medium,
    color:      COLORS.warmWhite,
    fontSize:   16,
  },
});
