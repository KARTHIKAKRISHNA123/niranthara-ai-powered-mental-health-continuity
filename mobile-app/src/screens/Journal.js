// src/screens/Journal.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';
import { postData } from '../utils/api';

export default function JournalScreen({ navigation }) {
  const [mood, setMood] = useState(3);
  const [journalText, setJournalText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!journalText.trim()) {
      Alert.alert("Please write something before saving.");
      return;
    }
    
    setLoading(true);
    
    const payload = {
      moodScore: mood,
      energyLevel: 5, // mock 
      anxietyLevel: 5, // mock
      sleepHours: 7, // mock
      journalText: journalText,
      offlineSyncId: Date.now().toString()
    };

    const result = await postData('/mood/log', payload, 'moodLogs');
    setLoading(false);

    if (result.success) {
      if (result.offline) {
        Alert.alert("Saved Offline", "Your check-in has been saved and will sync when online.");
      } else {
        if (result.data?.requiresImmediateAction) {
          Alert.alert("We are here for you", "Your response indicates you might be in distress. Help is available.", [
            { text: "Call NIMHANS", onPress: () => console.log("Calling NIMHANS") },
            { text: "Okay", style: "cancel" }
          ]);
        } else {
          Alert.alert("Saved", "Your check-in has been recorded securely.");
        }
      }
      navigation.goBack();
    } else {
      Alert.alert("Error", "Could not save your check-in.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Daily Check-in</Text>
      
      <Text style={styles.label}>Mood Score (1-5): {mood}</Text>
      <View style={styles.moodSelector}>
        {[1, 2, 3, 4, 5].map((val) => (
          <TouchableOpacity 
            key={val} 
            style={[styles.moodBtn, mood === val && styles.moodBtnActive]}
            onPress={() => setMood(val)}
          >
            <Text style={[styles.moodBtnText, mood === val && styles.moodBtnTextActive]}>{val}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Journal</Text>
      <TextInput
        style={styles.input}
        multiline
        placeholder="How are you feeling right now? (You can write in English or Tanglish)"
        value={journalText}
        onChangeText={setJournalText}
        textAlignVertical="top"
      />

      <TouchableOpacity 
        style={styles.submitBtn} 
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Entry</Text>}
      </TouchableOpacity>
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
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontFamily: theme.typography.bodyMedium,
    fontSize: 16,
    color: theme.colors.charcoal,
    marginBottom: theme.spacing.sm,
  },
  moodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
  },
  moodBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.warmWhite,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.softGray,
  },
  moodBtnActive: {
    backgroundColor: theme.colors.sage,
    borderColor: theme.colors.sageDark,
  },
  moodBtnText: {
    fontFamily: theme.typography.bodyMedium,
    color: theme.colors.charcoal,
  },
  moodBtnTextActive: {
    color: theme.colors.warmWhite,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.warmWhite,
    borderRadius: 16,
    padding: theme.spacing.lg,
    fontFamily: theme.typography.body,
    fontSize: 16,
    color: theme.colors.charcoal,
    borderWidth: 1,
    borderColor: theme.colors.softGray,
    marginBottom: theme.spacing.xl,
  },
  submitBtn: {
    backgroundColor: theme.colors.roseDark,
    padding: theme.spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitText: {
    fontFamily: theme.typography.bodyMedium,
    color: '#fff',
    fontSize: 16,
  }
});
