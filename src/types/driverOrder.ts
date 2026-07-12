/* ============================================================
   DRIVER ORDER TYPES
   ------------------------------------------------------------
   Mirrors GET /driver/orders and GET /driver/orders/{id}.
   Same underlying `orders` table as driverTask.ts (built for the
   dashboard), just with the fields the driver Orders screen
   actually needs — including offeredToMe, which is what
   distinguishes an ASAP order awaiting THIS driver's Accept/
   Decline from an order already assigned to them.
============================================================ */

export type BackendOrderStatus =
  | "Pending"
  | "Accepted"
  | "Assigned"
  | "Scheduled"
  | "Preparing"
  | "Out For Delivery"
  | "Delivered"
  | "Cancelled";

export interface DriverOrderItem {
  id: number;
  bottleName: string;
  size: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface DriverOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  latitude: number;
  longitude: number;
  amount: number;
  status: BackendOrderStatus;
  priority: "Normal" | "High" | "Urgent";
  paymentMethod: string | null;
  distanceKm: number | null;
  eta: string | null;
  specialInstructions: string | null;
  createdAt: string;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  items: DriverOrderItem[];

  // True when this order is an ASAP order currently offered to ME and
  // awaiting my Accept/Decline — NOT yet assigned. This is the ONLY
  // condition that should ever show the Accept/Decline buttons.
  offeredToMe: boolean;
}

export interface TrackingUpdate {
  driverLatitude: number | null;
  driverLongitude: number | null;
  destinationLatitude: number;
  destinationLongitude: number;
  distanceKm: number | null;
}