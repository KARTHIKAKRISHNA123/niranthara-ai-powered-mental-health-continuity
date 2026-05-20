// src/screens/Home.js — Dual ring header (Risk + Cycle) + SmartWatchCard per Build_Guide §29
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { COLORS, FONTS, SPACING, RADIUS, theme } from '../theme/theme';
import { CompactCycleRing } from './Cycle';
import { api } from '../utils/api';
import { processOfflineSync } from '../services/syncService';
import { useAuth } from '../context/AuthContext';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { app } from '../utils/firebase';

// ─── Risk Ring (SVG) ──────────────────────────────────────────────────────────
function RiskRing({ score }) {
  const R = 44, stroke = 8;
  const circumference = 2 * Math.PI * R;
  const filled = circumference * Math.min(score, 1);

  let color, label;
  if (score >= 0.80) { color = COLORS.alert;    label = 'Crisis'; }
  else if (score >= 0.60) { color = '#E8634A';  label = 'High'; }
  else if (score >= 0.30) { color = COLORS.warning; label = 'Moderate'; }
  else                    { color = COLORS.sage; label = 'Low'; }

  return (
    <View style={styles.ringWrap}>
      <Svg width={108} height={108} viewBox="0 0 108 108">
        <Circle cx="54" cy="54" r={R} stroke="rgba(44,40,38,0.08)" strokeWidth={stroke} fill="none" />
        <Circle
          cx="54" cy="54" r={R}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          rotation="-90"
          origin="54,54"
        />
        <SvgText x="54" y="50" textAnchor="middle" fontSize="20" fontWeight="600" fill={color}>
          {(score * 100).toFixed(0)}
        </SvgText>
        <SvgText x="54" y="66" textAnchor="middle" fontSize="9" fill={COLORS.warmGray}>
          RISK %
        </SvgText>
      </Svg>
      <Text style={[styles.riskLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Baseline Badge ───────────────────────────────────────────────────────────
function BaselineBadge({ icon, label, value, baseline, unit = '' }) {
  const deviation = baseline ? (value - baseline) / baseline : 0;
  const isGood = Math.abs(deviation) < 0.2;
  const color = isGood ? COLORS.sage : deviation < -0.2 ? COLORS.warning : COLORS.alert;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeIcon}>{icon}</Text>
      <Text style={styles.badgeValue} numberOfLines={1}>{value}{unit}</Text>
      <Text style={styles.badgeLabel}>{label}</Text>
      {baseline > 0 && (
        <Text style={[styles.badgeDev, { color }]}>
          {deviation >= 0 ? '+' : ''}{(deviation * 100).toFixed(0)}%
        </Text>
      )}
    </View>
  );
}

// ─── SmartWatch HRV Ring ──────────────────────────────────────────────────────
function HrvRing({ deviation }) {
  const R = 36, stroke = 7;
  const circumference = 2 * Math.PI * R;
  // Higher deviation = worse (more of ring filled = more stress)
  const filled = circumference * Math.min(deviation || 0, 1);
  const color  = deviation > 0.4 ? COLORS.alert
               : deviation > 0.2 ? COLORS.warning
               : COLORS.sage;
  return (
    <Svg width={86} height={86} viewBox="0 0 86 86">
      <Circle cx="43" cy="43" r={R} stroke="rgba(44,40,38,0.08)" strokeWidth={stroke} fill="none" />
      <Circle
        cx="43" cy="43" r={R}
        stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round" rotation="-90" origin="43,43"
      />
      <SvgText x="43" y="39" textAnchor="middle" fontSize="15" fontWeight="600" fill={color}>
        {((deviation || 0) * 100).toFixed(0)}
      </SvgText>
      <SvgText x="43" y="52" textAnchor="middle" fontSize="8" fill={COLORS.warmGray}>
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
    const firestore = getFirestore(app);
    const unsub = onSnapshot(doc(firestore, 'users', uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setWatchData({
          connected:        !!d.fitbitConnected,
          lastSync:         d.lastBiometricSync || null,
          hrvDeviation:     d.lastHrvDeviation  || 0
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const handleConnect = () => {
    if (!uid) return;
    Linking.openURL(`http://localhost:5001/smartwatch/auth/connect?uid=${uid}`);
  };

  const formatSync = (iso) => {
    if (!iso) return 'Never synced';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) +
           ' · ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const connected = watchData?.connected;
  const cardBg    = connected ? '#EEF7F1' : COLORS.warmWhite;
  const dotColor  = connected ? COLORS.sage : COLORS.warmGray;

  return (
    <View style={[styles.watchCard, { backgroundColor: cardBg }]}>
      {/* Header row */}
      <View style={styles.watchHeader}>
        <View style={styles.watchTitleRow}>
          <View style={[styles.watchDot, { backgroundColor: dotColor }]} />
          <Text style={styles.watchTitle}>Fitbit Health</Text>
          <Text style={[styles.watchStatus, { color: dotColor }]}>
            {loading ? '…' : connected ? 'Connected' : 'Not Connected'}
          </Text>
        </View>
        {connected && watchData?.lastSync && (
          <Text style={styles.watchSync}>Last sync {formatSync(watchData.lastSync)}</Text>
        )}
      </View>

      {/* Content */}
      {connected ? (
        <View style={styles.watchBody}>
          <HrvRing deviation={watchData?.hrvDeviation} />
          <View style={styles.watchInfo}>
            <Text style={styles.watchInfoLabel}>HRV Deviation</Text>
            <Text style={styles.watchInfoValue}>
              {watchData?.hrvDeviation > 0.4 ? '⚠️ Critically Low'
               : watchData?.hrvDeviation > 0.2 ? '⚡ Slightly Low'
               : '✅ Within Baseline'}
            </Text>
            <Text style={styles.watchInfoSub}>
              Computed against your 30-day personal baseline
            </Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.connectBtn}
          onPress={handleConnect}
          accessibilityLabel="Connect your Fitbit health tracker to Niranthara"
        >
          <Text style={styles.connectBtnText}>⌚ Connect Fitbit / Health</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { dbUser, currentUser, logout } = useAuth();
  const [data, setData]         = useState({ riskScore: 0, avgMood: 3 });
  const [passive, setPassive]   = useState({ steps: 0, stepsBaseline: 0, sleepHours: 0, sleepBaseline: 0 });
  const [cycle, setCycle]       = useState({ currentDay: 1, cycleLength: 28, vulnerabilityScore: 0 });
  const [refreshing, setRefreshing] = useState(false);

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
    } catch (e) {
      console.warn('Home fetch offline:', e.message);
    }
  };

  useEffect(() => { fetchData(); }, [currentUser]);

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const riskScore = data.riskScore || data.avgRiskScore || 0;
  const firstName = dbUser?.name?.split(' ')[0] || currentUser?.displayName?.split(' ')[0] || 'there';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.rose} />}
      >
        {/* ── Header: Dual rings ── */}
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Hi, {firstName}</Text>
            <Text style={styles.subtitle}>Your mind, our care</Text>
          </View>
        </View>

        <View style={styles.dualRingRow}>
          {/* Risk ring */}
          <View style={styles.ringCard}>
            <Text style={styles.ringCardLabel}>Risk</Text>
            <RiskRing score={riskScore} />
          </View>

          {/* Divider */}
          <View style={styles.ringDivider} />

          {/* Cycle ring */}
          <TouchableOpacity
            style={styles.ringCard}
            onPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'Cycle' })}
            accessibilityLabel="Go to Cycle tracking"
          >
            <Text style={styles.ringCardLabel}>Cycle</Text>
            <CompactCycleRing
              cycleLength={cycle.cycleLength || 28}
              currentDay={cycle.currentDay || 1}
              vulnerabilityScore={cycle.vulnerabilityScore || 0}
              size={108}
            />
          </TouchableOpacity>
        </View>

        {/* ── Baseline badges (steps / sleep) ── */}
        <View style={styles.badgeRow}>
          <BaselineBadge
            icon="👟" label="Steps"
            value={passive.steps || 0}
            baseline={passive.stepsBaseline}
          />
          <BaselineBadge
            icon="🌙" label="Sleep"
            value={passive.sleepHours?.toFixed(1) || '—'}
            baseline={passive.sleepBaseline}
            unit="h"
          />
          <BaselineBadge
            icon="😌" label="Avg Mood"
            value={data.avgMood?.toFixed(1) || '—'}
            baseline={3}
          />
        </View>

        {/* ── SmartWatch Card ── */}
        <SmartWatchCard uid={currentUser?.uid} />

        {/* ── Daily check-in CTA ── */}
        <TouchableOpacity
          style={styles.checkinCard}
          onPress={() => goToTab('Journal')}
          accessibilityLabel="Log your daily mood check-in"
        >
          <Text style={styles.checkinEmoji}>📝</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Daily Check-in</Text>
            <Text style={styles.cardSub}>Take a moment to reflect on your mood</Text>
          </View>
          <Text style={styles.cardArrow}>→</Text>
        </TouchableOpacity>

        {/* ── JITAI card: somatic breathing (high stress) ── */}
        {riskScore > 0.5 && (
          <TouchableOpacity
            style={[styles.jitaiCard, { backgroundColor: COLORS.sageLight }]}
            onPress={() => navigation.navigate('SomaticBreathing')}
            accessibilityLabel="Your AI companion suggests a breathing exercise"
          >
            <Text style={styles.checkinEmoji}>🫁</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: COLORS.sageDark }]}>Your companion suggests…</Text>
              <Text style={[styles.cardSub, { color: COLORS.sageDark }]}>Try a 4-4-6 breathing exercise now</Text>
            </View>
            <Text style={[styles.cardArrow, { color: COLORS.sageDark }]}>→</Text>
          </TouchableOpacity>
        )}

        {/* ── JITAI card: CBT reframe (low mood) ── */}
        {data.avgMood < 2.5 && (
          <TouchableOpacity
            style={[styles.jitaiCard, { backgroundColor: COLORS.lavenderLight }]}
            onPress={() => navigation.navigate('CBTReframe', { initialThought: 'I feel overwhelmed today.' })}
            accessibilityLabel="Your AI companion suggests a thought reframe exercise"
          >
            <Text style={styles.checkinEmoji}>💭</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: COLORS.lavenderDark }]}>Challenge a thought</Text>
              <Text style={[styles.cardSub, { color: COLORS.lavenderDark }]}>CBT thought reframing — 5 minutes</Text>
            </View>
            <Text style={[styles.cardArrow, { color: COLORS.lavenderDark }]}>→</Text>
          </TouchableOpacity>
        )}

        {/* ── Quick nav row ── */}
        <View style={styles.quickRow}>
          {[
            { label: 'Journal', sub: 'Log mood', tab: 'Journal', icon: '📓' },
            { label: 'Chat',    sub: 'Talk now',  tab: 'Chat',    icon: '💬' },
            { label: 'Cycle',   sub: 'View phase', tab: 'Cycle',  icon: '🌙' },
          ].map((item) => (
            <TouchableOpacity
              key={item.tab}
              style={styles.quickBtn}
              onPress={() => goToTab(item.tab)}
              accessibilityLabel={`Go to ${item.label}`}
            >
              <Text style={styles.quickIcon}>{item.icon}</Text>
              <Text style={styles.quickTitle}>{item.label}</Text>
              <Text style={styles.quickSub}>{item.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Insights entry card ── */}
        <TouchableOpacity
          style={styles.insightsCard}
          onPress={() => navigation.navigate('Insights')}
          accessibilityLabel="View your 30-day insights"
        >
          <View>
            <Text style={styles.insightsTitle}>📊 Your Insights</Text>
            <Text style={styles.insightsSub}>30-day trend · SHAP risk factors · Charts</Text>
          </View>
          <Text style={styles.cardArrow}>→</Text>
        </TouchableOpacity>

        {/* ── Sign out ── */}
        <TouchableOpacity
          style={styles.signOut}
          onPress={logout}
          accessibilityLabel="Sign out of Niranthara"
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },

  // Header
  headerTop: {
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.charcoal,
    lineHeight: 42,
  },

  // Dual ring row
  dualRingRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(44,40,38,0.07)',
    overflow: 'hidden',
  },
  ringCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  ringCardLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.warmGray,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  ringDivider: {
    width: 1,
    backgroundColor: 'rgba(44,40,38,0.07)',
    marginVertical: SPACING.xl,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.warmGray,
    marginTop: 4,
  },

  // Ring
  ringWrap: { alignItems: 'center' },
  riskLabel: { fontFamily: FONTS.medium, fontSize: 12, marginTop: 4 },

  // Baseline badges
  badgeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  badge: {
    flex: 1,
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(44,40,38,0.07)',
  },
  badgeIcon:  { fontSize: 20, marginBottom: 4 },
  badgeValue: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.charcoal },
  badgeLabel: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.warmGray, marginTop: 2 },
  badgeDev:   { fontFamily: FONTS.medium, fontSize: 10, marginTop: 2 },

  // Cards
  checkinCard: {
    backgroundColor: COLORS.roseLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  jitaiCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  checkinEmoji: { fontSize: 26 },
  cardTitle:    { fontFamily: FONTS.medium, fontSize: 16, color: COLORS.roseDark },
  cardSub:      { fontFamily: FONTS.body, fontSize: 13, color: COLORS.charcoal, marginTop: 2 },
  cardArrow:    { fontSize: 20, color: COLORS.roseDark },

  // Quick nav
  quickRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(44,40,38,0.08)',
    alignItems: 'center',
  },
  quickIcon:  { fontSize: 18, marginBottom: 4 },
  quickTitle: { fontFamily: FONTS.medium, color: COLORS.roseDark, fontSize: 13 },
  quickSub:   { fontFamily: FONTS.body, color: COLORS.warmGray, fontSize: 11, marginTop: 2 },

  // Insights entry
  insightsCard: {
    backgroundColor: COLORS.lavenderLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  insightsTitle: { fontFamily: FONTS.medium, fontSize: 16, color: COLORS.lavenderDark },
  insightsSub:   { fontFamily: FONTS.body, fontSize: 12, color: COLORS.lavenderDark, marginTop: 3 },

  // Sign out
  signOut: {
    backgroundColor: COLORS.softGray,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  signOutText: { fontFamily: FONTS.medium, color: COLORS.warmWhite, fontSize: 15 },

  // SmartWatch card
  watchCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(44,40,38,0.08)',
  },
  watchHeader:    { marginBottom: SPACING.md },
  watchTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  watchDot:       { width: 8, height: 8, borderRadius: 4 },
  watchTitle:     { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.charcoal, flex: 1 },
  watchStatus:    { fontFamily: FONTS.medium, fontSize: 12 },
  watchSync:      { fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray, marginLeft: 16 },
  watchBody:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  watchInfo:      { flex: 1 },
  watchInfoLabel: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.warmGray, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  watchInfoValue: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.charcoal, marginBottom: 4 },
  watchInfoSub:   { fontFamily: FONTS.body, fontSize: 11, color: COLORS.warmGray },
  connectBtn: {
    backgroundColor: COLORS.rose,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  connectBtnText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.warmWhite },
});
