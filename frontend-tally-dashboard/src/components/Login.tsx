import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login, checkPINRequired, getPINStatus, setupPIN } from '../services/authService';
import { CheckCircle, Eye, EyeOff, Lock, AlertCircle, X } from 'lucide-react';
import { logger } from '../utils/logger';
import AccountRecoveryWelcomeModal from './AccountRecoveryWelcomeModal';
import AccountRecoveryConfirmationModal from './AccountRecoveryConfirmationModal';
import PINEntry from './PINEntry';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showRecoveryConfirmationModal, setShowRecoveryConfirmationModal] = useState(false);
  const [recoveryData, setRecoveryData] = useState<{ 
    tenantName?: string; 
    userName?: string;
    daysRemaining?: number;
    recoveryDeadline?: string;
  } | null>(null);
  const [recoveryConfirmationLoading, setRecoveryConfirmationLoading] = useState(false);
  const [showPINEntry, setShowPINEntry] = useState(false);
  const [tempLoginData, setTempLoginData] = useState<any>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [existingSession, setExistingSession] = useState(false);
  
  // Forced PIN setup modal state
  const [showForcedPINModal, setShowForcedPINModal] = useState(false);
  const [pinData, setPinData] = useState({
    pin: ['', '', '', ''],
    confirmPin: ['', '', '', ''],
    password: '',
  });
  const [showPINPassword, setShowPINPassword] = useState(false);
  const [pinProcessing, setPinProcessing] = useState(false);
  const [pinError, setPinError] = useState('');
  
  // Refs for PIN inputs
  const pinInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const confirmPinInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    // Check for success message from navigation state
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      if (location.state?.email) {
        setEmail(location.state.email);
      }
      // Clear the state
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  useEffect(() => {
    // Check for existing session on mount
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const savedUser = localStorage.getItem('user');
      const savedTenant = localStorage.getItem('tenant');
      const accessToken = localStorage.getItem('access');
      
      // Check session flags first
      const pinVerified = sessionStorage.getItem('pin_verified');
      const awaitingPin = sessionStorage.getItem('awaiting_pin');
      
      console.log('🔍 Session check:', { 
        hasUser: !!savedUser, 
        hasTenant: !!savedTenant, 
        hasToken: !!accessToken,
        pinVerified: !!pinVerified,
        awaitingPin: !!awaitingPin 
      });
      
      if (savedUser && savedTenant && accessToken) {
        const user = JSON.parse(savedUser);
        logger.info('Found existing session for:', user.email);
        
        // Superusers don't need PIN verification
        if (user.is_superuser) {
          logger.info('Superuser detected - skipping PIN check');
          const from = (location.state as any)?.from?.pathname;
          const destination = (from && from !== '/' && from !== '/login') ? from : '/super-admin';
          navigate(destination, { replace: true });
          setCheckingSession(false);
          return;
        }
        
        // Check PIN status - PIN is now mandatory
        try {
          const pinStatus = await getPINStatus();
          
          if (!pinStatus.pin_enabled) {
            // PIN not enabled - show forced setup modal
            logger.info('PIN not enabled - showing forced setup modal');
            setEmail(user.email);
            setShowForcedPINModal(true);
            setCheckingSession(false);
            return;
          }
          
          // PIN is enabled - check if PIN entry is required
          const pinCheck = await checkPINRequired(user.email);
          
          if (pinCheck.pin_required) {
            // Show PIN entry if:
            // 1. PIN not verified yet, OR
            // 2. We're currently awaiting PIN (refresh on PIN screen)
            if (!pinVerified || awaitingPin) {
              logger.info('Existing session - showing PIN entry (verified:', pinVerified, 'awaiting:', awaitingPin, ')');
              setEmail(user.email);
              setExistingSession(true);
              setShowPINEntry(true);
              // Set flag to preserve PIN screen on refresh
              sessionStorage.setItem('awaiting_pin', 'true');
              setCheckingSession(false);
              return;
            }
            // PIN is verified - proceed to dashboard
            logger.info('PIN already verified in this session, proceeding to dashboard');
            const from = (location.state as any)?.from?.pathname;
            const destination = (from && from !== '/' && from !== '/login') ? from : '/hr-management';
            navigate(destination, { replace: true });
            return;
          } else {
            // PIN enabled and verified - proceed to dashboard
            logger.info('PIN enabled and verified, proceeding to dashboard');
            const from = (location.state as any)?.from?.pathname;
            const destination = (from && from !== '/' && from !== '/login') ? from : '/hr-management';
            navigate(destination, { replace: true });
            return;
          }
        } catch (err) {
          logger.error('PIN status check failed for existing session:', err);
          // If PIN status check fails, assume PIN is not enabled and force setup
          setEmail(user.email);
          setShowForcedPINModal(true);
          setCheckingSession(false);
          return;
        }
      }
    } catch (error) {
      logger.info('No existing session found');
    } finally {
      setCheckingSession(false);
    }
  };

  const completeLogin = (response: any) => {
    localStorage.setItem('access', response.access);
    localStorage.setItem('refresh', response.refresh);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    // Store session_key if provided (for SSE force_logout filtering)
    if (response.session_key) {
      localStorage.setItem('session_key', response.session_key);
      logger.info('✅ Session key stored:', response.session_key);
    }
    
    // Store tenant information
    if (response.tenant) {
      localStorage.setItem('tenant', JSON.stringify(response.tenant));
      logger.info(`Welcome to ${response.tenant.name}! Access URL: ${response.tenant.access_url}`);
    }
    
    // Check if account was recovered - show welcome modal
    if (response.account_recovered) {
      const userName = response.user?.name || 
                      `${response.user?.first_name || ''} ${response.user?.last_name || ''}`.trim() || 
                      response.user?.email || 'there';
      const tenantName = response.tenant?.name || 'your organization';
      
      setRecoveryData({
        userName,
        tenantName
      });
      setShowRecoveryModal(true);
      // Don't navigate yet - wait for modal to be closed
    } else {
      // Navigate based on user role - superusers go to super admin dashboard
      const isSuperUser = response.user?.is_superuser || false;
      navigate(isSuperUser ? '/super-admin' : '/hr-management');
    }
  };

  const handlePINSuccess = () => {
    // Mark PIN as verified in this browser session
    sessionStorage.setItem('pin_verified', 'true');
    // Clear the awaiting_pin flag
    sessionStorage.removeItem('awaiting_pin');
    
    if (existingSession) {
      // For existing session, navigate to dashboard
      const from = (location.state as any)?.from?.pathname;
      // Default to /hr-management if no specific path
      const destination = (from && from !== '/' && from !== '/login') ? from : '/hr-management';
      // Force a full page reload to ensure all components initialize properly
      window.location.href = destination;
    } else if (tempLoginData) {
      // For new login, complete the login process
      completeLogin(tempLoginData);
      setShowPINEntry(false);
      setTempLoginData(null);
    }
  };

  const handlePINBack = () => {
    setShowPINEntry(false);
    setTempLoginData(null);
    setEmail('');
    setPassword('');
    setExistingSession(false);
    // Clear the awaiting_pin flag when going back
    sessionStorage.removeItem('awaiting_pin');
  };

  const handlePinChange = (index: number, value: string, type: 'pin' | 'confirmPin') => {
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pinData[type]];
    newPin[index] = value;
    setPinData({ ...pinData, [type]: newPin });
    setPinError('');

    // Auto-focus next input
    if (value && index < 3) {
      const refs = type === 'pin' ? pinInputRefs : confirmPinInputRefs;
      refs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>, type: 'pin' | 'confirmPin') => {
    const currentPin = pinData[type];
    const refs = type === 'pin' ? pinInputRefs : confirmPinInputRefs;
    
    if (e.key === 'Backspace' && !currentPin[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  };

  const handleForcedPINSetup = async () => {
    const fullPin = pinData.pin.join('');
    const confirmFullPin = pinData.confirmPin.join('');

    if (fullPin.length !== 4) {
      setPinError('Please enter a 4-digit PIN');
      return;
    }

    if (fullPin !== confirmFullPin) {
      setPinError('PINs do not match');
      return;
    }

    if (!pinData.password) {
      setPinError('Please enter your password to confirm');
      return;
    }

    try {
      setPinProcessing(true);
      setPinError('');
      
      // Add timeout handling for PIN setup
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('PIN setup timeout. Please try again.')), 10000);
      });
      
      const result = await Promise.race([setupPIN(fullPin, pinData.password), timeoutPromise]);
      
      if (result.success) {
        // PIN setup successful - complete login
        if (tempLoginData) {
          completeLogin(tempLoginData);
          setShowForcedPINModal(false);
          setPinData({ pin: ['', '', '', ''], confirmPin: ['', '', '', ''], password: '' });
        } else {
          // For existing session
          const savedUser = localStorage.getItem('user');
          const savedTenant = localStorage.getItem('tenant');
          if (savedUser && savedTenant) {
            const from = (location.state as any)?.from?.pathname;
            const destination = (from && from !== '/' && from !== '/login') ? from : '/hr-management';
            setShowForcedPINModal(false);
            setPinData({ pin: ['', '', '', ''], confirmPin: ['', '', '', ''], password: '' });
            navigate(destination, { replace: true });
          }
        }
      } else {
        // Clean up tokens on failure
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        setPinError(result.message || 'Failed to set up PIN');
      }
    } catch (error: any) {
      // Clean up tokens on error
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      
      // Better error handling - distinguish error types
      let errorMessage = 'Failed to set up PIN';
      
      if (error.message) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please check your connection and try again.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.message.includes('Too many')) {
          errorMessage = error.message; // Rate limit message from backend
        } else if (error.message.includes('Invalid password')) {
          errorMessage = 'Invalid password. Please try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setPinError(errorMessage);
      logger.error('PIN setup error:', error);
    } finally {
      setPinProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const response = await login(email, password);
      
      // Check if recovery confirmation is required FIRST (before any other checks)
      // This response won't have access/refresh tokens, so we need to handle it before checking for tokens
      if (response.requires_recovery_confirmation === true) {
        // Show confirmation modal
        const userName = response.user?.name || 
                        `${response.user?.first_name || ''} ${response.user?.last_name || ''}`.trim() || 
                        response.user?.email || 'there';
        const tenantName = response.recovery_info?.tenant_name || 'your organization';
        
        setRecoveryData({
          userName,
          tenantName,
          daysRemaining: response.recovery_info?.days_remaining,
          recoveryDeadline: response.recovery_info?.recovery_deadline
        });
        setShowRecoveryConfirmationModal(true);
        setLoading(false);
        return;
      }
      
      // Check if user must change password
      if (response.must_change_password) {
        // Store user and tenant data for the password change process
        localStorage.setItem('tempUser', JSON.stringify(response.user));
        localStorage.setItem('tenant', JSON.stringify(response.tenant));
        
        // Navigate to change password page
        navigate('/change-password', { 
          state: { 
            email: email,
            message: 'Please set a new password to continue.',
            user: response.user,
            tenant: response.tenant
          }
        });
        return;
      }
      
          // Normal login flow - check PIN status (PIN is now mandatory)
      if (response.access && response.refresh) {
        // Store tokens temporarily for PIN status check
        localStorage.setItem('access', response.access);
        localStorage.setItem('refresh', response.refresh);
        
        // Superusers don't need PIN verification
        if (response.user?.is_superuser) {
          logger.info('Superuser detected - skipping PIN check');
          completeLogin(response);
          return;
        }
        
        // Check PIN status - PIN is now mandatory for all accounts
        try {
          const pinStatus = await getPINStatus();
          
          if (!pinStatus.pin_enabled) {
            // PIN not enabled - show forced setup modal
            logger.info('PIN not enabled - showing forced setup modal');
            setTempLoginData(response);
            setShowForcedPINModal(true);
            setLoading(false);
            return;
          }
          
          // PIN is enabled - check if PIN entry is required
          const pinCheck = await checkPINRequired(email);
          
          if (pinCheck.pin_required) {
            // Store temp data and show PIN entry
            setTempLoginData(response);
            setShowPINEntry(true);
            setLoading(false);
            return;
          }
        } catch (err) {
          logger.error('Error checking PIN status:', err);
          // If PIN status check fails, assume PIN is not enabled and force setup
          logger.warn('PIN status check failed, forcing PIN setup');
          setTempLoginData(response);
          setShowForcedPINModal(true);
          setLoading(false);
          return;
        }
        
        // PIN enabled and verified - proceed with normal login
        completeLogin(response);
      } else {
        setError('Invalid login response - missing tokens');
      }
    } catch (err: unknown) {
      const error = err as Error & { responseData?: any };
      
      // Check if error has response data (from authService)
      if (error.responseData) {
        if (error.responseData.recovery_expired) {
          setError(error.responseData.error || 'Your account recovery period has expired.');
        } else if (error.responseData.requires_admin && error.responseData.account_deactivated) {
          // Non-admin user trying to log in to deactivated account
          const daysRemaining = error.responseData.recovery_info?.days_remaining || 0;
          setError(
            error.responseData.error || 
            `Only administrators can reactivate this account. Please contact your administrator. ${daysRemaining > 0 ? `You have ${daysRemaining} day(s) remaining in the recovery period.` : ''}`
          );
        } else if (error.responseData.recovery_info) {
          setError(error.responseData.error || error.message);
        } else {
          setError(error.responseData.error || error.message || 'Login failed');
        }
      } else {
        setError(error.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading screen while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show PIN entry screen if required
  if (showPINEntry) {
    // For existing session, get user data from localStorage
    let userName = 'User';
    let companyName = '';
    
    if (existingSession) {
      const savedUser = localStorage.getItem('user');
      const savedTenant = localStorage.getItem('tenant');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        userName = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email?.split('@')[0] || 'User';
      }
      if (savedTenant) {
        const tenant = JSON.parse(savedTenant);
        companyName = tenant.name || '';
      }
    } else {
      // New login - use temp data
      userName = tempLoginData?.user?.name || 
                 `${tempLoginData?.user?.first_name || ''} ${tempLoginData?.user?.last_name || ''}`.trim() || 
                 tempLoginData?.user?.email?.split('@')[0] || 
                 'User';
      companyName = tempLoginData?.tenant?.name || '';
    }
    
    return (
      <PINEntry
        email={email}
        onSuccess={handlePINSuccess}
        onBack={handlePINBack}
        userName={userName}
        companyName={companyName}
        existingSession={existingSession}
      />
    );
  }

  return (
    <div className="flex min-h-screen font-poppins">
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="w-[640px] min-h-[700px] rounded-3xl flex flex-col items-start justify-start p-20 bg-[#176d67] bg-opacity-100 relative overflow-hidden">
          {/* Curved diagonal shape at top left */}
          <div className="absolute top-[-250px] left-[-50px] w-[300px] h-full">
            <img src="/img/r1.png" alt="Login Visual" className="w-full h-full object-contain mb-4" />
          </div>
          <div className="absolute top-[-90px] left-[-150px] w-[600px] h-[600px]">
            <img src="/img/r2.png" alt="Login Visual" className="w-full h-full object-contain mb-4" />
          </div>
          <div className="absolute bottom-[-0px] right-[-100px] w-[350px] h-[350px]">
            <img src="/img/rr1.png" alt="Login Visual" className="w-full h-full object-contain mb-4" />
          </div>
          <div className="absolute bottom-[-20px] right-[-20px] w-[350px] h-[350px]">
            <img src="/img/rr2.png" alt="Login Visual" className="w-full h-full object-contain mb-4" />
          </div>
          
          
          <img src="/image.png" alt="Login Visual" className="w-full h-[400px] object-contain mb-4 relative z-10" />
          <img src="/logo.png" alt="SniperThink Logo" className="h-8 w-[230px] mb-4 relative z-10" />
          <h2 className="text-[40px] font-bold text-white mb-2 text-left relative z-10">Analyze. Automate.<br />Accelerate.</h2>
          <p className="text-white text-[15px] text-center mb-4 text-base relative z-10">Welcome to SniperThink, your all-in-one solution.</p>
          <a href="#" className="text-white font-medium flex items-center gap-1 hover:underline text-base relative z-10">Learn More <span aria-hidden>→</span></a>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center bg-white">
        <div className="w-full max-w-md px-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <h2 className="text-4xl font-semibold text-center text-gray-800 mb-8">Sign in</h2>
            
            {/* Success Message */}
            {successMessage && (
              <div className="bg-teal-50 text-teal-700 p-3 rounded-lg border border-teal-200 flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5" />
                {successMessage}
              </div>
            )}
            
            <div className="space-y-1">
              <input 
                type="email" 
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                placeholder="Email"
              />
            </div>
            
            <div className="space-y-1">
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  placeholder="Password"
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            
            
            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              className="w-full bg-teal-700 text-white py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors disabled:opacity-50" 
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            
            {/* <div className="flex items-center my-6">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="px-4 text-sm text-gray-500">or</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>
            
            <button 
              type="button"
              className="w-full border border-gray-300 rounded-lg py-3 px-4 flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#1A6262" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#1A6262" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#1A6262" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#1A6262" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-[#1A6262] font-medium">Sign in with Google</span>
            </button> */}
            
            <div className="text-sm mt-6 flex items-center justify-between">
              <span className="text-gray-500">
                New to SniperThink?{' '}
                <a href="/signup" className="text-teal-700 hover:underline font-medium">
                  Sign up
                </a>
              </span>
              <button 
                type="button" 
                className="text-sm text-teal-600 hover:text-teal-900 font-medium" 
                onClick={() => navigate('/forgot-password')}
              >
                Forgot password?
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Account Recovery Confirmation Modal */}
      <AccountRecoveryConfirmationModal
        isOpen={showRecoveryConfirmationModal}
        onClose={() => {
          setShowRecoveryConfirmationModal(false);
          setRecoveryData(null);
        }}
        onConfirm={async () => {
          setRecoveryConfirmationLoading(true);
          try {
            // Retry login with confirm_recovery flag
            const response = await login(email, password, true);
            
            // Store authentication data
            if (response.access && response.refresh) {
              localStorage.setItem('access', response.access);
              localStorage.setItem('refresh', response.refresh);
              localStorage.setItem('user', JSON.stringify(response.user));
              
              // Store session_key if provided (for SSE force_logout filtering)
              if (response.session_key) {
                localStorage.setItem('session_key', response.session_key);
                logger.info( '✅ Session key stored (recovery):', response.session_key);
              }
              
              if (response.tenant) {
                localStorage.setItem('tenant', JSON.stringify(response.tenant));
              }
              
              // Close confirmation modal
              setShowRecoveryConfirmationModal(false);
              
              // Show welcome modal since account was recovered
              if (response.account_recovered) {
                const userName = response.user?.name || 
                                `${response.user?.first_name || ''} ${response.user?.last_name || ''}`.trim() || 
                                response.user?.email || 'there';
                const tenantName = response.tenant?.name || 'your organization';
                
                setRecoveryData({
                  userName,
                  tenantName
                });
                setShowRecoveryModal(true);
              } else {
                // Navigate based on user role - superusers go to super admin dashboard
                const isSuperUser = response.user?.is_superuser || false;
                navigate(isSuperUser ? '/super-admin' : '/hr-management');
              }
            }
          } catch (err: unknown) {
            const error = err as Error;
            setError(error.message || 'Failed to recover account. Please try again.');
            setShowRecoveryConfirmationModal(false);
          } finally {
            setRecoveryConfirmationLoading(false);
          }
        }}
        tenantName={recoveryData?.tenantName}
        userName={recoveryData?.userName}
        daysRemaining={recoveryData?.daysRemaining}
        recoveryDeadline={recoveryData?.recoveryDeadline}
        loading={recoveryConfirmationLoading}
      />

      {/* Account Recovery Welcome Modal */}
      <AccountRecoveryWelcomeModal
        isOpen={showRecoveryModal}
        onClose={() => {
          setShowRecoveryModal(false);
          // Check if user is superuser and redirect accordingly
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          const isSuperUser = user?.is_superuser || false;
          navigate(isSuperUser ? '/super-admin' : '/hr-management');
        }}
        tenantName={recoveryData?.tenantName}
        userName={recoveryData?.userName}
      />

      {/* Forced PIN Setup Modal */}
      {showForcedPINModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            // Clean up tokens if user clicks outside modal
            if (e.target === e.currentTarget) {
              localStorage.removeItem('access');
              localStorage.removeItem('refresh');
              setShowForcedPINModal(false);
              setError('PIN setup cancelled. Please login again.');
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Lock className="w-6 h-6 text-teal-700" />
                <h2 className="text-xl font-semibold text-gray-800">PIN Setup Required</h2>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Warning Message */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg mb-6">
                <AlertCircle className="w-5 h-5 text-teal-700 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">
                  PIN authentication is mandatory for all accounts. Please set up your PIN to continue.
                </p>
              </div>

              {/* PIN Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Enter a 4-digit PIN
                </label>
                <div className="flex gap-3">
                  {[0, 1, 2, 3].map((index) => (
                    <input
                      key={index}
                      ref={pinInputRefs[index]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={pinData.pin[index]}
                      onChange={(e) => handlePinChange(index, e.target.value, 'pin')}
                      onKeyDown={(e) => handleKeyDown(index, e, 'pin')}
                      className="w-full h-14 text-center text-2xl font-semibold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      style={{ WebkitTextSecurity: 'disc' }}
                    />
                  ))}
                </div>
              </div>

              {/* Confirm PIN Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Confirm PIN
                </label>
                <div className="flex gap-3">
                  {[0, 1, 2, 3].map((index) => (
                    <input
                      key={index}
                      ref={confirmPinInputRefs[index]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={pinData.confirmPin[index]}
                      onChange={(e) => handlePinChange(index, e.target.value, 'confirmPin')}
                      onKeyDown={(e) => handleKeyDown(index, e, 'confirmPin')}
                      className="w-full h-14 text-center text-2xl font-semibold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      style={{ WebkitTextSecurity: 'disc' }}
                    />
                  ))}
                </div>
              </div>

              {/* Password Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password (for verification)
                </label>
                <div className="relative">
                  <input
                    type={showPINPassword ? 'text' : 'password'}
                    value={pinData.password}
                    onChange={(e) => setPinData({ ...pinData, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPINPassword(!showPINPassword)}
                  >
                    {showPINPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {pinError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{pinError}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={handleForcedPINSetup}
                disabled={pinProcessing}
                className="w-full bg-teal-700 text-white py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {pinProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Setting up PIN...</span>
                  </>
                ) : (
                  'Setup PIN & Continue'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login; 