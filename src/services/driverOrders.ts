import { apiFetch } from "./api";
import { DriverOrder, DriverOrderItem, TrackingUpdate } from "../types/driverOrder";

/* ============================================================
   DRIVER ORDERS SERVICE
   ------------------------------------------------------------
   Talks to:
     GET  /driver/orders
     GET  /driver/orders/{id}
     POST /driver/orders/{id}/accept
     POST /driver/orders/{id}/decline
     POST /driver/orders/{id}/start
     POST /driver/orders/{id}/complete
     GET  /driver/orders/{id}/track

   Laravel returns snake_case JSON by default — the mappers below
   are the ONLY place that translates that into the camelCase
   shape the rest of the app uses, and the ONLY place that decides
   offeredToMe (offered_driver_id === the signed-in driver's id,
   which the backend already filters by, so here it's simply
   "status is Pending and no driver_id yet" for anything this
   endpoint returned at all).
============================================================ */

function mapItem(raw: any): DriverOrderItem {
  return {
    id: raw.id,
    bottleName: raw.bottle_name,
    size: raw.size,
    quantity: raw.quantity,
    price: Number(raw.price),
    subtotal: Number(raw.subtotal),
  };
}

function mapOrder(raw: any): DriverOrder {
  return {
    id: raw.id,
    orderNumber: raw.order_number,
    customerName: raw.customer_name,
    customerPhone: raw.customer_phone,
    deliveryAddress: raw.delivery_address,
    latitude: Number(raw.latitude),
    longitude: Number(raw.longitude),
    amount: Number(raw.amount),
    status: raw.status,
    priority: raw.priority,
    paymentMethod: raw.payment_method ?? null,
    distanceKm: raw.distance_km != null ? Number(raw.distance_km) : null,
    eta: raw.eta ?? null,
    specialInstructions: raw.special_instructions ?? null,
    createdAt: raw.created_at,
    assignedAt: raw.assigned_at,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    items: Array.isArray(raw.items) ? raw.items.map(mapItem) : [],
    // The backend only ever returns orders that are either assigned to me
    // or currently offered to me. "Offered, not yet assigned" is exactly
    // status === Pending with no driver_id set.
    offeredToMe: raw.status === "Pending" && !raw.driver_id,
  };
}

export const DriverOrdersService = {
  async getOrders(): Promise<DriverOrder[]> {
    const raw = await apiFetch<any[]>("/driver/orders");
    return raw.map(mapOrder);
  },

  async getOrderById(id: number | string): Promise<DriverOrder> {
    const raw = await apiFetch<any>(`/driver/orders/${id}`);
    return mapOrder(raw);
  },

  async acceptOrder(id: number | string): Promise<DriverOrder> {
    const raw = await apiFetch<any>(`/driver/orders/${id}/accept`, { method: "POST" });
    return mapOrder(raw);
  },

  async declineOrder(id: number | string): Promise<void> {
    await apiFetch(`/driver/orders/${id}/decline`, { method: "POST" });
  },

  async startOrder(id: number | string): Promise<DriverOrder> {
    const raw = await apiFetch<any>(`/driver/orders/${id}/start`, { method: "POST" });
    return mapOrder(raw);
  },

  async completeOrder(id: number | string): Promise<DriverOrder> {
    const raw = await apiFetch<any>(`/driver/orders/${id}/complete`, { method: "POST" });
    return mapOrder(raw);
  },

  async trackOrder(id: number | string): Promise<TrackingUpdate> {
    const raw = await apiFetch<any>(`/driver/orders/${id}/track`);
    return {
      driverLatitude: raw.driverLatitude != null ? Number(raw.driverLatitude) : null,
      driverLongitude: raw.driverLongitude != null ? Number(raw.driverLongitude) : null,
      destinationLatitude: Number(raw.destinationLatitude),
      destinationLongitude: Number(raw.destinationLongitude),
      distanceKm: raw.distanceKm != null ? Number(raw.distanceKm) : null,
    };
  },
};