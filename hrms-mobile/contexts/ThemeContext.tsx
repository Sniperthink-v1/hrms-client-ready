import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { storage } from '@/utils/storage';

type ThemePreference = 'system' | 'light' | 'dark';
type ThemeContextType = {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
  colorScheme: 'light' | 'dark' | null;
};

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useRNColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('light');
  const [colorScheme, setColorScheme] = useState<'light' | 'dark' | null>('light');

  // Load theme preference from storage on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      const preference = await storage.getThemePreference();
      setThemePreferenceState(preference);
    };
    loadThemePreference();
  }, []);

  // Update color scheme when preference or system theme changes
  useEffect(() => {
    if (themePreference === 'system') {
      setColorScheme(systemColorScheme || 'light');
    } else {
      setColorScheme(themePreference);
    }
  }, [themePreference, systemColorScheme]);

  const setThemePreference = async (preference: ThemePreference) => {
    await storage.setThemePreference(preference);
    setThemePreferenceState(preference);
  };

  return (
    <ThemeContext.Provider value={{ themePreference, setThemePreference, colorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within an AppThemeProvider');
  }
  return context;
}

