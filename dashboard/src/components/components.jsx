// dashboard/src/components/RiskBadge.jsx
export function RiskBadge({ level, score }) {
  const icons = { low: '✓', moderate: '⚠', high: '▲', crisis: '!' }
  return (
    <span className={`risk-badge ${level || 'low'}`} aria-label={`Risk level: ${level}`}>
      <span aria-hidden="true">{icons[level] || '?'}</span>
      <span>{level || 'low'}</span>
      {score !== undefined && <span>{(score * 100).toFixed(0)}%</span>}
    </span>
  )
}

// dashboard/src/components/CrisisBanner.jsx
export function CrisisBanner({ alerts, onView }) {
  if (!alerts || alerts.length === 0) return null
  const crisis = alerts.filter(a => a.type === 'crisis')
  if (crisis.length === 0) return null
  return (
    <div className="crisis-banner" role="alert" aria-live="assertive">
      <span style={{ fontSize: 22 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <strong>{crisis.length} crisis alert{crisis.length > 1 ? 's' : ''} require immediate attention</strong>
        <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
          NLP crisis probability above 0.85 — not keyword-based
        </div>
      </div>
      <button onClick={onView} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 13 }}>
        View Alerts
      </button>
    </div>
  )
}

// dashboard/src/components/PatientCard.jsx
import { useNavigate } from 'react-router-dom'
export function PatientCard({ patient }) {
  const nav = useNavigate()
  const topFactor = patient.topFactors?.[0] || ''
  return (
    <div className="patient-row fade-in" onClick={() => nav(`/patient/${patient.uid || patient.id}`)} role="button" tabIndex={0} aria-label={`View ${patient.name} — risk ${patient.riskLevel}`}
      onKeyDown={e => e.key === 'Enter' && nav(`/patient/${patient.uid || patient.id}`)}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--rose-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--rose-dark)', flexShrink: 0 }}>
        {(patient.name || 'U')[0].toUpperCase()}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, marginBottom: 2 }}>{patient.name || 'Unknown'}</div>
        {topFactor && <div className="muted">{topFactor}</div>}
      </div>
      <RiskBadge level={patient.riskLevel} score={patient.riskScore} />
      <span style={{ color: 'var(--soft-gray)', fontSize: 18 }}>›</span>
    </div>
  )
}
