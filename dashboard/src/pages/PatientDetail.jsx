// dashboard/src/pages/PatientDetail.jsx
// Full NLP signals + 30-day charts + SHAP factors + Gemma narrative + PDF export

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

export default function PatientDetail() {
  const { uid } = useParams()
  const nav     = useNavigate()
  const { clinician } = useAuth()
  const [patient,   setPatient]   = useState(null)
  const [moodLogs,  setMoodLogs]  = useState([])
  const [summary,   setSummary]   = useState('')
  const [loading,   setLoading]   = useState(true)
  const [flagging,  setFlagging]  = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30)
        const [userSnap, moodSnap] = await Promise.all([
          getDoc(doc(db, 'users', uid)),
          getDocs(query(collection(db, 'moodLogs'), where('uid','==',uid), where('createdAt','>=',thirtyAgo.toISOString()), orderBy('createdAt','asc')))
        ])
        if (userSnap.exists()) setPatient({ id: uid, ...userSnap.data() })
        setMoodLogs(moodSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [uid])

  const fetchSummary = async () => {
    try {
      const token = await import('firebase/auth').then(m => m.getAuth().currentUser?.getIdToken())
      const r = await fetch(`${API}/api/clinician/summary/${uid}`, { headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      setSummary(d.summary || '')
    } catch { setSummary('Summary generation failed — AI service may be offline') }
  }

  const flagPatient = async () => {
    const reason = prompt('Flag reason:'); if (!reason) return
    setFlagging(true)
    try {
      const token = await import('firebase/auth').then(m => m.getAuth().currentUser?.getIdToken())
      await fetch(`${API}/api/clinician/flag/${uid}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ reason }) })
      alert('Patient flagged successfully')
    } catch { alert('Flag failed') } finally { setFlagging(false) }
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
    if (summary) { pdf.setFontSize(11); pdf.text('AI Summary:', 20, 75); pdf.text(pdf.splitTextToSize(summary, 170), 20, 85) }
    if (patient?.topFactors?.length) { pdf.text('Top Risk Factors:', 20, 110); patient.topFactors.forEach((f, i) => pdf.text(`• ${f}`, 25, 120 + i * 10)) }
    pdf.save(`Niranthara_${(patient?.name || uid).replace(/\s/g,'_')}_report.pdf`)
  }

  const chartData = moodLogs.map(l => ({
    date:             new Date(l.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    mood:             l.moodScore || 0,
    risk:             Math.round((l.riskScore || 0) * 100),
    cycleVuln:        Math.round((l.cycleVulnerability || 0) * 100),
    sentiment:        Math.round((l.nlpResults?.sentimentScore || 0) * 100),
    crisisProb:       Math.round((l.nlpResults?.crisisProbability || 0) * 100),
  }))

  if (loading) return <div style={{ padding: 40, color: 'var(--warm-gray)' }}>Loading patient…</div>
  if (!patient) return <div style={{ padding: 40 }}>Patient not found</div>

  const shap = patient.topFactors || []

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="logo">Nirant<span>ara</span></div>
        <button onClick={() => nav('/dashboard')} className="btn-ghost" style={{ marginBottom: 'var(--sp-lg)', width: '100%', textAlign: 'left' }}>← Back</button>
        <div style={{ flex: 1 }} />
        <button onClick={flagPatient} disabled={flagging} className="btn-ghost" style={{ width: '100%', marginBottom: 8 }}>🚩 Flag Patient</button>
        <button onClick={exportPDF} className="btn-primary" style={{ width: '100%' }}>⬇ Export PDF</button>
      </aside>

      <main className="main-content">
        {/* Header */}
        <div className="card fade-in" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xl)', marginBottom: 'var(--sp-xl)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--rose-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--rose-dark)', flexShrink: 0 }}>
            {(patient.name || 'U')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ marginBottom: 4 }}>{patient.name || 'Unknown'}</h2>
            <div className="muted">{patient.conditions?.join(', ') || 'No conditions listed'} · Persona: {patient.personaType || 'general'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <RiskBadge level={patient.riskLevel} score={patient.riskScore} />
            <div className="muted" style={{ marginTop: 4 }}>XGBoost risk score</div>
          </div>
        </div>

        {/* Crisis banner */}
        {patient.riskLevel === 'crisis' && (
          <div className="crisis-banner" style={{ marginBottom: 'var(--sp-xl)' }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <strong>Crisis probability above threshold</strong>
              <div style={{ fontSize: 12, opacity: 0.9 }}>NLP classifier (mental-roberta) — not keyword matching</div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-xl)' }}>
          {/* 30-day Risk + Mood chart */}
          <div className="card" style={{ gridColumn: '1/-1' }}>
            <div style={{ fontWeight: 500, marginBottom: 'var(--sp-lg)' }}>30-Day Risk Trajectory + Cycle Vulnerability</div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#C97B84" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#C97B84" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="vulnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#9B8EC4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#9B8EC4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2D9DC" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8A8076' }} />
                  <YAxis domain={[0,100]} tick={{ fontSize: 11, fill: '#8A8076' }} />
                  <Tooltip formatter={(v, n) => [`${v}%`, n]} contentStyle={{ borderRadius: 8, border: '1px solid #F2D9DC', fontFamily: 'DM Sans' }} />
                  <Legend />
                  <Area type="monotone" dataKey="risk" name="Risk %" stroke="#C97B84" fill="url(#riskGrad)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="cycleVuln" name="Cycle Vuln %" stroke="#9B8EC4" fill="url(#vulnGrad)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="crisisProb" name="Crisis Prob %" stroke="#E8634A" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="muted" style={{ textAlign: 'center', padding: 'var(--sp-xxl)' }}>No mood data in last 30 days</div>}
          </div>

          {/* SHAP top factors */}
          <div className="card">
            <div style={{ fontWeight: 500, marginBottom: 'var(--sp-lg)' }}>Top Risk Factors (SHAP)</div>
            {shap.length > 0 ? shap.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', padding: '8px 0', borderBottom: i < shap.length-1 ? '1px solid var(--rose-light)' : 'none' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: ['#E8634A','#F0A830','#C97B84'][i] || '#C8C0B8', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i+1}</span>
                <span style={{ fontSize: 13 }}>{f}</span>
              </div>
            )) : <div className="muted">Run a mood check-in to compute SHAP factors</div>}
          </div>

          {/* Gemma AI narrative */}
          <div className="card">
            <div style={{ fontWeight: 500, marginBottom: 'var(--sp-lg)' }}>AI Clinical Summary (Gemma)</div>
            {summary ? (
              <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--charcoal)' }}>{summary}</p>
            ) : (
              <div>
                <p className="muted" style={{ marginBottom: 'var(--sp-lg)' }}>Generate a Gemma 4B narrative summary of this patient's recent history</p>
                <button className="btn-primary" onClick={fetchSummary}>Generate Summary</button>
              </div>
            )}
          </div>

          {/* NLP signals */}
          <div className="card" style={{ gridColumn: '1/-1' }}>
            <div style={{ fontWeight: 500, marginBottom: 'var(--sp-lg)' }}>Recent NLP Signals</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-lg)' }}>
              {[
                { label: 'Last Sentiment', value: moodLogs[moodLogs.length-1]?.nlpResults?.sentimentLabel || '—', sub: 'IndicBERT' },
                { label: 'Last Emotion',   value: moodLogs[moodLogs.length-1]?.nlpResults?.emotionLabel   || '—', sub: 'distilroberta' },
                { label: 'Crisis Prob',    value: moodLogs[moodLogs.length-1]?.nlpResults?.crisisProbability != null ? `${(moodLogs[moodLogs.length-1].nlpResults.crisisProbability * 100).toFixed(0)}%` : '—', sub: 'mental-roberta' },
                { label: 'Suppression',    value: moodLogs[moodLogs.length-1]?.moodSentimentDivergence != null ? (moodLogs[moodLogs.length-1].moodSentimentDivergence).toFixed(2) : '—', sub: 'Mood-Sentiment Divergence' },
              ].map(({ label, value, sub }) => (
                <div key={label} style={{ textAlign: 'center', padding: 'var(--sp-lg)', background: 'var(--cream)', borderRadius: 'var(--r-md)' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--rose-dark)', marginBottom: 4 }}>{value}</div>
                  <div style={{ fontWeight: 500, fontSize: 12 }}>{label}</div>
                  <div className="muted">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
