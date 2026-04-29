import { COLORS, FONTS, RADIUS } from './constants/theme';

const statCards = [
  { label: 'Patients', labelTa: 'நோயாளிகள்', value: '124', color: COLORS.primary },
  { label: 'Watch', labelTa: 'கண்காணிப்பு', value: '18', color: COLORS.lavender },
  { label: 'Alerts', labelTa: 'எச்சரிக்கைகள்', value: '5', color: COLORS.alert },
];

export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: COLORS.background,
      fontFamily: FONTS.body,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <h1 style={{
          fontFamily: FONTS.heading,
          fontSize: 56,
          fontWeight: 300,
          color: COLORS.roseDark,
          margin: 0,
          letterSpacing: 3,
        }}>
          Nirantara
        </h1>
        <p style={{
          fontFamily: FONTS.body,
          fontSize: 15,
          color: COLORS.muted,
          margin: '6px 0 0',
        }}>
          உங்கள் நோயாளிகளின் மன ஆரோக்கியம்
        </p>
        <p style={{
          fontFamily: FONTS.body,
          fontSize: 11,
          color: COLORS.muted,
          letterSpacing: 2,
          margin: '4px 0 0',
        }}>
          YOUR PATIENTS' MENTAL WELLBEING
        </p>
      </div>

      {/* Divider */}
      <div style={{ width: 48, height: 1, backgroundColor: COLORS.primary, opacity: 0.4, margin: '24px 0' }} />

      {/* Stat cards */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 40,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {statCards.map((card) => (
          <div key={card.label} style={{
            backgroundColor: '#F4EDE8',
            borderRadius: RADIUS.md,
            padding: '28px 36px',
            textAlign: 'center',
            minWidth: 140,
            border: `1px solid ${card.color}22`,
          }}>
            <div style={{
              fontFamily: FONTS.heading,
              fontSize: 48,
              fontWeight: 600,
              color: card.color,
              lineHeight: 1,
            }}>
              {card.value}
            </div>
            <div style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: COLORS.text,
              marginTop: 6,
              fontWeight: 500,
            }}>
              {card.label}
            </div>
            <div style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: COLORS.muted,
              marginTop: 2,
            }}>
              {card.labelTa}
            </div>
          </div>
        ))}
      </div>

      {/* Sign in button */}
      <button style={{
        backgroundColor: COLORS.roseDark,
        color: COLORS.warmWhite,
        fontFamily: FONTS.body,
        fontSize: 14,
        letterSpacing: 1.5,
        border: 'none',
        borderRadius: RADIUS.pill,
        padding: '14px 48px',
        cursor: 'pointer',
        textTransform: 'uppercase',
      }}>
        Sign In as Clinician
      </button>
      <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 8 }}>
        க்ளினிசியனாக உள்நுழைக
      </p>
    </div>
  );
}