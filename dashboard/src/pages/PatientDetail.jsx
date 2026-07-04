// dashboard/src/pages/PatientDetail.jsx
// Full NLP signals + 30-day charts + SHAP factors + Gemma narrative + PDF export
// RTCFR: no emojis, no prompt()/alert(), Flag modal via React state, icon buttons

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { RiskBadge } from '../components/components'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import jsPDF from 'jspdf'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// ─── Inline SVG icons ─────────────────────────────────────────────────────────
function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function IconFlag() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
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

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ─── Flag Modal ───────────────────────────────────────────────────────────────
function FlagModal({ patientName, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!reason.trim()) { setError('Please enter a clinical reason.'); return }
    setSubmitting(true)
    await onConfirm(reason.trim())
    setSubmitting(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="flag-modal-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(44,40,38,0.4)', backdropFilter: 'blur(4px)',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--warm-white)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--sp-xxl)',
        width: '100%',
        maxWidth: 440,
        boxShadow: '0 12px 40px rgba(44,40,38,0.18)',
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 id="flag-modal-title" style={{ margin: 0, fontSize: 18 }}>
            Flag Patient
          </h3>
          <button
            onClick={onClose}
            className="btn-icon"
            aria-label="Close"
            style={{ color: 'var(--warm-gray)' }}
          >
            <IconX />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.6 }}>
          This will notify your clinical supervisor and log a flag for{' '}
          <strong style={{ color: 'var(--charcoal)' }}>{patientName}</strong>.
          Please provide a clinical reason.
        </p>

        <div>
          <label htmlFor="flag-reason" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'var(--charcoal)' }}>
            Clinical reason
          </label>
          <textarea
            id="flag-reason"
            value={reason}
            onChange={e => { setReason(e.target.value); setError('') }}
            placeholder="e.g. Missed 3 check-ins, crisis probability elevated above 0.85…"
            rows={3}
            style={{
              width: '100%',
              resize: 'vertical',
              fontFamily: 'DM Sans',
              fontSize: 13,
              padding: '10px var(--sp-md)',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--rose-light)',
              background: 'var(--cream)',
              color: 'var(--charcoal)',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            autoFocus
          />
          {error && (
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--alert)' }}>{error}</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-md)', justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <IconFlag />
            {submitting ? 'Flagging…' : 'Flag patient'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Success Toast ────────────────────────────────────────────────────────────
function Toast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div style={{
      position: 'fixed', bottom: 32, right: 32, zIndex: 1100,
      background: 'var(--sage-dark, #3D6B4A)',
      color: 'white',
      borderRadius: 'var(--r-md)',
      padding: '12px 20px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 16px rgba(44,40,38,0.2)',
      fontSize: 14,
      fontFamily: 'DM Sans',
    }}
      role="status"
      aria-live="polite"
    >
      <IconCheck />
      {message}
    </div>
  )
}

// ─── PatientDetail ────────────────────────────────────────────────────────────
export default function PatientDetail() {
  const { uid } = useParams()
  const nav     = useNavigate()
  const { clinician } = useAuth()
  const [patient,   setPatient]   = useState(null)
  const [moodLogs,  setMoodLogs]  = useState([])
  const [summary,   setSummary]   = useState('')
  const [loading,   setLoading]   = useState(true)
  const [flagging,  setFlagging]  = useState(false)
  const [flagOpen,  setFlagOpen]  = useState(false)
  const [toast,     setToast]     = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30)
        
        // Fetch user first so it doesn't fail if logs fail
        const userSnap = await getDoc(doc(db, 'users', uid))
        if (userSnap.exists()) {
          setPatient({ id: uid, ...userSnap.data() })
        }

        try {
          // Fetch all user's mood logs and filter client-side to avoid Firebase composite index errors
          const moodSnap = await getDocs(query(collection(db, 'moodLogs'), where('uid', '==', uid)))
          const logs = moodSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(l => new Date(l.createdAt) >= thirtyAgo)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          setMoodLogs(logs)
        } catch (e) {
          console.warn('Could not load mood logs (index missing?)', e)
        }
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [uid])

  const fetchSummary = async () => {
    try {
      const token = await import('firebase/auth').then(m => m.getAuth().currentUser?.getIdToken())
      const r = await fetch(`${API}/api/clinician/summary/${uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const d = await r.json()
      setSummary(d.summary || '')
    } catch {
      setSummary('Summary generation failed — AI service may be offline')
    }
  }

  const handleFlag = async (reason) => {
    setFlagging(true)
    try {
      const token = await import('firebase/auth').then(m => m.getAuth().currentUser?.getIdToken())
      await fetch(`${API}/api/clinician/flag/${uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason })
      })
      setFlagOpen(false)
      setToast('Patient flagged and supervisor notified.')
    } catch {
      setFlagOpen(false)
      setToast('Flag request failed — check network connection.')
    } finally {
      setFlagging(false)
    }
  }

  const exportPDF = () => {
    const pdf = new jsPDF()
    pdf.setFont('helvetica')
    pdf.setFontSize(20)
    pdf.text('Niranthara — Patient Report', 20, 25)
    pdf.setFontSize(12)
    pdf.text(`Patient: ${patient?.name || uid}`, 20, 40)
    pdf.text(`Risk Level: ${patient?.riskLevel || 'unknown'} (${((patient?.riskScore || 0) * 100).toFixed(0)}%)`, 20, 50)
    pdf.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 20, 60)
    if (summary) {
      pdf.setFontSize(11)
      pdf.text('AI Summary:', 20, 75)
      pdf.text(pdf.splitTextToSize(summary, 170), 20, 85)
    }
    if (patient?.topFactors?.length) {
      pdf.text('Top Risk Factors:', 20, 110)
      patient.topFactors.forEach((f, i) => pdf.text(`• ${f}`, 25, 120 + i * 10))
    }
    pdf.save(`Niranthara_${(patient?.name || uid).replace(/\s/g, '_')}_report.pdf`)
  }

  const chartData = moodLogs.map(l => ({
    date:       new Date(l.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    mood:       l.moodScore || 0,
    risk:       Math.round((l.riskScore || 0) * 100),
    cycleVuln:  Math.round((l.cycleVulnerability || 0) * 100),
    sentiment:  Math.round((l.nlpResults?.sentimentScore || 0) * 100),
    crisisProb: Math.round((l.nlpResults?.crisisProbability || 0) * 100),
  }))

  if (loading) return <div style={{ padding: 40, color: 'var(--warm-gray)' }}>Loading patient…</div>
  if (!patient) return <div style={{ padding: 40 }}>Patient not found</div>

  const shap = patient.topFactors || []

  return (
    <div className="dashboard-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="logo">Niranth<span>ara</span></div>
        <button
          onClick={() => nav('/dashboard')}
          className="nav-item"
          style={{ marginBottom: 'var(--sp-lg)', width: '100%', gap: 8 }}
        >
          <IconArrowLeft />
          Back to Patients
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setFlagOpen(true)}
          disabled={flagging}
          className="btn-ghost"
          style={{ width: '100%', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <IconFlag />
          Flag Patient
        </button>
        <button
          onClick={exportPDF}
          className="btn-primary"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <IconDownload />
          Export PDF
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        {/* Patient header card */}
        <div className="card fade-in" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xl)', marginBottom: 'var(--sp-xl)' }}>
          <div className="patient-avatar" style={{ width: 56, height: 56, fontSize: 24, flexShrink: 0 }}>
            {(patient.name || 'U')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ marginBottom: 4 }}>{patient.name || 'Unknown'}</h2>
            <div className="muted">
              {patient.conditions?.join(', ') || 'No conditions listed'} · Persona: {patient.personaType || 'general'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <RiskBadge level={patient.riskLevel} score={patient.riskScore} />
            <div className="muted mono" style={{ marginTop: 4, fontSize: 10 }}>XGBoost risk score</div>
          </div>
        </div>

        {/* Crisis banner — no emoji */}
        {patient.riskLevel === 'crisis' && (
          <div className="crisis-banner" style={{ marginBottom: 'var(--sp-xl)' }} role="alert">
            <IconAlertTriangle size={22} />
            <div>
              <strong>Crisis probability above threshold</strong>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                NLP classifier (mental-roberta) — not keyword matching
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-xl)' }}>
          {/* 30-day Risk + Vulnerability chart */}
          <div className="card" style={{ gridColumn: '1/-1' }}>
            <div className="section-header" style={{ marginBottom: 'var(--sp-lg)' }}>
              <span style={{ fontWeight: 500 }}>30-Day Risk Trajectory</span>
              <span className="mono muted">+ Cycle Vulnerability</span>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#C97B84" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#C97B84" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="vulnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#9B8EC4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#9B8EC4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2D9DC" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8A8076' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#8A8076' }} />
                  <Tooltip
                    formatter={(v, n) => [`${v}%`, n]}
                    contentStyle={{ borderRadius: 8, border: '1px solid #F2D9DC', fontFamily: 'DM Sans' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="risk"      name="Risk %"       stroke="#C97B84" fill="url(#riskGrad)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="cycleVuln" name="Cycle Vuln %"  stroke="#9B8EC4" fill="url(#vulnGrad)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="crisisProb" name="Crisis Prob %" stroke="#E8634A" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="muted" style={{ textAlign: 'center', padding: 'var(--sp-xxl)' }}>
                No mood data in last 30 days
              </div>
            )}
          </div>

          {/* SHAP top factors — upgraded to .shap-card classes */}
          <div className={`card shap-card ${patient.riskLevel || 'low'}`}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Top Risk Factors</div>
            <div className="shap-subtitle">Explained by SHAP — what drives the XGBoost risk score</div>
            {shap.length > 0 ? (
              <div className="shap-factors">
                {shap.map((f, i) => (
                  <div key={i} className="shap-factor-row">
                    <span
                      className="shap-factor-dot"
                      style={{ background: ['#E8634A', '#F0A830', '#C97B84'][i] || '#C8C0B8' }}
                    />
                    <span className="shap-factor-text">{f}</span>
                    <span className="shap-rank mono">{i + 1}</span>
                  </div>
                ))}
                <div className="shap-footer">
                  Powered by XGBoost · SHAP explainability · Not keyword-based
                </div>
              </div>
            ) : (
              <div className="muted">Run a mood check-in to compute SHAP factors</div>
            )}
          </div>

          {/* Gemma AI narrative */}
          <div className="card">
            <div style={{ fontWeight: 500, marginBottom: 'var(--sp-lg)' }}>AI Clinical Summary</div>
            <div className="muted mono" style={{ fontSize: 10, marginBottom: 'var(--sp-lg)' }}>Gemma 4B via Ollama</div>
            {summary ? (
              <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--charcoal)', margin: 0 }}>{summary}</p>
            ) : (
              <div>
                <p className="muted" style={{ marginBottom: 'var(--sp-lg)', fontSize: 13 }}>
                  Generate a Gemma 4B narrative summary of this patient's recent history
                </p>
                <button className="btn-primary" onClick={fetchSummary}>
                  Generate Summary
                </button>
              </div>
            )}
          </div>

          {/* NLP signals */}
          <div className="card" style={{ gridColumn: '1/-1' }}>
            <div style={{ fontWeight: 500, marginBottom: 'var(--sp-lg)' }}>Recent NLP Signals</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-lg)' }}>
              {[
                {
                  label: 'Last Sentiment',
                  value: moodLogs[moodLogs.length - 1]?.nlpResults?.sentimentLabel || '—',
                  sub: 'IndicBERT'
                },
                {
                  label: 'Last Emotion',
                  value: moodLogs[moodLogs.length - 1]?.nlpResults?.emotionLabel || '—',
                  sub: 'distilroberta'
                },
                {
                  label: 'Crisis Prob',
                  value: moodLogs[moodLogs.length - 1]?.nlpResults?.crisisProbability != null
                    ? `${(moodLogs[moodLogs.length - 1].nlpResults.crisisProbability * 100).toFixed(0)}%`
                    : '—',
                  sub: 'mental-roberta'
                },
                {
                  label: 'Suppression',
                  value: moodLogs[moodLogs.length - 1]?.moodSentimentDivergence != null
                    ? moodLogs[moodLogs.length - 1].moodSentimentDivergence.toFixed(2)
                    : '—',
                  sub: 'Mood–Sentiment Divergence'
                },
              ].map(({ label, value, sub }) => (
                <div key={label} className="stat-tile" style={{ textAlign: 'center' }}>
                  <div className="stat-number" style={{ fontSize: 28 }}>{value}</div>
                  <div style={{ fontWeight: 500, fontSize: 12 }}>{label}</div>
                  <div className="muted mono" style={{ fontSize: 10 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* ── Flag Modal ── */}
      {flagOpen && (
        <FlagModal
          patientName={patient.name || 'this patient'}
          onConfirm={handleFlag}
          onClose={() => setFlagOpen(false)}
        />
      )}

      {/* ── Success Toast ── */}
      {toast && (
        <Toast message={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
