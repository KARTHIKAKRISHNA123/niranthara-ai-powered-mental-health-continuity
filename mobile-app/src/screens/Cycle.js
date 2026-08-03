// src/screens/Cycle.js — Clue-style segmented cycle ring per Build_Guide §22
// Redesign: uniform stroke width (no active bulge), separated vulnerability bar,
// small phase-colored day dot, clean center typography.

import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme/theme';
import { api } from '../utils/api';
import { auth } from '../utils/firebase';
import PeriodLogSheet from './PeriodLogSheet';

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

// ─── Phase Ring — single ring, uniform stroke, RN Text overlay for center ────
function PhaseRing({ cycleLength = 28, currentDay = 1, size = 260 }) {
  const cx = size / 2;
  const cy = size / 2;

  const R       = size * 0.40;   // ring radius — slightly larger for breathing room
  const SW      = size * 0.072;  // uniform stroke (no active bulge)
  const GAP_DEG = 2.5;

  const degPerDay      = 360 / cycleLength;
  const currentPhaseId = getPhaseId(currentDay, cycleLength);
  const currentPhase   = PHASES.find(p => p.id === currentPhaseId) || PHASES[3];

  const dotAngle = currentDay * degPerDay;
  const dotPos   = polarToXY(dotAngle, R, cx, cy);

  return (
    <View style={{ alignItems: 'center' }}>
      {/* SVG ring — arcs + dot only, NO SvgText (custom fonts don't load in SVG) */}
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>

          {/* Background track */}
          <Circle
            cx={cx} cy={cy} r={R}
            stroke="rgba(44,40,38,0.07)"
            strokeWidth={SW}
            fill="none"
          />

          {/* Phase arcs — uniform strokeWidth for all */}
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
                strokeWidth={SW}
                strokeLinecap="round"
                fill="none"
                opacity={isActive ? 1 : 0.22}
              />
            );
          })}

          {/* Day dot — phase-colored, white halo, sits on the ring */}
          <Circle cx={dotPos.x} cy={dotPos.y} r={8}   fill={COLORS.warmWhite} />
          <Circle cx={dotPos.x} cy={dotPos.y} r={5.5} fill={currentPhase.color} />
        </Svg>

        {/* ── Center text overlay — React Native Text so custom fonts load ── */}
        <View style={styles.ringCenter} pointerEvents="none">
          <Text style={styles.ringDayLabel}>DAY</Text>
          <Text style={styles.ringDayNumber}>{currentDay}</Text>
          <Text style={styles.ringDaySub}>of {cycleLength}</Text>
        </View>
      </View>

      {/* Phase legend */}
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
  const [loadError,  setLoadError]  = useState('');
  const [loading,    setLoading]    = useState(true);
  const [sheetOpen,  setSheetOpen]  = useState(false);
  const [dayLogs,    setDayLogs]    = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCycleData = useCallback(async () => {
    try {
      if (!auth.currentUser) return;
      const uid = auth.currentUser.uid;
      const [todayRes, logsRes] = await Promise.all([
        api.get(`/cycle/today/${uid}`, { timeout: 20000 }),
        api.get(`/cycle/day-logs/${uid}?days=60`).catch(() => ({ data: { logs: [] } })),
      ]);
      setCycleData(todayRes.data);
      setDayLogs(logsRes.data?.logs || []);
      setLoadError('');
    } catch (e) {
      // No invented fallback. The old catch substituted a hardcoded day 14 /
      // 0.3 vulnerability, which is why this screen and Home showed different
      // days whenever the request failed — Home defaults to day 1.
      setLoadError(
        e.response
          ? `Server error ${e.response.status} loading your cycle.`
          : 'Could not reach Niranthara. Pull to retry.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCycleData(); }, [fetchCycleData]);
  // Matches Home.js — both screens read /cycle/today, so both must refetch on
  // focus or they drift apart and show different cycle days.
  //
  // The callback MUST NOT be the async function itself: an async function
  // returns a Promise, and useFocusEffect only accepts undefined or a cleanup
  // function — passing it directly throws "An effect function must not return
  // anything besides a function". Call it inside a sync wrapper.
  useFocusEffect(useCallback(() => { fetchCycleData(); }, [fetchCycleData]));

  const onRefresh = () => { setRefreshing(true); fetchCycleData(); };

  const hasData         = cycleData?.hasData !== false && (cycleData?.currentDay || 0) > 0;
  const currentDay      = cycleData?.currentDay  || 0;
  const cycleLength     = cycleData?.cycleLength || 28;
  const vulnScore       = cycleData?.vulnerabilityScore || 0;
  const isOverdue       = !!cycleData?.isOverdue;
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

        {loadError ? (
          <View style={styles.errorCard}>
            <Feather name="wifi-off" size={16} color={COLORS.alert} />
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.rose} size="large" />
        ) : !hasData ? (
          /* No period logged yet — an honest empty state instead of a ring
             drawn around invented numbers. */
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Feather name="moon" size={30} color={COLORS.rose} />
            </View>
            <Text style={styles.emptyTitle}>No cycle data yet</Text>
            <Text style={styles.emptyBody}>
              Log the first day of your period and Niranthara starts learning
              your rhythm. After three cycles it trains a model that is yours
              alone.
            </Text>
            <TouchableOpacity
              style={styles.logBtn}
              onPress={() => setSheetOpen(true)}
              accessibilityLabel="Log your period"
            >
              <Feather name="droplet" size={18} color={COLORS.warmWhite} />
              <Text style={styles.logBtnText}>Log my period</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Ring ── */}
            <View style={styles.ringWrap}>
              <PhaseRing
                cycleLength={cycleLength}
                currentDay={currentDay}
                size={272}
              />
            </View>

            {isOverdue && (
              <View style={styles.overdueBadge}>
                <Feather name="clock" size={13} color={COLORS.warning} />
                <Text style={styles.overdueText}>
                  {cycleData.daysSinceLastPeriod - cycleLength} days past your predicted date
                </Text>
              </View>
            )}

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

            {/* ── Recently logged days ── */}
            {dayLogs.length > 0 && (
              <View style={styles.logsCard}>
                <Text style={styles.logsTitle}>Recently logged</Text>
                {dayLogs.slice(0, 5).map(log => (
                  <View key={log.id} style={styles.logRow}>
                    <View style={styles.logDayBadge}>
                      <Text style={styles.logDayText}>
                        {log.periodDay ? `D${log.periodDay}` : '·'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logDate}>
                        {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {log.flow ? `  ·  ${log.flow}` : ''}
                      </Text>
                      {log.symptoms?.length > 0 && (
                        <Text style={styles.logSymptoms} numberOfLines={1}>
                          {log.symptoms.map(s => s.replace(/_/g, ' ')).join(', ')}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Log period button — opens the full day/flow/symptom sheet ── */}
            <TouchableOpacity
              style={styles.logBtn}
              onPress={() => setSheetOpen(true)}
              accessibilityLabel="Log a period day with flow and symptoms"
            >
              <Feather name="droplet" size={18} color={COLORS.warmWhite} />
              <Text style={styles.logBtnText}>Log period day</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <PeriodLogSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={() => fetchCycleData()}
        defaultDay={hasData && currentDay <= 8 ? currentDay : 1}
      />
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

  // Ring center text overlay (absolute, centered over SVG)
  ringCenter: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    alignItems:     'center',
    justifyContent: 'center',
  },
  ringDayLabel: {
    fontFamily:    FONTS.medium,
    fontSize:      11,
    color:         COLORS.warmGray,
    letterSpacing: 3,
    marginBottom:  2,
  },
  ringDayNumber: {
    fontFamily: FONTS.display,       // Cormorant Garamond — loads correctly in RN View
    fontSize:   80,
    lineHeight: 80,
    color:      COLORS.charcoal,
    marginBottom: 2,
  },
  ringDaySub: {
    fontFamily: FONTS.body,
    fontSize:   13,
    color:      COLORS.warmGray,
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

  // Error banner
  errorCard: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#FDEAE6', borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.lg,
  },
  errorText: { flex: 1, fontFamily: FONTS.body, fontSize: 12.5, color: '#9B2A15', lineHeight: 18 },

  // Empty state
  emptyWrap: { width: '100%', alignItems: 'center', paddingTop: SPACING.xxl },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.roseLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg,
  },
  emptyTitle: { fontFamily: FONTS.display, fontSize: 26, color: COLORS.charcoal, marginBottom: SPACING.sm },
  emptyBody: {
    fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.warmGray,
    textAlign: 'center', lineHeight: 21, marginBottom: SPACING.xl, paddingHorizontal: SPACING.md,
  },

  // Overdue
  overdueBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FDF3E3', borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md, paddingVertical: 7, marginBottom: SPACING.lg,
  },
  overdueText: { fontFamily: FONTS.medium, fontSize: 12, color: '#8B5E1A' },

  // Recent day logs
  logsCard: {
    width: '100%', backgroundColor: COLORS.warmWhite, borderRadius: RADIUS.md,
    padding: SPACING.lg, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  logsTitle: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.charcoal, marginBottom: SPACING.md },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  logDayBadge: {
    width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: COLORS.roseLight,
    alignItems: 'center', justifyContent: 'center',
  },
  logDayText:  { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.roseDark },
  logDate:     { fontFamily: FONTS.body, fontSize: 13, color: COLORS.charcoal, textTransform: 'capitalize' },
  logSymptoms: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.warmGray, marginTop: 1, textTransform: 'capitalize' },

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
