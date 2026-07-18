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
  Image,
  Appearance,
  ActivityIndicator,
  Platform,
  Modal,
  RefreshControl,
  useWindowDimensions,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { BarChart } from "react-native-gifted-charts";
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
import { DriverDashboardService } from "../../services/driverDashboard";
import { DriverDailyStats, ChartRange, ChartPoint } from "../../types/driverTask";

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
  warning: "#F59E0B",
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
    warning: BRAND.warning,
    completed: BRAND.completed,
    danger: BRAND.danger,
    headerBg: isDark ? "#0A2645" : BRAND.background,
    pillBg: isDark ? "#12335C" : "#EEF3FA",
    modalBg: isDark ? "#0E2D52" : "#FFFFFF",
  };
}

const THEME_STORAGE_KEY = "kayora_driver_theme_mode";

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
  { key: "orders", label: "Orders", icon: "receipt-outline", route: "/driver/orders" as const },
  { key: "tasks", label: "Tasks", icon: "list", route: "/driver/tasks" as const },
  { key: "account", label: "Account", icon: "person-outline", route: "/driver/account" as const },
];

/* ============================================================
   DISPLAY MODEL
   ------------------------------------------------------------
   This screen is a second view over the SAME orders DriverOrders
   Service already fetches for orders.tsx — not a separate "tasks"
   backend concept. "Scheduled" here means "assigned, not yet
   Delivered" (covers Assigned/Accepted/Preparing/Out For
   Delivery, including ASAP orders — those arrive already
   Assigned per the driver-picker flow, so they just show up here
   like any other task, no separate handling needed). "Completed"
   means status === Delivered.
============================================================ */
type TaskPriority = "High" | "Medium" | "Low";
type TaskStatus = "Scheduled" | "In Progress" | "Completed";

interface DisplayTask {
  id: string; // order_number — also what orders.tsx's ?trackOrderId= expects
  apiId: number;
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerPicture: string | null;
  address: string;
  bottleName: string;
  bottleSize: string;
  quantity: string;
  paymentMethod: string;
  priority: TaskPriority;
  status: TaskStatus;
  // True when this is an ASAP order the driver hasn't accepted/declined
  // yet — raw backend status is still 'Assigned' (set directly by the
  // customer's driver-picker at checkout, no offer/broadcast step).
  // Scheduled (non-ASAP) orders are pre-arranged, so they never need this.
  needsResponse: boolean;
  deliveryTime: string;
  notes?: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

function formatTimeLabel(iso: string | null): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function mapOrderToTaskDisplay(order: DriverOrder): DisplayTask {
  const firstItem = order.items[0];
  const bottleSummary =
    order.items.length > 1
      ? `${firstItem?.bottleName ?? "Order"} +${order.items.length - 1} more`
      : firstItem?.bottleName ?? "—";
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const priorityMap: Record<string, TaskPriority> = {
    Urgent: "High",
    High: "High",
    Normal: "Medium",
  };

  const status: TaskStatus =
    order.status === "Delivered" ? "Completed" : order.status === "Out For Delivery" ? "In Progress" : "Scheduled";

  const isAsap = order.priority === "Urgent";

  return {
    id: order.orderNumber,
    apiId: order.id,
    orderId: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerPicture: null,
    address: order.deliveryAddress,
    bottleName: bottleSummary,
    bottleSize: firstItem?.size ?? "",
    quantity: `${totalQuantity} Pack${totalQuantity === 1 ? "" : "s"}`,
    paymentMethod: order.paymentMethod ?? "—",
    priority: priorityMap[order.priority] ?? "Medium",
    status,
    needsResponse: isAsap && order.status === "Assigned",
    deliveryTime: order.eta ?? "—",
    notes: order.specialInstructions ?? undefined,
    assignedAt: formatTimeLabel(order.assignedAt),
    startedAt: formatTimeLabel(order.startedAt),
    completedAt: formatTimeLabel(order.completedAt),
  };
}

/* ============================================================
   CHART RANGE CONFIG
============================================================ */
const CHART_RANGES: { key: ChartRange; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

/* ============================================================
   HELPERS
============================================================ */
function priorityColor(priority: TaskPriority, palette: ReturnType<typeof getPalette>) {
  if (priority === "High") return palette.danger;
  if (priority === "Medium") return palette.warning;
  return palette.success;
}

function statusColor(status: TaskStatus, palette: ReturnType<typeof getPalette>) {
  if (status === "Completed") return palette.completed;
  if (status === "In Progress") return palette.secondary;
  return palette.primary;
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
  const [pressedKey, setPressedKey] = useState<string>("tasks");
  const underlineX = useSharedValue(0);
  const underlineWidth = useSharedValue(0);
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});

  const handlePress = (key: string, route: string) => {
    setPressedKey(key);
    const layout = tabLayouts.current[key];
    if (layout) {
      underlineX.value = withTiming(layout.x, { duration: 220, easing: Easing.out(Easing.quad) });
      underlineWidth.value = withTiming(layout.width, { duration: 220, easing: Easing.out(Easing.quad) });
    }
    if (key !== "tasks") setTimeout(() => onNavigate(route), 140);
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
              if (tab.key === "tasks") {
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
   ANALYTICS CARD
============================================================ */
function AnalyticsCard({
  icon,
  label,
  value,
  color,
  palette,
  delay,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
  palette: ReturnType<typeof getPalette>;
  delay: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 700;
    const raf = setInterval(() => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      setDisplayValue(Math.round(value * progress));
      if (progress >= 1) clearInterval(raf);
    }, 30);
    return () => clearInterval(raf);
  }, [value]);

  return (
    <Animated.View
      entering={FadeInDown.duration(450).delay(delay)}
      style={[styles.analyticsCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <View style={[styles.analyticsIconWrap, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.analyticsValue, { color: palette.text }]}>{displayValue}</Text>
      <Text style={[styles.analyticsLabel, { color: palette.muted }]}>{label}</Text>
    </Animated.View>
  );
}

/* ============================================================
   CHART SECTION
   ------------------------------------------------------------
   Data/range/loading are all lifted to the parent screen now,
   since fetching a new range means a real network call
   (GET /driver/tasks/performance?range=) instead of a local
   object lookup.
============================================================ */
function DeliveryChart({
  palette,
  range,
  onRangeChange,
  data,
  loading,
}: {
  palette: ReturnType<typeof getPalette>;
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  data: ChartPoint[];
  loading: boolean;
}) {
  const barData = useMemo(
    () =>
      data.map((point) => ({
        value: point.value,
        label: point.label,
        frontColor: palette.primary,
        gradientColor: palette.secondary,
      })),
    [data, palette.primary, palette.secondary]
  );

  return (
    <Animated.View
      entering={FadeInDown.duration(500).delay(120)}
      style={[styles.chartCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <View style={styles.chartHeaderRow}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Delivery Performance</Text>
      </View>

      <View style={[styles.rangeSwitchRow, { backgroundColor: palette.pillBg }]}>
        {CHART_RANGES.map((item) => {
          const isActive = item.key === range;
          return (
            <Pressable
              key={item.key}
              onPress={() => onRangeChange(item.key)}
              style={[styles.rangePill, isActive && { backgroundColor: palette.primary }]}
            >
              <Text style={[styles.rangePillText, { color: isActive ? "#FFFFFF" : palette.muted }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 18, alignItems: "center", minHeight: 180, justifyContent: "center" }}>
        {loading ? (
          <ActivityIndicator color={palette.primary} />
        ) : (
          <BarChart
            key={range}
            data={barData}
            barWidth={range === "day" ? 22 : range === "week" ? 26 : range === "month" ? 40 : 30}
            spacing={range === "year" ? 18 : 22}
            roundedTop
            roundedBottom
            hideRules
            xAxisThickness={0}
            yAxisThickness={0}
            yAxisTextStyle={{ color: palette.muted, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: palette.muted, fontSize: 10 }}
            noOfSections={4}
            isAnimated
            animationDuration={550}
            height={180}
            width={undefined}
            gradientColor={palette.secondary}
            showGradient
          />
        )}
      </View>
    </Animated.View>
  );
}

/* ============================================================
   SCHEDULED TASK CARD
============================================================ */
const ScheduledTaskCard = memo(function ScheduledTaskCard({
  task,
  palette,
  onMoreDetails,
  onAccept,
  onDecline,
}: {
  task: DisplayTask;
  palette: ReturnType<typeof getPalette>;
  onMoreDetails: (task: DisplayTask) => void;
  onAccept: (task: DisplayTask) => void;
  onDecline: (task: DisplayTask) => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const initial = (task.customerName ?? "").trim().charAt(0).toUpperCase() || "?";

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[styles.taskCard, { backgroundColor: palette.card, borderColor: palette.border }, animatedStyle]}
    >
      {task.needsResponse && (
        <View style={[styles.asapBadge, { backgroundColor: palette.danger }]}>
          <Ionicons name="flash" size={12} color="#FFFFFF" />
          <Text style={styles.asapBadgeText}>ASAP — AWAITING YOUR RESPONSE</Text>
        </View>
      )}

      <View style={styles.taskTopRow}>
        <View style={styles.taskCustomerRow}>
          {task.customerPicture ? (
            <Image source={{ uri: task.customerPicture }} style={styles.taskAvatarImage} />
          ) : (
            <View style={[styles.taskAvatarFallback, { backgroundColor: palette.primary }]}>
              <Text style={styles.taskAvatarFallbackText}>{initial}</Text>
            </View>
          )}
          <View style={{ marginLeft: 10, flexShrink: 1 }}>
            <Text style={[styles.taskCustomerName, { color: palette.text }]} numberOfLines={1}>
              {task.customerName || "Unknown Customer"}
            </Text>
            <Text style={[styles.taskAddress, { color: palette.muted }]} numberOfLines={1}>
              {task.address}
            </Text>
          </View>
        </View>

        <View style={[styles.priorityBadge, { backgroundColor: priorityColor(task.priority, palette) + "1A" }]}>
          <Text style={[styles.priorityBadgeText, { color: priorityColor(task.priority, palette) }]}>
            {task.priority}
          </Text>
        </View>
      </View>

      <View style={[styles.taskDivider, { backgroundColor: palette.border }]} />

      <View style={styles.taskBottleRow}>
        <View style={[styles.bottleIconWrap, { backgroundColor: palette.pillBg }]}>
          <Ionicons name="water-outline" size={18} color={palette.secondary} />
        </View>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={[styles.bottleName, { color: palette.text }]} numberOfLines={1}>
            {task.bottleName}
          </Text>
          <Text style={[styles.bottleQuantity, { color: palette.muted }]}>
            {task.bottleSize} · {task.quantity}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(task.status, palette) + "1A" }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor(task.status, palette) }]}>{task.status}</Text>
        </View>
      </View>

      <View style={styles.taskMetaRow}>
        <View style={styles.taskMetaItem}>
          <Ionicons name="time-outline" size={14} color={palette.muted} />
          <Text style={[styles.taskMetaText, { color: palette.muted }]}>{task.deliveryTime}</Text>
        </View>
        <View style={styles.taskMetaItem}>
          <Ionicons name="card-outline" size={14} color={palette.muted} />
          <Text style={[styles.taskMetaText, { color: palette.muted }]}>{task.paymentMethod}</Text>
        </View>
      </View>

      {task.needsResponse ? (
        <View style={styles.taskButtonsRow}>
          <Pressable
            onPressIn={() => (scale.value = withTiming(0.97, { duration: 100 }))}
            onPressOut={() => (scale.value = withSpring(1, { damping: 12 }))}
            onPress={() => onAccept(task)}
            style={[styles.taskButtonPrimary, { backgroundColor: palette.primary, flex: 1 }]}
          >
            <Text style={styles.taskButtonPrimaryText}>Accept</Text>
          </Pressable>
          <Pressable
            onPress={() => onDecline(task)}
            style={[styles.ghostButton, { borderColor: palette.border, flex: 1 }]}
          >
            <Text style={[styles.ghostButtonText, { color: palette.danger }]}>Decline</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPressIn={() => (scale.value = withTiming(0.97, { duration: 100 }))}
          onPressOut={() => (scale.value = withSpring(1, { damping: 12 }))}
          onPress={() => onMoreDetails(task)}
          style={[styles.moreDetailsButton, { backgroundColor: palette.primary }]}
        >
          <Text style={styles.moreDetailsButtonText}>More Details</Text>
          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
        </Pressable>
      )}
    </Animated.View>
  );
});

/* ============================================================
   COMPLETED TASK CARD
============================================================ */
const CompletedTaskCard = memo(function CompletedTaskCard({
  task,
  palette,
  onViewDetails,
}: {
  task: DisplayTask;
  palette: ReturnType<typeof getPalette>;
  onViewDetails: (task: DisplayTask) => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[styles.completedCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <View style={[styles.completedIconCircle, { backgroundColor: palette.completed }]}>
        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.taskCustomerName, { color: palette.text }]} numberOfLines={1}>
          {task.customerName || "Unknown Customer"}
        </Text>
        <Text style={[styles.taskAddress, { color: palette.muted }]} numberOfLines={1}>
          {task.bottleName} · {task.quantity}
        </Text>
        <Text style={[styles.completedMeta, { color: palette.muted }]}>
          {task.orderId} · Completed {task.completedAt}
        </Text>
      </View>
      <Pressable onPress={() => onViewDetails(task)} style={[styles.viewDetailsSmall, { borderColor: palette.border }]}>
        <Text style={[styles.viewDetailsSmallText, { color: palette.text }]}>View</Text>
      </Pressable>
    </Animated.View>
  );
});

/* ============================================================
   EMPTY STATE
============================================================ */
function EmptyState({
  palette,
  icon,
  title,
}: {
  palette: ReturnType<typeof getPalette>;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
      <View style={[styles.emptyIconCircle, { backgroundColor: palette.pillBg }]}>
        <Ionicons name={icon} size={34} color={palette.muted} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>{title}</Text>
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
function SuccessOverlay({ visible, palette, message }: { visible: boolean; palette: ReturnType<typeof getPalette>; message: string }) {
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
   DETAIL ROW
============================================================ */
function DetailRow({ label, value, palette }: { label: string; value: string; palette: ReturnType<typeof getPalette> }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

/* ============================================================
   TASK DETAILS MODAL
============================================================ */
function TaskDetailsModal({
  task,
  palette,
  onClose,
  onStartDelivery,
  onContinueDelivery,
}: {
  task: DisplayTask | null;
  palette: ReturnType<typeof getPalette>;
  onClose: () => void;
  onStartDelivery: (task: DisplayTask) => void;
  onContinueDelivery: (task: DisplayTask) => void;
}) {
  if (!task) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <BlurView intensity={40} tint={palette.scheme === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill}>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <View style={[styles.detailsModalCard, { backgroundColor: palette.background }]}>
            <View style={styles.trackModalHeader}>
              <Text style={[styles.trackModalTitle, { color: palette.text }]}>Task Details</Text>
              <Pressable onPress={onClose} hitSlop={10} style={[styles.iconButton, { backgroundColor: palette.pillBg }]}>
                <Ionicons name="close" size={18} color={palette.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.taskCustomerRow}>
                {task.customerPicture ? (
                  <Image source={{ uri: task.customerPicture }} style={styles.taskAvatarImage} />
                ) : (
                  <View style={[styles.taskAvatarFallback, { backgroundColor: palette.primary }]}>
                    <Text style={styles.taskAvatarFallbackText}>
                      {(task.customerName ?? "").trim().charAt(0).toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={[styles.taskCustomerName, { color: palette.text }]}>{task.customerName || "Unknown Customer"}</Text>
                  <Text style={[styles.taskAddress, { color: palette.muted }]}>{task.customerPhone}</Text>
                </View>
              </View>

              <Text style={[styles.trackSectionTitle, { color: palette.text, marginTop: 20 }]}>Order Information</Text>
              <View style={[styles.trackSectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <DetailRow label="Order ID" value={task.orderId} palette={palette} />
                <DetailRow label="Address" value={task.address} palette={palette} />
                <DetailRow label="Bottle" value={`${task.bottleName} (${task.bottleSize})`} palette={palette} />
                <DetailRow label="Quantity" value={task.quantity} palette={palette} />
                <DetailRow label="Payment" value={task.paymentMethod} palette={palette} />
                <DetailRow label="Priority" value={task.priority} palette={palette} />
                <DetailRow label="Status" value={task.status} palette={palette} />
                <DetailRow label="Delivery Time" value={task.deliveryTime} palette={palette} />
                {task.notes && <DetailRow label="Delivery Notes" value={task.notes} palette={palette} />}
              </View>

              <Text style={[styles.trackSectionTitle, { color: palette.text }]}>Status Timeline</Text>
              <View style={[styles.trackSectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <DetailRow label="Assigned" value={task.assignedAt ?? "—"} palette={palette} />
                <DetailRow label="Started" value={task.startedAt ?? "—"} palette={palette} />
                <DetailRow label="Completed" value={task.completedAt ?? "—"} palette={palette} />
              </View>

              <View style={styles.taskButtonsRow}>
                {task.status === "Scheduled" && (
                  <Pressable
                    onPress={() => onStartDelivery(task)}
                    style={[styles.taskButtonPrimary, { backgroundColor: palette.primary }]}
                  >
                    <Ionicons name="play-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.taskButtonPrimaryText}>Start Delivery</Text>
                  </Pressable>
                )}
                {task.status === "In Progress" && (
                  <Pressable
                    onPress={() => onContinueDelivery(task)}
                    style={[styles.taskButtonPrimary, { backgroundColor: palette.secondary }]}
                  >
                    <Ionicons name="navigate-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.taskButtonPrimaryText}>Continue Delivery</Text>
                  </Pressable>
                )}
                <Pressable onPress={onClose} style={[styles.ghostButton, { borderColor: palette.border }]}>
                  <Text style={[styles.ghostButtonText, { color: palette.text }]}>Close</Text>
                </Pressable>
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
   MAIN TASKS SCREEN
============================================================ */
export default function DriverTasksScreen() {
  const router = useRouter();
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

  /* ---------- Real tasks (= orders) from the backend ---------- */
  const [allOrders, setAllOrders] = useState<DriverOrder[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await DriverOrdersService.getOrders();
      setAllOrders(result);
    } catch (e) {
      setLoadError("Could not load tasks. Pull down to try again.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      setTasksLoading(true);
      await loadTasks();
      setTasksLoading(false);
    })();
  }, [loadTasks]);

  const scheduledTasks = useMemo(
    () =>
      allOrders
        .filter((o) => o.status !== "Delivered" && o.status !== "Cancelled")
        .map(mapOrderToTaskDisplay),
    [allOrders]
  );

  const completedTasks = useMemo(
    () => allOrders.filter((o) => o.status === "Delivered").map(mapOrderToTaskDisplay),
    [allOrders]
  );

  /* ---------- Real analytics (Today's Deliveries / Completed / Pending / Active) ---------- */
  const [stats, setStats] = useState<DriverDailyStats>({
    todayDeliveries: 0,
    completed: 0,
    pending: 0,
    active: 0,
    distanceKm: 0,
  });

  const loadStats = useCallback(async () => {
    try {
      const result = await DriverDashboardService.getTodayStats();
      setStats(result);
    } catch (e) {
      // Keep last-known stats rather than zeroing them out on a transient error.
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  /* ---------- Real chart data (GET /driver/tasks/performance?range=) ---------- */
  const [chartRange, setChartRange] = useState<ChartRange>("week");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setChartLoading(true);
      try {
        const result = await DriverDashboardService.getPerformance(chartRange);
        if (!cancelled) setChartData(result);
      } catch (e) {
        if (!cancelled) setChartData([]);
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chartRange]);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadTasks(), loadStats()]);
    setRefreshing(false);
  }, [loadTasks, loadStats]);

  const [detailsTask, setDetailsTask] = useState<DisplayTask | null>(null);
  const [confirmTask, setConfirmTask] = useState<DisplayTask | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3200);
  };

  const showSuccess = (message: string) => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    setSuccessMessage(message);
    successTimeoutRef.current = setTimeout(() => setSuccessMessage(null), 1500);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

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

  /* Navigation Handlers */
  const handleTopTabNavigate = useCallback((route: string) => router.push(route as any), [router]);
  const handleBottomNavNavigate = useCallback(
    (route: string) => {
      if (route === "/driver/tasks") return;
      router.push(route as any);
    },
    [router]
  );
  const handleOpenProfile = useCallback(() => router.push("/driver/account" as any), [router]);
  const handleOpenNotifications = useCallback(() => {
    // Notification page will be built later.
  }, []);

  /* Task Handlers */
  const handleMoreDetails = useCallback((task: DisplayTask) => setDetailsTask(task), []);
  const handleViewCompletedDetails = useCallback((task: DisplayTask) => setDetailsTask(task), []);

  const handleRequestStart = useCallback((task: DisplayTask) => {
    setDetailsTask(null);
    setConfirmTask(task);
  }, []);

  const handleContinueDelivery = useCallback(
    (task: DisplayTask) => {
      setDetailsTask(null);
      // orders.tsx now actually reads this param and auto-opens the
      // tracking modal for the matching order on arrival.
      router.push(`/driver/orders?trackOrderId=${task.id}` as any);
    },
    [router]
  );

  const handleConfirmYes = useCallback(async () => {
    if (!confirmTask) return;
    setConfirmLoading(true);
    try {
      await DriverOrdersService.startOrder(confirmTask.apiId);
      setConfirmTask(null);
      showSuccess("Delivery Started");
      setTimeout(() => showToast("Customer has been notified that the delivery has started."), 900);
      await Promise.all([loadTasks(), loadStats()]);
    } catch (e) {
      showToast("Could not start this delivery. Please try again.");
    } finally {
      setConfirmLoading(false);
    }
  }, [confirmTask, loadTasks, loadStats]);

  const handleConfirmNo = useCallback(() => setConfirmTask(null), []);

  const handleAcceptTask = useCallback(
    async (task: DisplayTask) => {
      try {
        await DriverOrdersService.acceptOrder(task.apiId);
        showSuccess("Delivery Accepted");
        await loadTasks();
      } catch (e) {
        showToast("Could not accept this order — it may have already been taken.");
        await loadTasks();
      }
    },
    [loadTasks]
  );

  const handleDeclineTask = useCallback(
    async (task: DisplayTask) => {
      try {
        await DriverOrdersService.declineOrder(task.apiId);
        showToast(`Order ${task.orderId} declined`);
        await loadTasks();
      } catch (e) {
        showToast("Could not decline this order. Please try again.");
        await loadTasks();
      }
    },
    [loadTasks]
  );

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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefreshAll} tintColor={palette.primary} colors={[palette.primary]} />}
        >
          <Animated.View style={contentEntrance}>
            <Text style={[styles.pageTitle, { color: palette.text }]}>Today's Tasks</Text>
            <Text style={[styles.pageSubtitle, { color: palette.muted }]}>
              Track your assigned deliveries and monitor your daily performance.
            </Text>

            {loadError && (
              <View style={[styles.errorBanner, { backgroundColor: palette.danger + "1A" }]}>
                <Text style={[styles.errorBannerText, { color: palette.danger }]}>{loadError}</Text>
              </View>
            )}

            <View style={styles.analyticsGrid}>
              <AnalyticsCard
                icon="cube-outline"
                label="Today's Deliveries"
                value={stats.todayDeliveries}
                color={palette.primary}
                palette={palette}
                delay={0}
              />
              <AnalyticsCard
                icon="checkmark-done-outline"
                label="Completed Today"
                value={stats.completed}
                color={palette.completed}
                palette={palette}
                delay={60}
              />
              <AnalyticsCard
                icon="hourglass-outline"
                label="Pending Today"
                value={stats.pending}
                color={palette.warning}
                palette={palette}
                delay={120}
              />
              <AnalyticsCard
                icon="navigate-outline"
                label="Active Deliveries"
                value={stats.active}
                color={palette.secondary}
                palette={palette}
                delay={180}
              />
            </View>

            <DeliveryChart
              palette={palette}
              range={chartRange}
              onRangeChange={setChartRange}
              data={chartData}
              loading={chartLoading}
            />

            <Text style={[styles.sectionTitle, { color: palette.text, marginTop: 26, marginBottom: 14 }]}>
              Today's Scheduled Deliveries
            </Text>

            {tasksLoading ? (
              <ActivityIndicator color={palette.primary} style={{ marginVertical: 20 }} />
            ) : scheduledTasks.length === 0 ? (
              <EmptyState palette={palette} icon="calendar-outline" title="No deliveries scheduled today." />
            ) : (
              <FlatList
                data={scheduledTasks}
                keyExtractor={(item) => String(item.apiId)}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <ScheduledTaskCard
                    task={item}
                    palette={palette}
                    onMoreDetails={handleMoreDetails}
                    onAccept={handleAcceptTask}
                    onDecline={handleDeclineTask}
                  />
                )}
                ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
              />
            )}

            <Text style={[styles.sectionTitle, { color: palette.text, marginTop: 26, marginBottom: 14 }]}>
              Completed Deliveries
            </Text>

            {tasksLoading ? (
              <ActivityIndicator color={palette.primary} style={{ marginVertical: 20 }} />
            ) : completedTasks.length === 0 ? (
              <EmptyState palette={palette} icon="checkmark-done-circle-outline" title="No completed deliveries yet." />
            ) : (
              <FlatList
                data={completedTasks}
                keyExtractor={(item) => String(item.apiId)}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <CompletedTaskCard task={item} palette={palette} onViewDetails={handleViewCompletedDetails} />
                )}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              />
            )}

            <View style={{ height: 24 }} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomNav palette={palette} activeKey="tasks" onNavigate={handleBottomNavNavigate} />

      <TaskDetailsModal
        task={detailsTask}
        palette={palette}
        onClose={() => setDetailsTask(null)}
        onStartDelivery={handleRequestStart}
        onContinueDelivery={handleContinueDelivery}
      />

      <ConfirmDialog
        visible={!!confirmTask}
        palette={palette}
        title="Start this delivery?"
        message={`Confirm you are starting delivery for ${confirmTask?.orderId ?? ""}.`}
        loading={confirmLoading}
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

  /* Header */
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

  /* Top Tabs */
  topTabsWrapper: { paddingHorizontal: 16 },
  topTabsRow: { flexDirection: "row", gap: 26 },
  topTabItem: { paddingBottom: 12 },
  topTabLabel: { fontSize: 15, fontWeight: "700" },
  topTabsBaseline: { height: 1, width: "100%" },
  topTabsUnderline: { position: "absolute", bottom: 0, height: 2, borderRadius: 2 },

  /* Page title */
  pageTitle: { fontSize: 26, fontWeight: "800", marginTop: 6 },
  pageSubtitle: { fontSize: 13.5, marginTop: 6, marginBottom: 20, lineHeight: 19 },

  errorBanner: { borderRadius: 12, padding: 14, marginBottom: 16 },
  errorBannerText: { fontSize: 12.5, fontWeight: "700" },

  /* Analytics */
  analyticsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  analyticsCard: { width: "47%", borderWidth: 1, borderRadius: 18, padding: 16 },
  analyticsIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  analyticsValue: { fontSize: 22, fontWeight: "800" },
  analyticsLabel: { fontSize: 12, marginTop: 2 },

  /* Chart */
  chartCard: { borderWidth: 1, borderRadius: 20, padding: 18, marginBottom: 8 },
  chartHeaderRow: { marginBottom: 14 },
  rangeSwitchRow: { flexDirection: "row", borderRadius: 12, padding: 4 },
  rangePill: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  rangePillText: { fontSize: 12.5, fontWeight: "700" },

  sectionTitle: { fontSize: 17, fontWeight: "800" },

  /* Scheduled Task Card */
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
  taskCard: { borderWidth: 1, borderRadius: 20, padding: 16 },
  taskTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  taskCustomerRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  taskAvatarImage: { width: 42, height: 42, borderRadius: 21 },
  taskAvatarFallback: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  taskAvatarFallbackText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  taskCustomerName: { fontSize: 15, fontWeight: "700" },
  taskAddress: { fontSize: 12.5, marginTop: 2 },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  priorityBadgeText: { fontSize: 11.5, fontWeight: "800" },
  taskDivider: { height: 1, marginVertical: 14 },
  taskBottleRow: { flexDirection: "row", alignItems: "center" },
  bottleIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bottleName: { fontSize: 14, fontWeight: "700" },
  bottleQuantity: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusBadgeText: { fontSize: 11.5, fontWeight: "800" },
  taskMetaRow: { flexDirection: "row", gap: 18, marginTop: 14, marginBottom: 4 },
  taskMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  taskMetaText: { fontSize: 12.5, fontWeight: "600" },

  moreDetailsButton: {
    marginTop: 14,
    height: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  moreDetailsButtonText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "700" },

  /* Completed Card */
  completedCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 18, padding: 14 },
  completedIconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  completedMeta: { fontSize: 11.5, marginTop: 4 },
  viewDetailsSmall: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  viewDetailsSmallText: { fontSize: 12.5, fontWeight: "700" },

  /* Empty State */
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { fontSize: 14.5, fontWeight: "700" },

  /* Confirm Dialog */
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
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

  /* Success Overlay */
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
  },
  successCard: { width: "78%", maxWidth: 320, borderRadius: 24, paddingVertical: 36, paddingHorizontal: 32, alignItems: "center" },
  successCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  successMessage: { fontSize: 16, fontWeight: "800", textAlign: "center" },

  /* Toast */
  toastWrap: { position: "absolute", bottom: 100, left: 16, right: 16, alignItems: "center", zIndex: 55 },
  toastCard: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, maxWidth: 420 },
  toastText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "600", flexShrink: 1 },

  /* Details Modal */
  detailsModalCard: {
    flex: 1,
    marginTop: 40,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  trackModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  trackModalTitle: { fontSize: 18, fontWeight: "800" },
  trackSectionTitle: { fontSize: 14.5, fontWeight: "800", marginBottom: 10 },
  trackSectionCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 20 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  detailLabel: { fontSize: 12.5, fontWeight: "600" },
  detailValue: { fontSize: 12.5, fontWeight: "700", maxWidth: "60%", textAlign: "right" },

  taskButtonsRow: { flexDirection: "row", gap: 10, marginTop: 6, marginBottom: 10 },
  taskButtonPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  taskButtonPrimaryText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "700" },
  ghostButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostButtonText: { fontSize: 13.5, fontWeight: "700" },

  /* Bottom Nav */
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