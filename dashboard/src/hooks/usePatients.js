// dashboard/src/hooks/usePatients.js — Real-time Firestore patient data

import { useState, useEffect, useRef } from 'react'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../firebase'

// Browser notification for a new alert — reaches the clinician even when the
// dashboard tab is in the background or minimised. (Closed-browser delivery
// needs Web Push + a service worker: production roadmap, not MVP.)
const ALERT_TITLES = {
  crisis:                'Crisis alert',
  high_risk:             'High-risk alert',
  assessment_self_harm:  'PHQ-9 self-harm item flagged',
  silent_deviation:      'Silent deviation',
  manual_flag:           'Patient flagged',
}

function notifyBrowser(alert) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const n = new Notification(
      `${ALERT_TITLES[alert.type] || 'Patient alert'} — ${alert.patientName || 'Patient'}`,
      {
        body: (alert.triggerFactors || []).slice(0, 2).join('\n') || 'Open the dashboard to review.',
        tag:  alert.id,                       // dedup if Firestore re-emits
        requireInteraction: alert.type === 'crisis',
      },
    )
    n.onclick = () => { window.focus(); n.close() }
  } catch { /* Notification constructor can throw on some mobile browsers */ }
}

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
  // null until the first snapshot so seeding the list doesn't fire a
  // notification per pre-existing alert.
  const seenIds = useRef(null)

  useEffect(() => {
    if (!clinicianUid) { setLoading(false); return }

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }

    const q = query(
      collection(db, 'clinicianAlerts'),
      where('clinicianUid', '==', clinicianUid)
    )

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(alert => alert.resolved === false)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

      if (seenIds.current !== null) {
        data.filter(a => !seenIds.current.has(a.id)).forEach(notifyBrowser)
      }
      seenIds.current = new Set(data.map(a => a.id))

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
