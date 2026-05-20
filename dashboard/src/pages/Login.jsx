// dashboard/src/pages/Login.jsx

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login }   = useAuth()
  const nav         = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(email, password)
      nav('/dashboard')
    } catch {
      setError('Invalid email or password. Ensure you have clinician access.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card fade-in" style={{ width: 400, maxWidth: '95vw' }}>
        <div className="logo" style={{ textAlign: 'center', marginBottom: 'var(--sp-xl)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src="/logo.png" alt="Niranthara Logo" style={{ width: 80, height: 'auto', marginBottom: 12 }} />
          <div>Niranth<span>ara</span></div>
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: 4, fontWeight: 300 }}>Clinician Dashboard</h2>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 'var(--sp-xxl)' }}>
          Sign in with your clinician account
        </p>
        {error && (
          <div style={{ background: '#FDEAE5', color: 'var(--alert)', padding: 'var(--sp-md)', borderRadius: 'var(--r-sm)', marginBottom: 'var(--sp-lg)', fontSize: 13 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="clinician@hospital.in" required autoComplete="email" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Password</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button id="login-btn" type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 'var(--sp-sm)' }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
