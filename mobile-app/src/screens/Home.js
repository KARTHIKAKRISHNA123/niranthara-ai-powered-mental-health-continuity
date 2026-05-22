// src/screens/Home.js — Niranthara v2 Redesign (RTCFR)
// No emojis. Feather icons only. Calm staggered entrance.
// Hero components: SHAP Narrative Card + Emotional Suppression Arc.
// Responsive, mobile-first, min 44px tap targets throughout.

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Linking, Animated, Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, RISK_STYLES } from '../theme/theme';
import { CompactCycleRing } from './Cycle';
import { api } from '../utils/api';
import { processOfflineSync } from '../services/syncService';
import { useAuth } from '../context/AuthContext';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { app } from '../utils/firebase';

// AnimatedCircle for SVG ring fill
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Risk Ring ────────────────────────────────────────────────────────────────
function RiskRing({ score }) {
  const R = 44, stroke = 7;
  const circumference = 2 * Math.PI * R;
  const animScore = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animScore, {
      toValue: Math.min(score || 0, 1),
      duration: 900, delay: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score]);

  const strokeDash = animScore.interpolate({
    inputRange:  [0, 1],
    outputRange: [`0 ${circumference}`, `${circumference} ${circumference}`],
  });

  const rs = score >= 0.80 ? RISK_STYLES.crisis
           : score >= 0.60 ? RISK_STYLES.high
           : score >= 0.30 ? RISK_STYLES.moderate
           : RISK_STYLES.low;

  const label = score >= 0.80 ? 'Crisis' : score >= 0.60 ? 'High' : score >= 0.30 ? 'Moderate' : 'Low';

  return (
    <View style={s.ringWrap}>
      <Svg width={108} height={108} viewBox="0 0 108 108">
        <Circle cx="54" cy="54" r={R} stroke="rgba(44,40,38,0.08)" strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx="54" cy="54" r={R}
          stroke={rs.border}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={strokeDash}
          strokeLinecap="round"
          rotation="-90"
          origin="54,54"
        />
        <SvgText x="54" y="51" textAnchor="middle" fontSize="20" fontWeight="600" fill={rs.border}>
          {(score * 100).toFixed(0)}
        </SvgText>
        <SvgText x="54" y="64" textAnchor="middle" fontSize="8" fill={COLORS.warmGray} fontFamily="sans-serif">
          RISK %
        </SvgText>
      </Svg>
      <Text style={[s.riskLabel, { color: rs.border }]}>{label}</Text>
    </View>
  );
}

// ─── Emotional Suppression Arc ────────────────────────────────────────────────
// Signature UI moment: stated mood bar vs expressed sentiment bar.
// When divergence > 0.2, gap indicator appears between them.
function SuppressionArc({ divergenceScore = 0 }) {
  const gapOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(gapOpacity, {
      toValue: divergenceScore > 0.2 ? 1 : 0,
      duration: 600, delay: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [divergenceScore]);

  const arcColor = divergenceScore > 0.5 ? COLORS.rose
                 : divergenceScore > 0.2 ? COLORS.warning
                 : COLORS.sage;

  const label = divergenceScore > 0.5 ? 'Suppression detected'
              : divergenceScore > 0.2 ? 'Slight divergence'
              : 'Congruent';

  const labelColor = divergenceScore > 0.5 ? COLORS.roseDark
                   : divergenceScore > 0.2 ? '#8B5E1A'
                   : COLORS.sageDark;

  const statedWidth   = `${Math.max(30, (1 - divergenceScore) * 100)}%`;
  const expressedWidth = `${Math.max(30, divergenceScore > 0.2 ? (1 - divergenceScore * 0.6) * 100 : 90)}%`;

  return (
    <View style={s.suppressionInner}>
      <Text style={s.suppressionHeading}>Emotional Congruence</Text>
      <View style={s.suppressionRow}>
        <View style={s.arcSide}>
          <Text style={s.arcTag}>STATED</Text>
          <View style={[s.arcTrack, { backgroundColor: COLORS.roseLight }]}>
            <View style={[s.arcFill, { width: statedWidth, backgroundColor: COLORS.rose }]} />
          </View>
        </View>
        <Animated.View style={[s.arcGapDot, { opacity: gapOpacity, backgroundColor: arcColor }]} />
        <View style={[s.arcSide, { alignItems: 'flex-end' }]}>
          <Text style={s.arcTag}>EXPRESSED</Text>
          <View style={[s.arcTrack, { backgroundColor: COLORS.lavenderLight }]}>
            <View style={[s.arcFill, { width: expressedWidth, backgroundColor: COLORS.lavender, alignSelf: 'flex-end' }]} />
          </View>
        </View>
      </View>
      <Text style={[s.suppressionStatus, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

// ─── SHAP Narrative Card ──────────────────────────────────────────────────────
function ShapNarrativeCard({ riskScore, topFactors }) {
  const [expanded, setExpanded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, delay: 800,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  const rs = riskScore >= 0.80 ? RISK_STYLES.crisis
           : riskScore >= 0.60 ? RISK_STYLES.high
           : riskScore >= 0.30 ? RISK_STYLES.moderate
           : RISK_STYLES.low;

  const headline = riskScore >= 0.80 ? 'You are not alone right now.'
                 : riskScore >= 0.60 ? 'Your system is under stress.'
                 : riskScore >= 0.30 ? 'A few signals are shifting.'
                 : 'Your patterns look steady.';

  const iconName = riskScore >= 0.80 ? 'alert-triangle'
                 : riskScore >= 0.60 ? 'alert-circle'
                 : riskScore >= 0.30 ? 'activity'
                 : 'check-circle';

  const narrative = buildNarrative(riskScore, topFactors || []);

  return (
    <Animated.View style={[s.shapCard, { backgroundColor: rs.bg, opacity: fadeAnim }]}>
      <View style={s.shapHeader}>
        <View style={[s.shapIconBox, { backgroundColor: rs.border + '22' }]}>
          <Feather name={iconName} size={17} color={rs.border} />
        </View>
        <Text style={[s.shapHeadline, { color: rs.color }]}>{headline}</Text>
        <TouchableOpacity
          onPress={() => setExpanded(e => !e)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={expanded ? 'Collapse AI explanation' : 'Expand AI explanation'}
        >
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={rs.color} />
        </TouchableOpacity>
      </View>

      <Text style={[s.shapNarrative, { color: rs.color }]}>{narrative}</Text>

      {expanded && topFactors && topFactors.length > 0 && (
        <View style={s.shapFactors}>
          <Text style={[s.shapFactorsLabel, { color: rs.color }]}>AI SIGNAL BREAKDOWN</Text>
          {topFactors.slice(0, 3).map((factor, i) => (
            <View key={i} style={s.shapFactorRow}>
              <View style={[s.shapDot, {
                backgroundColor: i === 0 ? rs.border : i === 1 ? rs.border + 'AA' : rs.border + '66',
              }]} />
              <Text style={[s.shapFactorText, { color: rs.color }]}>{factor}</Text>
            </View>
          ))}
          <Text style={[s.shapFooter, { color: rs.color }]}>
            Powered by XGBoost · SHAP explainability · Not keyword-based
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

function buildNarrative(score, factors) {
  if (score >= 0.80) {
    return 'The system has detected signals requiring immediate attention. Your clinician has been alerted. If you need to speak with someone now, call NIMHANS: 080-46110007.';
  }
  if (score >= 0.60) {
    const f = factors[0] ? factors[0].toLowerCase() : 'several signals';
    return `The AI has noticed ${f} diverging from your personal baseline. Your clinician has been notified. Consider a breathing session or journaling now.`;
  }
  if (score >= 0.30) {
    const f = factors.slice(0, 2).join(' and ') || 'your patterns';
    return `${f.charAt(0).toUpperCase() + f.slice(1)} have moved outside your baseline in the last 7 days. A gentle check-in could help.`;
  }
  return 'Your mood, activity, and language have stayed within your personal range this week. The system continues monitoring passively.';
}

// ─── Baseline Stat ────────────────────────────────────────────────────────────
function BaselineStat({ iconName, label, value, baseline, unit = '' }) {
  const deviation  = baseline > 0 ? (value - baseline) / baseline : 0;
  const isGood     = Math.abs(deviation) < 0.2;
  const statusColor = isGood ? COLORS.sage : deviation < -0.2 ? COLORS.warning : COLORS.alert;

  return (
    <View style={s.stat}>
      <View style={[s.statIcon, { backgroundColor: isGood ? COLORS.sageLight : COLORS.roseLight }]}>
        <Feather name={iconName} size={15} color={isGood ? COLORS.sageDark : COLORS.roseDark} />
      </View>
      <Text style={s.statValue} numberOfLines={1}>
        {value != null && !isNaN(value) ? value : '—'}{unit}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
      {baseline > 0 && (
        <Text style={[s.statDev, { color: statusColor }]}>
          {deviation >= 0 ? '+' : ''}{(deviation * 100).toFixed(0)}%
        </Text>
      )}
    </View>
  );
}

// ─── SmartWatch HRV Arc ───────────────────────────────────────────────────────
function HrvArc({ deviation }) {
  const R = 34, stroke = 6;
  const circumference = 2 * Math.PI * R;
  const filled = circumference * Math.min(deviation || 0, 1);
  const color  = deviation > 0.4 ? COLORS.alert : deviation > 0.2 ? COLORS.warning : COLORS.sage;
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80">
      <Circle cx="40" cy="40" r={R} stroke="rgba(44,40,38,0.08)" strokeWidth={stroke} fill="none" />
      <Circle cx="40" cy="40" r={R}
        stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round" rotation="-90" origin="40,40"
      />
      <SvgText x="40" y="37" textAnchor="middle" fontSize="14" fontWeight="600" fill={color}>
        {((deviation || 0) * 100).toFixed(0)}
      </SvgText>
      <SvgText x="40" y="49" textAnchor="middle" fontSize="7.5" fill={COLORS.warmGray} fontFamily="sans-serif">
        HRV DEV
      </SvgText>
    </Svg>
  );
}

// ─── SmartWatch Card ──────────────────────────────────────────────────────────
function SmartWatchCard({ uid }) {
  const [watchData, setWatchData] = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(getFirestore(app), 'users', uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setWatchData({ connected: !!d.fitbitConnected, lastSync: d.lastBiometricSync || null, hrvDeviation: d.lastHrvDeviation || 0 });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const connected = watchData?.connected;
  const formatSync = (iso) => {
    if (!iso) return 'Never synced';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <View style={[s.watchCard, { backgroundColor: connected ? '#EEF7F1' : COLORS.warmWhite }]}>
      <View style={s.watchHeaderRow}>
        <View style={[s.watchDot, { backgroundColor: connected ? COLORS.sage : COLORS.softGray }]} />
        <Text style={s.watchTitle}>Fitbit Health</Text>
        <Text style={[s.watchStatus, { color: connected ? COLORS.sageDark : COLORS.warmGray }]}>
          {loading ? '…' : connected ? 'Connected' : 'Not connected'}
        </Text>
      </View>
      {connected && watchData?.lastSync && (
        <Text style={s.watchSync}>Last sync {formatSync(watchData.lastSync)}</Text>
      )}
      {connected ? (
        <View style={s.watchBody}>
          <HrvArc deviation={watchData?.hrvDeviation} />
          <View style={{ flex: 1 }}>
            <Text style={s.watchMetaLabel}>HRV DEVIATION</Text>
            <Text style={s.watchMetaValue}>
              {watchData?.hrvDeviation > 0.4 ? 'Critically low'
               : watchData?.hrvDeviation > 0.2 ? 'Slightly low'
               : 'Within baseline'}
            </Text>
            <Text style={s.watchMetaSub}>Measured against your 30-day personal baseline</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={s.connectBtn}
          onPress={() => uid && Linking.openURL(`http://localhost:5001/smartwatch/auth/connect?uid=${uid}`)}
          accessibilityLabel="Connect your Fitbit health tracker to Niranthara"
        >
          <Feather name="watch" size={15} color={COLORS.warmWhite} />
          <Text style={s.connectBtnText}>Connect Fitbit</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Quick Tile ───────────────────────────────────────────────────────────────
function QuickTile({ iconName, label, sub, onPress, a11y }) {
  return (
    <TouchableOpacity style={s.quickTile} onPress={onPress} activeOpacity={0.7} accessibilityLabel={a11y}>
      <View style={s.quickTileIcon}>
        <Feather name={iconName} size={18} color={COLORS.roseDark} />
      </View>
      <Text style={s.quickLabel}>{label}</Text>
      <Text style={s.quickSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { dbUser, currentUser, logout } = useAuth();
  const [data, setData]       = useState({ riskScore: 0, avgMood: 3, topFactors: [], moodSentimentDivergence: 0 });
  const [passive, setPassive] = useState({ steps: 0, stepsBaseline: 0, sleepHours: 0, sleepBaseline: 0 });
  const [cycle, setCycle]     = useState({ currentDay: 1, cycleLength: 28, vulnerabilityScore: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const anim0 = useRef(new Animated.Value(0)).current;
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(110, [
      Animated.timing(anim0, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(anim1, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(anim2, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(anim3, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const entrance = (anim, y = 10) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) }],
  });

  const goToTab = (name) => {
    const parent = navigation.getParent();
    if (parent) { parent.navigate('MainTabs', { screen: name }); return; }
    navigation.navigate(name);
  };

  const fetchData = async () => {
    await processOfflineSync();
    if (!currentUser) return;
    try {
      const [monthRes, passRes, cycleRes] = await Promise.all([
        api.get(`/mood/monthly/${currentUser.uid}`),
        api.get(`/passive/summary/${currentUser.uid}`).catch(() => ({ data: null })),
        api.get(`/cycle/today/${currentUser.uid}`).catch(() => ({ data: null })),
      ]);
      if (monthRes.data?.aggregates) setData(monthRes.data.aggregates);
      if (passRes.data)  setPassive(passRes.data);
      if (cycleRes.data) setCycle(cycleRes.data);
    } catch (e) { console.warn('Home fetch offline:', e.message); }
  };

  useEffect(() => { fetchData(); }, [currentUser]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const riskScore  = data.riskScore || data.avgRiskScore || 0;
  const topFactors = data.topFactors || [];
  const divergence = data.moodSentimentDivergence || 0;
  const firstName  = dbUser?.name?.split(' ')[0] || currentUser?.displayName?.split(' ')[0] || 'there';

  const hour = new Date().getHours();
  const greeting    = hour < 11 ? `Good morning, ${firstName}` : hour < 17 ? `Hello, ${firstName}` : hour < 21 ? `Good evening, ${firstName}` : `Rest well, ${firstName}`;
  const greetingSub = hour < 11 ? 'Your daily check-in takes 30 seconds' : hour < 17 ? 'How has your day been unfolding?' : hour < 21 ? 'A quiet moment for yourself' : 'Tomorrow begins a new record';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.rose} />}
      >
        {/* Header */}
        <Animated.View style={[s.header, entrance(anim0)]}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>{greeting}</Text>
            <Text style={s.greetingSub}>{greetingSub}</Text>
          </View>
          <TouchableOpacity style={s.insightsPill} onPress={() => navigation.navigate('Insights')} accessibilityLabel="View 30-day insights">
            <Feather name="bar-chart-2" size={14} color={COLORS.roseDark} />
            <Text style={s.insightsPillText}>Insights</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Dual ring card */}
        <Animated.View style={[s.dualCard, entrance(anim1, 14)]}>
          <View style={s.ringCell}>
            <Text style={s.ringLabel}>RISK SCORE</Text>
            <RiskRing score={riskScore} />
          </View>
          <View style={s.ringDivider} />
          <TouchableOpacity
            style={s.ringCell}
            onPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'Cycle' })}
            accessibilityLabel="View your cycle phase"
          >
            <Text style={s.ringLabel}>CYCLE PHASE</Text>
            <CompactCycleRing
              cycleLength={cycle.cycleLength || 28}
              currentDay={cycle.currentDay || 1}
              vulnerabilityScore={cycle.vulnerabilityScore || 0}
              size={108}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Baseline stats */}
        <Animated.View style={[s.statsRow, entrance(anim2)]}>
          <BaselineStat iconName="trending-up" label="Steps" value={passive.steps || 0} baseline={passive.stepsBaseline} />
          <BaselineStat iconName="moon" label="Sleep" value={passive.sleepHours ? parseFloat(passive.sleepHours.toFixed(1)) : null} baseline={passive.sleepBaseline} unit="h" />
          <BaselineStat iconName="heart" label="Avg Mood" value={data.avgMood ? parseFloat(data.avgMood.toFixed(1)) : null} baseline={3} />
        </Animated.View>

        {/* SHAP Narrative Card — hero AI component */}
        <ShapNarrativeCard riskScore={riskScore} topFactors={topFactors} />

        {/* Emotional Suppression Arc — signature UI moment */}
        {divergence > 0.15 && (
          <View style={s.suppressionCard}>
            <SuppressionArc divergenceScore={divergence} />
          </View>
        )}

        {/* SmartWatch */}
        <Animated.View style={entrance(anim3, 8)}>
          <SmartWatchCard uid={currentUser?.uid} />
        </Animated.View>

        {/* Daily check-in CTA */}
        <TouchableOpacity style={s.checkinCard} onPress={() => goToTab('Journal')} activeOpacity={0.75} accessibilityLabel="Log your daily mood check-in">
          <View style={s.checkinIconBox}>
            <Feather name="edit-3" size={19} color={COLORS.roseDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Daily Check-in</Text>
            <Text style={s.cardSub}>Take a moment to reflect on your mood</Text>
          </View>
          <Feather name="chevron-right" size={17} color={COLORS.roseDark} />
        </TouchableOpacity>

        {/* JITAI: Breathing */}
        {riskScore > 0.5 && (
          <TouchableOpacity style={[s.jitaiCard, { backgroundColor: COLORS.sageLight }]} onPress={() => navigation.navigate('SomaticBreathing')} activeOpacity={0.75} accessibilityLabel="Begin breathing exercise">
            <View style={[s.jitaiIconBox, { backgroundColor: COLORS.sageDark + '22' }]}>
              <Feather name="wind" size={18} color={COLORS.sageDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: COLORS.sageDark }]}>A moment to breathe</Text>
              <Text style={[s.cardSub, { color: COLORS.sageDark }]}>A 4·4·6 breathing cycle takes under 3 minutes.</Text>
            </View>
            <Feather name="chevron-right" size={17} color={COLORS.sageDark} />
          </TouchableOpacity>
        )}

        {/* JITAI: CBT */}
        {data.avgMood < 2.5 && (
          <TouchableOpacity style={[s.jitaiCard, { backgroundColor: COLORS.lavenderLight }]} onPress={() => navigation.navigate('CBTReframe', { initialThought: 'I feel overwhelmed today.' })} activeOpacity={0.75} accessibilityLabel="Begin CBT thought reframing">
            <View style={[s.jitaiIconBox, { backgroundColor: COLORS.lavenderDark + '22' }]}>
              <Feather name="layers" size={18} color={COLORS.lavenderDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: COLORS.lavenderDark }]}>Reframe a thought</Text>
              <Text style={[s.cardSub, { color: COLORS.lavenderDark }]}>Guided cognitive reframing — 5 minutes.</Text>
            </View>
            <Feather name="chevron-right" size={17} color={COLORS.lavenderDark} />
          </TouchableOpacity>
        )}

        {/* Cycle vulnerability nudge */}
        {cycle.vulnerabilityScore > 0.65 && (
          <TouchableOpacity style={[s.jitaiCard, { backgroundColor: COLORS.roseLight }]} onPress={() => goToTab('Cycle')} activeOpacity={0.75} accessibilityLabel="View your cycle vulnerability window">
            <View style={[s.jitaiIconBox, { backgroundColor: COLORS.roseDark + '22' }]}>
              <Feather name="moon" size={18} color={COLORS.roseDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: COLORS.roseDark }]}>Your cycle window</Text>
              <Text style={[s.cardSub, { color: COLORS.roseDark }]}>The AI predicts elevated vulnerability in your current phase. Extra care this week.</Text>
            </View>
            <Feather name="chevron-right" size={17} color={COLORS.roseDark} />
          </TouchableOpacity>
        )}

        {/* Quick nav */}
        <View style={s.quickRow}>
          <QuickTile iconName="edit-3"        label="Journal" sub="Log mood"   onPress={() => goToTab('Journal')} a11y="Go to Journal" />
          <QuickTile iconName="message-circle" label="Care"    sub="Talk now"  onPress={() => goToTab('Chat')}    a11y="Go to Care" />
          <QuickTile iconName="moon"           label="Cycle"   sub="View phase" onPress={() => goToTab('Cycle')}  a11y="Go to Cycle" />
        </View>

        {/* Sign out */}
        <TouchableOpacity style={s.signOut} onPress={logout} accessibilityLabel="Sign out of Niranthara">
          <Feather name="log-out" size={14} color={COLORS.warmGray} />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.cream },
  content: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.xxxl },

  header:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.xxl },
  greeting:     { fontFamily: FONTS.display, fontSize: 34, color: COLORS.charcoal, lineHeight: 40 },
  greetingSub:  { fontFamily: FONTS.body, fontSize: 13, color: COLORS.warmGray, marginTop: 5 },
  insightsPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.roseLight, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 7, marginTop: 4 },
  insightsPillText: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.roseDark },

  dualCard:   { flexDirection: 'row', backgroundColor: COLORS.warmWhite, borderRadius: RADIUS.xl, marginBottom: SPACING.xl, borderWidth: 1, borderColor: 'rgba(44,40,38,0.07)', overflow: 'hidden' },
  ringCell:   { flex: 1, alignItems: 'center', paddingVertical: SPACING.xl, paddingHorizontal: SPACING.md },
  ringLabel:  { fontFamily: FONTS.body, fontSize: 9, color: COLORS.warmGray, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: SPACING.md },
  ringDivider:{ width: 1, backgroundColor: 'rgba(44,40,38,0.07)', marginVertical: SPACING.xl },
  ringWrap:   { alignItems: 'center' },
  riskLabel:  { fontFamily: FONTS.medium, fontSize: 11, marginTop: 6 },

  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.xl },
  stat:     { flex: 1, backgroundColor: COLORS.warmWhite, borderRadius: RADIUS.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(44,40,38,0.07)' },
  statIcon: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue:{ fontFamily: FONTS.medium, fontSize: 15, color: COLORS.charcoal },
  statLabel:{ fontFamily: FONTS.body, fontSize: 9.5, color: COLORS.warmGray, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDev:  { fontFamily: FONTS.medium, fontSize: 10, marginTop: 3 },

  // SHAP card
  shapCard:      { borderRadius: RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.xl, borderWidth: 1, borderColor: 'rgba(44,40,38,0.07)' },
  shapHeader:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  shapIconBox:   { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  shapHeadline:  { fontFamily: FONTS.medium, fontSize: 15, lineHeight: 21, flex: 1 },
  shapNarrative: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 20 },
  shapFactors:   { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: 'rgba(44,40,38,0.08)' },
  shapFactorsLabel: { fontFamily: FONTS.body, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: SPACING.sm, opacity: 0.7 },
  shapFactorRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 6 },
  shapDot:       { width: 7, height: 7, borderRadius: 4 },
  shapFactorText:{ fontFamily: FONTS.body, fontSize: 12, flex: 1 },
  shapFooter:    { fontFamily: FONTS.body, fontSize: 9, marginTop: SPACING.sm, opacity: 0.5 },

  // Suppression arc
  suppressionCard:   { backgroundColor: COLORS.warmWhite, borderRadius: RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.xl, borderWidth: 1, borderColor: 'rgba(44,40,38,0.07)' },
  suppressionInner:  {},
  suppressionHeading:{ fontFamily: FONTS.medium, fontSize: 13, color: COLORS.charcoal, marginBottom: SPACING.md },
  suppressionRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  arcSide:   { flex: 1, gap: 5 },
  arcTag:    { fontFamily: FONTS.body, fontSize: 8.5, color: COLORS.warmGray, letterSpacing: 1, textTransform: 'uppercase' },
  arcTrack:  { height: 6, borderRadius: RADIUS.pill, overflow: 'hidden' },
  arcFill:   { height: '100%', borderRadius: RADIUS.pill },
  arcGapDot: { width: 8, height: 8, borderRadius: 4 },
  suppressionStatus: { fontFamily: FONTS.body, fontSize: 12 },

  // SmartWatch
  watchCard:      { borderRadius: RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.xl, borderWidth: 1, borderColor: 'rgba(44,40,38,0.07)' },
  watchHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  watchDot:       { width: 7, height: 7, borderRadius: 4 },
  watchTitle:     { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.charcoal, flex: 1 },
  watchStatus:    { fontFamily: FONTS.body, fontSize: 12 },
  watchSync:      { fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray, marginBottom: SPACING.md, paddingLeft: 15 },
  watchBody:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginTop: SPACING.md },
  watchMetaLabel: { fontFamily: FONTS.body, fontSize: 9, color: COLORS.warmGray, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  watchMetaValue: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.charcoal, marginBottom: 3 },
  watchMetaSub:   { fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray },
  connectBtn:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.rose, borderRadius: RADIUS.md, padding: SPACING.lg, justifyContent: 'center', marginTop: SPACING.md, minHeight: 48 },
  connectBtnText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.warmWhite },

  // CTA & JITAI cards
  checkinCard:   { backgroundColor: COLORS.roseLight, borderRadius: RADIUS.lg, padding: SPACING.xl, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md, minHeight: 72 },
  jitaiCard:     { borderRadius: RADIUS.lg, padding: SPACING.xl, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md, minHeight: 72 },
  checkinIconBox:{ width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.roseDark + '18', alignItems: 'center', justifyContent: 'center' },
  jitaiIconBox:  { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle:     { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.roseDark, marginBottom: 2 },
  cardSub:       { fontFamily: FONTS.body, fontSize: 12, color: COLORS.charcoal, lineHeight: 17 },

  // Quick tiles
  quickRow:      { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.xl },
  quickTile:     { flex: 1, backgroundColor: COLORS.warmWhite, borderRadius: RADIUS.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, borderWidth: 1, borderColor: 'rgba(44,40,38,0.08)', alignItems: 'center', minHeight: 84 },
  quickTileIcon: { width: 38, height: 38, borderRadius: RADIUS.sm, backgroundColor: COLORS.roseLight, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickLabel:    { fontFamily: FONTS.medium, color: COLORS.charcoal, fontSize: 12 },
  quickSub:      { fontFamily: FONTS.body, color: COLORS.warmGray, fontSize: 10, marginTop: 2 },

  // Sign out
  signOut:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg, marginTop: SPACING.sm },
  signOutText: { fontFamily: FONTS.body, color: COLORS.warmGray, fontSize: 13 },
});
