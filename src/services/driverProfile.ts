import { apiFetch } from "./api";

/* ============================================================
   DRIVER PROFILE SERVICE
   ------------------------------------------------------------
   Wraps GET /driver/profile, which returns { driver, profile,
   vehicle } from the Laravel side (see DriverProfileController).
   Used anywhere the app needs the signed-in driver's real name/
   details instead of a hardcoded placeholder — currently the
   dashboard header/avatar and account.tsx.
============================================================ */

export interface DriverProfileResponse {
  driver: {
    id: number;
    driverId: string;
    name: string;
    email: string;
    phone: string | null;
  };
  profile: Record<string, any> | null;
  vehicle: Record<string, any> | null;
}

export const DriverProfileService = {
  async getMyProfile(): Promise<DriverProfileResponse> {
    return apiFetch<DriverProfileResponse>("/driver/profile");
  },
};