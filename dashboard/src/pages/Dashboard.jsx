// dashboard/src/pages/Dashboard.jsx
// Clinician triage view — real-time Firestore onSnapshot.
// Three things drive the layout, in this order of clinical priority:
//   1. HOW MANY need me today          → risk summary tiles
//   2. WHO is worst, at a glance       → severity distribution chart
//   3. Narrow it down                  → filter + sort, then the list
// Risk is never encoded by colour alone (colour + icon + text), per
// docs/STYLE_GUIDE.md.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth }     from '../context/AuthContext'
import { usePatients, useAlerts } from '../hooks/usePatients'
import { RiskBadge, CrisisBanner, PatientCard, Sidebar } from '../components/components'

// Plain-English descriptors. The tiles used to show a bare count above a
// lowercase badge ("high", "moderate"), which reads as a label, not an
// instruction — a clinician scanning for three seconds could not tell what to
// DO with the number. Each tile now says what the number means.
const RISK_TIERS = [
  { key: 'crisis',   label: 'Crisis',    hint: 'Immediate action',  color: 'var(--alert)' },
  { key: 'high',     label: 'High Risk', hint: 'Review today',      color: 'var(--risk-high-color)' },
  { key: 'moderate', label: 'Moderate',  hint: 'Watch this week',   color: 'var(--risk-mod-color)' },
  { key: 'low',      label: 'Stable',    hint: 'Routine follow-up', color: 'var(--risk-low-color)' },
]

const SEVERITY_COLOR = {
  crisis:   'var(--alert)',
  high:     'var(--risk-high-color)',
  moderate: 'var(--warning)',
  low:      'var(--risk-low-color)',
}

const FILTERS = [
  { key: 'all',      label: 'All patients' },
  { key: 'priority', label: 'Needs attention' },   // crisis + high
  { key: 'moderate', label: 'Moderate' },
  { key: 'low',      label: 'Stable' },
]

const recencyOf = (p) =>
  new Date(p.updatedAt || p.lastCheckIn || p.lastActive || 0).getTime()

/**
 * CRITICAL: `riskScore` is NOT severity.
 *
 * `ai-service/routers/predict.py:138` returns `risk_proba.max()` — the model's
 * CONFIDENCE in whichever class it chose — while `riskLevel` is the argmax class
 * itself. So "0.80 / moderate" means *80% sure this patient is moderate*, and
 * "0.58 / high" means *58% sure this patient is high*. The second patient is
 * sicker despite the smaller number.
 *
 * Ranking the caseload by `riskScore` therefore sorts by model confidence, not by
 * how ill anyone is — and it renders an 80% bar in moderate-orange next to a 58%
 * bar in high-red, which looks broken because it IS wrong.
 *
 * Severity here is the band ordinal first, confidence only as a within-band
 * tiebreak. That keeps bands visually separated and monotonic.
 */
const LEVEL_ORDINAL = { low: 0, moderate: 1, high: 2, crisis: 3 }

const bandOf = (p) => (p.riskLevel && LEVEL_ORDINAL[p.riskLevel] !== undefined)
  ? p.riskLevel
  : 'low'

const severityOf = (p) => {
  const ordinal    = LEVEL_ORDINAL[bandOf(p)]
  const confidence = Math.min(Math.max(p.riskScore || 0, 0), 1)
  return (ordinal + confidence) / 4
}

/**
 * Severity distribution — every assigned patient as one horizontal bar, tallest
 * first. The point is pre-attentive triage: the clinician sees the shape of the
 * caseload and the worst patient in the same glance, without reading a single
 * name. Bars are labelled and carry a numeric score, so the chart is not
 * colour-dependent.
 */
function SeverityChart({ patients, onSelect }) {
  if (!patients.length) return null

  const ranked = [...patients]
    .sort((a, b) => severityOf(b) - severityOf(a))
    .slice(0, 12)

  return (
    <div className="card" style={{ marginBottom: 'var(--sp-xl)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--sp-lg)' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--charcoal)' }}>
            Caseload Severity
          </h2>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Every patient by predicted severity — most severe first
          </div>
        </div>
        <span className="mono muted" style={{ fontSize: 11 }}>
          {ranked.length} of {patients.length} shown
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ranked.map((p, i) => {
          const level      = bandOf(p)
          const severity   = severityOf(p)
          const confidence = Math.min(Math.max(p.riskScore || 0, 0), 1)
          const tierName   = RISK_TIERS.find(t => t.key === level)?.label || 'Stable'
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className={`severity-row fade-in stagger-${Math.min(i + 1, 4)}`}
              aria-label={`${p.name || 'Unknown'} — ${tierName}, model ${(confidence * 100).toFixed(0)} percent confident`}
              title={`${tierName} · model ${(confidence * 100).toFixed(0)}% confident`}
            >
              <span className="severity-name">{p.name || 'Unknown'}</span>
              <span className="severity-track">
                <span
                  className="severity-fill"
                  style={{ width: `${Math.max(severity * 100, 4)}%`, background: SEVERITY_COLOR[level] }}
                />
              </span>
              {/* The BAND is the clinical fact; confidence is secondary and
                  labelled as such, so the two are never read as one number. */}
              <span className="severity-meta">
                <span className="severity-band" style={{ color: SEVERITY_COLOR[level] }}>{tierName}</span>
                <span className="mono severity-conf">{(confidence * 100).toFixed(0)}% conf.</span>
              </span>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-lg)', marginTop: 'var(--sp-lg)', paddingTop: 'var(--sp-md)', borderTop: '1px solid var(--rose-light)', flexWrap: 'wrap' }}>
        {RISK_TIERS.map(t => (
          <span key={t.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--warm-gray)' }}>
            <span className={`risk-dot ${t.key}`} />
            {t.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { clinician, logout } = useAuth()
  const nav = useNavigate()
  const { patients, loading } = usePatients(clinician?.uid)
  const { alerts }            = useAlerts(clinician?.uid)

  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('risk')   // 'risk' | 'recent'

  const riskCounts = useMemo(() => patients.reduce((acc, p) => {
    const lvl = bandOf(p)
    acc[lvl] = (acc[lvl] || 0) + 1
    return acc
  }, {}), [patients])

  const visible = useMemo(() => {
    const matches = (p) => {
      const lvl = bandOf(p)
      if (filter === 'all')      return true
      if (filter === 'priority') return lvl === 'crisis' || lvl === 'high'
      return lvl === filter
    }
    // Same severity ordering as the chart — the list and the chart must never
    // disagree about who is worst.
    return patients.filter(matches).sort((a, b) =>
      sortBy === 'recent'
        ? recencyOf(b) - recencyOf(a)
        : severityOf(b) - severityOf(a)
    )
  }, [patients, filter, sortBy])

  const unresolvedCount = alerts.filter(a => !a.resolved).length
  const priorityCount   = (riskCounts.crisis || 0) + (riskCounts.high || 0)

  return (
    <div className="dashboard-layout">
      <Sidebar
        active="patients"
        alertCount={unresolvedCount}
        clinicianName={clinician?.name || clinician?.email}
        onLogout={logout}
      />

      <main className="main-content">
        <CrisisBanner alerts={alerts} onView={() => nav('/alerts')} />

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 'var(--sp-xl)' }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>Patients</h1>
            <div className="muted" style={{ fontSize: 13 }}>
              {priorityCount > 0
                ? `${priorityCount} ${priorityCount === 1 ? 'patient needs' : 'patients need'} attention today`
                : 'No patients above the moderate threshold'}
            </div>
          </div>
          <span className="live-indicator">Live · Firestore onSnapshot</span>
        </div>

        {/* ── 1. How many need me ── */}
        <div className="risk-tile-grid">
          {RISK_TIERS.map((tier, i) => (
            <div key={tier.key} className={`stat-tile risk-tile ${tier.key} fade-in stagger-${i + 1}`}>
              <div className="stat-number" style={{ color: tier.color }}>
                {riskCounts[tier.key] || 0}
              </div>
              <div className="risk-tile-label">{tier.label}</div>
              <div className="risk-tile-hint">{tier.hint}</div>
            </div>
          ))}
        </div>

        {/* ── 2. Who is worst ── */}
        {!loading && (
          <SeverityChart
            patients={patients}
            onSelect={(p) => nav(`/patient/${p.uid || p.id}`)}
          />
        )}

        {/* ── 3. Narrow it down ── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="list-toolbar">
            <div className="filter-chips" role="group" aria-label="Filter patients by risk">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  className={`chip${filter === f.key ? ' active' : ''}`}
                  onClick={() => setFilter(f.key)}
                  aria-pressed={filter === f.key}
                >
                  {f.label}
                  {f.key === 'priority' && priorityCount > 0 && (
                    <span className="chip-count">{priorityCount}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="filter-chips" role="group" aria-label="Sort patients">
              <span className="muted" style={{ fontSize: 11.5, marginRight: 4 }}>Sort</span>
              <button
                className={`chip${sortBy === 'risk' ? ' active' : ''}`}
                onClick={() => setSortBy('risk')}
                aria-pressed={sortBy === 'risk'}
              >
                Highest risk
              </button>
              <button
                className={`chip${sortBy === 'recent' ? ' active' : ''}`}
                onClick={() => setSortBy('recent')}
                aria-pressed={sortBy === 'recent'}
              >
                Most recent
              </button>
            </div>
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
          ) : visible.length === 0 ? (
            <div role="status" style={{ padding: 'var(--sp-xxl)', textAlign: 'center', color: 'var(--warm-gray)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--charcoal)', marginBottom: 6 }}>
                No patients in this band
              </div>
              <div style={{ fontSize: 12 }}>
                Nobody is currently at this risk level — try “All patients”.
              </div>
            </div>
          ) : (
            visible.map(p => <PatientCard key={p.id} patient={p} />)
          )}
        </div>
      </main>
    </div>
  )
}
