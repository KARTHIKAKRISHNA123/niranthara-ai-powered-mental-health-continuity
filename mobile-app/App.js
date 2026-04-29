import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useFonts, CormorantGaramond_300Light } from '@expo-google-fonts/cormorant-garamond';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const [appReady, setAppReady] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_300Light,
    DMSans_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      setAppReady(true);
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (appReady) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [appReady]);

  if (!appReady) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Text style={styles.title}>Nirantara</Text>
        <Text style={styles.tamilTagline}>உங்கள் மனம், எங்கள் அக்கறை</Text>
        <Text style={styles.englishTagline}>YOUR MIND, OUR CARE</Text>
      </Animated.View>

      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8B4A52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: 'CormorantGaramond_300Light',
    fontSize: 64,
    color: '#FAF5EE',
    letterSpacing: 4,
    marginBottom: 20,
  },
  tamilTagline: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    color: '#FAF5EECC',
    marginBottom: 10,
    textAlign: 'center',
    lineHeight: 26,
  },
  englishTagline: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: '#FAF5EE88',
    letterSpacing: 3,
    textAlign: 'center',
  },
  dots: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FAF5EE44',
  },
  dotActive: {
    backgroundColor: '#FAF5EE',
    width: 24,
  },
});