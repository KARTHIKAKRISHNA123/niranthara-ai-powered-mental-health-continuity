// src/theme/theme.js — Niranthara Design System v2
// RTCFR: warm cream background, rose accent, DM Sans body, Cormorant Garamond display
// Never pure white. Never sharp corners. Generous whitespace. Calm motion.

export const COLORS = {
  // Brand palette — §40 Build_Guide
  rose:           '#C97B84',
  roseLight:      '#F2D9DC',
  roseDark:       '#8B4A52',
  lavender:       '#9B8EC4',
  lavenderLight:  '#E8E4F4',
  lavenderDark:   '#5C4F8A',
  sage:           '#7BA68A',
  sageLight:      '#D6EAD9',
  sageDark:       '#3D6B4A',
  cream:          '#FBF7F2',
  warmWhite:      '#FEFCFA',
  charcoal:       '#2C2826',
  warmGray:       '#8A8076',
  softGray:       '#C8C0B8',
  alert:          '#E8634A',
  warning:        '#F0A830',

  // Semantic surfaces
  cardBorder:     'rgba(44,40,38,0.07)',
  divider:        'rgba(44,40,38,0.08)',
  pressedOverlay: 'rgba(44,40,38,0.05)',
};

export const FONTS = {
  display:     'CormorantGaramond_400Regular',
  displayMed:  'CormorantGaramond_500Medium',
  body:        'DMSans_400Regular',
  medium:      'DMSans_500Medium',
  semibold:    'DMSans_600SemiBold',
  // DM Mono: technical labels, scores, timestamps
  // Falls back to body if not loaded
  mono:        'DMSans_400Regular',
};

export const SPACING = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  xxxl: 48,
};

export const RADIUS = {
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  pill: 999,
};

// Risk level → visual identity (color + bg)
export const RISK_STYLES = {
  low:      { color: '#3D6B4A', bg: '#D6EAD9', border: '#7BA68A' },
  moderate: { color: '#8B5E1A', bg: '#FDF3E3', border: '#F0A830' },
  high:     { color: '#9B2A15', bg: '#FDEAE6', border: '#E8634A' },
  crisis:   { color: '#FEFCFA', bg: '#2C2826', border: '#E8634A' },
};

// Shadow tokens — soft only, no heavy elevation
export const SHADOW = {
  sm: {
    shadowColor: '#2C2826',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#2C2826',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 4,
  },
};

// Legacy compat
export const theme = {
  colors: COLORS,
  spacing: SPACING,
  typography: {
    display:    FONTS.display,
    body:       FONTS.body,
    bodyMedium: FONTS.medium,
  },
  radius: RADIUS,
};
