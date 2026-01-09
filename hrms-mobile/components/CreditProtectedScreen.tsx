/**
 * Credit Protected Screen Component
 * Wraps screen content and shows NoCreditsPage when credits are depleted
 * 
 * Works exactly like web dashboard's CreditProtectedRoute:
 * - Reads credits from stored tenant (set during login)
 * - Shows NoCreditsPage if stored credits are 0
 * - Superusers bypass credit checks (same as backend middleware)
 */

import React, { ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { useCredits } from '@/contexts/CreditContext';
import { useAppSelector } from '@/store/hooks';
import NoCreditsPage from './NoCreditsPage';

interface CreditProtectedScreenProps {
  children: ReactNode;
  /** Override the default route protection check */
  forceProtected?: boolean;
  /** Override to allow access even without credits */
  allowWithoutCredits?: boolean;
}

export default function CreditProtectedScreen({
  children,
  forceProtected,
  allowWithoutCredits = false,
}: CreditProtectedScreenProps) {
  const pathname = usePathname();
  const { hasCredits, isProtectedRoute, refreshCredits } = useCredits();
  const { user } = useAppSelector((state) => state.auth);

  // Refresh credits when component mounts or pathname changes
  React.useEffect(() => {
    refreshCredits();
  }, [pathname, refreshCredits]);

  // Superusers bypass credit checks (same as backend middleware)
  if (user?.is_superuser) {
    return <>{children}</>;
  }

  // Determine if this route is protected
  const isProtected = forceProtected !== undefined 
    ? forceProtected 
    : isProtectedRoute(pathname);

  // If route is protected and no credits (and not explicitly allowed), show NoCreditsPage
  if (isProtected && !hasCredits && !allowWithoutCredits) {
    return <NoCreditsPage />;
  }

  // Otherwise, render children
  return <>{children}</>;
}
