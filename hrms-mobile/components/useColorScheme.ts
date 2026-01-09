import { useColorScheme as useRNColorScheme } from 'react-native';
import { useContext } from 'react';
import { ThemeContext } from '@/contexts/ThemeContext';

export function useColorScheme(): 'light' | 'dark' | null {
  const systemColorScheme = useRNColorScheme();
  const context = useContext(ThemeContext);
  
  if (context) {
    return context.colorScheme;
  }
  
  // Fallback to system color scheme if context is not available
  return systemColorScheme;
}
