import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ============================================================
   API CLIENT
   ------------------------------------------------------------
   Central place every service (driver auth, orders, etc.) goes
   through to talk to Laravel. Handles attaching the bearer
   token, and clears it automatically on a 401 so a stale/expired
   token can never silently keep "working" against the UI.

   IMPORTANT: replace API_BASE_URL below with your machine's LAN
   IP (e.g. http://192.168.1.42:8000/api) when testing on a
   physical device or emulator — "localhost" only resolves to
   the device itself, not your dev machine.

   NOTE ON STORAGE: expo-secure-store has NO web implementation at
   all (it only exists for iOS/Android). Since this app also has
   to run on Web, the small wrapper below uses SecureStore on
   native and transparently falls back to AsyncStorage (which is
   backed by localStorage on web) when Platform.OS === "web". Every
   call site in this file goes through this wrapper instead of
   calling SecureStore directly, so this is the only place that
   needs to know about the platform difference.
============================================================ */

const isWeb = Platform.OS === "web";

const storage = {
  async getItem(key: string): Promise<string | null> {
    return isWeb ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api";

const TOKEN_KEY = "kayora_driver_token";
const TOKEN_EXPIRY_KEY = "kayora_driver_token_expiry";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function saveSession(token: string, expiresAt: string) {
  await storage.setItem(TOKEN_KEY, token);
  await storage.setItem(TOKEN_EXPIRY_KEY, expiresAt);
}

export async function clearSession() {
  await storage.removeItem(TOKEN_KEY);
  await storage.removeItem(TOKEN_EXPIRY_KEY);
}


export async function hasValidSession(): Promise<boolean> {
  const token = await storage.getItem(TOKEN_KEY);
  const expiry = await storage.getItem(TOKEN_EXPIRY_KEY);
  if (!token || !expiry) return false;
  return new Date(expiry).getTime() > Date.now();
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await storage.getItem(TOKEN_KEY);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (response.status === 401) {
    if (token) {
      // We HAD a token and the server rejected it — that's a genuine
      // expired/invalid session, so force a clean logout.
      await clearSession();
      throw new ApiError("Session expired. Please log in again.", 401);
    }
    // No token was attached at all (e.g. a login attempt) — a 401 here
    // means the credentials themselves were wrong. Surface Laravel's
    // actual message instead of a generic "session expired" string.
    throw new ApiError(body.message ?? "Incorrect Driver ID or Password", 401);
  }

  if (!response.ok) {
    throw new ApiError(body.message ?? "Request failed", response.status);
  }

  return body as T;
}