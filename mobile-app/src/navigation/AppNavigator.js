// src/navigation/AppNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme } from '../theme/theme';

import { Feather } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/Login';
import SignupScreen from '../screens/Signup';

import CBTReframeScreen from '../screens/interventions/CBTReframe';
import SomaticBreathingScreen from '../screens/interventions/SomaticBreathing';

import HomeScreen from '../screens/Home';
import JournalScreen from '../screens/Journal';
import ChatScreen from '../screens/Chat';
import CycleScreen from '../screens/Cycle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName = 'circle';
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'Journal') iconName = 'edit-3';
          else if (route.name === 'Chat') iconName = 'message-circle';
          else if (route.name === 'Cycle') iconName = 'moon';
          return <Feather name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.roseDark,
        tabBarInactiveTintColor: theme.colors.warmGray,
        tabBarStyle: {
          backgroundColor: theme.colors.warmWhite,
          borderTopColor: theme.colors.roseLight,
          elevation: 0,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8
        },
        tabBarLabelStyle: {
          fontFamily: theme.typography.bodyMedium,
          fontSize: 12
        }
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Journal" component={JournalScreen} options={{ tabBarLabel: 'Journal' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ tabBarLabel: 'Chat' }} />
      <Tab.Screen name="Cycle" component={CycleScreen} options={{ tabBarLabel: 'Cycle' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { currentUser } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {currentUser ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="CBTReframe" component={CBTReframeScreen} />
            <Stack.Screen name="SomaticBreathing" component={SomaticBreathingScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
