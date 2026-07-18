import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  FlatList,
  Linking,
  Appearance,
  ActivityIndicator,
  Platform,
  Modal,
  RefreshControl,
  useWindowDimensions,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  FadeInDown,
  FadeIn,
  FadeOut,
  ZoomIn,
} from "react-native-reanimated";
import { DriverOrdersService } from "../../services/driverOrders";
import { DriverOrder } from "../../types/driverOrder";
import TrackingMap from "../../components/TrackingMap";

/* ============================================================
   BRAND COLORS
============================================================ */
const BRAND = {
  primary: "#0D4A8C",
  secondary: "#1E5FAF",
  gold: "#D4A64A",
  background: "#FFFFFF",
  backgroundDark: "#071D38",
  card: "#F8FAFC",
  cardDark: "#102E56",
  border: "#E5E7EB",
  borderDark: "#1C3A5E",
  text: "#1F2937",
  textDark: "#F1F5F9",
  muted: "#6B7280",
  mutedDark: "#93A4BC",
  success: "#22C55E",
  pending: "#F59E0B",
  completed: "#10B981",
  danger: "#EF4444",
};

type ThemeMode = "light" | "dark" | "system";
type Scheme = "light" | "dark";

function getPalette(scheme: Scheme) {
  const isDark = scheme === "dark";
  return {
    scheme,
    background: isDark ? BRAND.backgroundDark : BRAND.background,
    card: isDark ? BRAND.cardDark : BRAND.card,
    border: isDark ? BRAND.borderDark : BRAND.border,
    text: isDark ? BRAND.textDark : BRAND.text,
    muted: isDark ? BRAND.mutedDark : BRAND.muted,
    primary: BRAND.primary,
    secondary: BRAND.secondary,
    gold: BRAND.gold,
    success: BRAND.success,
    pending: BRAND.pending,
    completed: BRAND.completed,
    danger: BRAND.danger,
    headerBg: isDark ? "#0A2645" : BRAND.background,
    pillBg: isDark ? "#12335C" : "#EEF3FA",
    modalBg: isDark ? "#0E2D52" : "#FFFFFF",
  };
}

const THEME_STORAGE_KEY = "kayora_driver_theme_mode";
const FALLBACK_LOCATION = { lat: 6.335, lng: 5.6037 };

/* ============================================================
   TOP / BOTTOM NAV CONFIG
============================================================ */
const TOP_TABS = [
  { key: "orders", label: "My Orders", route: "/driver/orders" as const },
  { key: "tasks", label: "My Tasks", route: "/driver/tasks" as const },
  { key: "account", label: "My Account", route: "/driver/account" as const },
];

const BOTTOM_TABS = [
  { key: "dashboard", label: "Dashboard", icon: "car-sport-outline", route: "/driver/dashboard" as const },
  { key: "orders", label: "Orders", icon: "receipt", route: "/driver/orders" as const },
  { key: "tasks", label: "Tasks", icon: "list-outline", route: "/driver/tasks" as const },
  { key: "account", label: "Account", icon: "person-outline", route: "/driver/account" as const },
];

/* ============================================================
   DISPLAY MODEL
============================================================ */
type DisplayStatus = "Pending" | "Active" | "Completed";
type DisplaySubStatus = "Assigned" | "In Progress" | "Completed";

interface DisplayOrder {
  id: string;
  apiId: number;
  customerName: string;
  customerPhone: string;
  address: string;
  lat: number;
  lng: number;
  bottleName: string;
  bottleSize: string;
  quantity: string;
  price: number;
  paymentMethod: string;
  isAsap: boolean;
  isAsapOffer: boolean;
  status: DisplayStatus;
  subStatus: DisplaySubStatus;
  distanceKm: number;
  eta: string;
  createdAt: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
}

function formatTimeLabel(iso: string | null): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function mapOrderToDisplay(order: DriverOrder): DisplayOrder {
  const firstItem = order.items[0];
  const bottleSummary =
    order.items.length > 1
      ? `${firstItem?.bottleName ?? "Order"} +${order.items.length - 1} more`
      : firstItem?.bottleName ?? "—";
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

  let status: DisplayStatus;
  let subStatus: DisplaySubStatus;

  switch (order.status) {
    case "Pending":
      status = "Pending";
      subStatus = "Assigned";
      break;
    case "Out For Delivery":
      status = "Active";
      subStatus = "In Progress";
      break;
    case "Delivered":
      status = "Completed";
      subStatus = "Completed";
      break;
    case "Accepted":
    case "Assigned":
    case "Preparing":
    default:
      status = "Active";
      subStatus = "Assigned";
      break;
  }

  const isAsap = order.priority === "Urgent";

  return {
    id: order.orderNumber,
    apiId: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    address: order.deliveryAddress,
    lat: order.latitude,
    lng: order.longitude,
    bottleName: bottleSummary,
    bottleSize: firstItem?.size ?? "",
    quantity: `${totalQuantity} Pack${totalQuantity === 1 ? "" : "s"}`,
    price: order.amount,
    paymentMethod: order.paymentMethod ?? "—",
    isAsap,
    isAsapOffer:
      isAsap &&
      // Covers TWO cases: (1) the legacy broadcast system, where a driver
      // is specifically offered a pending order (order.offeredToMe), and
      // (2) the new flow, where the customer picks the driver directly at
      // checkout — the order lands with driver_id already set and
      // status:'Assigned', with no offer step at all. Either way, if the
      // raw status is still 'Assigned', the driver hasn't accepted or
      // declined yet, so Accept/Decline should show.
      (order.offeredToMe || order.status === "Assigned"),
    distanceKm: order.distanceKm ?? 0,
    eta: order.eta ?? "—",
    createdAt: formatTimeLabel(order.createdAt) ?? "—",
    assignedAt: formatTimeLabel(order.assignedAt),
    startedAt: formatTimeLabel(order.startedAt),
    completedAt: formatTimeLabel(order.completedAt),
    notes: order.specialInstructions ?? undefined,
  };
}

/* ============================================================
   FILTER TABS
============================================================ */
const FILTERS: { key: DisplayStatus; label: string }[] = [
  { key: "Pending", label: "Pending" },
  { key: "Active", label: "Active" },
  { key: "Completed", label: "Completed" },
];

/* ============================================================
   HELPERS
============================================================ */
function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

/* ============================================================
   HEADER
============================================================ */
function DashboardHeader({
  palette,
  themeMode,
  onCycleTheme,
  onOpenNotifications,
  onOpenProfile,
}: {
  palette: ReturnType<typeof getPalette>;
  themeMode: ThemeMode;
  onCycleTheme: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
}) {
  const themeIcon =
    themeMode === "light" ? "sunny-outline" : themeMode === "dark" ? "moon-outline" : "contrast-outline";

  return (
    <View style={[styles.headerRow, { backgroundColor: palette.headerBg }]}>
      <View style={styles.headerLeft}>
        <View style={[styles.logoBadge, { backgroundColor: palette.primary }]}>
          <Text style={styles.logoBadgeText}>K</Text>
        </View>
        <Text style={[styles.headerBrand, { color: palette.text }]}>
          Kayora <Text style={{ color: palette.primary }}>Driver</Text>
        </Text>
      </View>

      <View style={styles.headerRight}>
        <Pressable onPress={onCycleTheme} hitSlop={10} style={[styles.iconButton, { backgroundColor: palette.pillBg }]}>
          <Ionicons name={themeIcon as any} size={18} color={palette.text} />
        </Pressable>

        <Pressable onPress={onOpenNotifications} hitSlop={10} style={[styles.iconButton, { backgroundColor: palette.pillBg }]}>
          <Ionicons name="notifications-outline" size={18} color={palette.text} />
          <View style={[styles.notifDot, { backgroundColor: palette.danger }]} />
        </Pressable>

        <Pressable onPress={onOpenProfile} hitSlop={6}>
          <View style={[styles.avatarFallback, { backgroundColor: palette.secondary }]}>
            <Text style={styles.avatarFallbackText}>D</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

/* ============================================================
   TOP TABS
============================================================ */
function TopTabsBar({ palette, onNavigate }: { palette: ReturnType<typeof getPalette>; onNavigate: (route: string) => void }) {
  const [pressedKey, setPressedKey] = useState<string>("orders");
  const underlineX = useSharedValue(0);
  const underlineWidth = useSharedValue(0);
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});

  useEffect(() => {
    const layout = tabLayouts.current["orders"];
    if (layout) {
      underlineX.value = layout.x;
      underlineWidth.value = layout.width;
    }
  }, []);

  const handlePress = (key: string, route: string) => {
    setPressedKey(key);
    const layout = tabLayouts.current[key];
    if (layout) {
      underlineX.value = withTiming(layout.x, { duration: 220, easing: Easing.out(Easing.quad) });
      underlineWidth.value = withTiming(layout.width, { duration: 220, easing: Easing.out(Easing.quad) });
    }
    if (key !== "orders") setTimeout(() => onNavigate(route), 140);
  };

  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: underlineX.value }],
    width: underlineWidth.value,
    opacity: underlineWidth.value > 0 ? 1 : 0,
  }));

  return (
    <View style={styles.topTabsWrapper}>
      <View style={styles.topTabsRow}>
        {TOP_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              tabLayouts.current[tab.key] = { x, width };
              if (tab.key === "orders") {
                underlineX.value = x;
                underlineWidth.value = width;
              }
            }}
            onPress={() => handlePress(tab.key, tab.route)}
            style={styles.topTabItem}
          >
            <Text style={[styles.topTabLabel, { color: pressedKey === tab.key ? palette.primary : palette.muted }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.topTabsBaseline, { backgroundColor: palette.border }]} />
      <Animated.View style={[styles.topTabsUnderline, { backgroundColor: palette.primary }, underlineStyle]} />
    </View>
  );
}

/* ============================================================
   FILTER PILLS
============================================================ */
function FilterPills({
  palette,
  active,
  onChange,
  counts,
}: {
  palette: ReturnType<typeof getPalette>;
  active: DisplayStatus;
  onChange: (key: DisplayStatus) => void;
  counts: Record<DisplayStatus, number>;
}) {
  return (
    <View style={[styles.filterWrap, { backgroundColor: palette.pillBg }]}>
      {FILTERS.map((filter) => {
        const isActive = filter.key === active;
        return (
          <Pressable
            key={filter.key}
            onPress={() => onChange(filter.key)}
            style={[styles.filterPill, isActive && { backgroundColor: palette.primary }]}
          >
            <Text style={[styles.filterPillText, { color: isActive ? "#FFFFFF" : palette.muted }]}>
              {filter.label}
            </Text>
            {counts[filter.key] > 0 && (
              <View
                style={[
                  styles.filterCountBadge,
                  { backgroundColor: isActive ? "rgba(255,255,255,0.25)" : palette.card },
                ]}
              >
                <Text style={[styles.filterCountText, { color: isActive ? "#FFFFFF" : palette.text }]}>
                  {counts[filter.key]}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ============================================================
   ORDER CARD
============================================================ */
const OrderCard = memo(function OrderCard({
  order,
  palette,
  onAccept,
  onDecline,
  onTrack,
  onViewDetails,
  onStart,
  onComplete,
}: {
  order: DisplayOrder;
  palette: ReturnType<typeof getPalette>;
  onAccept: (order: DisplayOrder) => void;
  onDecline: (order: DisplayOrder) => void;
  onTrack: (order: DisplayOrder) => void;
  onViewDetails: (order: DisplayOrder) => void;
  onStart: (order: DisplayOrder) => void;
  onComplete: (order: DisplayOrder) => void;
}) {
  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const initial = order.customerName.trim().charAt(0).toUpperCase();

  const statusChip = () => {
    if (order.status === "Completed") return { label: "✔ Completed", color: palette.completed };
    if (order.status === "Active" && order.subStatus === "In Progress")
      return { label: "In Progress", color: palette.secondary };
    if (order.status === "Active") return { label: "Accepted", color: palette.primary };
    return { label: "Pending", color: palette.pending };
  };
  const chip = statusChip();

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[styles.orderCard, { backgroundColor: palette.card, borderColor: palette.border }, cardStyle]}
    >
      {order.isAsap && (
        <View style={[styles.asapBadge, { backgroundColor: palette.danger }]}>
          <Ionicons name="flash" size={12} color="#FFFFFF" />
          <Text style={styles.asapBadgeText}>ASAP DELIVERY</Text>
        </View>
      )}

      <View style={styles.orderTopRow}>
        <Text style={[styles.orderId, { color: palette.text }]}>Order #{order.id}</Text>
        <View style={[styles.statusChip, { backgroundColor: chip.color + "1A" }]}>
          <Text style={[styles.statusChipText, { color: chip.color }]}>{chip.label}</Text>
        </View>
      </View>

      <View style={styles.orderCustomerRow}>
        <View style={[styles.orderAvatarFallback, { backgroundColor: palette.primary }]}>
          <Text style={styles.orderAvatarFallbackText}>{initial}</Text>
        </View>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={[styles.orderCustomerName, { color: palette.text }]} numberOfLines={1}>
            {order.customerName}
          </Text>
          <Text style={[styles.orderAddress, { color: palette.muted }]} numberOfLines={1}>
            {order.address}
          </Text>
        </View>
        {!order.isAsap && (
          <View style={[styles.priorityBadgeSoft, { backgroundColor: palette.pillBg }]}>
            <Text style={[styles.priorityBadgeSoftText, { color: palette.muted }]}>Normal</Text>
          </View>
        )}
      </View>

      <View style={[styles.orderDivider, { backgroundColor: palette.border }]} />

      <View style={styles.orderBottleRow}>
        <View style={[styles.bottleIconWrap, { backgroundColor: palette.pillBg }]}>
          <Ionicons name="water-outline" size={18} color={palette.secondary} />
        </View>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={[styles.bottleName, { color: palette.text }]} numberOfLines={1}>
            {order.bottleName}
          </Text>
          <Text style={[styles.bottleQuantity, { color: palette.muted }]}>
            {order.bottleSize} · {order.quantity}
          </Text>
        </View>
        <Text style={[styles.orderPrice, { color: palette.text }]}>{formatNaira(order.price)}</Text>
      </View>

      <View style={styles.orderMetaRow}>
        <View style={styles.taskMetaItem}>
          <Ionicons name="navigate-outline" size={14} color={palette.muted} />
          <Text style={[styles.taskMetaText, { color: palette.muted }]}>{order.distanceKm} km</Text>
        </View>
        <View style={styles.taskMetaItem}>
          <Ionicons name="card-outline" size={14} color={palette.muted} />
          <Text style={[styles.taskMetaText, { color: palette.muted }]}>{order.paymentMethod}</Text>
        </View>
        <View style={styles.taskMetaItem}>
          <Ionicons name="time-outline" size={14} color={palette.muted} />
          <Text style={[styles.taskMetaText, { color: palette.muted }]}>ETA {order.eta}</Text>
        </View>
      </View>

      {order.isAsapOffer && (
        <>
          <View style={styles.taskButtonsRow}>
            <Pressable
              onPressIn={() => (scale.value = withTiming(0.97, { duration: 100 }))}
              onPressOut={() => (scale.value = withSpring(1, { damping: 12 }))}
              onPress={() => onAccept(order)}
              style={[styles.taskButtonPrimary, { backgroundColor: palette.primary }]}
            >
              <Text style={styles.taskButtonPrimaryText}>Accept</Text>
            </Pressable>
            <Pressable
              onPress={() => onDecline(order)}
              style={[styles.taskButtonSecondary, { borderColor: palette.border }]}
            >
              <Text style={[styles.taskButtonSecondaryText, { color: palette.danger }]}>Decline</Text>
            </Pressable>
          </View>
          <View style={styles.taskButtonsRow}>
            <Pressable onPress={() => onViewDetails(order)} style={[styles.ghostButton, { borderColor: palette.border }]}>
              <Ionicons name="document-text-outline" size={15} color={palette.text} />
              <Text style={[styles.ghostButtonText, { color: palette.text }]}>View Details</Text>
            </Pressable>
          </View>
        </>
      )}

      {order.status === "Active" && !order.isAsapOffer && (
        <>
          <View style={styles.taskButtonsRow}>
            <Pressable onPress={() => onTrack(order)} style={[styles.ghostButton, { borderColor: palette.border }]}>
              <Ionicons name="map-outline" size={15} color={palette.text} />
              <Text style={[styles.ghostButtonText, { color: palette.text }]}>Track Delivery</Text>
            </Pressable>
            <Pressable onPress={() => onViewDetails(order)} style={[styles.ghostButton, { borderColor: palette.border }]}>
              <Ionicons name="document-text-outline" size={15} color={palette.text} />
              <Text style={[styles.ghostButtonText, { color: palette.text }]}>View Details</Text>
            </Pressable>
          </View>
          <View style={styles.taskButtonsRow}>
            {order.subStatus === "Assigned" ? (
              <Pressable
                onPress={() => onStart(order)}
                style={[styles.taskButtonPrimary, { backgroundColor: palette.secondary }]}
              >
                <Ionicons name="play-outline" size={15} color="#FFFFFF" />
                <Text style={styles.taskButtonPrimaryText}>Start Delivery</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => onComplete(order)}
                style={[styles.taskButtonPrimary, { backgroundColor: palette.completed }]}
              >
                <Ionicons name="checkmark-done-outline" size={15} color="#FFFFFF" />
                <Text style={styles.taskButtonPrimaryText}>Complete Delivery</Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      {order.status === "Completed" && (
        <View style={styles.taskButtonsRow}>
          <Pressable onPress={() => onViewDetails(order)} style={[styles.taskButtonPrimary, { backgroundColor: palette.primary }]}>
            <Text style={styles.taskButtonPrimaryText}>View Details</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
});

/* ============================================================
   EMPTY STATE
============================================================ */
function EmptyState({ palette, filter }: { palette: ReturnType<typeof getPalette>; filter: DisplayStatus }) {
  const copy: Record<DisplayStatus, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
    Pending: { title: "No Pending Orders", icon: "time-outline" },
    Active: { title: "No Active Deliveries", icon: "navigate-circle-outline" },
    Completed: { title: "No Completed Deliveries", icon: "checkmark-done-circle-outline" },
  };
  const entry = copy[filter];

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
      <View style={[styles.emptyIconCircle, { backgroundColor: palette.pillBg }]}>
        <Ionicons name={entry.icon} size={38} color={palette.muted} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>{entry.title}</Text>
      <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
        New orders will appear here as soon as they come in.
      </Text>
    </Animated.View>
  );
}

/* ============================================================
   CONFIRM DIALOG
============================================================ */
function ConfirmDialog({
  visible,
  palette,
  title,
  message,
  loading,
  onYes,
  onNo,
}: {
  visible: boolean;
  palette: ReturnType<typeof getPalette>;
  title: string;
  message: string;
  loading: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={styles.confirmOverlay}>
      <Animated.View entering={ZoomIn.duration(220)} style={[styles.confirmCard, { backgroundColor: palette.modalBg }]}>
        <Text style={[styles.confirmTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.confirmMessage, { color: palette.muted }]}>{message}</Text>
        <View style={styles.confirmButtonsRow}>
          <Pressable onPress={onNo} disabled={loading} style={[styles.confirmButtonNo, { borderColor: palette.border }]}>
            <Text style={[styles.confirmButtonNoText, { color: palette.text }]}>No</Text>
          </Pressable>
          <Pressable onPress={onYes} disabled={loading} style={[styles.confirmButtonYes, { backgroundColor: palette.primary }]}>
            {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.confirmButtonYesText}>Yes</Text>}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/* ============================================================
   SUCCESS OVERLAY
============================================================ */
function SuccessOverlay({
  visible,
  palette,
  message,
}: {
  visible: boolean;
  palette: ReturnType<typeof getPalette>;
  message: string;
}) {
  if (!visible) return null;
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.successOverlay}>
      <Animated.View entering={ZoomIn.duration(300)} style={[styles.successCard, { backgroundColor: palette.modalBg }]}>
        <View style={[styles.successCircle, { backgroundColor: palette.success }]}>
          <Ionicons name="checkmark" size={38} color="#FFFFFF" />
        </View>
        <Text style={[styles.successMessage, { color: palette.text }]}>{message}</Text>
      </Animated.View>
    </Animated.View>
  );
}

/* ============================================================
   TOAST
============================================================ */
function Toast({ message, palette }: { message: string | null; palette: ReturnType<typeof getPalette> }) {
  if (!message) return null;
  return (
    <Animated.View entering={FadeInDown.duration(250)} exiting={FadeOut.duration(250)} style={styles.toastWrap}>
      <View style={[styles.toastCard, { backgroundColor: palette.text }]}>
        <Ionicons name="notifications" size={16} color="#FFFFFF" />
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </Animated.View>
  );
}

/* ============================================================
   TRACK DELIVERY MODAL
============================================================ */
function TrackDeliveryModal({
  order,
  palette,
  onClose,
}: {
  order: DisplayOrder | null;
  palette: ReturnType<typeof getPalette>;
  onClose: () => void;
}) {
  const [driverCoords, setDriverCoords] = useState(FALLBACK_LOCATION);
  const [mapReady, setMapReady] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(order?.distanceKm ?? null);

  useEffect(() => {
    if (!order) return;
    setDriverCoords(FALLBACK_LOCATION);
    setDistanceKm(order.distanceKm);
  }, [order?.apiId]);

  useEffect(() => {
    if (!order) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const update = await DriverOrdersService.trackOrder(order.apiId);
        if (cancelled) return;
        if (update.driverLatitude != null && update.driverLongitude != null) {
          setDriverCoords({ lat: update.driverLatitude, lng: update.driverLongitude });
        }
        if (update.distanceKm != null) setDistanceKm(update.distanceKm);
      } catch (e) {
        // Skip this tick silently — a transient network error shouldn't
        // interrupt the polling interval.
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [order?.apiId]);

  if (!order) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <BlurView intensity={40} tint={palette.scheme === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill}>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <View style={[styles.trackModalCard, { backgroundColor: palette.background }]}>
            <View style={styles.trackModalHeader}>
              <Text style={[styles.trackModalTitle, { color: palette.text }]}>Track Delivery</Text>
              <Pressable onPress={onClose} hitSlop={10} style={[styles.iconButton, { backgroundColor: palette.pillBg }]}>
                <Ionicons name="close" size={18} color={palette.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={[styles.trackMapWrap, { borderColor: palette.border }]}>
                <TrackingMap
                  driverLat={driverCoords.lat}
                  driverLng={driverCoords.lng}
                  destLat={order.lat}
                  destLng={order.lng}
                  isDark={palette.scheme === "dark"}
                  onReady={() => setMapReady(true)}
                />
                {!mapReady && (
                  <View style={[styles.mapLoadingOverlay, { backgroundColor: palette.card }]}>
                    <ActivityIndicator size="small" color={palette.primary} />
                  </View>
                )}
              </View>

              <View style={styles.trackStatsRow}>
                <View style={[styles.trackStatPill, { backgroundColor: palette.pillBg }]}>
                  <Ionicons name="navigate-outline" size={14} color={palette.text} />
                  <Text style={[styles.trackStatText, { color: palette.text }]}>
                    {distanceKm != null ? `${distanceKm} km away` : "Distance unavailable"}
                  </Text>
                </View>
                <View style={[styles.trackStatPill, { backgroundColor: palette.pillBg }]}>
                  <Ionicons name="time-outline" size={14} color={palette.text} />
                  <Text style={[styles.trackStatText, { color: palette.text }]}>ETA {order.eta}</Text>
                </View>
              </View>

              <Text style={[styles.trackSectionTitle, { color: palette.text }]}>Customer Information</Text>
              <View style={[styles.trackSectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <View style={styles.orderCustomerRow}>
                  <View style={[styles.orderAvatarFallback, { backgroundColor: palette.primary }]}>
                    <Text style={styles.orderAvatarFallbackText}>
                      {order.customerName.trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={[styles.orderCustomerName, { color: palette.text }]}>{order.customerName}</Text>
                    <Text style={[styles.orderAddress, { color: palette.muted }]}>{order.address}</Text>
                  </View>
                </View>
                <View style={styles.taskButtonsRow}>
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}
                    style={[styles.taskButtonPrimary, { backgroundColor: palette.primary }]}
                  >
                    <Ionicons name="call-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.taskButtonPrimaryText}>Call</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => Linking.openURL(`sms:${order.customerPhone}`)}
                    style={[styles.ghostButton, { borderColor: palette.border }]}
                  >
                    <Ionicons name="chatbubble-outline" size={15} color={palette.text} />
                    <Text style={[styles.ghostButtonText, { color: palette.text }]}>Message</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={[styles.trackSectionTitle, { color: palette.text }]}>Order Details</Text>
              <View style={[styles.trackSectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <DetailRow label="Order ID" value={order.id} palette={palette} />
                <DetailRow label="Bottle" value={`${order.bottleName} (${order.bottleSize})`} palette={palette} />
                <DetailRow label="Quantity" value={order.quantity} palette={palette} />
                <DetailRow label="Price" value={formatNaira(order.price)} palette={palette} />
                <DetailRow label="Payment" value={order.paymentMethod} palette={palette} />
                <DetailRow label="Priority" value={order.isAsap ? "ASAP" : "Normal"} palette={palette} />
                {order.notes && <DetailRow label="Notes" value={order.notes} palette={palette} />}
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </BlurView>
    </Modal>
  );
}

/* ============================================================
   VIEW DETAILS MODAL
============================================================ */
function DetailRow({ label, value, palette }: { label: string; value: string; palette: ReturnType<typeof getPalette> }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

function ViewDetailsModal({
  order,
  palette,
  onClose,
}: {
  order: DisplayOrder | null;
  palette: ReturnType<typeof getPalette>;
  onClose: () => void;
}) {
  if (!order) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <BlurView intensity={40} tint={palette.scheme === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill}>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <View style={[styles.trackModalCard, { backgroundColor: palette.background }]}>
            <View style={styles.trackModalHeader}>
              <Text style={[styles.trackModalTitle, { color: palette.text }]}>Order Details</Text>
              <Pressable onPress={onClose} hitSlop={10} style={[styles.iconButton, { backgroundColor: palette.pillBg }]}>
                <Ionicons name="close" size={18} color={palette.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={[styles.trackSectionTitle, { color: palette.text }]}>Customer Information</Text>
              <View style={[styles.trackSectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <DetailRow label="Name" value={order.customerName} palette={palette} />
                <DetailRow label="Phone" value={order.customerPhone} palette={palette} />
                <DetailRow label="Address" value={order.address} palette={palette} />
              </View>

              <Text style={[styles.trackSectionTitle, { color: palette.text }]}>Order Information</Text>
              <View style={[styles.trackSectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <DetailRow label="Order ID" value={order.id} palette={palette} />
                <DetailRow label="Bottle" value={`${order.bottleName} (${order.bottleSize})`} palette={palette} />
                <DetailRow label="Quantity" value={order.quantity} palette={palette} />
                <DetailRow label="Price" value={formatNaira(order.price)} palette={palette} />
                <DetailRow label="Payment" value={order.paymentMethod} palette={palette} />
                <DetailRow label="Priority" value={order.isAsap ? "ASAP" : "Normal"} palette={palette} />
                {order.notes && <DetailRow label="Delivery Notes" value={order.notes} palette={palette} />}
              </View>

              <Text style={[styles.trackSectionTitle, { color: palette.text }]}>Status Timeline</Text>
              <View style={[styles.trackSectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <DetailRow label="Created" value={order.createdAt} palette={palette} />
                <DetailRow label="Assigned" value={order.assignedAt ?? "—"} palette={palette} />
                <DetailRow label="Started" value={order.startedAt ?? "—"} palette={palette} />
                <DetailRow label="Completed" value={order.completedAt ?? "—"} palette={palette} />
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </BlurView>
    </Modal>
  );
}

/* ============================================================
   BOTTOM NAVIGATION
============================================================ */
function BottomNavItem({
  label,
  icon,
  isActive,
  color,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  color: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(isActive ? 1.08 : 1);
  useEffect(() => {
    scale.value = withSpring(isActive ? 1.08 : 1, { damping: 10 });
  }, [isActive]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable onPress={onPress} style={styles.bottomNavItem}>
      <Animated.View style={animatedStyle}>
        <Ionicons name={icon} size={22} color={color} />
      </Animated.View>
      <Text style={[styles.bottomNavLabel, { color, fontWeight: isActive ? "700" : "500" }]}>{label}</Text>
    </Pressable>
  );
}

function BottomNav({
  palette,
  activeKey,
  onNavigate,
}: {
  palette: ReturnType<typeof getPalette>;
  activeKey: string;
  onNavigate: (route: string) => void;
}) {
  return (
    <View style={[styles.bottomNav, { backgroundColor: palette.headerBg, borderTopColor: palette.border }]}>
      {BOTTOM_TABS.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <BottomNavItem
            key={tab.key}
            label={tab.label}
            icon={tab.icon as keyof typeof Ionicons.glyphMap}
            isActive={isActive}
            color={isActive ? palette.primary : palette.muted}
            onPress={() => onNavigate(tab.route)}
          />
        );
      })}
    </View>
  );
}

/* ============================================================
   MAIN ORDERS SCREEN
============================================================ */
export default function DriverOrdersScreen() {
  const router = useRouter();
  const { trackOrderId } = useLocalSearchParams<{ trackOrderId?: string }>();
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 720;

  /* Theme */
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [systemScheme, setSystemScheme] = useState<Scheme>((Appearance.getColorScheme() as Scheme) || "light");

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark" || saved === "system") setThemeMode(saved);
      } catch (e) {
        // default remains "system"
      }
    })();
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme((colorScheme as Scheme) || "light");
    });
    return () => subscription.remove();
  }, []);

  const activeScheme: Scheme = themeMode === "system" ? systemScheme : themeMode;
  const palette = useMemo(() => getPalette(activeScheme), [activeScheme]);

  const handleCycleTheme = useCallback(async () => {
    const order: ThemeMode[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(themeMode) + 1) % order.length];
    setThemeMode(next);
    try {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, next);
    } catch (e) {
      // ignore
    }
  }, [themeMode]);

  /* Orders State — fetched from the backend, no demo data */
  const [orders, setOrders] = useState<DisplayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<DisplayStatus>("Pending");

  const [trackingOrder, setTrackingOrder] = useState<DisplayOrder | null>(null);
  const [detailsOrder, setDetailsOrder] = useState<DisplayOrder | null>(null);

  const [confirmAction, setConfirmAction] = useState<{ type: "start" | "complete"; order: DisplayOrder } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3200);
  }, []);

  const showSuccess = useCallback((message: string) => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    setSuccessMessage(message);
    successTimeoutRef.current = setTimeout(() => setSuccessMessage(null), 1600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await DriverOrdersService.getOrders();
      setOrders(result.map(mapOrderToDisplay));
    } catch (e) {
      setLoadError("Could not load orders. Pull down to try again.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadOrders();
      setLoading(false);
    })();
  }, [loadOrders]);

  // Honors ?trackOrderId= (tasks.tsx's "Continue Delivery" navigates here
  // with the order's id attached) to auto-open the modal — but ONLY once.
  //
  // A ref-based "already opened" guard is NOT enough here: if this screen
  // ever remounts (tab switch and back, fast refresh, etc.) while
  // trackOrderId is still sitting in the URL, a fresh component instance
  // gets a fresh ref starting at null, and the modal reopens all over
  // again. The real fix is to clear the param out of the URL itself the
  // moment it's consumed — router.setParams below — so there is nothing
  // left in the route for any future render/remount to react to.
  useEffect(() => {
    if (!trackOrderId || orders.length === 0) return;
    const match = orders.find((o) => o.id === trackOrderId);
    if (match) {
      setTrackingOrder(match);
    }
    // Clear it either way (even if no match yet) so a stale/invalid id
    // doesn't linger in the URL forever either.
    router.setParams({ trackOrderId: undefined });
  }, [trackOrderId, orders]);

  useEffect(() => {
    const interval = setInterval(loadOrders, 20000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  const filteredOrders = useMemo(
    () => orders.filter((o) => o.status === activeFilter),
    [orders, activeFilter]
  );

  const counts = useMemo<Record<DisplayStatus, number>>(
    () => ({
      Pending: orders.filter((o) => o.status === "Pending").length,
      Active: orders.filter((o) => o.status === "Active").length,
      Completed: orders.filter((o) => o.status === "Completed").length,
    }),
    [orders]
  );

  /* Entrance animation */
  const entranceOpacity = useSharedValue(0);
  const entranceTranslate = useSharedValue(16);
  useEffect(() => {
    entranceOpacity.value = withTiming(1, { duration: 450 });
    entranceTranslate.value = withTiming(0, { duration: 450, easing: Easing.out(Easing.quad) });
  }, []);
  const contentEntrance = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    transform: [{ translateY: entranceTranslate.value }],
  }));

  /* Handlers */
  const handleTopTabNavigate = useCallback((route: string) => router.push(route as any), [router]);
  const handleBottomNavNavigate = useCallback(
    (route: string) => {
      if (route === "/driver/orders") return;
      router.push(route as any);
    },
    [router]
  );
  const handleOpenProfile = useCallback(() => router.push("/driver/account" as any), [router]);
  const handleOpenNotifications = useCallback(() => {
    // Notification page will be built later.
  }, []);

  const handleAccept = useCallback(
    async (order: DisplayOrder) => {
      try {
        await DriverOrdersService.acceptOrder(order.apiId);
        showSuccess("Delivery Assigned Successfully");
        setActiveFilter("Active");
        await loadOrders();
      } catch (e) {
        showToast("Could not accept this order — it may have already been taken.");
        await loadOrders();
      }
    },
    [loadOrders, showSuccess, showToast]
  );

  const handleDecline = useCallback(
    async (order: DisplayOrder) => {
      setOrders((prev) => prev.filter((o) => o.apiId !== order.apiId));
      try {
        await DriverOrdersService.declineOrder(order.apiId);
        showToast(`Order #${order.id} declined`);
      } catch (e) {
        showToast("Could not decline this order. Please try again.");
        await loadOrders();
      }
    },
    [loadOrders, showToast]
  );

  const handleTrack = useCallback((order: DisplayOrder) => setTrackingOrder(order), []);
  const handleViewDetails = useCallback((order: DisplayOrder) => setDetailsOrder(order), []);

  const handleStartRequest = useCallback((order: DisplayOrder) => {
    setConfirmAction({ type: "start", order });
  }, []);

  const handleCompleteRequest = useCallback((order: DisplayOrder) => {
    setConfirmAction({ type: "complete", order });
  }, []);

  const handleConfirmYes = useCallback(async () => {
    if (!confirmAction) return;
    const { type, order } = confirmAction;
    setActionLoading(true);

    try {
      if (type === "start") {
        await DriverOrdersService.startOrder(order.apiId);
        showSuccess("Delivery Started");
        setTimeout(() => showToast("Customer has been notified that delivery is on the way."), 900);
      } else {
        await DriverOrdersService.completeOrder(order.apiId);
        showSuccess("Delivery Completed Successfully");
        setTimeout(() => showToast("Customer has been notified that the order has been delivered."), 900);
        setActiveFilter("Completed");
      }
      await loadOrders();
    } catch (e) {
      showToast("Could not update this order. Please try again.");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }, [confirmAction, loadOrders, showSuccess, showToast]);

  const handleConfirmNo = useCallback(() => setConfirmAction(null), []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <DashboardHeader
          palette={palette}
          themeMode={themeMode}
          onCycleTheme={handleCycleTheme}
          onOpenNotifications={handleOpenNotifications}
          onOpenProfile={handleOpenProfile}
        />

        <TopTabsBar palette={palette} onNavigate={handleTopTabNavigate} />

        <ScrollView
          style={{ flex: 1, backgroundColor: palette.background }}
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isWideScreen ? 32 : 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.primary} colors={[palette.primary]} />}
        >
          <Animated.View style={contentEntrance}>
            <Text style={[styles.pageTitle, { color: palette.text }]}>Orders</Text>

            {loadError && (
              <View style={[styles.errorBanner, { backgroundColor: palette.danger + "1A" }]}>
                <Text style={[styles.errorBannerText, { color: palette.danger }]}>{loadError}</Text>
              </View>
            )}

            <FilterPills palette={palette} active={activeFilter} onChange={setActiveFilter} counts={counts} />

            {loading ? (
              <View style={{ paddingVertical: 60, alignItems: "center" }}>
                <ActivityIndicator color={palette.primary} />
              </View>
            ) : filteredOrders.length === 0 ? (
              <EmptyState palette={palette} filter={activeFilter} />
            ) : (
              <FlatList
                data={filteredOrders}
                keyExtractor={(item) => String(item.apiId)}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <OrderCard
                    order={item}
                    palette={palette}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                    onTrack={handleTrack}
                    onViewDetails={handleViewDetails}
                    onStart={handleStartRequest}
                    onComplete={handleCompleteRequest}
                  />
                )}
                ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
                contentContainerStyle={{ marginTop: 18 }}
              />
            )}

            <View style={{ height: 24 }} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomNav palette={palette} activeKey="orders" onNavigate={handleBottomNavNavigate} />

      <TrackDeliveryModal order={trackingOrder} palette={palette} onClose={() => setTrackingOrder(null)} />
      <ViewDetailsModal order={detailsOrder} palette={palette} onClose={() => setDetailsOrder(null)} />

      <ConfirmDialog
        visible={!!confirmAction}
        palette={palette}
        title={confirmAction?.type === "start" ? "Start Delivery?" : "Complete Delivery?"}
        message={
          confirmAction?.type === "start"
            ? `Confirm you are starting delivery for Order #${confirmAction?.order.id}.`
            : `Confirm Order #${confirmAction?.order.id} has been delivered to the customer.`
        }
        loading={actionLoading}
        onYes={handleConfirmYes}
        onNo={handleConfirmNo}
      />

      <SuccessOverlay visible={!!successMessage} palette={palette} message={successMessage ?? ""} />
      <Toast message={toastMessage} palette={palette} />
    </SafeAreaView>
  );
}

/* ============================================================
   STYLES
============================================================ */
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingTop: 16 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logoBadge: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 10 },
  logoBadgeText: { color: "#FFFFFF", fontWeight: "800", fontSize: 17 },
  headerBrand: { fontSize: 18, fontWeight: "800" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  notifDot: { position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: 4 },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },

  topTabsWrapper: { paddingHorizontal: 16 },
  topTabsRow: { flexDirection: "row", gap: 26 },
  topTabItem: { paddingBottom: 12 },
  topTabLabel: { fontSize: 15, fontWeight: "700" },
  topTabsBaseline: { height: 1, width: "100%" },
  topTabsUnderline: { position: "absolute", bottom: 0, height: 2, borderRadius: 2 },

  pageTitle: { fontSize: 26, fontWeight: "800", marginTop: 6, marginBottom: 16 },

  errorBanner: { borderRadius: 12, padding: 14, marginBottom: 16 },
  errorBannerText: { fontSize: 12.5, fontWeight: "700" },

  filterWrap: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
  },
  filterPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  filterPillText: { fontSize: 13.5, fontWeight: "700" },
  filterCountBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  filterCountText: { fontSize: 10.5, fontWeight: "800" },

  orderCard: { borderWidth: 1, borderRadius: 20, padding: 16 },
  asapBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 12,
  },
  asapBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  orderTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  orderId: { fontSize: 15, fontWeight: "800" },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusChipText: { fontSize: 11.5, fontWeight: "800" },

  orderCustomerRow: { flexDirection: "row", alignItems: "center" },
  orderAvatarFallback: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  orderAvatarFallbackText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  orderCustomerName: { fontSize: 15, fontWeight: "700" },
  orderAddress: { fontSize: 12.5, marginTop: 2 },
  priorityBadgeSoft: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  priorityBadgeSoftText: { fontSize: 11, fontWeight: "700" },

  orderDivider: { height: 1, marginVertical: 14 },

  orderBottleRow: { flexDirection: "row", alignItems: "center" },
  bottleIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bottleName: { fontSize: 14, fontWeight: "700" },
  bottleQuantity: { fontSize: 12, marginTop: 2 },
  orderPrice: { fontSize: 15, fontWeight: "800" },

  orderMetaRow: { flexDirection: "row", gap: 16, marginTop: 14, flexWrap: "wrap" },
  taskMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  taskMetaText: { fontSize: 12.5, fontWeight: "600" },

  taskButtonsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  taskButtonPrimary: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  taskButtonPrimaryText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "700" },
  taskButtonSecondary: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  taskButtonSecondaryText: { fontSize: 13.5, fontWeight: "700" },
  ghostButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  ghostButtonText: { fontSize: 13, fontWeight: "700" },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  emptyIconCircle: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyTitle: { fontSize: 17, fontWeight: "800", marginBottom: 6 },
  emptySubtitle: { fontSize: 13, textAlign: "center", maxWidth: 260 },

  confirmOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15,23,42,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    zIndex: 50,
  },
  confirmCard: { width: "100%", maxWidth: 340, borderRadius: 22, padding: 24 },
  confirmTitle: { fontSize: 17, fontWeight: "800", marginBottom: 8 },
  confirmMessage: { fontSize: 13.5, lineHeight: 19, marginBottom: 22 },
  confirmButtonsRow: { flexDirection: "row", gap: 10 },
  confirmButtonNo: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  confirmButtonNoText: { fontSize: 14, fontWeight: "700" },
  confirmButtonYes: { flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  confirmButtonYesText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  successOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
  },
  successCard: { width: "78%", maxWidth: 320, borderRadius: 24, paddingVertical: 36, paddingHorizontal: 32, alignItems: "center" },
  successCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  successMessage: { fontSize: 16, fontWeight: "800", textAlign: "center" },

  toastWrap: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 55,
  },
  toastCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    maxWidth: 420,
  },
  toastText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "600", flexShrink: 1 },

  trackModalCard: {
    flex: 1,
    marginTop: 40,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  trackModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  trackModalTitle: { fontSize: 18, fontWeight: "800" },
  trackMapWrap: { height: 220, borderRadius: 18, borderWidth: 1, overflow: "hidden", marginBottom: 14 },
  mapLoadingOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  trackStatsRow: { flexDirection: "row", gap: 10, marginBottom: 22 },
  trackStatPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  trackStatText: { fontSize: 12.5, fontWeight: "700" },
  trackSectionTitle: { fontSize: 14.5, fontWeight: "800", marginBottom: 10 },
  trackSectionCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 20 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  detailLabel: { fontSize: 12.5, fontWeight: "600" },
  detailValue: { fontSize: 12.5, fontWeight: "700", maxWidth: "60%", textAlign: "right" },

  bottomNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 22 : 12,
    paddingHorizontal: 8,
  },
  bottomNavItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  bottomNavLabel: { fontSize: 11 },
});