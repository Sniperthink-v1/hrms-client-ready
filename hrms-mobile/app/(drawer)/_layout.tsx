import React, { useEffect, useState } from 'react';
import { Drawer } from 'expo-router/drawer';
import { Redirect, useRouter, useSegments } from 'expo-router';
import { useSelector } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { RootState } from '@/store';
import CustomDrawer from '@/components/CustomDrawer';

export default function DrawerLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    // Only redirect if we're actually in a drawer route and not authenticated
    // Don't redirect if we're navigating back from other pages
    const isDrawerRoute = segments[0] === '(drawer)';
    
    if (isDrawerRoute && !isAuthenticated) {
      // Small delay to prevent redirect during navigation transitions
      // This allows navigation back to complete before checking auth
      const timer = setTimeout(() => {
        // Double-check we're still in a drawer route and still not authenticated
        // This prevents redirects when navigating back from other pages
        if (segments[0] === '(drawer)' && !isAuthenticated) {
          setShouldRedirect(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setShouldRedirect(false);
    }
  }, [isAuthenticated, segments]);

  // Only redirect if we should and we're still in a drawer route
  // This prevents redirects when navigating back from pages outside the drawer
  if (shouldRedirect && segments[0] === '(drawer)' && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <CustomDrawer {...props} />}
        screenOptions={{
          drawerStyle: {
            width: 280,
          },
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: 'white',
          headerTitleStyle: {
            fontWeight: '600',
          },
          drawerActiveTintColor: colors.primary,
          drawerInactiveTintColor: colors.textSecondary,
        }}
      >
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: 'Dashboard',
            title: 'Dashboard',
            headerShown: true,
          }}
        />
        <Drawer.Screen
          name="employees"
          options={{
            drawerLabel: 'Employees',
            title: 'Employees',
            headerShown: true,
          }}
        />
        <Drawer.Screen
          name="attendance"
          options={{
            drawerLabel: 'Attendance',
            title: 'Attendance',
            headerShown: true,
          }}
        />
        <Drawer.Screen
          name="payroll"
          options={{
            drawerLabel: 'Payroll',
            title: 'Payroll',
            headerShown: true,
          }}
        />
        <Drawer.Screen
          name="more"
          options={{
            drawerLabel: 'More',
            title: 'More',
            headerShown: true,
          }}
        />
        <Drawer.Screen
          name="about"
          options={{
            drawerLabel: 'About',
            title: 'About',
            headerShown: true,
          }}
        />
        <Drawer.Screen
          name="employee-details"
          options={{
            title: 'Employee Details',
            headerShown: false,
            drawerItemStyle: { display: 'none' },
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
