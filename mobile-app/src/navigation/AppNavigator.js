// src/navigation/AppNavigator.js — v2 with navigation responsiveness fixes
// Fixes:
//   1. tabBarHideOnKeyboard: prevents layout shifts when keyboard is open
//   2. Increased height + paddingBottom: prevents gesture-nav-bar overlap eating tap area
//   3. pressColor/pressOpacity: gives immediate visual feedback on tap
//   4. tabBarButton hitSlop: expands invisible touch target by 8px on all sides
//   5. tabBarAllowFontScaling: false — prevents text resize breaking layout on accessibility settings

import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { COLORS, FONTS } from '../theme/theme';
import { useAuth } from '../context/AuthContext';

// Auth
import LoginScreen      from '../screens/Login';
import SignupScreen     from '../screens/Signup';

// Onboarding
import OnboardingScreen from '../screens/Onboarding';

// Main tab screens
import HomeScreen    from '../screens/Home';
import JournalScreen from '../screens/Journal';
import ChatScreen    from '../screens/Chat';
import CycleScreen   from '../screens/Cycle';

// Stack-only screens
import InsightsScreen         from '../screens/Insights';
import CBTReframeScreen       from '../screens/interventions/CBTReframe';
import SomaticBreathingScreen from '../screens/interventions/SomaticBreathing';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = {
  Home:    'home',
  Journal: 'edit-3',
  Chat:    'message-circle',
  Cycle:   'moon',
};

// On Android with gesture nav bar, the system eats ~28-34px at the bottom.
// We add extra paddingBottom to ensure the tab label is never clipped.
const TAB_HEIGHT        = Platform.OS === 'ios' ? 60 : 64;
const TAB_PADDING_BTM   = Platform.OS === 'ios' ? 8  : 10;
const TAB_PADDING_TOP   = 8;

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // ── Icon ────────────────────────────────────────────────────────────
        tabBarIcon: ({ color, size }) => (
          <Feather name={TAB_ICONS[route.name] || 'circle'} size={size} color={color} />
        ),
        // ── Colors ──────────────────────────────────────────────────────────
        tabBarActiveTintColor:   COLORS.roseDark,
        tabBarInactiveTintColor: COLORS.warmGray,
        // ── Hide bar when keyboard is open (prevents layout shift) ──────────
        tabBarHideOnKeyboard: true,
        // ── Style ───────────────────────────────────────────────────────────
        tabBarStyle: {
          backgroundColor: COLORS.warmWhite,
          borderTopColor:  COLORS.roseLight,
          borderTopWidth:  1,
          elevation:       0,
          shadowOpacity:   0,
          height:          TAB_HEIGHT,
          paddingBottom:   TAB_PADDING_BTM,
          paddingTop:      TAB_PADDING_TOP,
        },
        tabBarLabelStyle: {
          fontFamily:           FONTS.medium,
          fontSize:             12,
          includeFontPadding:   false,
        },
        tabBarAllowFontScaling: false,
        // ── Button-level touch improvements ────────────────────────────────
        tabBarButton: (props) => {
          const { children, onPress, onLongPress, style, accessibilityRole, accessibilityState } = props;
          const { TouchableOpacity } = require('react-native');
          return (
            <TouchableOpacity
              {...{ onPress, onLongPress, style, accessibilityRole, accessibilityState }}
              activeOpacity={0.65}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {children}
            </TouchableOpacity>
          );
        },
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen}    options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Journal" component={JournalScreen} options={{ tabBarLabel: 'Journal' }} />
      <Tab.Screen name="Chat"    component={ChatScreen}    options={{ tabBarLabel: 'Chat' }} />
      <Tab.Screen name="Cycle"   component={CycleScreen}   options={{ tabBarLabel: 'Cycle' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { currentUser, dbUser } = useAuth();
  const needsOnboarding = currentUser && dbUser && !dbUser.onboardingComplete;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!currentUser ? (
          <>
            <Stack.Screen name="Login"  component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : needsOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            {/* MainTabs is the root authenticated screen */}
            <Stack.Screen name="MainTabs"         component={MainTabs} />
            {/* All screens that need a back button go here as stack screens */}
            <Stack.Screen name="Insights"         component={InsightsScreen} />
            <Stack.Screen name="SomaticBreathing" component={SomaticBreathingScreen} />
            <Stack.Screen name="CBTReframe"       component={CBTReframeScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
