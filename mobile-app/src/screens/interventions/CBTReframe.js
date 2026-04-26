// src/screens/interventions/CBTReframe.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme/theme';

export default function CBTReframeScreen({ navigation, route }) {
  const { initialThought = "" } = route.params || {};
  const [step, setStep] = useState(1);
  const [thought, setThought] = useState(initialThought);
  const [distortion, setDistortion] = useState('');
  const [reframe, setReframe] = useState('');

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
    else navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Close</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Cognitive Reframe</Text>
          
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
          </View>

          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>1. Catch the thought</Text>
              <Text style={styles.stepDesc}>What is the negative thought running through your mind right now?</Text>
              <TextInput
                style={styles.textArea}
                multiline
                placeholder="e.g., I ruined the entire presentation..."
                value={thought}
                onChangeText={setThought}
              />
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>2. Check the evidence</Text>
              <Text style={styles.stepDesc}>Are you falling into a thinking trap? Select the distortion you might be using:</Text>
              <View style={styles.chipGroup}>
                {['All-or-Nothing', 'Catastrophizing', 'Mind Reading', 'Self-Blame'].map(d => (
                  <TouchableOpacity 
                    key={d} 
                    style={[styles.chip, distortion === d && styles.chipActive]}
                    onPress={() => setDistortion(d)}
                  >
                    <Text style={[styles.chipText, distortion === d && styles.chipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>3. Change the narrative</Text>
              <Text style={styles.stepDesc}>Write a more balanced, compassionate version of this thought.</Text>
              <TextInput
                style={styles.textArea}
                multiline
                placeholder="e.g., I stumbled on one slide, but the rest of the presentation went well."
                value={reframe}
                onChangeText={setReframe}
              />
            </View>
          )}

          <TouchableOpacity 
            style={[styles.btnPrimary, (!thought && step===1) && styles.btnDisabled]} 
            onPress={nextStep}
            disabled={(!thought && step===1)}
          >
            <Text style={styles.btnPrimaryText}>{step === 3 ? "Save & Complete" : "Next Step"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  content: {
    padding: theme.spacing.xl,
    flexGrow: 1,
  },
  backBtn: {
    marginBottom: theme.spacing.lg,
  },
  backText: {
    fontFamily: theme.typography.bodyMedium,
    color: theme.colors.roseDark,
  },
  title: {
    fontFamily: theme.typography.display,
    fontSize: 32,
    color: theme.colors.charcoal,
    marginBottom: theme.spacing.md,
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.roseLight,
    borderRadius: 3,
    marginBottom: theme.spacing.xxl,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.roseDark,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: theme.typography.display,
    fontSize: 24,
    color: theme.colors.charcoal,
    marginBottom: theme.spacing.sm,
  },
  stepDesc: {
    fontFamily: theme.typography.body,
    fontSize: 16,
    color: theme.colors.warmGray,
    marginBottom: theme.spacing.lg,
  },
  textArea: {
    backgroundColor: theme.colors.warmWhite,
    borderWidth: 1,
    borderColor: theme.colors.softGray,
    borderRadius: 12,
    padding: theme.spacing.lg,
    fontFamily: theme.typography.body,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.lavenderDark,
    backgroundColor: theme.colors.warmWhite,
  },
  chipActive: {
    backgroundColor: theme.colors.lavenderDark,
  },
  chipText: {
    fontFamily: theme.typography.bodyMedium,
    color: theme.colors.lavenderDark,
  },
  chipTextActive: {
    color: theme.colors.warmWhite,
  },
  btnPrimary: {
    backgroundColor: theme.colors.roseDark,
    padding: theme.spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: theme.spacing.xxl,
  },
  btnDisabled: {
    backgroundColor: theme.colors.softGray,
  },
  btnPrimaryText: {
    fontFamily: theme.typography.bodyMedium,
    color: '#fff',
    fontSize: 16,
  }
});
