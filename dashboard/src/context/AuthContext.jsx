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

  const login  = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = () => { signOut(auth); setClinician(null) }

  return (
    <AuthContext.Provider value={{ clinician, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
