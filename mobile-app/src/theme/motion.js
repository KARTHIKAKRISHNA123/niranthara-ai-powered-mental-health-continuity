// src/theme/motion.js — Niranthara Animation System
// Calm therapeutic motion only. React Native Animated API.
// No Reanimated 2 required. Works on low-end Android.

import { Easing } from 'react-native';

export const MOTION = {
  duration: {
    instant:    100,   // tap press state, active flicker
    fast:       200,   // icon swap, badge update, chat bubble
    standard:   300,   // card entrance, tab active icon
    deliberate: 500,   // screen transition, JITAI entrance
    slow:       800,   // risk ring fill, suppression arc
    breath:    4000,   // breathing exercise phases (per phase)
  },

  easing: {
    enter:  Easing.out(Easing.cubic),
    exit:   Easing.in(Easing.quad),
    move:   Easing.inOut(Easing.cubic),
    breath: Easing.inOut(Easing.sin),
    linear: Easing.linear,
  },

  spring: {
    tabIcon:    { tension: 120, friction: 8,  useNativeDriver: true },
    gentle:     { tension: 60,  friction: 14, useNativeDriver: true },
    snappy:     { tension: 200, friction: 20, useNativeDriver: true },
  },
};

// ─── Card entrance (translateY: 12→0, opacity: 0→1) ──────────────────────────
import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

export function useCardEntrance(delay = 0) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: MOTION.duration.standard, delay,
        easing: MOTION.easing.enter, useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: MOTION.duration.standard, delay,
        easing: MOTION.easing.enter, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return { opacity, transform: [{ translateY }] };
}

// ─── Fade in only (for sections that don't slide) ────────────────────────────
export function useFadeIn(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1, duration: MOTION.duration.deliberate, delay,
      easing: MOTION.easing.enter, useNativeDriver: true,
    }).start();
  }, []);
  return { opacity };
}
