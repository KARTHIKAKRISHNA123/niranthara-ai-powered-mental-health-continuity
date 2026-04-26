// dashboard/src/pages/Dashboard.jsx
// Patient list sorted by XGBoost risk_score — real-time Firestore onSnapshot

import { useNavigate } from 'react-router-dom'
import { useAuth }     from '../context/AuthContext'
import { usePatients, useAlerts } from '../hooks/usePatients'
import { RiskBadge, CrisisBanner, PatientCard } from '../components/components'

export default function Dashboard() {
  const { clinician, logout } = useAuth()
  const nav = useNavigate()
  const { patients, loading } = usePatients(clinician?.uid)
  const { alerts }            = useAlerts(clinician?.uid)

  const riskCounts = patients.reduce((acc, p) => {
    acc[p.riskLevel || 'low'] = (acc[p.riskLevel || 'low'] || 0) + 1
    return acc
  }, {})

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'var(--sp-xl)' }}>
          <img src="/logo.png" alt="Niranthara Logo" style={{ width: 40, height: 'auto' }} />
          <div>Niranth<span>ara</span></div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {[
            { label: '📋 Patients',  path: '/dashboard' },
            { label: '🔔 Alerts',    path: '/alerts',   badge: alerts.filter(a => !a.resolved).length },
          ].map(({ label, path, badge }) => (
            <button key={path} onClick={() => nav(path)} style={{ textAlign: 'left', background: window.location.pathname === path ? 'var(--rose-light)' : 'transparent', color: window.location.pathname === path ? 'var(--rose-dark)' : 'var(--warm-gray)', border: 'none', padding: '10px var(--sp-md)', borderRadius: 'var(--r-sm)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{label}</span>
              {badge > 0 && <span style={{ background: 'var(--alert)', color: 'white', borderRadius: 'var(--r-pill)', padding: '1px 7px', fontSize: 11 }}>{badge}</span>}
            </button>
          ))}
        </nav>
        <div style={{ borderTop: '1px solid var(--rose-light)', paddingTop: 'var(--sp-lg)' }}>
          <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 8 }}>{clinician?.name || clinician?.email}</div>
          <button className="btn-ghost" onClick={logout} style={{ width: '100%', fontSize: 12 }}>Sign Out</button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <CrisisBanner alerts={alerts} onView={() => nav('/alerts')} />

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 'var(--sp-xl)' }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Patients</h1>
          <div className="muted" style={{ textAlign: 'right' }}>
            Real-time • Sorted by XGBoost risk score
          </div>
        </div>

        {/* Risk summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--sp-lg)', marginBottom: 'var(--sp-xl)' }}>
          {['crisis','high','moderate','low'].map(level => (
            <div key={level} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 300, color: `var(--risk-${level})` }}>
                {riskCounts[level] || 0}
              </div>
              <RiskBadge level={level} />
            </div>
          ))}
        </div>

        {/* Patient list */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: 'var(--sp-lg) var(--sp-xl)', borderBottom: '1px solid var(--rose-light)', fontWeight: 500 }}>
            All Patients ({patients.length})
          </div>
          {loading ? (
            <div style={{ padding: 'var(--sp-xxl)', textAlign: 'center', color: 'var(--warm-gray)' }}>Loading patients…</div>
          ) : patients.length === 0 ? (
            <div style={{ padding: 'var(--sp-xxl)', textAlign: 'center', color: 'var(--warm-gray)' }}>No patients assigned yet</div>
          ) : (
            patients.map(p => <PatientCard key={p.id} patient={p} />)
          )}
        </div>
      </main>
    </div>
  )
}
