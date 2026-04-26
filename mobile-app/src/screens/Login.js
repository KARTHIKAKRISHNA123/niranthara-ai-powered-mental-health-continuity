// src/screens/Login.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }
    
    setLoading(true);
    try {
      await login(email, password);
      // AuthContext will update state and AppNavigator will automatically switch to Main tabs
    } catch (error) {
      console.warn("Login Error:", error);
      Alert.alert("Login Failed", "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            {/* If the user added logo.png to assets, it will render here. We fallback gracefully if not found via requires */}
            <Text style={styles.logoText}>Niranth<Text style={{ color: theme.colors.roseDark }}>ara</Text></Text>
          </View>
          
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue your mental wellness journey</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity 
              style={styles.btnPrimary} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Sign In</Text>}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.btnSecondary} 
              onPress={() => navigation.navigate('Signup')}
            >
              <Text style={styles.btnSecondaryText}>New here? Create an account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  logoText: {
    fontFamily: theme.typography.display,
    fontSize: 42,
    color: theme.colors.charcoal,
  },
  title: {
    fontFamily: theme.typography.display,
    fontSize: 32,
    color: theme.colors.charcoal,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: theme.typography.body,
    fontSize: 16,
    color: theme.colors.warmGray,
    marginBottom: theme.spacing.xxl,
  },
  form: {
    gap: theme.spacing.md,
  },
  label: {
    fontFamily: theme.typography.bodyMedium,
    fontSize: 14,
    color: theme.colors.charcoal,
    marginBottom: 4,
  },
  input: {
    backgroundColor: theme.colors.warmWhite,
    borderRadius: 12,
    padding: theme.spacing.lg,
    fontFamily: theme.typography.body,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.softGray,
    marginBottom: theme.spacing.sm,
  },
  btnPrimary: {
    backgroundColor: theme.colors.roseDark,
    padding: theme.spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  btnPrimaryText: {
    fontFamily: theme.typography.bodyMedium,
    color: '#fff',
    fontSize: 16,
  },
  btnSecondary: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontFamily: theme.typography.body,
    color: theme.colors.roseDark,
    fontSize: 15,
  }
});
