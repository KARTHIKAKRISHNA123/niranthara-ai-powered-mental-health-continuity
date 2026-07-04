// src/screens/Assessment.js — PHQ-9 / GAD-7 validated instruments
// One question per screen (completion rates roughly double vs a 9-row form).
// Scoring is done server-side; a local fallback covers offline demo runs.
// No emojis. Calm pacing — this is a clinical instrument, not a quiz.

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../theme/theme';
import { api } from '../utils/api';

const INSTRUMENTS = {
  phq9: {
    title: 'PHQ-9',
    fullName: 'Patient Health Questionnaire',
    lead: 'Over the last two weeks, how often have you been bothered by:',
    questions: [
      'Little interest or pleasure in doing things',
      'Feeling down, depressed, or hopeless',
      'Trouble falling or staying asleep, or sleeping too much',
      'Feeling tired or having little energy',
      'Poor appetite or overeating',
      'Feeling bad about yourself, or that you are a failure or have let yourself or your family down',
      'Trouble concentrating on things, such as reading or watching television',
      'Moving or speaking so slowly that other people could have noticed — or the opposite, being unusually fidgety or restless',
      'Thoughts that you would be better off dead, or of hurting yourself in some way',
    ],
    max: 27,
    bands: [
      [0, 4, 'minimal'], [5, 9, 'mild'], [10, 14, 'moderate'],
      [15, 19, 'moderately severe'], [20, 27, 'severe'],
    ],
  },
  gad7: {
    title: 'GAD-7',
    fullName: 'Generalised Anxiety Disorder scale',
    lead: 'Over the last two weeks, how often have you been bothered by:',
    questions: [
      'Feeling nervous, anxious, or on edge',
      'Not being able to stop or control worrying',
      'Worrying too much about different things',
      'Trouble relaxing',
      'Being so restless that it is hard to sit still',
      'Becoming easily annoyed or irritable',
      'Feeling afraid, as if something awful might happen',
    ],
    max: 21,
    bands: [[0, 4, 'minimal'], [5, 9, 'mild'], [10, 14, 'moderate'], [15, 21, 'severe']],
  },
};

const OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
];

const localSeverity = (spec, score) =>
  spec.bands.find(([lo, hi]) => score >= lo && score <= hi)[2];

const RESULT_COPY = {
  minimal:  'Your responses suggest minimal symptoms right now. Keep checking in — trends matter more than single scores.',
  mild:     'Your responses suggest mild symptoms. Small, steady routines help — your check-ins let the system watch the trend with you.',
  moderate: 'Your responses suggest moderate symptoms. This is worth discussing with your clinician — your score has been shared with your care team.',
  'moderately severe': 'Your responses suggest moderately severe symptoms. Your care team can see this score, and reaching out to them soon is a good next step.',
  severe:   'Your responses suggest severe symptoms. Please consider contacting your clinician soon — your care team can see this score and is there for you.',
};

export default function AssessmentScreen({ navigation, route }) {
  const type = route?.params?.type === 'gad7' ? 'gad7' : 'phq9';
  const spec = INSTRUMENTS[type];

  // step: -1 = intro, 0..n-1 = questions, n = result
  const [step, setStep]       = useState(-1);
  const [answers, setAnswers] = useState([]);
  const [result, setResult]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [step]);

  const submit = async (finalAnswers) => {
    setSubmitting(true);
    const score = finalAnswers.reduce((s, a) => s + a, 0);
    const local = {
      score,
      severity: localSeverity(spec, score),
      maxScore: spec.max,
      selfHarmFlag: type === 'phq9' && finalAnswers[8] > 0,
      offline: true,
    };
    try {
      const res = await api.post('/assessments', { type, answers: finalAnswers });
      setResult({ ...res.data, offline: false });
    } catch (e) {
      // Offline or server down: score locally so the user still gets their result.
      setResult(local);
    }
    setSubmitting(false);
    setStep(spec.questions.length);
  };

  const answer = (value) => {
    const next = [...answers.slice(0, step), value];
    setAnswers(next);
    if (step + 1 < spec.questions.length) {
      setStep(step + 1);
    } else {
      submit(next);
    }
  };

  const goBack = () => {
    if (step <= 0) navigation.goBack();
    else setStep(step - 1);
  };

  const progress = step < 0 ? 0 : Math.min((step / spec.questions.length) * 100, 100);

  // ── Intro ──
  if (step === -1) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <TouchableOpacity style={s.closeBtn} onPress={() => navigation.goBack()} accessibilityLabel="Close assessment">
            <Feather name="x" size={20} color={COLORS.warmGray} />
          </TouchableOpacity>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={s.introBadge}>{spec.title}</Text>
            <Text style={s.introTitle}>{spec.fullName}</Text>
            <Text style={s.introBody}>
              {spec.questions.length} short questions about the last two weeks.
              It takes about two minutes, and your answers are shared only with
              your care team.
            </Text>
          </View>
          <TouchableOpacity style={s.primaryBtn} onPress={() => setStep(0)} accessibilityLabel="Begin assessment">
            <Text style={s.primaryBtnText}>Begin</Text>
            <Feather name="arrow-right" size={16} color={COLORS.warmWhite} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Result ──
  if (step >= spec.questions.length && result) {
    const copy = RESULT_COPY[result.severity] || RESULT_COPY.minimal;
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={s.resultLabel}>{spec.title} RESULT</Text>
            <Text style={s.resultScore}>
              {result.score}
              <Text style={s.resultMax}> / {result.maxScore}</Text>
            </Text>
            <View style={s.severityPill}>
              <Text style={s.severityText}>{result.severity}</Text>
            </View>
            <Text style={s.resultCopy}>{copy}</Text>
            {result.offline && (
              <Text style={s.offlineNote}>
                Scored on this device — the server could not be reached, so your
                care team has not received this result yet.
              </Text>
            )}
          </View>

          {result.selfHarmFlag && (
            <TouchableOpacity
              style={s.supportBtn}
              onPress={() => navigation.navigate('CrisisSupport', { fromDetection: true })}
              accessibilityLabel="Open support resources"
            >
              <Feather name="heart" size={16} color={COLORS.warmWhite} />
              <Text style={s.primaryBtnText}>Support is available right now</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.goBack()} accessibilityLabel="Finish assessment">
            <Text style={s.primaryBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Question ──
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>
        {/* Top bar: back + progress */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={goBack} style={s.backBtn} accessibilityLabel="Previous question">
            <Feather name="arrow-left" size={20} color={COLORS.warmGray} />
          </TouchableOpacity>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={s.progressText}>{step + 1}/{spec.questions.length}</Text>
        </View>

        <Animated.View style={{ flex: 1, opacity: fade }}>
          <Text style={s.lead}>{spec.lead}</Text>
          <Text style={s.question}>{spec.questions[step]}</Text>

          <View style={{ flex: 1 }} />

          {OPTIONS.map(o => {
            const selected = answers[step] === o.value;
            return (
              <TouchableOpacity
                key={o.value}
                style={[s.option, selected && s.optionSelected]}
                onPress={() => !submitting && answer(o.value)}
                activeOpacity={0.75}
                accessibilityLabel={o.label}
              >
                <View style={[s.optionRadio, selected && s.optionRadioSelected]} />
                <Text style={[s.optionText, selected && s.optionTextSelected]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.cream },
  content: { flex: 1, padding: SPACING.xl },

  closeBtn: { alignSelf: 'flex-end', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  introBadge: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.roseDark, letterSpacing: 1.5, marginBottom: SPACING.sm },
  introTitle: { fontFamily: FONTS.display, fontSize: 30, lineHeight: 38, color: COLORS.charcoal, marginBottom: SPACING.lg },
  introBody:  { fontFamily: FONTS.body, fontSize: 14, lineHeight: 22, color: COLORS.warmGray },

  topBar:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.xxl },
  backBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -SPACING.md },
  progressTrack:{ flex: 1, height: 5, borderRadius: RADIUS.pill, backgroundColor: COLORS.roseLight, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: RADIUS.pill, backgroundColor: COLORS.roseDark },
  progressText: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.warmGray, minWidth: 32, textAlign: 'right' },

  lead:     { fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray, marginBottom: SPACING.md, lineHeight: 19 },
  question: { fontFamily: FONTS.display, fontSize: 26, lineHeight: 34, color: COLORS.charcoal },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.warmWhite, borderRadius: RADIUS.md,
    padding: SPACING.lg, marginBottom: SPACING.md, minHeight: 56,
    borderWidth: 1.5, borderColor: COLORS.cardBorder,
    ...SHADOW.sm,
  },
  optionSelected:      { borderColor: COLORS.roseDark, backgroundColor: COLORS.roseLight },
  optionRadio:         { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: COLORS.softGray },
  optionRadioSelected: { borderColor: COLORS.roseDark, backgroundColor: COLORS.roseDark },
  optionText:          { fontFamily: FONTS.body, fontSize: 15, color: COLORS.charcoal },
  optionTextSelected:  { fontFamily: FONTS.medium, color: COLORS.roseDark },

  resultLabel: { fontFamily: FONTS.body, fontSize: 11, letterSpacing: 1.4, color: COLORS.warmGray, marginBottom: SPACING.md },
  resultScore: { fontFamily: FONTS.display, fontSize: 64, color: COLORS.charcoal, lineHeight: 72 },
  resultMax:   { fontSize: 24, color: COLORS.warmGray },
  severityPill:{ backgroundColor: COLORS.lavenderLight, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.lg, paddingVertical: 7, marginTop: SPACING.md, marginBottom: SPACING.xl },
  severityText:{ fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.lavenderDark, textTransform: 'capitalize', letterSpacing: 0.5 },
  resultCopy:  { fontFamily: FONTS.body, fontSize: 14, lineHeight: 22, color: COLORS.warmGray, textAlign: 'center', paddingHorizontal: SPACING.md },
  offlineNote: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.warmGray, marginTop: SPACING.lg, fontStyle: 'italic' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.roseDark, borderRadius: RADIUS.md,
    padding: SPACING.lg, minHeight: 52,
  },
  primaryBtnText: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.warmWhite },
  supportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.lavenderDark, borderRadius: RADIUS.md,
    padding: SPACING.lg, minHeight: 52, marginBottom: SPACING.md,
  },
});
