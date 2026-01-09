// Login Screen
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAppDispatch } from '@/store/hooks';
import { setUser, setTenant } from '@/store/slices/authSlice';
import { authService, LoginCredentials } from '@/services/authService';
import { storage } from '@/utils/storage';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import SniperThinkLogo from '@/components/SniperThinkLogo';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const dispatch = useAppDispatch();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  
  // Forced PIN setup modal state
  const [showForcedPINModal, setShowForcedPINModal] = useState(false);
  const [pinData, setPinData] = useState({
    pin: ['', '', '', ''],
    confirmPin: ['', '', '', ''],
    password: '',
  });
  const [pinProcessing, setPinProcessing] = useState(false);
  const [loginResponse, setLoginResponse] = useState<any>(null);
  
  // Refs for PIN inputs
  const pinInputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];
  const confirmPinInputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];
  
  // Ref to track if we're coming from logout (prevents API calls)
  const isLoggingOut = useRef(false);
  const sessionCheckInProgress = useRef(false);

  // Check for existing session on mount (skip if coming from logout)
  useEffect(() => {
    const initializeLogin = async () => {
      // Keep splash screen visible during session check
      await SplashScreen.preventAutoHideAsync();
      
      // If logout param is present, skip session check and clear any remaining data
      if (params.logout === 'true') {
        // Mark that we're logging out to prevent any API calls
        isLoggingOut.current = true;
        // Clear any remaining storage multiple times to be sure
        await storage.clearAll();
        await storage.clearAll(); // Double clear
        // Wait longer to ensure everything is cleared (3 seconds total)
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Final check - if token still exists, clear again
        const remainingToken = await storage.getAccessToken();
        if (remainingToken) {
          await storage.clearAll();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        setCheckingSession(false);
        // Hide splash screen after logout cleanup
        await SplashScreen.hideAsync();
        return;
      }
      
      // Add a longer delay before checking session to ensure any logout operations complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // After delay, verify we're not in a logout state
      // Check if params changed to logout during the delay
      if (params.logout === 'true' || isLoggingOut.current) {
        setCheckingSession(false);
        return;
      }
      
      // Double-check that we still have a token before checking session
      // (in case logout happened during the delay)
      const accessToken = await storage.getAccessToken();
      if (!accessToken) {
        setCheckingSession(false);
        return;
      }
      
      // Also check if logout param appeared (race condition protection)
      const currentParams = params;
      if (currentParams.logout === 'true') {
        setCheckingSession(false);
        return;
      }
      
      await checkExistingSession();
      // Hide splash screen after session check completes
      await SplashScreen.hideAsync();
    };
    
    initializeLogin();
  }, [params.logout]);

  const checkExistingSession = async () => {
    // Use a flag to prevent concurrent execution
    if (sessionCheckInProgress.current) {
      return;
    }
    sessionCheckInProgress.current = true;
    
    try {
      // Check if logout param is present (double-check in case params changed)
      if (params.logout === 'true' || isLoggingOut.current) {
        setCheckingSession(false);
        await SplashScreen.hideAsync();
        return;
      }
      
      // Triple-check: verify storage is actually populated
      const accessToken = await storage.getAccessToken();
      const savedUser = await storage.getUser();
      const savedTenant = await storage.getTenant();
      
      // If any of these are missing, don't proceed
      if (!accessToken || !savedUser || !savedTenant) {
        setCheckingSession(false);
        await SplashScreen.hideAsync();
        return;
      }
      
      // Final check before proceeding
      if (isLoggingOut.current || params.logout === 'true') {
        setCheckingSession(false);
        await SplashScreen.hideAsync();
        return;
      }
      
      if (savedUser && savedTenant && accessToken) {
        console.log('Found existing session for:', savedUser.email);
        
        // Superusers don't need PIN verification
        if (savedUser.is_superuser) {
          console.log('Superuser detected - skipping PIN check');
          await SplashScreen.hideAsync();
          dispatch(setUser(savedUser));
          dispatch(setTenant(savedTenant));
          router.replace('/(drawer)');
          setCheckingSession(false);
          return;
        }
        
        // Check PIN status - PIN is now mandatory
        // CRITICAL: Check if we're logging out BEFORE making ANY API calls
        if (isLoggingOut.current || params.logout === 'true') {
          setCheckingSession(false);
          return;
        }
        
        try {
          // Double-check again right before API call (race condition protection)
          if (isLoggingOut.current || params.logout === 'true') {
            setCheckingSession(false);
            await SplashScreen.hideAsync();
            return;
          }
          
          const pinStatusPromise = authService.getPINStatus();
          const timeoutPromise = new Promise<any>((_, reject) => {
            setTimeout(() => reject(new Error('PIN status check timeout')), 5000);
          });
          
          const pinStatus = await Promise.race([pinStatusPromise, timeoutPromise]);
          console.log('PIN status result:', pinStatus);
          
          // Check if we're still not logging out after API call
          if (isLoggingOut.current || params.logout === 'true') {
            setCheckingSession(false);
            await SplashScreen.hideAsync();
            return;
          }
          
          // Check if user has a PIN set up
          if (!pinStatus.has_pin) {
            console.log('No PIN found - showing forced setup modal');
            setShowForcedPINModal(true);
            return;
          }
          
          // User has PIN - check if PIN entry is required
          // Double-check we're not logging out before making API calls
          if (isLoggingOut.current || params.logout === 'true') {
            setCheckingSession(false);
            return;
          }
          
          const pinCheckPromise = authService.checkPINRequired(savedUser.email);
          const pinCheckTimeout = new Promise<{ pin_required: boolean }>((_, reject) => {
            setTimeout(() => reject(new Error('PIN check timeout')), 5000);
          });
          
          const pinCheck = await Promise.race([pinCheckPromise, pinCheckTimeout]);
          console.log('PIN check result:', pinCheck);
          
          // Final check before redirecting - make sure we're not logging out
          if (isLoggingOut.current || params.logout === 'true') {
            setCheckingSession(false);
            await SplashScreen.hideAsync();
            return;
          }
          
          if (pinCheck.pin_required) {
            console.log('Existing session - navigating to PIN entry');
            const userName = savedUser.name || 
                            `${savedUser.first_name || ''} ${savedUser.last_name || ''}`.trim() || 
                            savedUser.email?.split('@')[0] || 
                            'User';
            const companyName = savedTenant.name || '';
            
            // Hide splash screen before navigating to PIN entry
            await SplashScreen.hideAsync();
            router.replace({
              pathname: '/(auth)/pin-entry',
              params: {
                email: savedUser.email,
                userName,
                companyName,
                existingSession: 'true',
              },
            });
            return;
          }
        } catch (err) {
          console.error('PIN check failed or timed out for existing session:', err);
          // On error, try to check PIN required directly instead of assuming no PIN
          try {
            const pinCheck = await authService.checkPINRequired(savedUser.email);
            if (pinCheck.pin_required) {
              const userName = savedUser.name || 
                              `${savedUser.first_name || ''} ${savedUser.last_name || ''}`.trim() || 
                              savedUser.email?.split('@')[0] || 
                              'User';
              const companyName = savedTenant.name || '';
              
              router.replace({
                pathname: '/(auth)/pin-entry',
                params: {
                  email: savedUser.email,
                  userName,
                  companyName,
                  existingSession: 'true',
                },
              });
              return;
            }
          } catch (checkErr) {
            console.error('PIN required check also failed:', checkErr);
            // Only show forced setup if we can't verify PIN exists
            // If we can't check, assume PIN might exist and proceed to dashboard
            console.warn('Cannot verify PIN status - proceeding to dashboard');
          }
        }
        
        // PIN enabled and verified - go directly to dashboard
        await SplashScreen.hideAsync();
        dispatch(setUser(savedUser));
        dispatch(setTenant(savedTenant));
        router.replace('/(drawer)');
        return;
      }
    } catch (error) {
      console.log('No existing session found');
    } finally {
      sessionCheckInProgress.current = false;
      setCheckingSession(false);
      // Hide splash screen when session check is complete
      await SplashScreen.hideAsync();
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const credentials: LoginCredentials = {
        email,
        password,
      };

      console.log('Attempting login for:', email);
      
      // Retry logic for first-time connection issues
      let response;
      let retries = 0;
      const maxRetries = 2;
      
      while (retries < maxRetries) {
        try {
          response = await authService.login(credentials);
          console.log('Login successful, got response');
          break;
        } catch (loginError: any) {
          retries++;
          console.log(`Login attempt ${retries} failed:`, loginError.message);
          console.log('Error details:', JSON.stringify(loginError, null, 2));
          
          if (retries >= maxRetries) {
            throw loginError;
          }
          
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('Retrying login...');
        }
      }
      
      if (!response) {
        throw new Error('Login failed after retries');
      }

      // Small delay to ensure login is fully processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Superusers don't need PIN verification
      if (response.user?.is_superuser) {
        console.log('Superuser detected - skipping PIN check');
        // Complete login for superuser
        await storage.setAccessToken(response.access);
        await storage.setRefreshToken(response.refresh);
        await storage.setUser(response.user);
        if (response.tenant) {
          await storage.setTenant(response.tenant);
        }
        dispatch(setUser(response.user));
        if (response.tenant) {
          dispatch(setTenant(response.tenant));
        }
        router.replace('/(drawer)');
        setLoading(false);
        return;
      }

      // Check PIN status - PIN is now mandatory for all accounts
      try {
        console.log('Checking PIN status for:', email);
        
        const pinStatusPromise = authService.getPINStatus();
        const timeoutPromise = new Promise<any>((_, reject) => {
          setTimeout(() => reject(new Error('PIN status check timeout')), 5000);
        });
        
        const pinStatus = await Promise.race([pinStatusPromise, timeoutPromise]);
        console.log('PIN status result:', pinStatus);
        
        // Check if user has a PIN set up (not just if it's enabled)
        if (!pinStatus.has_pin) {
          console.log('No PIN found - forcing PIN setup');
          // Store login response and show forced PIN setup modal
          setLoginResponse(response);
          setShowForcedPINModal(true);
          setLoading(false);
          return;
        }
        
        // User has PIN - check if PIN entry is required
        const pinCheckPromise = authService.checkPINRequired(email);
        const pinCheckTimeout = new Promise<{ pin_required: boolean }>((_, reject) => {
          setTimeout(() => reject(new Error('PIN check timeout')), 5000);
        });
        
        const pinCheck = await Promise.race([pinCheckPromise, pinCheckTimeout]);
        console.log('PIN check result:', pinCheck);
        
        if (pinCheck.pin_required) {
          console.log('PIN required - navigating to PIN entry screen');
          const userName = response.user?.name || 
                          `${response.user?.first_name || ''} ${response.user?.last_name || ''}`.trim() || 
                          response.user?.email?.split('@')[0] || 
                          'User';
          const companyName = response.tenant?.name || '';
          
          router.push({
            pathname: '/(auth)/pin-entry',
            params: {
              email,
              userName,
              companyName,
              tempLoginData: JSON.stringify(response),
            },
          });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Error checking PIN status:', err);
        // On error, try to check PIN required directly instead of assuming no PIN
        try {
          const pinCheck = await authService.checkPINRequired(email);
          if (pinCheck.pin_required) {
            console.log('PIN required (fallback check) - navigating to PIN entry screen');
            const userName = response.user?.name || 
                            `${response.user?.first_name || ''} ${response.user?.last_name || ''}`.trim() || 
                            response.user?.email?.split('@')[0] || 
                            'User';
            const companyName = response.tenant?.name || '';
            
            router.push({
              pathname: '/(auth)/pin-entry',
              params: {
                email,
                userName,
                companyName,
                tempLoginData: JSON.stringify(response),
              },
            });
            setLoading(false);
            return;
          }
        } catch (checkErr) {
          console.error('PIN required check also failed:', checkErr);
          // If we can't verify PIN status, don't force setup - proceed with login
          // This prevents false positives when network is slow
          console.warn('Cannot verify PIN status - proceeding with login');
        }
      }

      // PIN enabled and verified - complete login
      dispatch(setUser(response.user));
      dispatch(setTenant(response.tenant));

      // Navigate to main app
      router.replace('/(drawer)');
    } catch (error: any) {
      // Handle different error types
      let errorMessage = 'Invalid email or password';
      
      if (error.message) {
        if (error.message.includes('SESSION_INVALID') || error.message.includes('session')) {
          errorMessage = 'Session error occurred. Please try logging in again.';
        } else if (error.message.includes('already_logged_in')) {
          errorMessage = 'You are already logged in on another device.';
        } else if (error.message.includes('verified')) {
          errorMessage = 'Email not verified. Please check your email.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (index: number, value: string, type: 'pin' | 'confirmPin') => {
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pinData[type]];
    newPin[index] = value;
    setPinData({ ...pinData, [type]: newPin });

    // Auto-focus next input
    if (value && index < 3) {
      if (type === 'pin') {
        pinInputRefs[index + 1].current?.focus();
      } else {
        confirmPinInputRefs[index + 1].current?.focus();
      }
    }
  };

  const handleForcedPINSetup = async () => {
    const fullPin = pinData.pin.join('');
    const confirmFullPin = pinData.confirmPin.join('');

    if (fullPin.length !== 4) {
      Alert.alert('Error', 'Please enter a 4-digit PIN');
      return;
    }

    if (fullPin !== confirmFullPin) {
      Alert.alert('Error', 'PINs do not match');
      return;
    }

    if (!pinData.password) {
      Alert.alert('Error', 'Please enter your password to confirm');
      return;
    }

    try {
      setPinProcessing(true);
      
      // Add timeout handling for PIN setup
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('PIN setup timeout. Please try again.')), 10000);
      });
      
      const result = await Promise.race([authService.setupPIN(fullPin, pinData.password), timeoutPromise]);
      
      if (result.success) {
        // PIN setup successful - complete login
        if (loginResponse) {
          dispatch(setUser(loginResponse.user));
          dispatch(setTenant(loginResponse.tenant));
          setShowForcedPINModal(false);
          setPinData({ pin: ['', '', '', ''], confirmPin: ['', '', '', ''], password: '' });
          router.replace('/(drawer)');
        } else {
          // For existing session
          const savedUser = await storage.getUser();
          const savedTenant = await storage.getTenant();
          if (savedUser && savedTenant) {
            dispatch(setUser(savedUser));
            dispatch(setTenant(savedTenant));
            setShowForcedPINModal(false);
            setPinData({ pin: ['', '', '', ''], confirmPin: ['', '', '', ''], password: '' });
            router.replace('/(drawer)');
          }
        }
      } else {
        // Clean up tokens on failure
        await storage.clearAll();
        Alert.alert('Error', result.message || 'Failed to set up PIN');
      }
    } catch (error: any) {
      // Clean up tokens on error
      await storage.clearAll();
      
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
      
      Alert.alert('Error', errorMessage);
    } finally {
      setPinProcessing(false);
    }
  };

  // Show loading screen while checking for existing session
  if (checkingSession) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#176d67" />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          {/* Logo and Title */}
          <View style={styles.header}>
            <SniperThinkLogo size={60} color="#176d67" marginBottom={32} />
            <Text style={[styles.title, { color: '#176d67' }]}>SniperThink HRMS</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Analyze. Automate. Accelerate.
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Welcome back! Please login to continue.
            </Text>
          </View>

          {/* Login Form */}
          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter your email"
                placeholderTextColor={colors.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <FontAwesome 
                    name={showPassword ? 'eye-slash' : 'eye'} 
                    size={20} 
                    color={colors.textLight} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password */}
            <View style={styles.forgotPasswordContainer}>
              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={[styles.forgotPassword, { color: '#176d67' }]}>
                  Forgot password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: '#176d67' }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            {/* <View style={styles.signupContainer}>
              <Text style={[styles.signupText, { color: colors.textSecondary }]}>
                New to SniperThink?{' '}
              </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                <Text style={[styles.signupLink, { color: '#176d67' }]}>Sign up</Text>
              </TouchableOpacity>
            </View> */}
          </View>
        </View>
      </ScrollView>

      {/* Forced PIN Setup Modal */}
      <Modal
        visible={showForcedPINModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {}} // Prevent closing - PIN setup is mandatory
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.background }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <FontAwesome name="lock" size={24} color={colors.primary || '#176d67'} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>PIN Setup Required</Text>
              </View>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.warningBox}>
                <FontAwesome name="exclamation-circle" size={20} color={colors.primary || '#176d67'} />
                <Text style={[styles.warningText, { color: colors.text }]}>
                  PIN authentication is mandatory for all accounts. Please set up your PIN to continue.
                </Text>
              </View>

              <Text style={[styles.label, { color: colors.text, marginTop: 24, marginBottom: 16 }]}>
                Enter a 4-digit PIN
              </Text>

              <View style={styles.pinInputContainer}>
                {[0, 1, 2, 3].map((index) => (
                  <TextInput
                    key={index}
                    ref={pinInputRefs[index]}
                    style={[styles.pinInput, { color: colors.text, borderColor: colors.border }]}
                    value={pinData.pin[index]}
                    onChangeText={(value) => handlePinChange(index, value, 'pin')}
                    keyboardType="numeric"
                    maxLength={1}
                    secureTextEntry
                  />
                ))}
              </View>

              <Text style={[styles.label, { color: colors.text, marginTop: 24, marginBottom: 16 }]}>
                Confirm PIN
              </Text>

              <View style={styles.pinInputContainer}>
                {[0, 1, 2, 3].map((index) => (
                  <TextInput
                    key={index}
                    ref={confirmPinInputRefs[index]}
                    style={[styles.pinInput, { color: colors.text, borderColor: colors.border }]}
                    value={pinData.confirmPin[index]}
                    onChangeText={(value) => handlePinChange(index, value, 'confirmPin')}
                    keyboardType="numeric"
                    maxLength={1}
                    secureTextEntry
                  />
                ))}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Password (for verification)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  value={pinData.password}
                  onChangeText={(value) => setPinData({ ...pinData, password: value })}
                  secureTextEntry
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textLight}
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.primaryButton, { backgroundColor: colors.primary || '#176d67', opacity: pinProcessing ? 0.6 : 1 }]}
                onPress={handleForcedPINSetup}
                disabled={pinProcessing}
              >
                {pinProcessing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: 'white' }]}>Setup PIN & Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingRight: 48,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPassword: {
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    margin: 20,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#176d67',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  pinInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  pinInput: {
    flex: 1,
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    backgroundColor: 'white',
  },
  inputGroup: {
    marginTop: 24,
  },
});

