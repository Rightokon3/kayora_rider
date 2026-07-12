import { apiFetch } from "./api";
import { DriverTask, DriverDailyStats, DutyStatus, TaskItem } from "../types/driverTask";

/* ============================================================
   DRIVER DASHBOARD SERVICE
   ------------------------------------------------------------
   Talks to the Laravel endpoints built for the dashboard:

     GET  /driver/tasks/today
     GET  /driver/tasks/{id}
     POST /driver/tasks/{id}/start
     POST /driver/tasks/{id}/complete
     GET  /driver/stats/today
     POST /driver/status
     POST /driver/location

   Laravel/Eloquent returns snake_case JSON by default (order_number,
   customer_name, distance_km, etc.) — the mapper functions below are
   the ONLY place that translates that into the camelCase shape the
   rest of the app already uses. If the backend later returns an API
   Resource with different casing, only these mappers change.
============================================================ */

function mapItem(raw: any): TaskItem {
  return {
    id: raw.id,
    bottleName: raw.bottle_name,
    size: raw.size,
    quantity: raw.quantity,
    price: Number(raw.price),
    subtotal: Number(raw.subtotal),
  };
}

function mapTask(raw: any): DriverTask {
  return {
    id: raw.id,
    orderNumber: raw.order_number,
    customerName: raw.customer_name,
    customerPhone: raw.customer_phone,
    customerEmail: raw.customer_email ?? null,
    deliveryAddress: raw.delivery_address,
    nearestLandmark: raw.nearest_landmark ?? null,
    latitude: Number(raw.latitude),
    longitude: Number(raw.longitude),
    amount: Number(raw.amount),
    status: raw.status,
    paymentMethod: raw.payment_method ?? null,
    paymentStatus: raw.payment_status ?? null,
    deliveryType: raw.delivery_type,
    priority: raw.priority,
    distanceKm: raw.distance_km != null ? Number(raw.distance_km) : null,
    eta: raw.eta ?? null,
    specialInstructions: raw.special_instructions ?? null,
    assignedAt: raw.assigned_at,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    items: Array.isArray(raw.items) ? raw.items.map(mapItem) : [],
  };
}

export const DriverDashboardService = {
  async getTodayTasks(): Promise<DriverTask[]> {
    const raw = await apiFetch<any[]>("/driver/tasks/today");
    return raw.map(mapTask);
  },

  async getTaskById(id: number | string): Promise<DriverTask> {
    const raw = await apiFetch<any>(`/driver/tasks/${id}`);
    return mapTask(raw);
  },

  async startTask(id: number | string): Promise<DriverTask> {
    const raw = await apiFetch<any>(`/driver/tasks/${id}/start`, { method: "POST" });
    return mapTask(raw);
  },

  async completeTask(id: number | string): Promise<DriverTask> {
    const raw = await apiFetch<any>(`/driver/tasks/${id}/complete`, { method: "POST" });
    return mapTask(raw);
  },

  async getTodayStats(): Promise<DriverDailyStats> {
    const raw = await apiFetch<any>("/driver/stats/today");
    return {
      todayDeliveries: raw.todayDeliveries,
      completed: raw.completed,
      pending: raw.pending,
      distanceKm: Number(raw.distanceKm),
    };
  },

  async updateDutyStatus(status: DutyStatus): Promise<void> {
    await apiFetch("/driver/status", {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  },

  /**
   * Sends one GPS ping to the backend, which computes the Haversine
   * increment against the driver's last known point server-side and
   * accumulates it into today's distance total. Returns the running
   * total so the UI can update immediately without a separate stats
   * refetch.
   */
  async sendLocationPing(latitude: number, longitude: number): Promise<number> {
    const result = await apiFetch<{ distanceKm: number }>("/driver/location", {
      method: "POST",
      body: JSON.stringify({ latitude, longitude }),
    });
    return result.distanceKm;
  },
};