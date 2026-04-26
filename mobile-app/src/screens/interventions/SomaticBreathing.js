// src/screens/interventions/SomaticBreathing.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme/theme';

export default function SomaticBreathingScreen({ navigation }) {
  const [phase, setPhase] = useState('Ready');
  const [isActive, setIsActive] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);

  const startBreathing = () => {
    setIsActive(true);
    runBreathingCycle();
  };

  const stopBreathing = () => {
    setIsActive(false);
    setPhase('Ready');
    scaleAnim.setValue(1);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const runBreathingCycle = () => {
    // Inhale
    setPhase('Breathe In');
    Animated.timing(scaleAnim, {
      toValue: 2,
      duration: 4000,
      useNativeDriver: true,
    }).start();

    timerRef.current = setTimeout(() => {
      if (!isActive) return;
      // Hold
      setPhase('Hold');
      
      timerRef.current = setTimeout(() => {
        if (!isActive) return;
        // Exhale
        setPhase('Breathe Out');
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }).start();

        timerRef.current = setTimeout(() => {
          if (!isActive) return;
          // Hold
          setPhase('Hold');
          
          timerRef.current = setTimeout(() => {
            if (!isActive) return;
            runBreathingCycle(); // loop
          }, 4000);
        }, 4000);
      }, 4000);
    }, 4000);
  };

  useEffect(() => {
    return () => stopBreathing();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => { stopBreathing(); navigation.goBack(); }} style={styles.backBtn}>
        <Text style={styles.backText}>← Close</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Box Breathing</Text>
        <Text style={styles.subtitle}>A somatic exercise to lower heart rate and reduce immediate anxiety.</Text>

        <View style={styles.animationContainer}>
          <Animated.View style={[styles.circle, { transform: [{ scale: scaleAnim }] }]} />
          <Text style={styles.phaseText}>{phase}</Text>
        </View>

        <TouchableOpacity 
          style={styles.actionBtn} 
          onPress={isActive ? stopBreathing : startBreathing}
        >
          <Text style={styles.actionBtnText}>{isActive ? 'Stop' : 'Start Exercise'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.sageLight,
    padding: theme.spacing.xl,
  },
  backBtn: {
    marginBottom: theme.spacing.xl,
  },
  backText: {
    fontFamily: theme.typography.bodyMedium,
    color: theme.colors.sageDark,
    fontSize: 16,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontFamily: theme.typography.display,
    fontSize: 36,
    color: theme.colors.sageDark,
  },
  subtitle: {
    fontFamily: theme.typography.body,
    fontSize: 16,
    color: theme.colors.sageDark,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  animationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.sage,
    opacity: 0.8,
    position: 'absolute',
  },
  phaseText: {
    fontFamily: theme.typography.display,
    fontSize: 28,
    color: theme.colors.charcoal,
    zIndex: 10,
  },
  actionBtn: {
    backgroundColor: theme.colors.sageDark,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  actionBtnText: {
    fontFamily: theme.typography.bodyMedium,
    fontSize: 18,
    color: '#fff',
  }
});
