// dashboard/src/components/components.jsx
// RTCFR: no emojis — inline SVG icons only; new CSS class tokens from index.css

// ─── Inline SVG icon atoms ────────────────────────────────────────────────────
function IconCheck({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconMinus({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconTrendUp({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function IconAlertCircle({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function IconAlertTriangle({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

// ─── Risk icon map ────────────────────────────────────────────────────────────
const RISK_ICONS = {
  low:      <IconCheck />,
  moderate: <IconMinus />,
  high:     <IconTrendUp />,
  crisis:   <IconAlertCircle />,
}

// ─── RiskBadge ────────────────────────────────────────────────────────────────
export function RiskBadge({ level, score }) {
  const safeLevel = level || 'low'
  return (
    <span className={`risk-badge ${safeLevel}`} aria-label={`Risk level: ${safeLevel}`}>
      <span className="risk-badge-icon" aria-hidden="true">{RISK_ICONS[safeLevel] || <IconAlertCircle />}</span>
      <span>{safeLevel}</span>
      {score !== undefined && (
        <span className="mono" style={{ marginLeft: 2 }}>
          {(score * 100).toFixed(0)}%
        </span>
      )}
    </span>
  )
}

// ─── CrisisBanner ─────────────────────────────────────────────────────────────
export function CrisisBanner({ alerts, onView }) {
  if (!alerts || alerts.length === 0) return null
  const crisis = alerts.filter(a => a.type === 'crisis')
  if (crisis.length === 0) return null
  return (
    <div className="crisis-banner" role="alert" aria-live="assertive">
      <IconAlertTriangle size={22} />
      <div style={{ flex: 1 }}>
        <strong>
          {crisis.length} crisis alert{crisis.length > 1 ? 's' : ''} require immediate attention
        </strong>
        <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
          NLP crisis probability above 0.85 — not keyword-based
        </div>
      </div>
      <button
        onClick={onView}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.4)',
          color: 'white',
          padding: '6px 16px',
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: 'DM Sans',
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        View Alerts
      </button>
    </div>
  )
}

// ─── Shared Sidebar ───────────────────────────────────────────────────────────
// One sidebar for Dashboard + Alerts so the brand block, nav, and badge can
// never drift apart between pages again.
import { useNavigate } from 'react-router-dom'

function IconClipboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="2" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="12" y2="16" />
    </svg>
  )
}

function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function IconLogOut() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export function Sidebar({ active, alertCount = 0, clinicianName, onLogout }) {
  const nav = useNavigate()
  const items = [
    { key: 'patients', label: 'Patients', path: '/dashboard', Icon: IconClipboard },
    { key: 'alerts',   label: 'Alerts',   path: '/alerts',    Icon: IconBell },
  ]
  return (
    <aside className="sidebar">
      <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'var(--sp-xxl)' }}>
        <img src="/logo.png" alt="Niranthara logo" style={{ width: 40, height: 'auto' }} />
        <div>Niranth<span>ara</span></div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {items.map(item => (
          <button
            key={item.key}
            onClick={() => nav(item.path)}
            className={`nav-item${active === item.key ? ' active' : ''}`}
            aria-current={active === item.key ? 'page' : undefined}
          >
            <item.Icon />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.key === 'alerts' && alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
          </button>
        ))}
      </nav>

      <div style={{ borderTop: '1px solid var(--rose-light)', paddingTop: 'var(--sp-lg)' }}>
        {clinicianName && (
          <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 8, paddingLeft: 4 }}>
            {clinicianName}
          </div>
        )}
        <button className="nav-item" onClick={onLogout} style={{ width: '100%', fontSize: 12, gap: 8 }}>
          <IconLogOut />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

// ─── PatientCard ──────────────────────────────────────────────────────────────
export function PatientCard({ patient }) {
  const nav = useNavigate()
  const topFactor = patient.topFactors?.[0] || ''
  const initial   = (patient.name || 'U')[0].toUpperCase()

  return (
    <div
      className="patient-row fade-in"
      onClick={() => nav(`/patient/${patient.uid || patient.id}`)}
      role="button"
      tabIndex={0}
      aria-label={`View ${patient.name} — risk ${patient.riskLevel}`}
      onKeyDown={e => {
        if (e.key === 'Enter') nav(`/patient/${patient.uid || patient.id}`)
        if (e.key === ' ') { e.preventDefault(); nav(`/patient/${patient.uid || patient.id}`) }
      }}
    >
      <div className="patient-avatar">{initial}</div>
      <div style={{ flex: 1 }}>
        <div className="patient-name">{patient.name || 'Unknown'}</div>
        {topFactor && <div className="patient-factor">{topFactor}</div>}
      </div>
      <RiskBadge level={patient.riskLevel} score={patient.riskScore} />
      <span className="patient-chevron">›</span>
    </div>
  )
}
