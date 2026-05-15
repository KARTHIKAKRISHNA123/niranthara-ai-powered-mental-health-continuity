import { useState } from 'react';
import { COLORS, FONTS, RADIUS } from './constants/theme';
import PatientList from './pages/PatientList';

const navItems = [
  { key: 'patients', label: 'Patients'},
  { key: 'alerts',   label: 'Alerts' },
  { key: 'reports',  label: 'Reports' },
];

export default function App() {
  const [page, setPage] = useState('patients');
  const [signedIn, setSignedIn] = useState(false);

  if (!signedIn) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.background, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <h1 style={{ fontFamily: FONTS.heading, fontSize: 56, fontWeight: 300, color: COLORS.roseDark, margin: 0, letterSpacing: 3 }}>Nirantara</h1>
        
        <div style={{ background: '#F4EDE8', borderRadius: RADIUS.lg, padding: 32, width: '100%', maxWidth: 380 }}>
          <input placeholder="Clinician email" style={{ width: '100%', background: COLORS.background, border: `1px solid ${COLORS.primary}33`, borderRadius: RADIUS.sm, padding: 14, fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, marginBottom: 12, boxSizing: 'border-box' }} />
          <input type="password" placeholder="Password" style={{ width: '100%', background: COLORS.background, border: `1px solid ${COLORS.primary}33`, borderRadius: RADIUS.sm, padding: 14, fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, marginBottom: 20, boxSizing: 'border-box' }} />
          <button onClick={() => setSignedIn(true)} style={{ width: '100%', background: COLORS.roseDark, color: COLORS.warmWhite, border: 'none', borderRadius: RADIUS.pill, padding: 14, fontFamily: FONTS.body, fontSize: 14, letterSpacing: 1, cursor: 'pointer' }}>
            Sign in 
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.background, display: 'flex' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: '#F4EDE8', padding: '32px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontFamily: FONTS.heading, fontSize: 28, color: COLORS.roseDark, letterSpacing: 2, marginBottom: 4 }}>Nirantara</div>
        <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, marginBottom: 32 }}>Clinician portal</div>
        {navItems.map(n => (
          <button key={n.key} onClick={() => setPage(n.key)} style={{ background: page === n.key ? COLORS.primary + '22' : 'transparent', border: 'none', borderRadius: RADIUS.md, padding: '10px 14px', textAlign: 'left', cursor: 'pointer', marginBottom: 4 }}>
            <div style={{ fontFamily: FONTS.body, fontSize: 14, color: page === n.key ? COLORS.roseDark : COLORS.text, fontWeight: page === n.key ? 500 : 400 }}>{n.label}</div>
            <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted }}>{n.labelTa}</div>
          </button>
        ))}
      </div>
      {/* Main */}
      <div style={{ flex: 1 }}>
        {page === 'patients' && <PatientList />}
        {page === 'alerts' && <div style={{ padding: 32, fontFamily: FONTS.body, color: COLORS.muted }}>Alerts page </div>}
        {page === 'reports' && <div style={{ padding: 32, fontFamily: FONTS.body, color: COLORS.muted }}>Reports page </div>}
      </div>
    </div>
  );
}