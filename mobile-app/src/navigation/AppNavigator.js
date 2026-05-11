import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import SignupScreen from '../screens/SignupScreen';
import OTPScreen from '../screens/OTPScreen';
import LoginScreen from '../screens/LoginScreen';
import PersonaSelectScreen from '../screens/PersonaSelectScreen.js';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="OTP" component={OTPScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="PersonaSelect" component={PersonaSelectScreen} />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}