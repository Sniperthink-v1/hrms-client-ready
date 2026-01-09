// Biometric Authentication Service
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface BiometricType {
  available: boolean;
  type: 'fingerprint' | 'face' | 'iris' | 'none';
  error?: string;
}

export const biometricService = {
  // Check if biometric authentication is available
  async checkAvailability(): Promise<BiometricType> {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        return {
          available: false,
          type: 'none',
          error: 'Biometric authentication is not available on this device',
        };
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        return {
          available: false,
          type: 'none',
          error: 'No biometric credentials are enrolled on this device',
        };
      }

      // Get supported authentication types
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      let biometricType: 'fingerprint' | 'face' | 'iris' | 'none' = 'none';
      
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = 'face';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = 'fingerprint';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        biometricType = 'iris';
      }

      return {
        available: true,
        type: biometricType,
      };
    } catch (error: any) {
      console.error('Error checking biometric availability:', error);
      return {
        available: false,
        type: 'none',
        error: error.message || 'Failed to check biometric availability',
      };
    }
  },

  // Authenticate using biometrics
  async authenticate(reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const availability = await this.checkAvailability();
      
      if (!availability.available) {
        return {
          success: false,
          error: availability.error || 'Biometric authentication is not available',
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason || 'Authenticate to continue',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: false,
        fallbackLabel: 'Use PIN',
      });

      if (result.success) {
        return { success: true };
      } else {
        // User cancelled or authentication failed
        if (result.error === 'user_cancel') {
          return {
            success: false,
            error: 'Authentication cancelled',
          };
        }
        return {
          success: false,
          error: result.error || 'Biometric authentication failed',
        };
      }
    } catch (error: any) {
      console.error('Error during biometric authentication:', error);
      return {
        success: false,
        error: error.message || 'Biometric authentication failed',
      };
    }
  },

  // Get biometric type name for display
  getBiometricTypeName(type: 'fingerprint' | 'face' | 'iris' | 'none'): string {
    if (Platform.OS === 'ios') {
      if (type === 'face') return 'Face ID';
      if (type === 'fingerprint') return 'Touch ID';
      return 'Biometric';
    } else {
      if (type === 'fingerprint') return 'Fingerprint';
      if (type === 'face') return 'Face Recognition';
      return 'Biometric';
    }
  },
};

export default biometricService;

