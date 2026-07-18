import * as SecureStore from "expo-secure-store";

// Replace with your local machine IP or production URL — same base your
// other driver services (driverDashboard.ts, driverOrders.ts) already use.
const API_BASE_URL = "http://localhost:8000";

// Matches the key your login flow already writes the Sanctum token to
// (see the auth fix from earlier — always written on login, independent
// of "Remember Me"). Adjust if your DriverAuthContext uses a different key.
const TOKEN_STORAGE_KEY = "kayora_auth_token";

export type DriverOnlineStatus = "Available" | "Busy" | "Off Duty";

export interface DriverAccountPersonal {
  fullName: string;
  gender: string | null;
  dob: string | null;
  maritalStatus: string | null;
  stateOfOrigin: string | null;
  residentialAddress: string | null;
  phone: string;
  email: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bloodGroup: string | null;
  genotype: string | null;
  nationalId: string | null;
  employmentDate: string | null;
  department: string | null;
  branch: string | null;
  supervisor: string | null;
}

export interface DriverAccountLicense {
  number: string | null;
  expiryDate: string | null;
  status: "Valid" | "Expired" | null;
  frontImage: string | null;
  backImage: string | null;
  nationalIdImage: string | null;
}

export interface DriverAccountVehicle {
  type: string;
  brand: string;
  model: string;
  color: string | null;
  plateNumber: string;
  engineNumber: string | null;
  chassisNumber: string | null;
  image: string | null;
  registrationImage: string | null;
  status: "Available" | "Assigned" | "Maintenance";
}

export interface DriverAccountWork {
  todaysTasks: number;
  completedToday: number;
  pendingTasks: number;
  depot: string | null;
  supervisor: string | null;
}

export interface DriverAccount {
  name: string;
  employeeId: string | null;
  driverId: string;
  profilePicture: string | null;
  onlineStatus: DriverOnlineStatus;
  yearsWithKayora: number | null;
  completedDeliveries: number;
  currentAssignment: string | null;
  personal: DriverAccountPersonal;
  license: DriverAccountLicense;
  vehicle: DriverAccountVehicle | null;
  work: DriverAccountWork;
}

export interface DriverProfileUpdatePayload {
  middle_name?: string;
  gender?: "Male" | "Female";
  date_of_birth?: string; // "YYYY-MM-DD"
  marital_status?: "Single" | "Married" | "Divorced" | "Widowed";
  alternative_phone?: string;
  home_address?: string;
  city?: string;
  state?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  blood_group?: string;
  genotype?: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY).catch(() => null);
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  // Laravel's JsonResource wraps single resources in { "data": {...} }
  return (data?.data ?? data) as T;
}

export const DriverAccountService = {
  async getAccount(): Promise<DriverAccount> {
    const response = await fetch(`${API_BASE_URL}/api/driver/me`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse<DriverAccount>(response);
  },

  async updateProfile(payload: DriverProfileUpdatePayload): Promise<DriverAccount> {
    const response = await fetch(`${API_BASE_URL}/api/driver/me/profile`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<DriverAccount>(response);
  },

  async updateDutyStatus(dutyStatus: "on_duty" | "off_duty"): Promise<DriverAccount> {
    const response = await fetch(`${API_BASE_URL}/api/driver/me/duty-status`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ duty_status: dutyStatus }),
    });
    return handleResponse<DriverAccount>(response);
  },
};