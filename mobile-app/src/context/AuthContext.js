// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { api, postData } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true); // True while Firebase checks auth state on load
  const [dbUser, setDbUser] = useState(null); // The user's profile from the backend

  // Call this after profile mutations (e.g., onboarding save) to re-sync state
  const refreshDbUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.user) setDbUser(res.data.user);
    } catch (e) {
      console.warn('refreshDbUser failed:', e.message);
    }
  };

  useEffect(() => {
    // Safety timeout — if Firebase or backend hangs, show login after 5s max
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 5000);

    // Listen for Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Fetch full profile from backend to get name and settings
        try {
          const res = await api.get('/auth/me');
          if (res.data && res.data.user) {
            setDbUser(res.data.user);
          }
        } catch (error) {
          console.warn("Could not fetch backend profile. User might be newly registered or offline.");
        }
      } else {
        setDbUser(null);
      }
      clearTimeout(safetyTimer);
      setLoading(false);
    });

    return () => { unsubscribe(); clearTimeout(safetyTimer); };
  }, []);

  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (name, email, password) => {
    // 1. Create Firebase User
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // 2. Update Firebase Profile with Name
    await updateProfile(user, { displayName: name });
    
    // 3. Register user in Backend (creates Firestore doc)
    try {
      // No persona or gender is assumed here — onboarding asks. Defaulting
      // every new account to 'women' put cycle features in front of users the
      // product does not apply them to.
      await api.post('/auth/register', {
        name: name,
        email: email,
        language: 'en',
      });
    } catch (e) {
      console.warn("Backend registration failed (might already exist):", e);
    }
    
    return user;
  };

  const logout = () => {
    return signOut(auth);
  };

  const value = {
    currentUser,
    dbUser,
    login,
    signup,
    logout,
    loading,
    refreshDbUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
