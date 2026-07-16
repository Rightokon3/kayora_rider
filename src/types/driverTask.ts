/* ============================================================
   DRIVER TASK (ORDER) TYPES
   ------------------------------------------------------------
   Mirrors the shape returned by GET /driver/tasks/today and
   GET /driver/tasks/{id} on the Laravel side. Field names match
   the API response exactly (camelCase after Laravel's JSON
   resource mapping) so no translation layer is needed between
   the backend and these components.
============================================================ */

export type TaskStatus =
  | "Pending"
  | "Accepted"
  | "Assigned"
  | "Scheduled"
  | "Preparing"
  | "Out For Delivery"
  | "Delivered"
  | "Cancelled";

export interface TaskItem {
  id: number;
  bottleName: string;
  size: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface DriverTask {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: string;
  nearestLandmark: string | null;
  latitude: number;
  longitude: number;
  amount: number;
  status: TaskStatus;
  paymentMethod: string | null;
  paymentStatus: string | null;
  deliveryType: string;
  priority: "Normal" | "High" | "Urgent";
  distanceKm: number | null;
  eta: string | null;
  specialInstructions: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  items: TaskItem[];
}

export interface DriverDailyStats {
  todayDeliveries: number;
  completed: number;
  pending: number;
  active: number;
  distanceKm: number;
}

export type ChartRange = "day" | "week" | "month" | "year";

export interface ChartPoint {
  label: string;
  value: number;
}

export type DutyStatus = "on_duty" | "off_duty";