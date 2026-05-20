// src/theme/theme.js — Design System per Build_Guide §22
export const COLORS = {
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
};

export const FONTS = {
  display: 'CormorantGaramond_400Regular',
  body:    'DMSans_400Regular',
  medium:  'DMSans_500Medium',
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

// Legacy theme object — kept for backward compatibility with existing screens
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
