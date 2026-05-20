// dashboard/src/pages/Alerts.jsx
// Unresolved crisis alerts — real-time, resolve in one click

import { useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useAlerts } from '../hooks/usePatients'

export default function Alerts() {
  const nav = useNavigate()
  const { clinician, logout } = useAuth()
  const { alerts, loading }   = useAlerts(clinician?.uid)

  const resolve = async (alertId) => {
    try {
      await updateDoc(doc(db, 'clinicianAlerts', alertId), {
        resolved: true, resolvedAt: new Date().toISOString()
      })
    } catch (e) { alert('Could not resolve: ' + e.message) }
  }

  const TYPE_STYLES = {
    crisis:      { bg: '#FDEAE5', border: 'var(--alert)',   icon: '🆘' },
    high_risk:   { bg: '#FEF3D9', border: 'var(--warning)', icon: '⚠️' },
    manual_flag: { bg: 'var(--lavender-light)', border: 'var(--lavender)', icon: '🚩' },
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="logo">Niranth<span>ara</span></div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <button onClick={() => nav('/dashboard')} style={{ textAlign:'left', background:'transparent', color:'var(--warm-gray)', border:'none', padding:'10px var(--sp-md)', borderRadius:'var(--r-sm)', fontSize:14, cursor:'pointer' }}>📋 Patients</button>
          <button style={{ textAlign:'left', background:'var(--rose-light)', color:'var(--rose-dark)', border:'none', padding:'10px var(--sp-md)', borderRadius:'var(--r-sm)', fontSize:14, cursor:'pointer' }}>🔔 Alerts</button>
        </nav>
        <button className="btn-ghost" onClick={logout} style={{ width:'100%', fontSize:12 }}>Sign Out</button>
      </aside>

      <main className="main-content">
        <h1 className="page-title">Alerts</h1>
        <p className="muted" style={{ marginBottom:'var(--sp-xl)', marginTop:-16 }}>
          Crisis detection by mental-roberta NLP — not keyword matching
        </p>

        {loading && <div style={{ color:'var(--warm-gray)', padding:'var(--sp-xxl)', textAlign:'center' }}>Loading alerts…</div>}

        {!loading && alerts.length === 0 && (
          <div className="card" style={{ textAlign:'center', padding:'var(--sp-xxl)' }}>
            <div style={{ fontSize:48, marginBottom:'var(--sp-lg)' }}>✓</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:22, color:'var(--sage-dark)' }}>No unresolved alerts</div>
            <div className="muted" style={{ marginTop:8 }}>All patients are within monitored thresholds</div>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:'var(--sp-lg)' }}>
          {alerts.map(alert => {
            const style = TYPE_STYLES[alert.type] || TYPE_STYLES.manual_flag
            return (
              <div key={alert.id} className="card fade-in" style={{ border:`1.5px solid ${style.border}`, background:style.bg }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:'var(--sp-lg)' }}>
                  <span style={{ fontSize:28 }}>{style.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, marginBottom:4, textTransform:'capitalize' }}>
                      {alert.type.replace('_',' ')} — {(alert.riskScore*100).toFixed(0)}% risk
                      {alert.crisisProb > 0 && ` · Crisis prob: ${(alert.crisisProb*100).toFixed(0)}%`}
                    </div>
                    {alert.triggerFactors?.length > 0 && (
                      <div style={{ fontSize:13, color:'var(--warm-gray)', marginBottom:4 }}>
                        {alert.triggerFactors.slice(0,2).join(' · ')}
                      </div>
                    )}
                    <div className="muted">
                      {new Date(alert.timestamp).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end' }}>
                    <button className="btn-primary" style={{ fontSize:12, padding:'6px 14px' }} onClick={() => nav(`/patient/${alert.patientUid}`)}>
                      View Patient
                    </button>
                    <button className="btn-ghost" style={{ fontSize:12 }} onClick={() => resolve(alert.id)}>
                      Mark Resolved
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
