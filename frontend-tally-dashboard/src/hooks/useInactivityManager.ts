import { useEffect, useState, useCallback } from 'react';
import { inactivityManager } from '../services/inactivityManager';

export const useInactivityManager = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [showPINModal, setShowPINModal] = useState(false);

  const logout = useCallback(() => {
    setShowWarning(false);
    inactivityManager.stop();
    // Clear all auth data
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    // Check if user is superuser
    const user = localStorage.getItem('user');
    let isSuperUser = false;
    try {
      if (user) {
        const userData = JSON.parse(user);
        isSuperUser = userData.is_superuser || false;
      }
    } catch (e) {
      // Ignore parsing errors
    }

    // Set up warning callback
    inactivityManager.setWarningCallback(() => {
      // Superusers don't get inactivity warnings - they get logged out directly
      if (isSuperUser) {
        logout();
        return;
      }
      setShowWarning(true);
    });

    // Set up PIN required callback (instead of logout)
    inactivityManager.setPinRequiredCallback(() => {
      // Superusers don't need PIN - logout directly
      if (isSuperUser) {
        logout();
        return;
      }
      setShowWarning(false);
      // Clear PIN verification to force PIN entry
      sessionStorage.removeItem('pin_verified');
      setShowPINModal(true);
    });

    // Start the inactivity manager
    inactivityManager.start();

    // Cleanup on unmount
    return () => {
      inactivityManager.destroy();
    };
  }, [logout]);

  const extendSession = () => {
    setShowWarning(false);
    inactivityManager.extendSession();
  };

  const handlePINSuccess = () => {
    // Mark PIN as verified and extend session
    sessionStorage.setItem('pin_verified', 'true');
    setShowPINModal(false);
    inactivityManager.extendSession();
  };

  return {
    showWarning,
    showPINModal,
    extendSession,
    handlePINSuccess,
    logout
  };
}; 