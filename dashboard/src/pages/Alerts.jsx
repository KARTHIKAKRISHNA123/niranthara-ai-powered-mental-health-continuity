// dashboard/src/pages/Alerts.jsx
// Unresolved alerts — real-time, resolve in one click.
// No emojis (style guide): inline SVG severity icons; clinical titles per type.

import { useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useAlerts } from '../hooks/usePatients'
import { Sidebar } from '../components/components'

// ─── Inline SVG icons ─────────────────────────────────────────────────────────
function IconAlertOctagon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function IconTrendingUp({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function IconUserX({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="18" y1="8" x2="23" y2="13" />
      <line x1="23" y1="8" x2="18" y2="13" />
    </svg>
  )
}

function IconClipboardAlert({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="2" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function IconFlag({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

function IconCheckCircle({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

// ─── Alert type → presentation ────────────────────────────────────────────────
// Every alert writer sets `type`; this map turns it into clinical language.
const ALERT_PRESENTATION = {
  crisis: {
    title: 'Crisis detected',
    sub:   'suicidality NLP classifier',
    bg: '#FDEAE6', border: 'var(--alert)', color: 'var(--risk-high-color)',
    Icon: IconAlertOctagon,
  },
  crisis_detected: {
    title: 'Crisis detected',
    sub:   'escalation sweep — crisis probability spike',
    bg: '#FDEAE6', border: 'var(--alert)', color: 'var(--risk-high-color)',
    Icon: IconAlertOctagon,
  },
  high_risk: {
    title: 'High risk',
    sub:   'XGBoost 15-feature fusion',
    bg: 'var(--risk-mod-bg)', border: 'var(--warning)', color: 'var(--risk-mod-color)',
    Icon: IconTrendingUp,
  },
  loss_of_contact: {
    title: 'Loss of follow-up',
    sub:   'escalation sweep — high risk plus inactivity',
    bg: 'var(--lavender-light)', border: 'var(--lavender)', color: 'var(--lavender-dark)',
    Icon: IconUserX,
  },
  silent_deviation: {
    title: 'Silent deviation',
    sub:   'behavioral baseline shift',
    bg: 'var(--lavender-light)', border: 'var(--lavender)', color: 'var(--lavender-dark)',
    Icon: IconUserX,
  },
  assessment_self_harm: {
    title: 'PHQ-9 self-harm item flagged',
    sub:   'item 9 protocol — review regardless of total score',
    bg: '#FDEAE6', border: 'var(--alert)', color: 'var(--risk-high-color)',
    Icon: IconClipboardAlert,
  },
  manual_flag: {
    title: 'Flagged by clinician',
    sub:   'manual clinical flag',
    bg: 'var(--lavender-light)', border: 'var(--lavender)', color: 'var(--lavender-dark)',
    Icon: IconFlag,
  },
}

export default function Alerts() {
  const nav = useNavigate()
  const { clinician, logout } = useAuth()
  const { alerts, loading }   = useAlerts(clinician?.uid)

  const resolve = async (alertId) => {
    try {
      await updateDoc(doc(db, 'clinicianAlerts', alertId), {
        resolved: true, resolvedAt: new Date().toISOString()
      })
    } catch (e) { console.error('Could not resolve:', e.message) }
  }

  return (
    <div className="dashboard-layout">
      <Sidebar
        active="alerts"
        alertCount={alerts.length}
        clinicianName={clinician?.name || clinician?.email}
        onLogout={logout}
      />

      <main className="main-content">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 'var(--sp-sm)' }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Alerts</h1>
          <span className="live-indicator">Live · Firestore onSnapshot</span>
        </div>
        <p className="muted" style={{ marginBottom: 'var(--sp-xl)' }}>
          Model-driven escalations — crisis NLP, risk fusion, follow-up sweeps. Not keyword matching.
        </p>

        {loading && (
          <div aria-busy="true" aria-label="Loading alerts" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton" style={{ height: 110, borderRadius: 'var(--r-md)' }} />
            ))}
          </div>
        )}

        {!loading && alerts.length === 0 && (
          <div className="card" role="status" style={{ textAlign: 'center', padding: 'var(--sp-xxxl)' }}>
            <div style={{ color: 'var(--sage)', marginBottom: 'var(--sp-lg)' }}>
              <IconCheckCircle />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--sage-dark)' }}>
              No unresolved alerts
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              All patients are within monitored thresholds. New alerts appear here in real time.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
          {alerts.map((a, i) => {
            const p = ALERT_PRESENTATION[a.type] || ALERT_PRESENTATION.manual_flag
            const { Icon } = p
            const risk   = a.riskScore > 0 ? `${(a.riskScore * 100).toFixed(0)}% risk` : null
            const crisis = a.crisisProb > 0 ? `crisis prob ${(a.crisisProb * 100).toFixed(0)}%` : null
            const detail = a.triggerFactors?.length ? a.triggerFactors.slice(0, 2).join('  ·  ') : a.message

            return (
              <div
                key={a.id}
                className={`card fade-in stagger-${Math.min(i + 1, 4)}`}
                style={{ background: p.bg, border: 'none', borderLeft: `4px solid ${p.border}`, borderRadius: 'var(--r-md)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-lg)' }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 'var(--r-sm)', flexShrink: 0,
                    background: 'var(--warm-white)', color: p.border,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: p.color }}>{p.title}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--charcoal)' }}>
                        {a.patientName || 'Patient'}
                      </span>
                      {(risk || crisis) && (
                        <span className="mono" style={{ fontSize: 10 }}>
                          {[risk, crisis].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                    {detail && (
                      <div style={{ fontSize: 13, color: 'var(--charcoal)', opacity: 0.75, marginTop: 4, lineHeight: 1.5 }}>
                        {detail}
                      </div>
                    )}
                    <div className="muted mono" style={{ fontSize: 10, marginTop: 6 }}>
                      {p.sub} · {new Date(a.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', flexShrink: 0 }}>
                    <button className="btn-primary" style={{ fontSize: 12, padding: '6px 14px', minHeight: 34 }}
                      onClick={() => nav(`/patient/${a.patientUid}`)}>
                      View Patient
                    </button>
                    <button className="btn-ghost" style={{ fontSize: 12, minHeight: 32 }}
                      onClick={() => resolve(a.id)}>
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
