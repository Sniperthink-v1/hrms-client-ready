// Accept Invitation Screen
// Handles team invitation links and user onboarding
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppDispatch } from '@/store/hooks';
import { setUser, setTenant } from '@/store/slices/authSlice';
import { storage } from '@/utils/storage';
import { API_BASE_URL, API_ENDPOINTS } from '@/constants/Config';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import SniperThinkLogo from '@/components/SniperThinkLogo';

interface InvitationDetails {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  tenant_name: string;
  invited_by: string;
}

export default function AcceptInvitationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const dispatch = useAppDispatch();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [invitationDetails, setInvitationDetails] = useState<InvitationDetails | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateInvitation = useCallback(async () => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.validateInvitation}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setInvitationDetails(data);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Invalid or expired invitation');
      }
    } catch (err) {
      console.error('Invitation validation error:', err);
      setError('Failed to validate invitation. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    validateInvitation();
  }, [validateInvitation]);

  const handleAcceptInvitation = async () => {
    // Validation
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.acceptInvitation}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store tokens if provided (for immediate login)
        if (data.tokens) {
          await storage.setAccessToken(data.tokens.access);
          await storage.setRefreshToken(data.tokens.refresh);
        }
        if (data.session_key) {
          await storage.setSessionKey(data.session_key);
        }
        if (data.user) {
          await storage.setUser(data.user);
          dispatch(setUser(data.user));
        }
        if (data.tenant) {
          await storage.setTenant(data.tenant);
          dispatch(setTenant(data.tenant));
        }

        // Show success and navigate
        Alert.alert(
          'Success',
          'Account created successfully!',
          [
            {
              text: 'Continue',
              onPress: () => {
                // If tokens are provided, go directly to dashboard
                if (data.tokens && data.session_key) {
                  router.replace('/(drawer)');
                } else {
                  // Otherwise, go to login
                  router.replace('/(auth)/login');
                }
              },
            },
          ]
        );
      } else {
        setError(data.error || 'Failed to accept invitation');
      }
    } catch (err) {
      console.error('Accept invitation error:', err);
      setError('Failed to accept invitation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Validating invitation...
        </Text>
      </View>
    );
  }

  // Invalid invitation state
  if (!invitationDetails) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <View style={[styles.errorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.errorIconContainer, { backgroundColor: `${colors.error}15` }]}>
            <FontAwesome name="times-circle" size={48} color={colors.error} />
          </View>
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Invalid Invitation
          </Text>
          <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
            {error || 'This invitation link is invalid or has expired.'}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.buttonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main form
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <SniperThinkLogo size={50} color={colors.primary} marginBottom={16} />
            <Text style={[styles.title, { color: colors.primary }]}>
              Accept Invitation
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Set up your password to join {invitationDetails.tenant_name}
            </Text>
          </View>

          {/* Invitation Details Card */}
          <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Invitation Details
            </Text>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Name:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {invitationDetails.first_name} {invitationDetails.last_name}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Email:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {invitationDetails.email}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Role:</Text>
              <View style={[styles.roleBadge, { backgroundColor: `${colors.primary}15` }]}>
                <Text style={[styles.roleText, { color: colors.primary }]}>
                  {invitationDetails.role}
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Organization:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {invitationDetails.tenant_name}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Invited by:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {invitationDetails.invited_by}
              </Text>
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: `${colors.error}15`, borderColor: colors.error }]}>
              <FontAwesome name="exclamation-circle" size={16} color={colors.error} />
              <Text style={[styles.errorBannerText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {/* Password Form */}
          <View style={styles.form}>
            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
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
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                Must be at least 8 characters long
              </Text>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="Confirm your password"
                  placeholderTextColor={colors.textLight}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  <FontAwesome
                    name={showConfirmPassword ? 'eye-slash' : 'eye'}
                    size={20}
                    color={colors.textLight}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                (submitting || !password || !confirmPassword) && styles.buttonDisabled,
              ]}
              onPress={handleAcceptInvitation}
              disabled={submitting || !password || !confirmPassword}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={[styles.loginLinkText, { color: colors.primary }]}>
                Already have an account? Login here
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorCard: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  detailsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 14,
    flex: 1,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  passwordContainer: {
    position: 'relative',
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingRight: 48,
    fontSize: 16,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  button: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
