import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';


export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined') return null;
        return window.localStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      // no-op in demo mode; swallow storage errors rather than crash the app
    }
  },

  async deleteItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      // no-op
    }
  },
};