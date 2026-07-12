import { apiFetch, saveSession, clearSession, ApiError } from "./api";

/* ============================================================
   DRIVER AUTH SERVICE
   ------------------------------------------------------------
   Replaces the old local DemoAuth object in login.tsx. Same
   external shape (login returns {success, driverName} or
   {success:false}) so the login screen's animation/error logic
   didn't need to change — only the implementation underneath.
============================================================ */

interface LoginResponse {
  token: string;
  expiresAt: string;
  driver: {
    id: number;
    driverId: string;
    name: string;
    email: string;
  };
}

type DriverAuthResult =
  | { success: true; driverName: string }
  | { success: false; message?: string };

export const DriverAuth = {
  async login(identifier: string, password: string): Promise<DriverAuthResult> {
    try {
      const data = await apiFetch<LoginResponse>("/driver/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });

      // Every successful login persists a 30-day session. There is no
      // "Remember Me" branch here on purpose — the token itself IS the
      // session, and its 30-day expiry is enforced server-side too.
      await saveSession(data.token, data.expiresAt);

      return { success: true, driverName: data.driver.name };
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Unable to reach the server.";
      return { success: false, message };
    }
  },

  async logout(): Promise<void> {
    try {
      await apiFetch("/driver/logout", { method: "POST" });
    } catch (e) {
      // Even if the network call fails, still clear the local session below
      // so the user isn't stuck "logged in" on a device with no connection.
    } finally {
      await clearSession();
    }
  },

  async getCurrentDriver() {
    return apiFetch("/driver/me");
  },
};