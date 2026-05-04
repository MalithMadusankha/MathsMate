// MathsMate Color System
// Adventure & Bold theme — Purple/Indigo base
// Supports Light and Dark mode

export const LightColors = {
  // Brand
  primary: '#6C3DD3',
  primaryLight: '#EDE9FF',
  primaryDark: '#4B23A8',

  // Accent
  secondary: '#F5A623',
  accent: '#00C9A7',

  // Backgrounds
  background: '#F4F0FF',
  surface: '#FFFFFF',
  surfaceElevated: '#EDE9FF',

  // Text
  textPrimary: '#1A0A3C',
  textSecondary: '#6B5E8C',
  textDisabled: '#B0A8CC',
  textOnPrimary: '#FFFFFF',

  // Feedback
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Game Specific
  reward: '#FFD700',
  cardBorder: '#DDD6FE',
  border: '#DDD6FE',

  // UI
  tabBar: '#FFFFFF',
  tabBarActive: '#6C3DD3',
  tabBarInactive: '#B0A8CC',
  shadow: '#6C3DD3',
} as const;

export const DarkColors = {
  // Brand
  primary: '#9B72F5',
  primaryLight: '#2D1B6E',
  primaryDark: '#6C3DD3',

  // Accent
  secondary: '#F5A623',
  accent: '#00E5BF',

  // Backgrounds
  background: '#12082E',
  surface: '#1E1040',
  surfaceElevated: '#2A1660',

  // Text
  textPrimary: '#F0EAFF',
  textSecondary: '#A992D4',
  textDisabled: '#5A4880',
  textOnPrimary: '#FFFFFF',

  // Feedback
  success: '#4ADE80',
  error: '#F87171',
  warning: '#FCD34D',
  info: '#60A5FA',

  // Game Specific
  reward: '#FFD700',
  cardBorder: '#3B2777',
  border: '#3B2777',

  // UI
  tabBar: '#1E1040',
  tabBarActive: '#9B72F5',
  tabBarInactive: '#5A4880',
  shadow: '#000000',
} as const;

// Type derived from the palette so it's always in sync
export type ColorPalette = typeof LightColors;