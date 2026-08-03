// src/screens/Recovery.js — the patient's answer to "am I actually getting better?"
//
// Every other screen asks the patient for something: a mood, a journal entry, a
// questionnaire. This one gives something back. That asymmetry is the whole
// reason people stop using mental-health apps — the app accumulates data about
// you and never tells you what it means.
//
// Two rules this screen must keep:
//   1. It never shows a number the backend called insufficient. An invented
//      score is worse than a blank, because a patient will believe it.
//   2. Language is non-clinical and non-judgemental. A plateau is "your symptoms
//      have levelled off", never "you have failed to respond to treatment".
//      The clinical wording belongs on the dashboard, not here.

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme/theme';
import { api, postData } from '../utils/api';
import { useAuth } from '../context/AuthContext';

// Patient-facing trajectory wording. Deliberately gentler than the clinical
// strings the dashboard shows for the same underlying state.
const TRAJECTORY_COPY = {
  remission:          { title: 'You are in remission',        body: 'Your symptom scores are in the minimal range. Keeping your routine steady is what protects this.', color: COLORS.sageDark, bg: COLORS.sageLight },
  treatment_response: { title: 'Clear improvement',           body: 'Your symptoms have more than halved since you started. That is a meaningful change.',            color: COLORS.sageDark, bg: COLORS.sageLight },
  improving:          { title: 'Moving in the right direction', body: 'Your scores are trending down week on week.',                                                  color: COLORS.sageDark, bg: COLORS.sageLight },
  plateau:            { title: 'Your symptoms have levelled off', body: 'You have been showing up and it has not shifted lately. That is worth raising with your clinician — it usually means the plan needs adjusting, not that you are doing it wrong.', color: COLORS.warning, bg: '#FDF3E0' },
  deteriorating:      { title: 'Things have been harder lately', body: 'Your scores have risen. Your clinician can see this too.',                                     color: COLORS.roseDark, bg: COLORS.roseLight },
  insufficient_data:  { title: 'Still getting to know you',   body: 'Take a PHQ-9 check twice and we can start showing you a trend.',                                 color: COLORS.warmGray, bg: COLORS.cream },
};

function ScoreRing({ score }) {
  const R = 52, stroke = 8;
  const c = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, score || 0)) / 100;

  return (
    <View style={{ width: 130, height: 130, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={130} height={130}>
        <Circle cx={65} cy={65} r={R} stroke={COLORS.roseLight} strokeWidth={stroke} fill="none" />
        <Circle
          cx={65} cy={65} r={R} stroke={COLORS.sage} strokeWidth={stroke} fill="none"
          strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round"
          transform="rotate(-90 65 65)"
        />
      </Svg>
      <View style={StyleSheet.absoluteFillObject && s.ringCenter}>
        <Text style={s.ringScore}>{score != null ? score : '—'}</Text>
        <Text style={s.ringLabel}>recovery</Text>
      </View>
    </View>
  );
}

export default function Recovery({ navigation }) {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(null);

  const load = useCallback(async () => {
    // The uid guard MUST be inside the try, so `finally` always clears loading.
    // Outside it, a focus that happened before AuthContext resolved returned
    // early, setLoading(false) never ran, and the screen span forever — which is
    // exactly what a patient saw on the Recovery tab.
    try {
      if (!user?.uid) return;
      const r = await api.get(`/recovery/${user.uid}`, { timeout: 45000 });
      setData(r.data);
      setError('');
    } catch (e) {
      setError(e.response?.data?.error || 'Could not reach the server. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleGoal = async (goal) => {
    setBusy(goal.id);
    // Optimistic: a checkbox that waits on a round trip feels broken.
    setData(d => ({ ...d, plan: { ...d.plan,
      goals: d.plan.goals.map(g => g.id === goal.id ? { ...g, done: !g.done } : g),
      completed: d.plan.completed + (goal.done ? -1 : 1) } }));

    const res = await postData('/recovery/goal', { goalId: goal.id, done: !goal.done });
    if (!res.success) load();   // server disagreed — take its word, not ours
    setBusy(null);
  };

  // Journal and Cycle live inside the tab navigator, the exercises live in the
  // stack — routing through the wrong one silently no-ops, so it is explicit.
  const TABS = ['Journal', 'Cycle', 'Home', 'Chat'];
  const openGoal = (goal) => {
    const target = goal.type === 'checkin' ? 'Journal' : goal.screen;
    if (!target) return toggleGoal(goal);
    if (TABS.includes(target)) return navigation.navigate('MainTabs', { screen: target });
    navigation.navigate(target);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}><ActivityIndicator color={COLORS.rose} /></View>
      </SafeAreaView>
    );
  }

  const score = data?.recoveryScore || {};
  const traj  = TRAJECTORY_COPY[data?.trajectory?.trajectory] || TRAJECTORY_COPY.insufficient_data;
  const goals = data?.plan?.goals || [];
  const doneCount = goals.filter(g => g.done).length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.rose} />}
      >
        <Text style={s.h1}>Your recovery</Text>
        <Text style={s.sub}>What has changed since you started — not a prediction.</Text>

        {!!error && <Text style={s.error}>{error}</Text>}

        {/* ── Score ────────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.lg }}>
            <ScoreRing score={score.score} />
            <View style={{ flex: 1 }}>
              {score.score != null ? (
                <>
                  <Text style={s.cardTitle}>{traj.title}</Text>
                  <Text style={s.cardBody}>{traj.body}</Text>
                </>
              ) : (
                <>
                  <Text style={s.cardTitle}>Not enough yet</Text>
                  <Text style={s.cardBody}>{score.message || 'Check in a few times and this fills in.'}</Text>
                </>
              )}
            </View>
          </View>

          {/* Components — the patient is entitled to know what the number is made of. */}
          {!!score.components && Object.keys(score.components).length > 0 && (
            <View style={s.componentWrap}>
              {Object.entries(score.components).map(([k, c]) => (
                <View key={k} style={s.componentRow}>
                  <Text style={s.componentLabel}>{k === 'symptoms' ? 'Symptoms' : k === 'adherence' ? 'Checking in' : k === 'engagement' ? 'Using support' : 'Mood'}</Text>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${Math.round(c.value)}%` }]} />
                  </View>
                  <Text style={s.componentDetail}>{c.detail}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Today's plan ─────────────────────────────────────────── */}
        <View style={s.sectionHead}>
          <Text style={s.h2}>Today</Text>
          <Text style={s.count}>{doneCount} of {goals.length}</Text>
        </View>
        <Text style={s.sectionSub}>
          Short on purpose. These are chosen from what has actually helped you.
        </Text>

        {goals.map(g => (
          <View key={g.id} style={s.goalCard}>
            <TouchableOpacity
              onPress={() => toggleGoal(g)}
              disabled={busy === g.id}
              style={s.checkTap}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: g.done }}
              accessibilityLabel={`Mark ${g.label} ${g.done ? 'not done' : 'done'}`}
            >
              <View style={[s.check, g.done && s.checkOn]}>
                {g.done && <Feather name="check" size={14} color={COLORS.warmWhite} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={{ flex: 1 }} onPress={() => openGoal(g)} activeOpacity={0.7}>
              <Text style={[s.goalLabel, g.done && s.goalDone]}>{g.label}</Text>
              <Text style={s.goalWhy}>{g.rationale}</Text>
              {!!g.minutes && <Text style={s.goalMin}>{g.minutes} min</Text>}
            </TouchableOpacity>

            {(g.type === 'intervention' || g.type === 'checkin') && (
              <Feather name="chevron-right" size={18} color={COLORS.softGray} />
            )}
          </View>
        ))}

        {/* ── Residual symptoms ────────────────────────────────────── */}
        {!!data?.symptoms && (data.symptoms.residual?.length > 0 || data.symptoms.active?.length > 0) && (
          <>
            <Text style={[s.h2, { marginTop: SPACING.xxl }]}>What is still lingering</Text>
            <Text style={s.sectionSub}>
              From your last PHQ-9. These are the parts that have not cleared yet — useful to
              mention at your next appointment.
            </Text>
            <View style={s.card}>
              {(data.symptoms.residual?.length ? data.symptoms.residual : data.symptoms.active).map(r => (
                <View key={r.item} style={s.symptomRow}>
                  <View style={[s.dot, { backgroundColor: r.severity === 3 ? COLORS.alert : COLORS.warning }]} />
                  <Text style={s.symptomText}>{r.symptom}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={s.footnote}>
          Your recovery score is arithmetic over your own check-ins, assessments and
          completed exercises — not a prediction, and not a diagnosis.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },

  h1:  { fontFamily: FONTS.display, fontSize: 30, color: COLORS.charcoal, marginBottom: SPACING.xs },
  sub: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray, marginBottom: SPACING.xl },
  h2:  { fontFamily: FONTS.displayMed, fontSize: 21, color: COLORS.charcoal },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: SPACING.xxl },
  sectionSub:  { fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginTop: SPACING.xs, marginBottom: SPACING.lg, lineHeight: 18 },
  count: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.warmGray },
  error: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.roseDark, marginBottom: SPACING.lg },

  card: {
    backgroundColor: COLORS.warmWhite, borderRadius: RADIUS.lg, padding: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: SPACING.md,
  },
  cardTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: COLORS.charcoal, marginBottom: SPACING.xs },
  cardBody:  { fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray, lineHeight: 20 },

  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 130, height: 130 },
  ringScore:  { fontFamily: FONTS.displayMed, fontSize: 34, color: COLORS.charcoal },
  ringLabel:  { fontFamily: FONTS.body, fontSize: 10, color: COLORS.warmGray, letterSpacing: 0.5 },

  componentWrap:   { marginTop: SPACING.xl, gap: SPACING.md },
  componentRow:    { gap: 4 },
  componentLabel:  { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.charcoal },
  componentDetail: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray },
  barTrack: { height: 5, backgroundColor: COLORS.roseLight, borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: '100%', backgroundColor: COLORS.sage, borderRadius: 3 },

  goalCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.warmWhite, borderRadius: RADIUS.md, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: SPACING.sm, minHeight: 64,
  },
  checkTap: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -SPACING.sm },
  check: {
    width: 22, height: 22, borderRadius: RADIUS.sm,
    borderWidth: 1.5, borderColor: COLORS.softGray, alignItems: 'center', justifyContent: 'center',
  },
  checkOn:   { backgroundColor: COLORS.sage, borderColor: COLORS.sageDark },
  goalLabel: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.charcoal },
  goalDone:  { textDecorationLine: 'line-through', color: COLORS.warmGray },
  goalWhy:   { fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray, marginTop: 2, lineHeight: 16 },
  goalMin:   { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.softGray, marginTop: 2 },

  symptomRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  dot:         { width: 7, height: 7, borderRadius: 4 },
  symptomText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.charcoal },

  footnote: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.softGray, marginTop: SPACING.xxl, lineHeight: 17 },
});
