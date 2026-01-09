import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import NoCreditsPage from './NoCreditsPage';
import { apiGet } from '../services/api';

interface CreditsResponse {
  tenant_id: number;
  tenant_name: string;
  credits: number;
  is_active: boolean;
}

interface CreditProtectedRouteProps {
  children?: React.ReactNode;
}

const CreditProtectedRoute: React.FC<CreditProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Get tenant info from localStorage
  const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperUser = user?.is_superuser || false;

  // Pages that are always accessible even with 0 credits
  const alwaysAccessiblePaths = [
    '/hr-management/settings',
    '/hr-management/support',
  ];

  // Check if current path is always accessible
  const isAlwaysAccessible = alwaysAccessiblePaths.some(path =>
    location.pathname === path || location.pathname.startsWith(path + '/')
  );

  // Fetch fresh credits from API
  const fetchCredits = async () => {
    // Skip for superusers
    if (isSuperUser) {
      setCredits(999); // Superusers have unlimited access
      setLoading(false);
      return;
    }

    try {
      const response = await apiGet('/api/tenant/credits/');
      const data: CreditsResponse = await response.json();

      if (data && typeof data.credits === 'number') {
        setCredits(data.credits);
        // Update localStorage with fresh credits
        const updatedTenant = { ...tenant, credits: data.credits };
        localStorage.setItem('tenant', JSON.stringify(updatedTenant));
      } else {
        setCredits(0);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
      // Fallback to localStorage
      const cachedCredits = tenant?.credits || 0;
      setCredits(cachedCredits);
    } finally {
      setLoading(false);
    }
  };

  // Fetch credits on mount and when location changes
  useEffect(() => {
    fetchCredits();
  }, [location.pathname, isSuperUser]);

  // Show loading state while checking credits
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  // If credits are 0 and path is not always accessible, show NoCreditsPage
  if (credits !== null && credits <= 0 && !isAlwaysAccessible && !isSuperUser) {
    return <NoCreditsPage />;
  }

  // Otherwise, render the children/outlet
  return children ? <>{children}</> : <Outlet />;
};

export default CreditProtectedRoute;
