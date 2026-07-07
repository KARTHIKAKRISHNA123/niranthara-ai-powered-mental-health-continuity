// src/screens/interventions/SomaticBreathing.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme/theme';
import { postData } from '../../utils/api';
import * as Haptics from 'expo-haptics';

export default function SomaticBreathing({ navigation }) {
  const [phase, setPhase] = useState('ready'); // ready, inhale, hold, exhale, done
  const [sessionCount, setSessionCount] = useState(0);
  const [timer, setTimer] = useState(0);
  
  const circleScale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Track session duration
  useEffect(() => {
    let interval;
    if (phase !== 'ready' && phase !== 'done') {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [phase]);

  const runCycle = () => {
    setPhase('inhale');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Animated.timing(circleScale, {
      toValue: 2.5,
      duration: 4000,
      useNativeDriver: true,
    }).start(() => {
      setPhase('hold');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      setTimeout(() => {
        setPhase('exhale');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        Animated.timing(circleScale, {
          toValue: 1,
          duration: 6000,
          useNativeDriver: true,
        }).start(() => {
          setSessionCount(prev => prev + 1);
          setPhase('ready');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        });
      }, 4000);
    });
  };

  const logResponse = async (responseType) => {
    try {
      await postData('/jitai/log-response', {
        interventionType: 'somatic_breathing',
        responseType: responseType,
        sessionDurationSeconds: timer,
        cyclesCompleted: sessionCount
      }, 'jitaiLogs');
    } catch (err) {
      console.warn("Could not log JITAI response");
    }
    navigation.goBack();
  };

  const getInstructions = () => {
    switch (phase) {
      case 'inhale': return 'Inhale deeply...';
      case 'hold': return 'Hold your breath...';
      case 'exhale': return 'Exhale slowly...';
      case 'ready': return sessionCount > 0 ? 'Ready for another round?' : 'Tap Start to begin';
      case 'done': return 'Session Complete';
      default: return '';
    }
  };

  const getSubInstructions = () => {
    switch (phase) {
      case 'inhale': return '4 seconds';
      case 'hold': return '4 seconds';
      case 'exhale': return '6 seconds';
      default: return '';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Somatic Breathing</Text>
      <Text style={styles.subtitle}>Parasympathetic Activation</Text>

      <View style={styles.centerContainer}>
        <Animated.View 
          style={[
            styles.circle,
            { transform: [{ scale: circleScale }], opacity }
          ]} 
        />
        <View style={styles.instructionOverlay}>
          <Text style={styles.instruction}>{getInstructions()}</Text>
          <Text style={styles.subInstruction}>{getSubInstructions()}</Text>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.stats}>Cycles Completed: {sessionCount}</Text>
        <Text style={styles.stats}>Time: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</Text>
      </View>

      {phase === 'ready' && sessionCount === 0 && (
        <TouchableOpacity style={styles.startBtn} onPress={runCycle} accessibilityLabel="Start the breathing exercise">
          <Text style={styles.btnText}>Start Breathing</Text>
        </TouchableOpacity>
      )}

      {phase === 'ready' && sessionCount > 0 && (
        <View style={styles.feedbackContainer}>
          <TouchableOpacity style={styles.startBtn} onPress={runCycle} accessibilityLabel="Do one more breathing round">
            <Text style={styles.btnText}>One More Round</Text>
          </TouchableOpacity>
          
          <Text style={styles.feedbackTitle}>How do you feel now?</Text>
          <View style={styles.feedbackRow}>
            <TouchableOpacity style={styles.feedbackBtn} onPress={() => logResponse('feel_better')} accessibilityLabel="I feel better">
              <Text style={styles.feedbackBtnText}>I feel better</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.feedbackBtn, styles.helpBtn]} onPress={() => logResponse('need_more_help')} accessibilityLabel="I need more help">
              <Text style={styles.feedbackBtnText}>I need more help</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontFamily: theme.typography.display,
    fontSize: 28,
    color: theme.colors.charcoal,
    marginTop: theme.spacing.xl,
  },
  subtitle: {
    fontFamily: theme.typography.body,
    fontSize: 16,
    color: theme.colors.warmGray,
    marginBottom: theme.spacing.xxl,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.sageLight,
    position: 'absolute',
  },
  instructionOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  instruction: {
    fontFamily: theme.typography.display,
    fontSize: 24,
    color: theme.colors.sageDark,
    textAlign: 'center',
  },
  subInstruction: {
    fontFamily: theme.typography.bodyMedium,
    fontSize: 16,
    color: theme.colors.warmGray,
    marginTop: theme.spacing.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: theme.spacing.xl,
  },
  stats: {
    fontFamily: theme.typography.body,
    fontSize: 16,
    color: theme.colors.charcoal,
  },
  startBtn: {
    backgroundColor: theme.colors.sageDark,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  btnText: {
    fontFamily: theme.typography.bodyMedium,
    color: theme.colors.warmWhite,
    fontSize: 18,
  },
  feedbackContainer: {
    width: '100%',
    alignItems: 'center',
  },
  feedbackTitle: {
    fontFamily: theme.typography.bodyMedium,
    fontSize: 16,
    color: theme.colors.charcoal,
    marginBottom: theme.spacing.md,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  feedbackBtn: {
    flex: 1,
    backgroundColor: theme.colors.sage,
    padding: theme.spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  helpBtn: {
    backgroundColor: theme.colors.roseDark,
  },
  feedbackBtnText: {
    fontFamily: theme.typography.bodyMedium,
    color: theme.colors.warmWhite,
    fontSize: 14,
  }
});
