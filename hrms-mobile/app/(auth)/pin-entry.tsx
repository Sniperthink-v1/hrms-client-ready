// PIN Entry Screen for Mobile
import React, { useState, useRef, useEffect } from 'react';
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
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppDispatch } from '@/store/hooks';
import { setUser, setTenant } from '@/store/slices/authSlice';
import { authService } from '@/services/authService';
import { biometricService } from '@/services/biometricService';
import { storage } from '@/utils/storage';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import SniperThinkLogo from '@/components/SniperThinkLogo';

export default function PINEntryScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Get params from navigation
  const params = useLocalSearchParams();
  const email = params.email as string;
  const userName = params.userName as string;
  const companyName = params.companyName as string;
  const tempLoginData = params.tempLoginData ? JSON.parse(params.tempLoginData as string) : null;
  const existingSession = params.existingSession === 'true';

  const [pin, setPin] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | 'iris' | 'none'>('none');
  const [biometricPrompted, setBiometricPrompted] = useState(false);
  const [biometricCancelled, setBiometricCancelled] = useState(false);

  // Refs for PIN inputs
  const inputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  useEffect(() => {
    // Check if we have required params (email is mandatory)
    if (!email) {
      // No email means no valid context - redirect to login
      router.replace('/(auth)/login');
      return;
    }
    
    // Check biometric availability on mount
    checkBiometricAvailability();
  }, []);

  useEffect(() => {
    // Only auto-prompt once on mount if biometric is available
    // Don't auto-prompt if user has already cancelled or prompted
    if (biometricAvailable && !biometricPrompted && !biometricCancelled && !loading) {
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 500);
      return () => clearTimeout(timer);
    } else if (!biometricAvailable && !biometricPrompted) {
      // Focus first input if biometric is not available
      const timer = setTimeout(() => {
        inputRefs[0].current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricAvailable]);

  const checkBiometricAvailability = async () => {
    try {
      const availability = await biometricService.checkAvailability();
      setBiometricAvailable(availability.available);
      setBiometricType(availability.type);
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      setBiometricAvailable(false);
    }
  };

  const handleBiometricAuth = async () => {
    if (!biometricAvailable || loading) return;
    
    setBiometricPrompted(true);
    setLoading(true);
    setError('');
    
    try {
      const result = await biometricService.authenticate(
        `Authenticate to access your account`
      );
      
      if (result.success) {
        // Biometric authentication successful
        // Check if we have a stored PIN for backend verification
        // For now, we'll proceed since biometric is device-level security
        // The backend session is already established, biometric just unlocks the device
        
        try {
          let userData = null;
          let tenantData = null;

          // Complete the authentication flow
          if (existingSession) {
            const savedUser = await storage.getUser();
            const savedTenant = await storage.getTenant();
            if (savedUser && savedTenant) {
              userData = savedUser;
              tenantData = savedTenant;
            }
          } else if (tempLoginData) {
            userData = tempLoginData.user;
            tenantData = tempLoginData.tenant;
          }

          // Only navigate if we have valid user and tenant data
          if (userData && tenantData) {
            dispatch(setUser(userData));
            dispatch(setTenant(tenantData));
            router.replace('/(drawer)');
            return;
          }
          
          // If we reach here, no valid session data
          setError('Session expired. Please login again.');
          setBiometricPrompted(false);
          setTimeout(() => {
            router.replace('/(auth)/login');
          }, 2000);
        } catch (error: any) {
          console.error('Error completing authentication:', error);
          setError('Authentication completed but failed to load user data. Please login again.');
          setBiometricPrompted(false);
          setTimeout(() => {
            router.replace('/(auth)/login');
          }, 2000);
        }
      } else {
        // Biometric failed or cancelled - fall back to PIN
        setBiometricPrompted(false);
        // Mark as cancelled to prevent auto-reopening
        if (result.error === 'Authentication cancelled' || result.error === 'user_cancel') {
          setBiometricCancelled(true);
        } else {
          setError('Biometric authentication failed. Please use PIN.');
        }
        // Focus first input for PIN entry
        setTimeout(() => {
          inputRefs[0].current?.focus();
        }, 300);
      }
    } catch (error: any) {
      console.error('Biometric authentication error:', error);
      setBiometricPrompted(false);
      setBiometricCancelled(true);
      setError('Biometric authentication failed. Please use PIN.');
      setTimeout(() => {
        inputRefs[0].current?.focus();
      }, 300);
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError('');

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 4 digits are entered
    if (index === 3 && value) {
      const fullPin = newPin.join('');
      if (fullPin.length === 4) {
        setTimeout(() => handleSubmit(fullPin), 100);
      }
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    // Handle backspace
    if (key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleSubmit = async (pinValue?: string) => {
    const fullPin = pinValue || pin.join('');

    if (fullPin.length !== 4) {
      setError('Please enter all 4 digits');
      return;
    }

    if (!email) {
      setError('Email is required. Please login first.');
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 2000);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authService.verifyPIN(email, fullPin);

      if (response.success) {
        let userData = null;
        let tenantData = null;

        // For existing session, user and tenant are already in storage
        if (existingSession) {
          const savedUser = await storage.getUser();
          const savedTenant = await storage.getTenant();
          if (savedUser && savedTenant) {
            userData = savedUser;
            tenantData = savedTenant;
          }
        } else if (tempLoginData) {
          // New login - use temp data
          userData = tempLoginData.user;
          tenantData = tempLoginData.tenant;
        }

        // Only navigate if we have valid user and tenant data
        if (userData && tenantData) {
          dispatch(setUser(userData));
          dispatch(setTenant(tenantData));
          // Navigate immediately - dashboard will load data in background
          router.replace('/(drawer)');
        } else {
          // No valid session data - redirect to login
          setError('Session expired. Please login again.');
          setTimeout(() => {
            router.replace('/(auth)/login');
          }, 2000);
        }
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Invalid PIN. Please try again.';
      setError(errorMessage);
      
      // Clear PIN on error
      setPin(['', '', '', '']);
      inputRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleNumberPress = (num: string) => {
    if (loading) return;
    
    // Find first empty slot
    const emptyIndex = pin.findIndex(d => d === '');
    if (emptyIndex !== -1) {
      const newPin = [...pin];
      newPin[emptyIndex] = num;
      setPin(newPin);
      setError('');
      
      // Auto-submit when all 4 digits are entered
      if (emptyIndex === 3) {
        const fullPin = newPin.join('');
        setTimeout(() => handleSubmit(fullPin), 100);
      }
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    
    // Find last filled slot
    const lastFilledIndex = pin.findIndex(d => d === '') - 1;
    const indexToClear = lastFilledIndex >= 0 ? lastFilledIndex : pin.length - 1;
    
    if (indexToClear >= 0 && pin[indexToClear] !== '') {
      const newPin = [...pin];
      newPin[indexToClear] = '';
      setPin(newPin);
      setError('');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#176d67" />
      
      {/* Teal Header */}
      <View style={styles.tealHeader}>
        <SniperThinkLogo size={50} color="#fff" marginBottom={0} />
        <Text style={styles.headerTitle}>SniperThink HRMS</Text>
      </View>

      <View style={[styles.content, { backgroundColor: colors.background }]}>
            {/* User Info */}
            <View style={styles.userInfo}>
              <View style={styles.avatarContainer}>
                <FontAwesome name="user-circle" size={50} color="#176d67" />
              </View>
              {userName && (
                <Text style={[styles.welcomeText, { color: colors.text }]}>
                  Welcome back, {userName}
                </Text>
              )}
              {companyName && (
                <Text style={[styles.companyText, { color: colors.textSecondary }]}>
                  {companyName}
                </Text>
              )}
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Enter your 4-digit PIN
              </Text>
            </View>

            {/* Biometric Icon */}
            {biometricAvailable && (
              <TouchableOpacity
                style={styles.biometricIconContainer}
                onPress={handleBiometricAuth}
                disabled={loading}
                activeOpacity={0.7}
              >
                <FontAwesome 
                  name={biometricType === 'face' ? 'lock' : 'lock'} 
                  size={32} 
                  color={colors.primary} 
                />
                <Text style={[styles.biometricHintText, { color: colors.textSecondary }]}>
                  Use biometrics
                </Text>
              </TouchableOpacity>
            )}

          {/* PIN Input */}
          <View style={styles.pinContainer}>
            {pin.map((digit, index) => (
              <TextInput
                key={index}
                ref={inputRefs[index]}
                style={[
                  styles.pinInput,
                  {
                    borderColor: error ? '#ef4444' : colors.border,
                    color: colors.text,
                    backgroundColor: colors.surface || colors.background,
                  },
                ]}
                value={digit}
                onChangeText={(value) => handlePinChange(index, value)}
                onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(index, key)}
                keyboardType="numeric"
                returnKeyType="done"
                maxLength={1}
                secureTextEntry
                selectTextOnFocus
                editable={false}
                showSoftInputOnFocus={false}
                autoComplete="off"
                textContentType="oneTimeCode"
              />
            ))}
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <FontAwesome name="exclamation-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Loading Indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#176d67" />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Verifying...</Text>
            </View>
          )}

          {/* Custom Numeric Keypad */}
          {!loading && (
            <View style={styles.keypad}>
              <View style={styles.keypadRow}>
                {['1', '2', '3'].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={styles.keypadButton}
                    onPress={() => handleNumberPress(num)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.keypadButtonText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.keypadRow}>
                {['4', '5', '6'].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={styles.keypadButton}
                    onPress={() => handleNumberPress(num)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.keypadButtonText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.keypadRow}>
                {['7', '8', '9'].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={styles.keypadButton}
                    onPress={() => handleNumberPress(num)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.keypadButtonText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.keypadRow}>
                <View style={styles.keypadButtonEmpty} />
                <TouchableOpacity
                  style={styles.keypadButton}
                  onPress={() => handleNumberPress('0')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.keypadButtonText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.keypadButton}
                  onPress={handleBackspace}
                  activeOpacity={0.7}
                >
                  <FontAwesome name="arrow-left" size={24} color="#374151" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Not you? Login here */}
          <TouchableOpacity
            style={styles.notYouButton}
            onPress={handleBack}
            disabled={loading}
          >
            <Text style={styles.notYouText}>
              Not you? <Text style={styles.loginLink}>Login here</Text>
            </Text>
          </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tealHeader: {
    backgroundColor: '#176d67',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 8,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  userInfo: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  avatarContainer: {
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 2,
  },
  companyText: {
    fontSize: 13,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  pinInput: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderRadius: 10,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    gap: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  notYouButton: {
    alignItems: 'center',
    marginTop: 32,
    padding: 12,
  },
  notYouText: {
    fontSize: 14,
    color: '#6b7280',
  },
  loginLink: {
    color: '#176d67',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  keypad: {
    marginBottom: 10,
    paddingHorizontal: 30,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 12,
  },
  keypadButton: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  keypadButtonEmpty: {
    width: 65,
    height: 65,
  },
  keypadButtonText: {
    fontSize: 28,
    fontWeight: '500',
    color: '#1f2937',
  },
  biometricIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 8,
    gap: 4,
  },
  biometricHintText: {
    fontSize: 12,
    marginTop: 4,
  },
});
