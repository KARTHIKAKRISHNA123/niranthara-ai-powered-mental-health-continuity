import { COLORS, FONTS, RADIUS } from '../constants/theme';

const patients = [
  { id: 1, name: 'Kavitha R.', risk: 0.82, level: 'crisis', lastSeen: '2h ago', signal: 'Crisis prob: 0.87' },
  { id: 2, name: 'Priya M.', risk: 0.65, level: 'high', lastSeen: '4h ago', signal: 'Sleep: 4.1h' },
  { id: 3, name: 'Anitha S.', risk: 0.41, level: 'moderate', lastSeen: '1d ago', signal: 'Cycle day 22' },
  { id: 4, name: 'Meena L.', risk: 0.18, level: 'low', lastSeen: '2d ago', signal: 'Stable' },
];

const levelColors = { crisis: COLORS.alert, high: COLORS.primary, moderate: COLORS.lavender, low: COLORS.sage };

export default function PatientList({ onSelect }) {
  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ fontFamily: FONTS.heading, fontSize: 36, color: COLORS.roseDark, margin: 0 }}>Patient List</h2>
      <p style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.muted, margin: '4px 0 24px' }}>
        Sorted by XGBoost risk score
      </p>
      {patients.map(p => (
        <div
          key={p.id}
          onClick={() => onSelect && onSelect(p)}
          style={{
            background: '#F4EDE8', borderRadius: RADIUS.md, padding: '16px 20px',
            marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', borderLeft: `4px solid ${levelColors[p.level]}`,
          }}
        >
          <div>
            <div style={{ fontFamily: FONTS.body, fontSize: 16, color: COLORS.text, fontWeight: 500 }}>{p.name}</div>
            <div style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.muted }}>{p.signal} · {p.lastSeen}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: 28, color: levelColors[p.level] }}>{Math.round(p.risk * 100)}</div>
            <div style={{ fontFamily: FONTS.body, fontSize: 11, color: levelColors[p.level], letterSpacing: 1 }}>{p.level.toUpperCase()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}