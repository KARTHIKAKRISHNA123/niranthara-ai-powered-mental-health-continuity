// src/screens/Cycle.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';
import { api, postData } from '../utils/api';
import { auth } from '../utils/firebase';

export default function CycleScreen() {
  const [cycleData, setCycleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    fetchCycleData();
  }, []);

  const fetchCycleData = async () => {
    try {
      if (!auth.currentUser) return;
      const res = await api.get(`/cycle/today/${auth.currentUser.uid}`);
      setCycleData(res.data);
    } catch (e) {
      console.warn("Could not fetch cycle data.");
    } finally {
      setLoading(false);
    }
  };

  const logPeriodStart = async () => {
    setLogging(true);
    const result = await postData('/cycle/log-period', { periodStart: new Date().toISOString() }, 'cycleLogs');
    setLogging(false);
    
    if (result.success) {
      Alert.alert("Period Logged", "Your period has been recorded. Your predictions will be updated.");
      fetchCycleData();
    } else {
      Alert.alert("Error", "Could not log period.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Cycle Tracking</Text>
      <Text style={styles.subtitle}>Personalized predictions for your wellbeing</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.sageDark} />
      ) : (
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Current Phase</Text>
            <Text style={styles.cardValue}>{cycleData?.currentPhase ? cycleData.currentPhase.replace('_', ' ').toUpperCase() : 'UNKNOWN'}</Text>
            <Text style={styles.cardSub}>Day {cycleData?.currentDay || '?'}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Vulnerability Score</Text>
            <Text style={[styles.cardValue, { color: (cycleData?.vulnerabilityScore || 0) > 0.65 ? theme.colors.roseDark : theme.colors.sageDark }]}>
              {((cycleData?.vulnerabilityScore || 0) * 100).toFixed(0)}%
            </Text>
            <Text style={styles.cardSub}>LSTM Prediction</Text>
          </View>

          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={logPeriodStart}
            disabled={logging}
          >
            {logging ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Log Period Start Today</Text>}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.cream,
  },
  title: {
    fontFamily: theme.typography.display,
    fontSize: 32,
    color: theme.colors.charcoal,
  },
  subtitle: {
    fontFamily: theme.typography.body,
    fontSize: 16,
    color: theme.colors.warmGray,
    marginBottom: theme.spacing.xl,
  },
  content: {
    gap: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.warmWhite,
    padding: theme.spacing.xl,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.sageLight,
  },
  cardLabel: {
    fontFamily: theme.typography.bodyMedium,
    fontSize: 14,
    color: theme.colors.warmGray,
    marginBottom: 8,
  },
  cardValue: {
    fontFamily: theme.typography.display,
    fontSize: 28,
    color: theme.colors.sageDark,
  },
  cardSub: {
    fontFamily: theme.typography.body,
    fontSize: 12,
    color: theme.colors.softGray,
    marginTop: 4,
  },
  actionBtn: {
    backgroundColor: theme.colors.sageDark,
    padding: theme.spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  btnText: {
    fontFamily: theme.typography.bodyMedium,
    color: '#fff',
    fontSize: 16,
  }
});
