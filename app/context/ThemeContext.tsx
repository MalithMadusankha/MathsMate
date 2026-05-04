// Global theme context
// Provides colors + dark/light toggle to the entire app
// Any component can call useTheme() to access current colors

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  JSX,
} from 'react';
import { LightColors, DarkColors, ColorPalette } from '../constants/colors';

interface ThemeContextType {
  colors: typeof LightColors | typeof DarkColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps): JSX.Element => {
  const [isDark, setIsDark] = useState<boolean>(false);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  // Memoized so consumers only re-render when theme actually changes
  const value = useMemo<ThemeContextType>(
    () => ({
      colors: isDark ? DarkColors : LightColors,
      isDark,
      toggleTheme,
    }),
    [isDark, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook — clean access from any component
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
};