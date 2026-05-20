// dashboard/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [clinician, setClinician] = useState(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid))
        if (snap.exists() && snap.data().role === 'clinician') {
          setClinician({ uid: user.uid, email: user.email, ...snap.data() })
        } else {
          setClinician(null)
        }
      } else {
        setClinician(null)
      }
      setLoading(false)
    })
  }, [])

  const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, 'users', cred.user.uid));
    if (snap.exists() && snap.data().role === 'clinician') {
      setClinician({ uid: cred.user.uid, email: cred.user.email, ...snap.data() });
    } else {
      await signOut(auth);
      throw new Error('Not authorized as clinician');
    }
  };
  const logout = () => { signOut(auth); setClinician(null) }

  return (
    <AuthContext.Provider value={{ clinician, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
