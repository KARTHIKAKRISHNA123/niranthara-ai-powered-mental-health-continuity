// src/screens/Home.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';
import { api } from '../utils/api';
import { processOfflineSync } from '../services/syncService';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen({ navigation }) {
  const { dbUser, currentUser, logout } = useAuth();
  const [data, setData] = useState({ riskScore: 0, avgMood: 3 });

  const goToMainTab = (screenName) => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('MainTabs', { screen: screenName });
      return;
    }
    navigation.navigate(screenName);
  };
  
  useEffect(() => {
    // Initial sync and fetch
    const init = async () => {
      await processOfflineSync();
      try {
        if (!currentUser) return;
        const res = await api.get(`/mood/monthly/${currentUser.uid}`); 
        if (res.data && res.data.aggregates) {
          setData(res.data.aggregates);
        }
      } catch (e) {
        console.warn("Could not fetch user summary. Offline mode active.");
      }
    };
    init();
  }, [currentUser]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Hi {dbUser?.name?.split(' ')[0] || currentUser?.displayName || 'User'}</Text>
          <Text style={styles.subtitle}>How are you feeling today?</Text>
        </View>

        <TouchableOpacity 
          style={styles.checkinCard}
          onPress={() => goToMainTab('Journal')}
        >
          <Text style={styles.cardTitle}>Daily Check-in</Text>
          <Text style={styles.cardSubtitle}>Take a moment to reflect on your mood</Text>
        </TouchableOpacity>

        <View style={styles.quickNavRow}>
          <TouchableOpacity style={styles.quickNavBtn} onPress={() => goToMainTab('Journal')}>
            <Text style={styles.quickNavTitle}>Journal</Text>
            <Text style={styles.quickNavText}>Log your mood</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickNavBtn} onPress={() => goToMainTab('Chat')}>
            <Text style={styles.quickNavTitle}>Chat</Text>
            <Text style={styles.quickNavText}>Talk now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickNavBtn} onPress={() => goToMainTab('Cycle')}>
            <Text style={styles.quickNavTitle}>Cycle</Text>
            <Text style={styles.quickNavText}>View today</Text>
          </TouchableOpacity>
        </View>

        {data.riskScore > 0.5 && (
          <TouchableOpacity 
            style={[styles.checkinCard, { backgroundColor: theme.colors.sageLight, marginTop: 0 }]}
            onPress={() => navigation.navigate('SomaticBreathing')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.colors.sageDark }]}>High Stress Detected</Text>
                <Text style={[styles.cardSubtitle, { color: theme.colors.sageDark }]}>Start a quick Box Breathing exercise</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {data.avgMood < 2.5 && (
          <TouchableOpacity 
            style={[styles.checkinCard, { backgroundColor: theme.colors.lavenderLight, marginTop: 0 }]}
            onPress={() => navigation.navigate('CBTReframe', { initialThought: 'I feel overwhelmed today.' })}
          >
            <Text style={[styles.cardTitle, { color: theme.colors.lavenderDark }]}>Cognitive Reframe</Text>
            <Text style={[styles.cardSubtitle, { color: theme.colors.lavenderDark }]}>Challenge negative thoughts</Text>
          </TouchableOpacity>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{data.avgMood?.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Mood</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{(data.riskScore || 0).toFixed(2)}</Text>
            <Text style={styles.statLabel}>Risk Level</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.btnPrimary, { marginTop: 40, backgroundColor: theme.colors.softGray }]} 
          onPress={logout}
        >
          <Text style={styles.btnPrimaryText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  scrollContent: {
    padding: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.xxl,
  },
  greeting: {
    fontFamily: theme.typography.display,
    fontSize: 36,
    color: theme.colors.charcoal,
  },
  subtitle: {
    fontFamily: theme.typography.body,
    fontSize: 16,
    color: theme.colors.warmGray,
    marginTop: 4,
  },
  checkinCard: {
    backgroundColor: theme.colors.roseLight,
    padding: theme.spacing.xl,
    borderRadius: 16,
    marginBottom: theme.spacing.xl,
  },
  cardTitle: {
    fontFamily: theme.typography.bodyMedium,
    fontSize: 20,
    color: theme.colors.roseDark,
  },
  cardSubtitle: {
    fontFamily: theme.typography.body,
    fontSize: 14,
    color: theme.colors.charcoal,
    marginTop: 4,
  },
  quickNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  quickNavBtn: {
    flex: 1,
    backgroundColor: theme.colors.warmWhite,
    borderRadius: 12,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.softGray,
  },
  quickNavTitle: {
    fontFamily: theme.typography.bodyMedium,
    color: theme.colors.roseDark,
    fontSize: 14,
  },
  quickNavText: {
    fontFamily: theme.typography.body,
    color: theme.colors.warmGray,
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    backgroundColor: theme.colors.warmWhite,
    padding: theme.spacing.lg,
    borderRadius: 16,
    flex: 0.48,
    alignItems: 'center',
    shadowColor: theme.colors.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontFamily: theme.typography.display,
    fontSize: 32,
    color: theme.colors.lavenderDark,
  },
  statLabel: {
    fontFamily: theme.typography.body,
    fontSize: 12,
    color: theme.colors.warmGray,
  },
  btnPrimary: {
    padding: theme.spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontFamily: theme.typography.bodyMedium,
    color: '#fff',
    fontSize: 16,
  }
});
