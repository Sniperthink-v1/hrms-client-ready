import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useCallback } from 'react';
import { Provider, useSelector } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, AppStateStatus } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { store, RootState } from '@/store';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { CreditProvider } from '@/contexts/CreditContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import NoInternet from '@/components/NoInternet';
import SessionConflictModal from '@/components/SessionConflictModal';
import { sessionConflictService, SessionConflictData } from '@/services/sessionConflictService';
import { View } from 'react-native';
import { storage } from '@/utils/storage';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

// Session Conflict Handler Component
function SessionConflictHandler({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [sessionConflict, setSessionConflict] = useState<SessionConflictData>({
    show: false,
    message: '',
    reason: '',
  });

  // Handle session conflict
  const handleSessionConflict = useCallback((data: SessionConflictData) => {
    console.log('[SessionConflictHandler] Received conflict:', data);
    setSessionConflict(data);
  }, []);

  // Close modal and redirect to login
  const handleCloseModal = useCallback(async () => {
    setSessionConflict({ show: false, message: '', reason: '' });
    
    // Clear all storage
    await storage.clearAll();
    
    // Stop session polling
    sessionConflictService.stopPolling();
    
    // Navigate to login
    router.replace('/(auth)/login?logout=true');
  }, [router]);

  // Start/stop session polling based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      // Register handler
      sessionConflictService.onConflict(handleSessionConflict);
      
      // Start polling
      sessionConflictService.startPolling();
      
      return () => {
        sessionConflictService.offConflict(handleSessionConflict);
        sessionConflictService.stopPolling();
      };
    } else {
      // Stop polling when not authenticated
      sessionConflictService.stopPolling();
    }
  }, [isAuthenticated, handleSessionConflict]);

  return (
    <>
      {children}
      <SessionConflictModal
        visible={sessionConflict.show}
        message={sessionConflict.message}
        onClose={handleCloseModal}
      />
    </>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isOffline } = useNetworkStatus();
  const router = useRouter();

  // Logout superusers when app goes to background or closes
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        try {
          const user = await storage.getUser();
          if (user && user.is_superuser) {
            // Clear auth data for superusers
            await storage.clearAll();
            // Stop session conflict polling
            sessionConflictService.stopPolling();
            // Navigate to login if not already there
            router.replace('/(auth)/login?logout=true');
          }
        } catch (error) {
          console.error('Error checking user on app state change:', error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [router]);

  // Show offline page blocking all access when offline
  if (isOffline) {
    return (
      <SafeAreaProvider>
        <Provider store={store}>
          <AppThemeProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <View style={{ flex: 1 }}>
                <NoInternet />
              </View>
            </ThemeProvider>
          </AppThemeProvider>
        </Provider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <AppThemeProvider>
          <CreditProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <SessionConflictHandler>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
                  <Stack.Screen name="payroll/detail-table" options={{ headerShown: false }} />
                </Stack>
              </SessionConflictHandler>
            </ThemeProvider>
          </CreditProvider>
        </AppThemeProvider>
      </Provider>
    </SafeAreaProvider>
  );
}
