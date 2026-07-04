// dashboard/src/hooks/usePatients.js — Real-time Firestore patient data

import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../firebase'

export function usePatients(clinicianUid) {
  const [patients, setPatients] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    if (!clinicianUid) { setLoading(false); return }

    const q = query(
      collection(db, 'users'),
      where('assignedClinician', '==', clinicianUid),
      where('role', '==', 'user')
    )

    // Real-time onSnapshot — updates without refresh
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))  // Sorted by XGBoost score
      setPatients(data)
      setLoading(false)
    }, (err) => {
      console.error('usePatients error:', err)
      setError(err.message)
      setLoading(false)
    })

    return unsub
  }, [clinicianUid])

  return { patients, loading, error }
}

export function useAlerts(clinicianUid) {
  const [alerts,  setAlerts]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clinicianUid) { setLoading(false); return }

    const q = query(
      collection(db, 'clinicianAlerts'),
      where('clinicianUid', '==', clinicianUid)
    )

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(alert => alert.resolved === false)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      setAlerts(data)
      setLoading(false)
    }, (err) => {
      console.error('useAlerts error:', err)
      setLoading(false)
    })

    return unsub
  }, [clinicianUid])

  return { alerts, loading }
}
