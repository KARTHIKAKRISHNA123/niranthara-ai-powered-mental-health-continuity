// src/utils/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyA1UvrpMb15vv91n90WvoWOENQRHxfUzc4",
  authDomain: "niranthara-86578.firebaseapp.com",
  projectId: "niranthara-86578",
  storageBucket: "niranthara-86578.firebasestorage.app",
  messagingSenderId: "232605546365",
  appId: "1:232605546365:web:3ea28bc171a5a2d205fe14"
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Always use AsyncStorage persistence so auth survives app restarts
let auth;
try {
  // First call: initialize with persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // Already initialized (hot reload / fast refresh) — just get the existing instance
  auth = getAuth(app);
}

export { app, auth };