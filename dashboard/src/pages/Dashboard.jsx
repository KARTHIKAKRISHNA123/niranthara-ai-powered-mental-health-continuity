// dashboard/src/pages/Dashboard.jsx
// Patient list sorted by XGBoost risk_score — real-time Firestore onSnapshot
// RTCFR: no emojis, Feather-equivalent SVG nav icons, .nav-item CSS class

import { useNavigate } from 'react-router-dom'
import { useAuth }     from '../context/AuthContext'
import { usePatients, useAlerts } from '../hooks/usePatients'
import { RiskBadge, CrisisBanner, PatientCard, Sidebar } from '../components/components'

export default function Dashboard() {
  const { clinician, logout } = useAuth()
  const nav = useNavigate()
  const { patients, loading } = usePatients(clinician?.uid)
  const { alerts }            = useAlerts(clinician?.uid)

  const riskCounts = patients.reduce((acc, p) => {
    acc[p.riskLevel || 'low'] = (acc[p.riskLevel || 'low'] || 0) + 1
    return acc
  }, {})

  const unresolvedCount = alerts.filter(a => !a.resolved).length

  return (
    <div className="dashboard-layout">
      <Sidebar
        active="patients"
        alertCount={unresolvedCount}
        clinicianName={clinician?.name || clinician?.email}
        onLogout={logout}
      />

      {/* ── Main ── */}
      <main className="main-content">
        <CrisisBanner alerts={alerts} onView={() => nav('/alerts')} />

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 'var(--sp-xl)' }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Patients</h1>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span className="live-indicator">Live · Firestore onSnapshot</span>
            <span className="muted mono" style={{ fontSize: 11 }}>Sorted by XGBoost risk score</span>
          </div>
        </div>

        {/* Risk summary tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--sp-lg)', marginBottom: 'var(--sp-xl)' }}>
          {[
            ['crisis',   'var(--alert)'],
            ['high',     'var(--risk-high-color)'],
            ['moderate', 'var(--risk-mod-color)'],
            ['low',      'var(--risk-low-color)'],
          ].map(([level, color], i) => (
            <div key={level} className={`stat-tile fade-in stagger-${i + 1}`}>
              <div className="stat-number" style={{ color }}>
                {riskCounts[level] || 0}
              </div>
              <RiskBadge level={level} />
            </div>
          ))}
        </div>

        {/* Patient list */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 'var(--sp-lg) var(--sp-xl)', borderBottom: '1px solid var(--rose-light)', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>All Patients</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{patients.length}</span>
          </div>
          {loading ? (
            <div aria-busy="true" aria-label="Loading patients">
              {[0, 1, 2].map(i => (
                <div key={i} className="skeleton-row">
                  <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="skeleton" style={{ width: '40%', height: 12 }} />
                    <div className="skeleton" style={{ width: '65%', height: 10 }} />
                  </div>
                  <div className="skeleton" style={{ width: 72, height: 22, borderRadius: 'var(--r-pill)' }} />
                </div>
              ))}
            </div>
          ) : patients.length === 0 ? (
            <div role="status" style={{ padding: 'var(--sp-xxl)', textAlign: 'center', color: 'var(--warm-gray)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--charcoal)', marginBottom: 6 }}>
                No patients assigned yet
              </div>
              <div style={{ fontSize: 12 }}>
                Patients appear here in real time once they are assigned to you.
              </div>
            </div>
          ) : (
            patients.map(p => <PatientCard key={p.id} patient={p} />)
          )}
        </div>
      </main>
    </div>
  )
}
