// src/screens/Insights.js — 30-day mood chart, risk trend, SHAP factors (Build_Guide §Feature Map)
// Accessed from Home screen card — not a bottom tab.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Circle, Line, Text as SvgText, Rect } from 'react-native-svg';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme/theme';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

// ─── Risk helpers ────────────────────────────────────────────────────────────
function riskLevel(score) {
  if (score >= 0.80) return { label: 'Crisis',   color: COLORS.alert,   bg: '#FDEAE6' };
  if (score >= 0.60) return { label: 'High',     color: '#9B2A15',      bg: '#FDEAE6' };
  if (score >= 0.30) return { label: 'Moderate', color: '#8B5E1A',      bg: '#FDF3E3' };
  return              { label: 'Low',            color: COLORS.sageDark, bg: COLORS.sageLight };
}

// ─── Sparkline chart (react-native-svg) ──────────────────────────────────────
function MiniChart({ data, color, height = 90, label }) {
  if (!data || data.length < 2) return null;
  const W = 300, H = height;
  const min = Math.min(...data);
  const max = Math.max(...data) || 1;
  const pad = 8;

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
    return `${x},${y}`;
  });
  const lastPt = pts[pts.length - 1].split(',');

  return (
    <View style={{ marginTop: SPACING.sm }}>
      {label && <Text style={styles.chartLabel}>{label}</Text>}
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((t, i) => (
          <Line
            key={i}
            x1={pad} y1={pad + (1 - t) * (H - pad * 2)}
            x2={W - pad} y2={pad + (1 - t) * (H - pad * 2)}
            stroke="rgba(44,40,38,0.06)" strokeWidth="1"
          />
        ))}
        <Polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={lastPt[0]} cy={lastPt[1]} r="4" fill={color} />
      </Svg>
    </View>
  );
}

// ─── SHAP Factor Card ─────────────────────────────────────────────────────────
import { Feather } from '@expo/vector-icons';

function ShapCard({ factor, index }) {
  const dotColors = [COLORS.roseDark, COLORS.rose, COLORS.lavender];
  const dotColor  = dotColors[index] || COLORS.warmGray;
  return (
    <View style={styles.shapCard}>
      <View style={[styles.shapRankDot, { backgroundColor: dotColor }]} />
      <View style={styles.shapBody}>
        <Text style={styles.shapFactor}>{factor.label || factor}</Text>
        {factor.value !== undefined && (
          <View style={styles.shapBar}>
            <View style={[styles.shapBarFill, {
              width: `${Math.min(factor.value * 100, 100)}%`,
              backgroundColor: dotColor,
            }]} />
          </View>
        )}
      </View>
      <Text style={styles.shapPct}>
        {factor.value !== undefined ? `${(factor.value * 100).toFixed(0)}%` : ''}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function InsightsScreen({ navigation }) {
  const { currentUser } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary]   = useState(null);
  const [riskData, setRiskData] = useState([]);
  const [moodData, setMoodData] = useState([]);
  const [shapFactors, setShapFactors] = useState([]);
  const [currentRisk, setCurrentRisk] = useState(0);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [monthlyRes, riskRes] = await Promise.all([
        api.get(`/mood/monthly/${currentUser.uid}`),
        api.get(`/risk/history/${currentUser.uid}`).catch(() => ({ data: null })),
      ]);

      if (monthlyRes.data?.aggregates) {
        const agg = monthlyRes.data.aggregates;
        setSummary(agg);
        setCurrentRisk(agg.avgRiskScore || agg.riskScore || 0);
      }

      if (monthlyRes.data?.moodTrend) {
        setMoodData(monthlyRes.data.moodTrend.map(d => d.mood || d.value || 3));
      }

      if (riskRes.data?.history) {
        setRiskData(riskRes.data.history.map(d => d.riskScore || 0));
      }

      if (monthlyRes.data?.shapFactors || riskRes.data?.shapFactors) {
        const raw = monthlyRes.data?.shapFactors || riskRes.data?.shapFactors || [];
        setShapFactors(raw.slice(0, 3));
      }
    } catch (e) {
      console.warn('[Insights] fetch error:', e.message);
      // Show placeholder data so the screen is still useful offline
      setMoodData([3, 3.5, 2.8, 4, 3.2, 2.5, 3.8]);
      setRiskData([0.3, 0.35, 0.42, 0.28, 0.5, 0.38, 0.3]);
      setShapFactors([
        { label: 'Sleep disruption', value: 0.72 },
        { label: 'Low physical activity', value: 0.55 },
        { label: 'Hormonal vulnerability', value: 0.48 },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };
  const rl = riskLevel(currentRisk);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.rose} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Insights</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.rose} size="large" />
            <Text style={styles.loadingText}>Fetching your 30-day data…</Text>
          </View>
        ) : (
          <>
            {/* Current Risk Card */}
            <View style={[styles.riskCard, { backgroundColor: rl.bg }]}>
              <View style={styles.riskCardRow}>
                <View>
                  <Text style={styles.riskCardLabel}>Current Risk Level</Text>
                  <Text style={[styles.riskCardLevel, { color: rl.color }]}>{rl.label}</Text>
                  <Text style={[styles.riskCardScore, { color: rl.color }]}>
                    Score: {(currentRisk * 100).toFixed(0)}%
                  </Text>
                </View>
                {/* Risk ring indicator */}
                <Svg width={64} height={64} viewBox="0 0 64 64">
                  <Circle cx="32" cy="32" r="28" stroke="rgba(44,40,38,0.1)" strokeWidth="6" fill="none" />
                  <Circle
                    cx="32" cy="32" r="28"
                    stroke={rl.color}
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 28 * Math.min(currentRisk, 1)} ${2 * Math.PI * 28}`}
                    strokeLinecap="round"
                    rotation="-90"
                    origin="32,32"
                  />
                  <SvgText x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="600" fill={rl.color}>
                    {(currentRisk * 100).toFixed(0)}
                  </SvgText>
                </Svg>
              </View>
              <Text style={[styles.riskCardHint, { color: rl.color }]}>
                {currentRisk >= 0.80 ? '⚠ Immediate support recommended. Talk to your clinician.'
                  : currentRisk >= 0.60 ? '📋 Your clinician has been notified. Try a CBT reframe.'
                  : currentRisk >= 0.30 ? '🌿 Moderate watch. A breathing exercise can help.'
                  : '✅ You\'re doing well. Keep up the check-ins.'}
              </Text>
            </View>

            {/* 30-Day Mood Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>30-Day Mood Trend</Text>
              <MiniChart data={moodData} color={COLORS.lavender} label="Daily mood score (1–5)" />
              {summary && (
                <View style={styles.statRow}>
                  <View style={styles.statPill}>
                    <Text style={styles.statVal}>{summary.avgMood?.toFixed(1) ?? '—'}</Text>
                    <Text style={styles.statKey}>Avg Mood</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={styles.statVal}>{summary.totalLogs ?? '—'}</Text>
                    <Text style={styles.statKey}>Check-ins</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={styles.statVal}>{summary.streakDays ?? '—'}</Text>
                    <Text style={styles.statKey}>Streak</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Risk Score Trend */}
            {riskData.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.sectionTitle}>Risk Score Trend (XGBoost)</Text>
                <MiniChart data={riskData} color={COLORS.alert} label="Daily risk score (0–1)" />
              </View>
            )}

            {/* SHAP Top Factors */}
            {shapFactors.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.sectionTitle}>Top Risk Factors</Text>
                <Text style={styles.shapSubtitle}>Explained by SHAP — what's driving your risk score</Text>
                {shapFactors.map((f, i) => (
                  <ShapCard key={i} factor={f} index={i} />
                ))}
              </View>
            )}

            {/* Intervention nudge */}
            <TouchableOpacity
              style={styles.nudgeCard}
              onPress={() => navigation.navigate('SomaticBreathing')}
              accessibilityLabel="Start a breathing exercise"
            >
              <Text style={styles.nudgeIcon}>🫁</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.nudgeTitle}>Start a Breathing Exercise</Text>
                <Text style={styles.nudgeDesc}>4-4-6 somatic breathing. Takes just 3 minutes.</Text>
              </View>
              <Text style={styles.nudgeArrow}>→</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.xxl },
  backBtn: { padding: SPACING.sm, borderRadius: RADIUS.pill, backgroundColor: COLORS.warmWhite },
  backArrow: { fontSize: 22, color: COLORS.charcoal },
  title: { fontFamily: FONTS.display, fontSize: 34, color: COLORS.charcoal, lineHeight: 38 },

  loadingBox: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  loadingText: { fontFamily: FONTS.body, color: COLORS.warmGray, marginTop: SPACING.lg },

  // Risk card
  riskCard: { borderRadius: RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.xl },
  riskCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  riskCardLabel: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginBottom: 4 },
  riskCardLevel: { fontFamily: FONTS.display, fontSize: 32, lineHeight: 36 },
  riskCardScore: { fontFamily: FONTS.medium, fontSize: 13 },
  riskCardHint: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 20 },

  // Chart cards
  chartCard: {
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(44,40,38,0.07)',
  },
  sectionTitle: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.charcoal, marginBottom: 4 },
  chartLabel: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray, marginBottom: SPACING.xs },

  statRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  statPill: {
    flex: 1,
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statVal: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.lavenderDark },
  statKey: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray, marginTop: 2 },

  // SHAP
  shapSubtitle: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginBottom: SPACING.md },
  shapRankDot: { width: 9, height: 9, borderRadius: 5, marginTop: 4 },
  shapPct: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.warmGray },
  shapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(44,40,38,0.06)',
  },
  shapRank: { fontSize: 20, display: 'none' },
  shapBody: { flex: 1 },
  shapFactor: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.charcoal, marginBottom: 6 },
  shapBar: {
    height: 6,
    backgroundColor: 'rgba(44,40,38,0.08)',
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  shapBarFill: { height: 6, backgroundColor: COLORS.rose, borderRadius: RADIUS.pill },

  // Nudge
  nudgeCard: {
    backgroundColor: COLORS.sageLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  nudgeIcon: { fontSize: 28 },
  nudgeTitle: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.sageDark },
  nudgeDesc: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.sageDark, marginTop: 3 },
  nudgeArrow: { fontSize: 20, color: COLORS.sageDark },
});
