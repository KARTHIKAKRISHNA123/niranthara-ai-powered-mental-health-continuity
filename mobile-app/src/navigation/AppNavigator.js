// src/navigation/AppNavigator.js — Niranthara v2
// RTCFR: "Chat" → "Care" (clinical signal), 48px touch targets, pill active indicator,
//        hitSlop expansion, keyboard-safe layout, no emojis, smooth stack transitions

import React from 'react';
import { Platform, TouchableOpacity, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { COLORS, FONTS, RADIUS } from '../theme/theme';
import { useAuth } from '../context/AuthContext';

import LoginScreen            from '../screens/Login';
import SignupScreen           from '../screens/Signup';
import OnboardingScreen       from '../screens/Onboarding';
import HomeScreen             from '../screens/Home';
import JournalScreen          from '../screens/Journal';
import ChatScreen             from '../screens/Chat';
import CycleScreen            from '../screens/Cycle';
import InsightsScreen         from '../screens/Insights';
import CBTReframeScreen       from '../screens/interventions/CBTReframe';
import SomaticBreathingScreen from '../screens/interventions/SomaticBreathing';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_HEIGHT  = Platform.OS === 'ios' ? 60 : 64;
const TAB_PAD_BTM = Platform.OS === 'ios' ? 8  : 12;
const TAB_PAD_TOP = 8;

const TAB_ICON = {
  Home:    'home',
  Journal: 'edit-3',
  Chat:    'message-circle',
  Cycle:   'moon',
};

const TAB_LABEL = {
  Home:    'Home',
  Journal: 'Journal',
  Chat:    'Care',    // renamed: clinical intent
  Cycle:   'Cycle',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,

        tabBarIcon: ({ color, focused }) => (
          <View style={[ts.iconWrap, focused && ts.iconActive]}>
            <Feather name={TAB_ICON[route.name] || 'circle'} size={22} color={color} />
          </View>
        ),

        tabBarActiveTintColor:   COLORS.roseDark,
        tabBarInactiveTintColor: COLORS.warmGray,

        tabBarStyle: {
          backgroundColor: COLORS.warmWhite,
          borderTopColor:  COLORS.roseLight,
          borderTopWidth:  1,
          elevation:       0,
          shadowOpacity:   0,
          height:          TAB_HEIGHT,
          paddingBottom:   TAB_PAD_BTM,
          paddingTop:      TAB_PAD_TOP,
        },

        tabBarLabelStyle: {
          fontFamily:         FONTS.medium,
          fontSize:           11,
          includeFontPadding: false,
        },
        tabBarAllowFontScaling: false,

        tabBarButton: (props) => {
          const { children, onPress, onLongPress, style, accessibilityRole, accessibilityState } = props;
          return (
            <TouchableOpacity
              onPress={onPress}
              onLongPress={onLongPress}
              style={[style, ts.tabBtn]}
              accessibilityRole={accessibilityRole}
              accessibilityState={accessibilityState}
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              {children}
            </TouchableOpacity>
          );
        },
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen}    options={{ tabBarLabel: TAB_LABEL.Home,    tabBarAccessibilityLabel: 'Home' }} />
      <Tab.Screen name="Journal" component={JournalScreen} options={{ tabBarLabel: TAB_LABEL.Journal, tabBarAccessibilityLabel: 'Journal' }} />
      <Tab.Screen name="Chat"    component={ChatScreen}    options={{ tabBarLabel: TAB_LABEL.Chat,    tabBarAccessibilityLabel: 'Care' }} />
      <Tab.Screen name="Cycle"   component={CycleScreen}   options={{ tabBarLabel: TAB_LABEL.Cycle,   tabBarAccessibilityLabel: 'Cycle' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { currentUser, dbUser } = useAuth();
  const needsOnboarding = currentUser && dbUser && !dbUser.onboardingComplete;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown:       false,
          animation:         'slide_from_right',
          animationDuration: 300,
          contentStyle:      { backgroundColor: COLORS.cream },
        }}
      >
        {!currentUser ? (
          <>
            <Stack.Screen name="Login"  component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : needsOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs"         component={MainTabs} />
            <Stack.Screen name="Insights"         component={InsightsScreen} />
            <Stack.Screen name="SomaticBreathing" component={SomaticBreathingScreen} />
            <Stack.Screen name="CBTReframe"       component={CBTReframeScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const ts = StyleSheet.create({
  tabBtn: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      48,
  },
  iconWrap: {
    width:          36,
    height:         28,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   RADIUS.pill,
  },
  iconActive: {
    backgroundColor: COLORS.roseLight,
    width:           52,
  },
});
