// dashboard/src/components/RecoveryPanel.jsx
//
// The clinician-facing half of the recovery loop.
//
// Every other panel on this page describes RISK. This one is the only place a
// clinician can see whether anything we did changed the illness — per
// intervention, with the evidence strength stated. It deliberately shows
// "insufficient evidence" rather than a number when n is small: a confident
// effect size from three observations is how digital health products lose
// clinical trust, and refusing to print one is the feature.

import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Colours come from the design-system tokens in index.css, never fresh hex —
// the risk semantics are already defined there and a second palette would drift.
const TRAJECTORY_STYLE = {
  remission:          { label: 'Remission',           color: 'var(--risk-low-color)',  bg: 'var(--risk-low-bg)' },
  treatment_response: { label: 'Treatment response',  color: 'var(--risk-low-color)',  bg: 'var(--risk-low-bg)' },
  improving:          { label: 'Improving',           color: 'var(--risk-low-color)',  bg: 'var(--risk-low-bg)' },
  plateau:            { label: 'Plateau',             color: 'var(--risk-mod-color)',  bg: 'var(--risk-mod-bg)' },
  deteriorating:      { label: 'Deteriorating',       color: 'var(--risk-high-color)', bg: 'var(--risk-high-bg)' },
  insufficient_data:  { label: 'Not enough data yet', color: 'var(--warm-gray)',       bg: 'var(--cream)' },
}

const CONFIDENCE_NOTE = {
  insufficient: 'Fewer than 4 measured outcomes — no effect reported.',
  low:          '4-7 measured outcomes — treat as a hint, not a finding.',
  moderate:     '8+ measured outcomes.',
}

function Stat({ label, value, sub, accent = 'var(--charcoal)' }) {
  return (
    <div style={{ flex: '1 1 120px', minWidth: 120 }}>
      <div className="muted mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 500, color: accent, lineHeight: 1.3 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  )
}

function Bar({ value }) {
  return (
    <div style={{ height: 6, background: 'var(--cream)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, value))}%`, height: '100%',
        background: 'var(--rose)', borderRadius: 3,
        transition: 'width 600ms cubic-bezier(0.22, 1, 0.36, 1)',
      }} />
    </div>
  )
}

/**
 * The recovery score, as a ring.
 *
 * A bare integer reads as an opinion; a ring reads as a measurement, and it is
 * the one number a judge will look at first. The caption is doing real work —
 * "not 100 minus risk" is the first question any clinician asks about a
 * composite score, so it is answered on the face of the component rather than
 * in a tooltip. An absent score renders an empty track and the backend's own
 * sentence: never a fabricated 50.
 */
function ScoreRing({ score, confidence, message }) {
  const R = 46
  const C = 2 * Math.PI * R
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-lg)', flex: '1 1 320px' }}>
      <svg width="112" height="112" viewBox="0 0 112 112" style={{ flexShrink: 0 }} role="img"
           aria-label={score == null ? 'Recovery score not available' : `Recovery score ${score} out of 100`}>
        <circle cx="56" cy="56" r={R} fill="none" stroke="var(--rose-light)" strokeWidth="9" />
        {score != null && (
          <circle
            cx="56" cy="56" r={R} fill="none" stroke="var(--rose)" strokeWidth="9"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
            transform="rotate(-90 56 56)"
            style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        )}
        <text x="56" y="53" textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 30, fontWeight: 500, fill: 'var(--rose-dark)', fontFamily: 'var(--font-body)' }}>
          {score != null ? score : '—'}
        </text>
        <text x="56" y="75" textAnchor="middle"
              style={{ fontSize: 9, fill: 'var(--warm-gray)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
          / 100
        </text>
      </svg>
      <div style={{ minWidth: 0 }}>
        <div className="muted mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Recovery score
        </div>
        <div style={{ fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
          {score != null
            ? <>confidence: <strong>{confidence}</strong></>
            : <span className="muted">{message}</span>}
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.55, maxWidth: 210 }}>
          Measured progress against this patient's own baseline — not 100 minus risk.
        </div>
      </div>
    </div>
  )
}

export default function RecoveryPanel({ uid }) {
  const [data, setData]   = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const token = await import('firebase/auth').then(m => m.getAuth().currentUser?.getIdToken())
        const r = await fetch(`${API}/api/recovery/${uid}`, { headers: { Authorization: `Bearer ${token}` } })
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Backend returned ${r.status}`)
        const d = await r.json()
        if (!cancelled) setData(d)
      } catch (e) {
        // A fetch that throws means the BACKEND is unreachable — the AI service
        // is a hop further in. Say which one actually failed.
        if (!cancelled) setError(
          e.message === 'Failed to fetch'
            ? `Backend unreachable at ${API} — is it running on port 5000?`
            : e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [uid])

  if (loading) return <div className="card" style={{ gridColumn: '1/-1' }}><div className="muted">Loading recovery data…</div></div>
  if (error)   return <div className="card" style={{ gridColumn: '1/-1' }}><div style={{ color: 'var(--rose-dark)', fontSize: 13 }}>{error}</div></div>
  if (!data)   return null

  const score  = data.recoveryScore || {}
  const traj   = data.trajectory || {}
  const eff    = data.effectiveness || {}
  const perType = eff.perType || []
  const residual = data.symptoms?.residual || []
  const active   = data.symptoms?.active || []
  const ts = TRAJECTORY_STYLE[traj.trajectory] || TRAJECTORY_STYLE.insufficient_data

  return (
    <>
      {/* ── Recovery score + trajectory ─────────────────────────────── */}
      <div className="card" style={{ gridColumn: '1/-1' }}>
        <div className="section-header" style={{ marginBottom: 'var(--sp-lg)' }}>
          <span style={{ fontWeight: 500 }}>Recovery</span>
          <span className="mono muted">measured progress, not predicted risk</span>
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-xl)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <ScoreRing score={score.score} confidence={score.confidence} message={score.message} />
          <Stat
            label="PHQ-9"
            value={traj.latestPhq9 != null ? traj.latestPhq9 : '—'}
            sub={traj.baselinePhq9 != null ? `from ${traj.baselinePhq9} at baseline` : 'no assessments yet'}
          />
          {/* Direction is a word, not a sign. A "-9% reduction" on a patient who
              got worse reads as improvement in a glance, which is the opposite
              of what happened. */}
          <Stat
            label="PHQ-9 change"
            value={traj.percentReduction != null ? `${Math.abs(traj.percentReduction)}%` : '—'}
            accent={traj.percentReduction == null ? 'var(--charcoal)'
                    : traj.percentReduction >= 0 ? 'var(--risk-low-color)' : 'var(--risk-high-color)'}
            sub={traj.percentReduction == null ? ''
                 : `${traj.percentReduction >= 0 ? 'reduction' : 'increase'}` +
                   (traj.slopePerWeek != null ? ` · ${traj.slopePerWeek > 0 ? '+' : ''}${traj.slopePerWeek}/week` : '')}
          />
          <div style={{ flex: '1 1 160px' }}>
            <div className="muted mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trajectory</div>
            <span style={{
              display: 'inline-block', marginTop: 6, padding: '4px 12px', borderRadius: 999,
              background: ts.bg, color: ts.color, fontSize: 12, fontWeight: 500,
            }}>{ts.label}</span>
            {traj.projectedRemissionWeeks != null && (
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                ~{traj.projectedRemissionWeeks} weeks to remission at current slope
              </div>
            )}
          </div>
        </div>

        {/* The clinical flag IS the problem statement, produced from data. */}
        {traj.clinicalFlag && (
          <div style={{
            marginTop: 'var(--sp-lg)', padding: 'var(--sp-lg)',
            borderRadius: 'var(--r-sm)', borderLeft: `3px solid ${ts.color}`,
            background: ts.bg, color: ts.color, fontSize: 13, lineHeight: 1.6,
          }}>
            <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.75, marginBottom: 4 }}>
              Clinical flag · derived from the PHQ-9 series
            </div>
            <strong>{traj.clinicalFlag}</strong>
          </div>
        )}

        {/* Components — a composite that hides its drivers is not usable. */}
        {score.components && Object.keys(score.components).length > 0 && (
          <div style={{ marginTop: 'var(--sp-xl)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-lg)' }}>
            {Object.entries(score.components).map(([key, c]) => (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ textTransform: 'capitalize' }}>{key}</span>
                  <span className="mono muted">{Math.round(c.value)}</span>
                </div>
                <Bar value={c.value} />
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{c.detail}</div>
              </div>
            ))}
          </div>
        )}
        {score.componentsMissing?.length > 0 && (
          <div className="muted" style={{ fontSize: 11, marginTop: 'var(--sp-lg)' }}>
            Not measurable yet: {score.componentsMissing.join(', ')} — weights renormalised over the
            components present, so a missing signal is never scored as zero.
          </div>
        )}
      </div>

      {/* ── Residual symptoms ───────────────────────────────────────── */}
      <div className="card">
        <div style={{ fontWeight: 500, marginBottom: 4 }}>
          {residual.length ? 'Residual Symptoms' : active.length ? 'Active Symptoms' : 'Symptom Detail'}
        </div>
        <div className="muted" style={{ fontSize: 11, marginBottom: 'var(--sp-lg)' }}>
          PHQ-9 items still scoring 2+ ("more than half the days") — the strongest
          predictor of relapse, and invisible to a total score alone.
        </div>
        {(residual.length || active.length) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(residual.length ? residual : active).map(r => (
              <div key={r.item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span className="mono muted" style={{ fontSize: 10, width: 22 }}>Q{r.item}</span>
                <span style={{ flex: 1 }}>{r.symptom}</span>
                <span className="mono" style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  background: r.severity === 3 ? 'var(--risk-high-bg)' : 'var(--risk-mod-bg)',
                  color:      r.severity === 3 ? 'var(--risk-high-color)' : 'var(--risk-mod-color)',
                }}>{r.severity}/3</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            {!data.symptoms
              ? 'No PHQ-9 on record yet.'
              : data.symptoms.itemsAvailable === false
                // Never render missing data as a negative finding — a total of 24
                // with "no items scoring 2+" is arithmetically impossible and
                // destroys trust in every other number on the page.
                ? <>Item-level answers were not recorded for this PHQ-9 (total {data.symptoms.totalScore}).
                    Residual-symptom detection needs the individual item scores.</>
                : 'No items scoring 2 or above.'}
          </div>
        )}
      </div>

      {/* ── Today's plan ────────────────────────────────────────────── */}
      <div className="card">
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Today's Recovery Plan</div>
        <div className="muted" style={{ fontSize: 11, marginBottom: 'var(--sp-lg)' }}>
          {data.plan.completed} of {data.plan.total} complete · generated from residual
          symptoms and measured intervention effect
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.plan.goals.map(g => (
            <div key={g.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                width: 14, height: 14, borderRadius: 4, marginTop: 2, flexShrink: 0,
                border: `1.5px solid ${g.done ? 'var(--sage-dark)' : 'var(--soft-gray)'}`,
                background: g.done ? 'var(--sage)' : 'transparent',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, textDecoration: g.done ? 'line-through' : 'none', opacity: g.done ? 0.6 : 1 }}>
                  {g.label}
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{g.rationale}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Intervention effectiveness ──────────────────────────────── */}
      <div className="card" style={{ gridColumn: '1/-1' }}>
        <div className="section-header" style={{ marginBottom: 'var(--sp-lg)' }}>
          <span style={{ fontWeight: 500 }}>Intervention Effectiveness</span>
          <span className="mono muted">
            {eff.measured || 0} measured · {eff.awaitingFollowUp || 0} awaiting follow-up
          </span>
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-xl)', flexWrap: 'wrap', marginBottom: 'var(--sp-xl)' }}>
          <Stat label="Delivered"      value={eff.delivered ?? 0} />
          <Stat label="Engagement"     value={eff.engagementRate != null ? `${eff.engagementRate}%` : '—'} sub="system-initiated only" />
          <Stat label="Mean mood Δ"    value={eff.meanMoodDelta != null ? (eff.meanMoodDelta > 0 ? `+${eff.meanMoodDelta}` : eff.meanMoodDelta) : '—'} sub="next check-in vs prior 3" />
          <Stat label="Self-initiated" value={eff.selfInitiated ?? 0} sub="opened without a prompt" />
        </div>

        {perType.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--rose-light)' }}>
                  {['Intervention', 'n', 'Engaged', 'Observed Δ', 'Estimated effect', 'Evidence'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Intervention' ? 'left' : 'right', padding: '8px 10px', fontWeight: 500, fontSize: 11, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perType.map(t => (
                  <tr key={t.interventionType} style={{ borderBottom: '1px solid var(--cream)' }}>
                    <td style={{ padding: '10px', textTransform: 'capitalize' }}>{t.interventionType.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }} className="mono">{t.n}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }} className="mono">{t.engagementRate}%</td>
                    <td style={{ padding: '10px', textAlign: 'right' }} className="mono">{t.rawMoodDelta > 0 ? `+${t.rawMoodDelta}` : t.rawMoodDelta}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 500 }} className="mono">
                      {/* An estimate below the evidence threshold is not shown as
                          a number. This is the honesty rule, enforced in the UI. */}
                      {t.confidence === 'insufficient'
                        ? <span className="muted" style={{ fontWeight: 400 }}>not reported</span>
                        : (t.estimatedEffect > 0 ? `+${t.estimatedEffect}` : t.estimatedEffect)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <span title={CONFIDENCE_NOTE[t.confidence]} style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        background: t.confidence === 'moderate' ? 'var(--risk-low-bg)' : t.confidence === 'low' ? 'var(--risk-mod-bg)' : 'var(--cream)',
                        color:      t.confidence === 'moderate' ? 'var(--risk-low-color)' : t.confidence === 'low' ? 'var(--risk-mod-color)' : 'var(--warm-gray)',
                      }}>{t.confidence}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="muted" style={{ fontSize: 11, marginTop: 'var(--sp-lg)', lineHeight: 1.6 }}>
              Estimated effect is shrunk toward the population mean —
              (n·patient + 3·population) / (n + 3) — so a small number of lucky
              observations cannot crown a winner. Nothing is reported below n = 4.
            </div>
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 13 }}>
            No interventions have been paired with a follow-up check-in yet.
          </div>
        )}

        {/* What the loop will do next, and why. */}
        {data.adaptiveSelection?.recommended && (
          <div style={{ marginTop: 'var(--sp-xl)', padding: 'var(--sp-lg)', borderRadius: 8, background: 'var(--cream)', border: '1px solid var(--rose-light)' }}>
            <div className="muted mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              Next intervention · {data.adaptiveSelection.selectionMode}
            </div>
            <div style={{ fontSize: 13, textTransform: 'capitalize', fontWeight: 500 }}>
              {data.adaptiveSelection.recommended.replace(/_/g, ' ')}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
              {data.adaptiveSelection.rationale}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
