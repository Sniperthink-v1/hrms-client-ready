import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import HRSidebar from './components/HRSidebar';
import HRHeader from './components/HRHeader';
import HRStats from './components/HRStats';
import HROverviewCharts from './components/HROverviewCharts';
import HRDirectory from './components/HRDirectory';
import HRAddEmployee from './components/HRAddEmployee';
import HRPayrollNew from './components/HRPayrollNew';
import PayrollOverview from './components/payroll/PayrollOverview';

import HRAttendanceTracker from './components/HRAttendanceTracker';
import HRAttendanceLog from './components/HRAttendanceLog';
import HRDailyCheckLog from './components/HRDailyCheckLog';
import HRLeaveManagement from './components/HRLeaveManagement';
import HRSettings from './components/HRSettings';
import HREmployeeDetails from './components/HREmployeeDetails';
import HRDataUpload from './components/HRDataUpload';
import HRUserInvitation from './components/HRUserInvitation';
import HRSupport from './components/HRSupport';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import Dropdown, { DropdownOption } from './components/Dropdown';
import CustomDateInput from './components/CustomDateInput';
import { TimePeriod, clearSalaryDataCache } from './services/salaryService';
import { getDropdownOptions } from './services/dropdownService';
import Login from './components/Login';
import Signup from './components/Signup';
import AcceptInvitation from './components/AcceptInvitation';
import ForgotPassword from './components/ForgotPassword';
import ChangePassword from './components/ChangePassword';
import InactivityWarningModal from './components/InactivityWarningModal';
import PINEntry from './components/PINEntry';
import { useInactivityManager } from './hooks/useInactivityManager';
import { useSessionConflict } from './hooks/useSessionConflict';
import { SessionConflictModal } from './components/SessionConflictModal';
import CreditProtectedRoute from './components/CreditProtectedRoute';
import { logger } from './utils/logger';
import { Lock, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { API_CONFIG } from './config/apiConfig';

// Time period options for HR dashboard
const timePeriodOptions: { label: string; value: TimePeriod | 'custom_range' }[] = [
  { label: 'Latest Month', value: 'this_month' },
  { label: 'Last 6 Months', value: 'last_6_months' },
  { label: 'Last 12 Months', value: 'last_12_months' },
  { label: 'Last 5 Years', value: 'last_5_years' },
  { label: 'Custom Range', value: 'custom_range' },
];

// Inactivity PIN Modal Component
interface InactivityPINModalProps {
  email: string;
  userName?: string;
  onSuccess: () => void;
}

const InactivityPINModal: React.FC<InactivityPINModalProps> = ({ email, userName, onSuccess }) => {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    // Focus first input on mount
    inputRefs[0].current?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError('');

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    if (index === 3 && value) {
      const fullPin = newPin.join('');
      if (fullPin.length === 4) {
        handleSubmit(fullPin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleSubmit = async (pinValue?: string) => {
    const fullPin = pinValue || pin.join('');
    
    if (fullPin.length !== 4) {
      setError('Please enter all 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        API_CONFIG.getApiUrl('/pin/verify/'),
        {
          email,
          pin: fullPin,
        }
      );

      if (response.data.success) {
        onSuccess();
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Invalid PIN. Please try again.';
      setError(errorMessage);
      setPin(['', '', '', '']);
      inputRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4">
        <div className="p-8">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 text-teal-700" />
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Session Timeout</h2>
            <p className="text-gray-600 mb-1">Please enter your PIN to continue</p>
            {userName && (
              <p className="text-sm text-gray-500">Welcome back, {userName}</p>
            )}
          </div>

          {/* PIN Input */}
          <div className="flex justify-center gap-4 mb-6">
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-16 h-16 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                disabled={loading}
                style={{ WebkitTextSecurity: 'disc' }}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={() => handleSubmit()}
            disabled={loading || pin.some(d => !d)}
            className="w-full bg-teal-700 text-white py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify PIN'}
          </button>

          {/* Help Text */}
          <div className="text-center text-sm text-gray-500 mt-4">
            <p>Forgot your PIN? Contact your administrator for assistance.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

function PrivateRoute({ children }: { children: JSX.Element }) {
  const access = localStorage.getItem('access');
  const { showWarning, showPINModal, extendSession, handlePINSuccess, logout } = useInactivityManager();
  
  // SSE-based session conflict detection
  const { modalData, closeModal, testModal } = useSessionConflict();
  
  // Debug logging
  useEffect(() => {
    logger.info( '📊 Modal Data Changed:', modalData);
  }, [modalData]);
  
  // Expose test function globally for debugging
  useEffect(() => {
    (window as any).testSessionModal = testModal;
    logger.info( '💡 Test modal with: window.testSessionModal()');
  }, [testModal]);
  
  // Legacy forcedLogout event support (backup)
  const [showForcedLogout, setShowForcedLogout] = useState<boolean>(false);
  const [forcedReason, setForcedReason] = useState<string>('OTHER_LOGIN');

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setForcedReason(e?.detail?.reason || 'OTHER_LOGIN');
      setShowForcedLogout(true);
      // Clear tokens immediately
      localStorage.clear();
    };
    window.addEventListener('forcedLogout', handler as EventListener);
    return () => window.removeEventListener('forcedLogout', handler as EventListener);
  }, []);

  if (!access) {
    return <Navigate to="/login" replace />;
  }

  // Check if PIN verification is required
  const pinVerified = sessionStorage.getItem('pin_verified');
  const user = localStorage.getItem('user');
  
  // Get user email for PIN entry
  let userEmail = '';
  let userName = '';
  let companyName = '';
  let isSuperUser = false;
  try {
    if (user) {
      const userData = JSON.parse(user);
      userEmail = userData.email || '';
      userName = userData.name || `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email?.split('@')[0] || 'User';
      isSuperUser = userData.is_superuser || false;
    }
    const tenant = localStorage.getItem('tenant');
    if (tenant) {
      const tenantData = JSON.parse(tenant);
      companyName = tenantData.name || '';
    }
  } catch (e) {
    logger.error('Error parsing user/tenant data:', e);
  }
  
  // Superusers don't need PIN verification
  // If user exists but PIN not verified (and not showing PIN modal), redirect to login
  if (user && !isSuperUser && !pinVerified && !showPINModal) {
    return <Navigate to="/login" replace />;
  }
  
  // Logout superusers on browser close
  useEffect(() => {
    if (!isSuperUser) return;
    
    const handleBeforeUnload = () => {
      // Clear auth data when browser/tab is closed
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      localStorage.removeItem('user');
      localStorage.removeItem('tenant');
      localStorage.removeItem('session_key');
      sessionStorage.clear();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isSuperUser]);

  return (
    <>
      {children}
      
      {/* Inactivity Warning Modal */}
      <InactivityWarningModal
        isOpen={showWarning}
        onStayLoggedIn={extendSession}
        onLogout={logout}
      />
      
      {/* Inactivity PIN Entry Modal - Don't show for superusers */}
      {showPINModal && userEmail && !isSuperUser && (
        <InactivityPINModal
          email={userEmail}
          userName={userName}
          onSuccess={handlePINSuccess}
        />
      )}
      
      {/* New SSE-based Session Conflict Modal */}
      <SessionConflictModal
        show={modalData.show}
        message={modalData.message}
        onClose={closeModal}
      />
      
      {/* Legacy Forced Logout Modal (backup) */}
      {showForcedLogout && !modalData.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">You've been logged out</h3>
            <p className="text-sm text-gray-600 mb-4">
              {forcedReason === 'OTHER_LOGIN' ? 'You have been logged out due to another login on a different device or browser.' : 'Your session has ended. Please log in again.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                onClick={() => {
                  setShowForcedLogout(false);
                  window.location.href = '/login';
                }}
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AppContent({ dark, setDark }: { dark: boolean; setDark: (v: boolean) => void }) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod | 'custom_range'>('this_month');
  const [activePage, setActivePage] = useState('overview'); // Track active HR page
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [customStartMonth, setCustomStartMonth] = useState<string>('');
  const [customStartYear, setCustomStartYear] = useState<string>('');
  const [customEndMonth, setCustomEndMonth] = useState<string>('');
  const [customEndYear, setCustomEndYear] = useState<string>('');
  const [dateRangeError, setDateRangeError] = useState<string>('');
  const [isCustomRangeLoading, setIsCustomRangeLoading] = useState<boolean>(false);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  
  // Get current year and month for validation
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // getMonth() returns 0-11
  const [overviewSalaryData, setOverviewSalaryData] = useState<any>(null);

  // Convert time period options to dropdown format
  const timePeriodDropdownOptions: DropdownOption[] = timePeriodOptions.map(opt => ({
    value: opt.value,
    label: opt.label
  }));

  // Convert departments to dropdown format
  const departmentDropdownOptions: DropdownOption[] = [
    { value: 'All', label: 'All Departments' },
    ...availableDepartments.map(dept => ({ value: dept, label: dept }))
  ];

  // Fetch available departments from API
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const dropdownOptions = await getDropdownOptions();
        // Use departments from the dropdown options API (sourced from database)
        setAvailableDepartments(dropdownOptions.departments);
      } catch (error) {
        logger.error('Failed to load departments:', error);
        // Fallback to default departments if API fails
        setAvailableDepartments(['Engineering', 'Sales', 'HR', 'Finance', 'Design', 'Marketing']);
      }
    };

    loadDepartments();
  }, []);

  // Update activePage based on current route
  useEffect(() => {
    if (location.pathname === '/hr-management') {
      // Check user role and redirect HR managers to attendance log
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const isHRManager = user?.role === 'hr_manager' || user?.role === 'hr-manager' || false;
      const isAdmin = user?.role === 'admin' || user?.is_admin || user?.is_superuser || false;
      const isPayrollMaster = user?.role === 'payroll_master' || false;
      
      if (isHRManager && !isAdmin && !isPayrollMaster) {
        // HR managers should go to attendance log instead of directory
        navigate('/hr-management/attendance-log');
      } else {
        setActivePage('overview');
      }
    } else if (location.pathname === '/hr-management/directory') {
      setActivePage('directory');
    } else if (location.pathname === '/hr-management/directory/add') {
      setActivePage('add-employee');
    } else if (location.pathname === '/hr-management/payroll') {
      setActivePage('payroll');
    } else if (location.pathname === '/hr-management/payroll-overview') {
      setActivePage('payroll');
    } else if (location.pathname === '/hr-management/attendance-tracker') {
      setActivePage('attendance-tracker');
    } else if (location.pathname === '/hr-management/attendance-log') {
      setActivePage('attendance-log');
    } else if (location.pathname === '/hr-management/face-attendance') {
      setActivePage('face-attendance');
    } else if (location.pathname === '/hr-management/leave-management') {
      setActivePage('leave-management');
    } else if (location.pathname === '/hr-management/settings') {
      setActivePage('settings');
    } else if (location.pathname === '/hr-management/data-upload') {
      setActivePage('data-upload');
    } else if (location.pathname === '/hr-management/team') {
      setActivePage('team');
    } else if (location.pathname === '/hr-management/support') {
      setActivePage('support');
    } else if (location.pathname === '/super-admin') {
      setActivePage('super-admin');
    }
  }, [location.pathname]);

  // Handle time period selection
  const handleTimePeriodSelect = (value: string) => {
    logger.info( '🔄 Time period changed:', value);
    setTimePeriod(value as TimePeriod | 'custom_range');
    
    // Clear cache to ensure fresh data
    clearSalaryDataCache();
    
    // If custom range is selected, set default month/year range (current month)
    if (value === 'custom_range') {
      const today = new Date();
      const currentMonth = (today.getMonth() + 1).toString();
      const currentYear = today.getFullYear().toString();
      setCustomStartMonth(currentMonth);
      setCustomStartYear(currentYear);
      setCustomEndMonth(currentMonth);
      setCustomEndYear(currentYear);
      // Set dates to first and last day of current month
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      setCustomStartDate(firstDay);
      setCustomEndDate(lastDay);
      logger.info( '📅 Set default custom month/year range:', { month: currentMonth, year: currentYear });
    }
    
    // Dispatch filter change event
    window.dispatchEvent(new CustomEvent('filterChanged', {
      detail: { 
        type: 'timePeriod', 
        value: value,
        selectedDepartment,
        customStartDate,
        customEndDate
      }
    }));
  };

  // Handle department selection
  const handleDepartmentSelect = (value: string) => {
    logger.info( '🔄 Department changed:', value);
    setSelectedDepartment(value);
    
    // Clear cache to ensure fresh data
    clearSalaryDataCache();
    
    // Dispatch filter change event
    window.dispatchEvent(new CustomEvent('filterChanged', {
      detail: { 
        type: 'department', 
        value: value,
        timePeriod,
        customStartDate,
        customEndDate
      }
    }));
  };

  // Validate date range
  const validateDateRange = (startYear: number, startMonth: number, endYear: number, endMonth: number): string => {
    // Check if end date is in the future
    if (endYear > currentYear || (endYear === currentYear && endMonth > currentMonth)) {
      return 'End date cannot be in the future';
    }
    
    // Check if start date is in the future
    if (startYear > currentYear || (startYear === currentYear && startMonth > currentMonth)) {
      return 'Start date cannot be in the future';
    }
    
    // Check if end date is before start date
    if (endYear < startYear || (endYear === startYear && endMonth < startMonth)) {
      return 'End date must be after or equal to start date';
    }
    
    return '';
  };

  // Handle custom date changes (without triggering API call - wait for Go button)
  const handleCustomDateChange = (startDate: string, endDate: string, triggerApi = false) => {
    logger.info( '🔄 Custom dates changed:', { startDate, endDate, triggerApi });
    logger.info( '🔄 Current timePeriod:', timePeriod);
    logger.info( '🔄 Current selectedDepartment:', selectedDepartment);
    
    setCustomStartDate(startDate);
    setCustomEndDate(endDate);
    
    // Only trigger API call if explicitly requested (via Go button)
    if (triggerApi && !dateRangeError && startDate && endDate) {
      setIsCustomRangeLoading(true);
      // Clear cache to ensure fresh data
      clearSalaryDataCache();
      
      // Dispatch filter change event
      window.dispatchEvent(new CustomEvent('filterChanged', {
        detail: { 
          type: 'customDate', 
          startDate,
          endDate,
          timePeriod,
          selectedDepartment
        }
      }));
      
      // Reset loading state after a short delay (will be cleared by HRStats when data loads)
      setTimeout(() => {
        setIsCustomRangeLoading(false);
      }, 3000); // Fallback timeout
    }
  };

  // Handle Go button click
  const handleGoButtonClick = () => {
    if (!customStartMonth || !customStartYear || !customEndMonth || !customEndYear) {
      setDateRangeError('Please select all date fields');
      return;
    }

    if (dateRangeError) {
      return; // Don't proceed if there's a validation error
    }

    // Validate dates one more time
    const startYear = parseInt(customStartYear);
    const startMonth = parseInt(customStartMonth);
    const endYear = parseInt(customEndYear);
    const endMonth = parseInt(customEndMonth);
    
    const error = validateDateRange(startYear, startMonth, endYear, endMonth);
    if (error) {
      setDateRangeError(error);
      return;
    }

    // Build dates
    const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(endYear, endMonth, 0).getDate();
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    // Trigger API call
    handleCustomDateChange(startDate, endDate, true);
  };

  // Listen for data loaded event to stop loading
  useEffect(() => {
    const handleDataLoaded = () => {
      if (isCustomRangeLoading) {
        setIsCustomRangeLoading(false);
      }
    };

    window.addEventListener('customRangeDataLoaded', handleDataLoaded);
    return () => {
      window.removeEventListener('customRangeDataLoaded', handleDataLoaded);
    };
  }, [isCustomRangeLoading]);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    if (dark) {
      document.documentElement.classList.add('dark');
    }
  }, [dark]);

  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/accept-invitation" element={<AcceptInvitation />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/change-password" element={<ChangePassword />} />
      {/* Protected Routes */}
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-black dark:text-white">
              {/* Left Sidebar */}
              <Routes>
                <Route path="/hr-management/*" element={<HRSidebar activePage={activePage} onPageChange={setActivePage} />} />
                <Route path="*" element={<HRSidebar activePage={activePage} onPageChange={setActivePage} />} />
              </Routes>
              {/* Main Content Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <Routes>
                  <Route path="/hr-management/*" element={<HRHeader dark={dark} setDark={setDark} />} />
                  <Route path="*" element={<HRHeader dark={dark} setDark={setDark} />} />
                </Routes>
                {/* Main Content with Right Sidebar */}
                <div className="flex flex-1 overflow-hidden">
                  {/* Main Content */}
                  <main className="flex-1 overflow-auto p-6 hide-scrollbar">
                    <div className="max-w-full mx-auto">
                      <CreditProtectedRoute>
                        <Routes>
                          {/* HR Management Routes */}
                          <Route path="/hr-management" element={
                          <>
                            <div className="flex justify-end items-center mb-6">
                              <div className="flex items-center gap-4">
                                <Dropdown
                                  options={timePeriodDropdownOptions}
                                  value={timePeriod}
                                  onChange={handleTimePeriodSelect}
                                  className="w-48"
                                />
                                <Dropdown
                                  options={departmentDropdownOptions}
                                  value={selectedDepartment}
                                  onChange={handleDepartmentSelect}
                                  className="w-48"
                                />
                                
                                {/* Custom Month/Year Range Inputs - Show when Custom Range is selected */}
                                {timePeriod === 'custom_range' && (
                                  <>
                                    <div className="w-32">
                                      <Dropdown
                                        options={(() => {
                                          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                                             'July', 'August', 'September', 'October', 'November', 'December'];
                                          const startYear = parseInt(customStartYear || '0');
                                          return [
                                            { value: '', label: 'From Month', disabled: false },
                                            ...monthNames.map((name, idx) => {
                                              const monthNum = idx + 1;
                                              const isFutureMonth = startYear > currentYear || 
                                                (startYear === currentYear && monthNum > currentMonth);
                                              return {
                                                value: monthNum.toString(),
                                                label: name,
                                                disabled: startYear > 0 && isFutureMonth
                                              };
                                            })
                                          ];
                                        })()}
                                        value={customStartMonth || ''}
                                        onChange={(month) => {
                                          setCustomStartMonth(month);
                                          setDateRangeError(''); // Clear error on change
                                          
                                          if (month && customStartYear) {
                                            const year = parseInt(customStartYear);
                                            const monthNum = parseInt(month);
                                            
                                            // Validate if end date is selected
                                            if (customEndYear && customEndMonth) {
                                              const endYear = parseInt(customEndYear);
                                              const endMonth = parseInt(customEndMonth);
                                              const error = validateDateRange(year, monthNum, endYear, endMonth);
                                              setDateRangeError(error);
                                              if (error) return; // Don't update date if validation fails
                                            }
                                            
                                            const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
                                            handleCustomDateChange(startDate, customEndDate, false);
                                          }
                                        }}
                                        placeholder="From Month"
                                      />
                                    </div>
                                    <div className="w-24">
                                      <Dropdown
                                        options={[
                                          { value: '', label: 'From Year', disabled: false },
                                          ...Array.from({ length: 10 }, (_, i) => {
                                            const year = currentYear - i;
                                            return {
                                              value: year.toString(),
                                              label: year.toString()
                                            };
                                          })
                                        ]}
                                        value={customStartYear || ''}
                                        onChange={(year) => {
                                          setCustomStartYear(year);
                                          setDateRangeError(''); // Clear error on change
                                          
                                          if (year && customStartMonth) {
                                            const yearNum = parseInt(year);
                                            const monthNum = parseInt(customStartMonth);
                                            
                                            // Validate if end date is selected
                                            if (customEndYear && customEndMonth) {
                                              const endYear = parseInt(customEndYear);
                                              const endMonth = parseInt(customEndMonth);
                                              const error = validateDateRange(yearNum, monthNum, endYear, endMonth);
                                              setDateRangeError(error);
                                              if (error) return; // Don't update date if validation fails
                                            }
                                            
                                            // Check if start date is in future
                                            if (yearNum > currentYear || (yearNum === currentYear && monthNum > currentMonth)) {
                                              setDateRangeError('Start date cannot be in the future');
                                              return;
                                            }
                                            
                                            const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
                                            handleCustomDateChange(startDate, customEndDate, false);
                                          }
                                        }}
                                        placeholder="From Year"
                                      />
                                    </div>
                                    <div className="w-32">
                                      <Dropdown
                                        options={(() => {
                                          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                                             'July', 'August', 'September', 'October', 'November', 'December'];
                                          const endYear = parseInt(customEndYear || '0');
                                          return [
                                            { value: '', label: 'To Month', disabled: false },
                                            ...monthNames.map((name, idx) => {
                                              const monthNum = idx + 1;
                                              const isFutureMonth = endYear > currentYear || 
                                                (endYear === currentYear && monthNum > currentMonth);
                                              
                                              // Also check if month is before start month (if start date is selected)
                                              const isBeforeStart = customStartYear && customStartMonth 
                                                ? (endYear < parseInt(customStartYear) || 
                                                   (endYear === parseInt(customStartYear) && monthNum < parseInt(customStartMonth)))
                                                : false;
                                              
                                              return {
                                                value: monthNum.toString(),
                                                label: name,
                                                disabled: isFutureMonth || isBeforeStart
                                              };
                                            })
                                          ];
                                        })()}
                                        value={customEndMonth || ''}
                                        onChange={(month) => {
                                          setCustomEndMonth(month);
                                          setDateRangeError(''); // Clear error on change
                                          
                                          if (month && customEndYear) {
                                            const year = parseInt(customEndYear);
                                            const monthNum = parseInt(month);
                                            
                                            // Validate if start date is selected
                                            if (customStartYear && customStartMonth) {
                                              const startYear = parseInt(customStartYear);
                                              const startMonth = parseInt(customStartMonth);
                                              const error = validateDateRange(startYear, startMonth, year, monthNum);
                                              setDateRangeError(error);
                                              if (error) return; // Don't update date if validation fails
                                            }
                                            
                                            const lastDay = new Date(year, monthNum, 0).getDate();
                                            const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                                            handleCustomDateChange(customStartDate, endDate, false);
                                          }
                                        }}
                                        placeholder="To Month"
                                        disabled={!customStartMonth || !customStartYear}
                                      />
                                    </div>
                                    <div className="w-24">
                                      <Dropdown
                                        options={[
                                          { value: '', label: 'To Year', disabled: false },
                                          ...Array.from({ length: 10 }, (_, i) => {
                                            const year = currentYear - i;
                                            // Check if year is before start year (if start date is selected)
                                            const isBeforeStart = customStartYear && parseInt(customStartYear) > year;
                                            return {
                                              value: year.toString(),
                                              label: year.toString(),
                                              disabled: isBeforeStart
                                            };
                                          })
                                        ]}
                                        value={customEndYear || ''}
                                        onChange={(year) => {
                                          setCustomEndYear(year);
                                          setDateRangeError(''); // Clear error on change
                                          
                                          if (year && customEndMonth) {
                                            const yearNum = parseInt(year);
                                            const monthNum = parseInt(customEndMonth);
                                            
                                            // Validate if start date is selected
                                            if (customStartYear && customStartMonth) {
                                              const startYear = parseInt(customStartYear);
                                              const startMonth = parseInt(customStartMonth);
                                              const error = validateDateRange(startYear, startMonth, yearNum, monthNum);
                                              setDateRangeError(error);
                                              if (error) return; // Don't update date if validation fails
                                            }
                                            
                                            const lastDay = new Date(yearNum, monthNum, 0).getDate();
                                            const endDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                                            handleCustomDateChange(customStartDate, endDate, false);
                                          }
                                        }}
                                        placeholder="To Year"
                                        disabled={!customStartMonth || !customStartYear}
                                      />
                                    </div>
                                    {dateRangeError && (
                                      <div className="flex items-end">
                                        <p className="text-sm text-red-600 dark:text-red-400 mb-1">{dateRangeError}</p>
                                      </div>
                                    )}
                                    <div className="flex items-end gap-2">
                                      <button
                                        onClick={handleGoButtonClick}
                                        disabled={isCustomRangeLoading || !customStartMonth || !customStartYear || !customEndMonth || !customEndYear || !!dateRangeError}
                                        className="px-4 py-2.5 text-sm font-medium bg-teal-500 hover:bg-teal-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 min-w-[80px]"
                                      >
                                        {isCustomRangeLoading ? (
                                          <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                            <span>Loading...</span>
                                          </>
                                        ) : (
                                          'Go'
                                        )}
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleCustomDateChange('', '', false);
                                          setCustomStartMonth('');
                                          setCustomStartYear('');
                                          setCustomEndMonth('');
                                          setCustomEndYear('');
                                          setDateRangeError('');
                                          setIsCustomRangeLoading(false);
                                        }}
                                        className="px-4 py-2.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200 min-w-[80px]"
                                      >
                                        Clear
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="space-y-6">
                              <HRStats 
                                timePeriod={timePeriod} 
                                selectedDepartment={selectedDepartment === "N/A" ? "N/A" : selectedDepartment} 
                                overviewSalaryData={overviewSalaryData}
                                customStartDate={customStartDate}
                                customEndDate={customEndDate}
                              />
                                <HROverviewCharts 
                                  timePeriod={timePeriod} 
                                  selectedDepartment={selectedDepartment === "N/A" ? "N/A" : selectedDepartment} 
                                  onSalaryData={(d) => setOverviewSalaryData(d)}
                                  customStartDate={customStartDate}
                                  customEndDate={customEndDate}
                                />
                            </div>
                          </>
                        } />
                        {/* Directory/Employees Route */}
                        <Route path="/hr-management/directory" element={<HRDirectory />} />
                        {/* Add Employee Route */}
                        <Route path="/hr-management/directory/add" element={<HRAddEmployee />} />
                        {/* Employee Details Route */}
                        <Route path="/hr-management/directory/:id" element={<HREmployeeDetails />} />
                        {/* Employee Edit Route */}
                        <Route path="/hr-management/employees/edit/:id" element={<HREmployeeDetails />} />
                        {/* Payroll Route */}
                        <Route path="/hr-management/payroll" element={<HRPayrollNew />} />
                        {/* Payroll Overview Route */}
                        <Route path="/hr-management/payroll-overview" element={<PayrollOverview />} />

                        {/* Attendance Tracker Route */}
                        <Route path="/hr-management/attendance-tracker" element={<HRAttendanceTracker />} />
                <Route path="/hr-management/attendance-log" element={<HRAttendanceLog />} />
                        {/* Face Attendance Route - Shows Daily Check Log */}
                        <Route path="/hr-management/face-attendance" element={<HRDailyCheckLog />} />
                        {/* Leave Management Route */}
                        <Route path="/hr-management/leave-management" element={<HRLeaveManagement />} />
                        {/* Data Upload Route */}
                        <Route path="/hr-management/data-upload" element={<HRDataUpload />} />
                        {/* Team Management Route */}
                        <Route path="/hr-management/team" element={<HRUserInvitation />} />
                        {/* Support Route */}
                        <Route path="/hr-management/support" element={<HRSupport />} />
                        {/* Settings Route */}
                        <Route path="/hr-management/settings" element={<HRSettings />} />
                        {/* Super Admin Route */}
                        <Route path="/super-admin" element={<SuperAdminDashboard />} />
                          {/* Redirect root to hr-management */}
                          <Route path="/" element={<Navigate to="/hr-management" replace />} />
                        </Routes>
                      </CreditProtectedRoute>
                    </div>
                  </main>
                </div>
              </div>
            </div>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

function App() {
  const [dark, setDark] = useState(false); // Always start with light theme

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    if (dark) {
      document.documentElement.classList.add('dark');
    }
  }, [dark]);

  return (
    <Router>
      <AppContent dark={dark} setDark={setDark} />
    </Router>
  );
}

export default App;