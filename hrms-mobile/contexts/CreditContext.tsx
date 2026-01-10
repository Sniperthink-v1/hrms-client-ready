/**
 * Credit Protection Context
 * Manages tenant credits and provides credit protection for routes
 * 
 * Works exactly like web dashboard's CreditProtectedRoute:
 * - Credits are read from tenant stored during login (no API calls)
 * - Shows NoCreditsPage if stored tenant credits are 0
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAppSelector } from '@/store/hooks';
import { storage } from '@/utils/storage';
import { api } from '@/services/api';

interface CreditContextType {
  credits: number;
  hasCredits: boolean;
  refreshCredits: () => Promise<void>;
  isProtectedRoute: (pathname: string) => boolean;
}

const CreditContext = createContext<CreditContextType>({
  credits: 0,
  hasCredits: false,
  refreshCredits: async () => {},
  isProtectedRoute: () => true,
});

// Routes that are always accessible even with 0 credits (same as web dashboard)
const ALWAYS_ACCESSIBLE_ROUTES = [
  '/settings',
  '/support',
  '/(drawer)/about',
  '/(drawer)/more',
  '/(drawer)/pin-settings',
];

interface CreditProviderProps {
  children: ReactNode;
}

export function CreditProvider({ children }: CreditProviderProps) {
  const { tenant } = useAppSelector((state) => state.auth);
  // Read credits directly from tenant stored during login (same as web dashboard)
  const [credits, setCredits] = useState<number>(tenant?.credits ?? 0);

  // Update credits when tenant changes (e.g., after login)
  useEffect(() => {
    if (tenant?.credits !== undefined && tenant.credits !== null) {
      setCredits(tenant.credits);
    }
  }, [tenant?.credits]);

  // Refresh credits from API (more reliable than local storage)
  const refreshCredits = useCallback(async () => {
    try {
      // Use the api service which handles authentication and token refresh
      const data = await api.get('/api/tenant/credits/');

      if (data.credits !== undefined) {
        setCredits(data.credits);
        // Also update stored tenant data
        const storedTenant = await storage.getTenant();
        if (storedTenant) {
          storedTenant.credits = data.credits;
          await storage.setTenant(storedTenant);
        }
        return;
      }
    } catch (error) {
      console.warn('[CreditContext] Failed to refresh credits from API:', error);
    }

    // Fallback to local storage if API call fails
    try {
      const storedTenant = await storage.getTenant();
      if (storedTenant?.credits !== undefined) {
        setCredits(storedTenant.credits);
      }
    } catch (fallbackError) {
      console.warn('[CreditContext] Failed to read stored tenant:', fallbackError);
    }
  }, []);

  // Auto-refresh credits when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground, refresh credits
        refreshCredits();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [refreshCredits]);

  // Check if a route is protected (requires credits)
  const isProtectedRoute = useCallback((pathname: string): boolean => {
    const isAlwaysAccessible = ALWAYS_ACCESSIBLE_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    );
    return !isAlwaysAccessible;
  }, []);

  const hasCredits = credits > 0;

  const value: CreditContextType = {
    credits,
    hasCredits,
    refreshCredits,
    isProtectedRoute,
  };

  return (
    <CreditContext.Provider value={value}>
      {children}
    </CreditContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error('useCredits must be used within a CreditProvider');
  }
  return context;
}

export default CreditContext;
