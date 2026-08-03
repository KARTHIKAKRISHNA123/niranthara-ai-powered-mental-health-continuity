// dashboard/src/pages/PatientDetail.jsx
// Full NLP signals + 30-day charts + SHAP factors + LLM narrative + PDF export
// RTCFR: no emojis, no prompt()/alert(), Flag modal via React state, icon buttons

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { RiskBadge } from '../components/components'
import RecoveryPanel from '../components/RecoveryPanel'
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
  const [assessments, setAssessments] = useState([])
  const [summary,   setSummary]   = useState('')
  const [summaryModel, setSummaryModel] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
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

        try {
          // PHQ-9 / GAD-7 history — same client-side filter approach
          const assessSnap = await getDocs(query(collection(db, 'assessments'), where('uid', '==', uid)))
          const items = assessSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          setAssessments(items)
        } catch (e) {
          console.warn('Could not load assessments', e)
        }
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [uid])

  const fetchSummary = async () => {
    setSummaryLoading(true)
    try {
      const token = await import('firebase/auth').then(m => m.getAuth().currentUser?.getIdToken())
      const r = await fetch(`${API}/api/clinician/summary/${uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!r.ok) {
        setSummary(`Summary request rejected (HTTP ${r.status}). ${r.status === 403 ? 'This patient is not assigned to you.' : 'Check the backend logs.'}`)
        return
      }
      const d = await r.json()
      setSummary(d.summary || '')
      setSummaryModel(d.modelUsed || '')
    } catch {
      // A fetch() that throws means the BACKEND was unreachable — the AI
      // service is a hop further in and cannot be the thing we just failed to
      // reach. The old copy blamed the AI service and sent debugging the wrong
      // way while the actual cause was `node index.js` not running.
      setSummary(`Could not reach the Niranthara backend at ${API}. Start it with "node index.js" in backend/, then try again.`)
    } finally {
      setSummaryLoading(false)
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

  // ── Clinical report ─────────────────────────────────────────────────────────
  // The previous export wrote at fixed Y offsets (75, 85, 110, 120+i*10), so a
  // summary longer than ~two lines ran straight through the risk-factor block
  // and off the page. This lays out with a running cursor, paginates, and
  // follows the app palette from Build_Guide §40.
  const exportPDF = () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const PAGE_W = 210, PAGE_H = 297
    const M = 18                      // margin
    const W = PAGE_W - M * 2          // content width
    const INK    = [44, 40, 38]       // charcoal
    const MUTED  = [138, 128, 118]    // warm gray
    const ROSE   = [201, 123, 132]
    const ROSE_D = [139, 74, 82]
    const CREAM  = [251, 247, 242]
    const RISK_RGB = {
      low:      [123, 166, 138],
      moderate: [240, 168, 48],
      high:     [232, 99, 74],
      crisis:   [155, 42, 21],
    }

    let y = 0
    let page = 1

    const need = (h) => {
      if (y + h > PAGE_H - 22) { footer(); pdf.addPage(); page += 1; y = M }
    }
    const footer = () => {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(...MUTED)
      pdf.text(
        'Niranthara — clinical decision support. Generated from structured signals; not a diagnosis. Journal and chat text are never included.',
        M, PAGE_H - 12, { maxWidth: W }
      )
      pdf.text(`Page ${page}`, PAGE_W - M, PAGE_H - 12, { align: 'right' })
    }
    const heading = (text) => {
      need(14)
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(...ROSE_D)
      pdf.text(text.toUpperCase(), M, y)
      y += 2
      pdf.setDrawColor(...ROSE); pdf.setLineWidth(0.4)
      pdf.line(M, y, M + W, y)
      y += 6
    }
    const body = (text, size = 9.5, color = INK) => {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size); pdf.setTextColor(...color)
      const lines = pdf.splitTextToSize(text, W)
      lines.forEach((ln) => { need(6); pdf.text(ln, M, y); y += size * 0.5 + 1.2 })
    }

    // ── Header band ──
    pdf.setFillColor(...ROSE_D); pdf.rect(0, 0, PAGE_W, 34, 'F')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(19); pdf.setTextColor(255, 255, 255)
    pdf.text('Niranthara', M, 15)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(242, 217, 220)
    pdf.text('Continuity of Care — Patient Report', M, 22)
    pdf.setFontSize(8)
    pdf.text(
      `Generated ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`,
      PAGE_W - M, 22, { align: 'right' }
    )
    y = 46

    // ── Patient identity + risk chip ──
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor(...INK)
    pdf.text(patient?.name || uid, M, y)

    const lvl = (patient?.riskLevel || 'low').toLowerCase()
    const rgb = RISK_RGB[lvl] || RISK_RGB.low
    const chip = `${lvl.toUpperCase()}  ${((patient?.riskScore || 0) * 100).toFixed(0)}%`
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
    const chipW = pdf.getTextWidth(chip) + 10
    pdf.setFillColor(...rgb)
    pdf.roundedRect(PAGE_W - M - chipW, y - 6, chipW, 9, 2, 2, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.text(chip, PAGE_W - M - chipW / 2, y, { align: 'center' })
    y += 7

    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...MUTED)
    const meta = [
      patient?.age ? `${patient.age}y` : null,
      patient?.personaType ? `profile: ${patient.personaType}` : null,
      patient?.conditions?.length ? patient.conditions.join(', ') : null,
      `XGBoost risk score · ${moodLogs.length} check-ins in 30 days`,
    ].filter(Boolean).join('   ·   ')
    pdf.text(meta, M, y)
    y += 12

    // ── Key metrics strip ──
    const last = moodLogs[moodLogs.length - 1]
    const avg = (f) => moodLogs.length
      ? (moodLogs.reduce((s, l) => s + (f(l) || 0), 0) / moodLogs.length)
      : null
    const tiles = [
      { k: 'Avg mood',   v: avg(l => l.moodScore)  != null ? `${avg(l => l.moodScore).toFixed(1)}/5` : '—' },
      { k: 'Avg sleep',  v: avg(l => l.sleepHours) != null ? `${avg(l => l.sleepHours).toFixed(1)}h` : '—' },
      { k: 'PHQ-9',      v: phq9 ? `${phq9.score}/${phq9.maxScore}` : '—' },
      { k: 'GAD-7',      v: gad7 ? `${gad7.score}/${gad7.maxScore}` : '—' },
      { k: 'Suppression',v: last?.moodSentimentDivergence != null ? last.moodSentimentDivergence.toFixed(2) : '—' },
    ]
    need(24)
    const tw = W / tiles.length
    tiles.forEach((t, i) => {
      const x = M + i * tw
      pdf.setFillColor(...CREAM); pdf.roundedRect(x + 1, y, tw - 2, 18, 2, 2, 'F')
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(...INK)
      pdf.text(String(t.v), x + tw / 2, y + 8, { align: 'center' })
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...MUTED)
      pdf.text(t.k, x + tw / 2, y + 13.5, { align: 'center' })
    })
    y += 26

    // ── AI clinical summary ──
    heading('AI clinical summary')
    if (summary) {
      body(summary, 9.5)
      y += 2
      body(
        `Model: ${summaryModel ? summaryModel.replace(/^nvidia-/, '') : 'NVIDIA model chain'} · generated from structured 30-day aggregates only.`,
        7.5, MUTED
      )
    } else {
      body('Not generated. Open the patient record and select "Generate Summary" before exporting.', 9.5, MUTED)
    }
    y += 8

    // ── SHAP factors ──
    heading('Top risk factors (SHAP)')
    if (shap.length) {
      shap.forEach((f, i) => {
        need(8)
        pdf.setFillColor(...(i === 0 ? RISK_RGB.high : i === 1 ? RISK_RGB.moderate : ROSE))
        pdf.circle(M + 1.6, y - 1.4, 1.3, 'F')
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(...INK)
        pdf.text(String(f), M + 6, y, { maxWidth: W - 6 })
        y += 6.5
      })
      y += 1
      body('Ranked by SHAP contribution to the XGBoost risk score. Not keyword matching.', 7.5, MUTED)
    } else {
      body('No SHAP factors computed yet — requires at least one mood check-in.', 9.5, MUTED)
    }
    y += 8

    // ── Assessment history ──
    heading('Validated assessments')
    if (assessments.length) {
      assessments.slice(-8).reverse().forEach((a) => {
        need(6)
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...INK)
        const flag = a.selfHarmFlag ? '   [ITEM 9 FLAGGED]' : ''
        pdf.text(
          `${new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}    ${String(a.type).toUpperCase()}    ${a.score}/${a.maxScore}    ${a.severity}${flag}`,
          M, y
        )
        y += 5.6
      })
    } else {
      body('No PHQ-9 or GAD-7 recorded.', 9.5, MUTED)
    }
    y += 8

    // ── Recent check-ins ──
    heading('Recent check-ins')
    if (moodLogs.length) {
      need(7)
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...MUTED)
      pdf.text('DATE', M, y)
      pdf.text('MOOD', M + 42, y)
      pdf.text('SLEEP', M + 62, y)
      pdf.text('RISK', M + 84, y)
      pdf.text('EMOTION', M + 104, y)
      pdf.text('CRISIS P', M + 140, y)
      y += 4.5
      moodLogs.slice(-12).reverse().forEach((l) => {
        need(6)
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(...INK)
        pdf.text(new Date(l.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), M, y)
        pdf.text(`${l.moodScore ?? '—'}/5`, M + 42, y)
        pdf.text(l.sleepHours != null ? `${l.sleepHours}h` : '—', M + 62, y)
        pdf.text(`${((l.riskScore || 0) * 100).toFixed(0)}%`, M + 84, y)
        pdf.text(String(l.nlpResults?.emotionLabel || '—'), M + 104, y)
        pdf.text(`${((l.nlpResults?.crisisProbability || 0) * 100).toFixed(0)}%`, M + 140, y)
        y += 5.4
      })
    } else {
      body('No check-ins in the last 30 days. Loss of follow-up is itself a clinical signal.', 9.5, MUTED)
    }

    footer()
    const safeName = (patient?.name || uid).replace(/[^\w-]+/g, '_')
    pdf.save(`Niranthara_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const chartData = moodLogs.map(l => ({
    date:       new Date(l.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    mood:       l.moodScore || 0,
    risk:       Math.round((l.riskScore || 0) * 100),
    cycleVuln:  Math.round((l.cycleVulnerability || 0) * 100),
    sentiment:  Math.round((l.nlpResults?.sentimentScore || 0) * 100),
    crisisProb: Math.round((l.nlpResults?.crisisProbability || 0) * 100),
  }))

  if (loading) return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}
      aria-busy="true" aria-label="Loading patient">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="skeleton" style={{ width: 56, height: 56, borderRadius: '50%' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton" style={{ width: '30%', height: 18 }} />
          <div className="skeleton" style={{ width: '50%', height: 12 }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: 220, borderRadius: 'var(--r-md)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="skeleton" style={{ height: 140, borderRadius: 'var(--r-md)' }} />
        <div className="skeleton" style={{ height: 140, borderRadius: 'var(--r-md)' }} />
      </div>
    </div>
  )
  if (!patient) return <div role="status" style={{ padding: 40 }}>Patient not found</div>

  // users.topFactors is written on every mood log; fall back to the latest
  // mood log's factors for patients seeded before that write existed.
  const shap = patient.topFactors?.length
    ? patient.topFactors
    : (moodLogs[moodLogs.length - 1]?.topFactors || [])

  const latestAssessment = (type) => [...assessments].reverse().find(a => a.type === type)
  const phq9 = latestAssessment('phq9')
  const gad7 = latestAssessment('gad7')

  return (
    <div className="dashboard-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="Niranthara logo" style={{ width: 40, height: 'auto' }} />
          <div>Niranth<span>ara</span></div>
        </div>
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
                NLP classifier (sentinet/suicidality) — not keyword matching
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

          {/* Recovery + outcome loop. Deliberately placed directly under the
              risk chart: risk says who is deteriorating, this says whether
              anything we did about it worked. */}
          <RecoveryPanel uid={uid} />

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

          {/* AI clinical narrative — structured signals only, never raw journal text */}
          <div className="card">
            <div style={{ fontWeight: 500, marginBottom: 4 }}>AI Clinical Summary</div>
            {/* The model is a chain, not a fixed choice — label whichever tier
                actually answered rather than asserting Minimax every time. */}
            <div className="muted mono" style={{ fontSize: 10, marginBottom: 'var(--sp-lg)' }}>
              {summaryModel
                ? `${summaryModel.replace(/^nvidia-/, '')} · NVIDIA Cloud · from structured signals, not journal text`
                : 'NVIDIA model chain · from structured signals, not journal text'}
            </div>
            {summary ? (
              <>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--charcoal)', margin: 0 }}>{summary}</p>
                <button
                  className="btn-ghost"
                  onClick={fetchSummary}
                  disabled={summaryLoading}
                  style={{ marginTop: 'var(--sp-lg)', fontSize: 12 }}
                >
                  {summaryLoading ? 'Regenerating…' : 'Regenerate'}
                </button>
              </>
            ) : (
              <div>
                <p className="muted" style={{ marginBottom: 'var(--sp-lg)', fontSize: 13 }}>
                  The last 30 days — mood trend, risk trajectory, assessments and
                  alerts — condensed into five clinical sentences.
                </p>
                <button className="btn-primary" onClick={fetchSummary} disabled={summaryLoading}>
                  {summaryLoading ? 'Generating…' : 'Generate Summary'}
                </button>
              </div>
            )}
          </div>

          {/* Validated assessments: PHQ-9 / GAD-7 */}
          <div className="card" style={{ gridColumn: '1/-1' }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Validated Assessments</div>
            <div className="muted mono" style={{ fontSize: 10, marginBottom: 'var(--sp-lg)' }}>
              PHQ-9 (depression) · GAD-7 (anxiety) · self-administered in app
            </div>
            {assessments.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--sp-xl)', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
                  {[{ label: 'PHQ-9', a: phq9 }, { label: 'GAD-7', a: gad7 }].map(({ label, a }) => (
                    <div key={label} className="stat-tile" style={{ textAlign: 'center' }}>
                      <div className="stat-number" style={{ fontSize: 26 }}>
                        {a ? `${a.score}/${a.maxScore}` : '—'}
                      </div>
                      <div style={{ fontWeight: 500, fontSize: 12 }}>{label}</div>
                      <div className="muted mono" style={{ fontSize: 10, textTransform: 'capitalize' }}>
                        {a ? `${a.severity} · ${new Date(a.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}` : 'not yet taken'}
                      </div>
                      {a?.selfHarmFlag && (
                        <div style={{ fontSize: 10, color: 'var(--alert)', fontWeight: 500, marginTop: 4 }}>
                          Item 9 flagged — review
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={assessments.map(a => ({
                    date: new Date(a.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
                    phq9: a.type === 'phq9' ? a.score : null,
                    gad7: a.type === 'gad7' ? a.score : null,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2D9DC" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8A8076' }} />
                    <YAxis domain={[0, 27]} tick={{ fontSize: 11, fill: '#8A8076' }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #F2D9DC', fontFamily: 'DM Sans' }} />
                    <Legend />
                    <Line type="monotone" dataKey="phq9" name="PHQ-9" stroke="#C97B84" strokeWidth={2} connectNulls dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="gad7" name="GAD-7" stroke="#9B8EC4" strokeWidth={2} connectNulls dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>
                No assessments yet — the patient can take the PHQ-9 from the app home screen.
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
                  // Must match ai-service/routers/sentiment.py. IndicBERT was
                  // replaced because it had no trained classification head and
                  // returned a constant ~0.338 for every input.
                  sub: 'XLM-R sentiment'
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
                  sub: 'suicidality classifier'
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
