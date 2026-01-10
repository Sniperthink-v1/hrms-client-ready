// Secure Storage Utilities
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/Config';

// Use SecureStore for sensitive data, AsyncStorage for non-sensitive
export const storage = {
  // Secure storage for tokens
  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, token);
  },

  async getAccessToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
  },

  async setSessionKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEYS.SESSION_KEY, key);
  },

  async getSessionKey(): Promise<string | null> {
    return await SecureStore.getItemAsync(STORAGE_KEYS.SESSION_KEY);
  },

  // AsyncStorage for non-sensitive data
  async setUser(user: any): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  async getUser(): Promise<any | null> {
    const user = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    return user ? JSON.parse(user) : null;
  },

  async setTenant(tenant: any): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.TENANT, JSON.stringify(tenant));
  },

  async getTenant(): Promise<any | null> {
    const tenant = await AsyncStorage.getItem(STORAGE_KEYS.TENANT);
    return tenant ? JSON.parse(tenant) : null;
  },

  // Theme preference (non-sensitive)
  async setThemePreference(preference: 'system' | 'light' | 'dark'): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.THEME_PREFERENCE, preference);
  },

  async getThemePreference(): Promise<'system' | 'light' | 'dark'> {
    const preference = await AsyncStorage.getItem(STORAGE_KEYS.THEME_PREFERENCE);
    return (preference as 'system' | 'light' | 'dark') || 'light';
  },

  // Clear all storage
  async clearAll(): Promise<void> {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.SESSION_KEY);
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
    await AsyncStorage.removeItem(STORAGE_KEYS.TENANT);
    await AsyncStorage.removeItem(STORAGE_KEYS.THEME_PREFERENCE);
  },
};

