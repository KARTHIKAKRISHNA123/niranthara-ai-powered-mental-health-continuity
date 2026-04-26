// src/utils/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
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
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Auth with AsyncStorage for persistence across app restarts
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export { app, auth };