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
  Platform,
  Modal,
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
   NOTE ON SHARED STATE
   ------------------------------------------------------------
   In production this demo store is lifted into its own module
   (e.g. src/store/deliveryStore.ts) built with the same shape
   below, imported by both orders.tsx and tasks.tsx, and later
   swapped for a Laravel-backed API/query layer without any UI
   changes. Since only this single file may be generated in this
   step, the store logic lives here and is written so it can be
   extracted verbatim later.
============================================================ */

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
   DEMO DATA TYPES
============================================================ */
type TaskPriority = "High" | "Medium" | "Low";
type TaskStatus = "Scheduled" | "In Progress" | "Completed";
type PaymentMethod = "Cash" | "Card" | "Transfer";

interface DemoTask {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerPicture: string | null;
  address: string;
  bottleName: string;
  bottleSize: string;
  quantity: string;
  paymentMethod: PaymentMethod;
  priority: TaskPriority;
  status: TaskStatus;
  deliveryTime: string;
  notes?: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

const INITIAL_SCHEDULED: DemoTask[] = [
  {
    id: "TASK-2201",
    orderId: "ORD-3392",
    customerName: "Tunde Bakare",
    customerPhone: "+2348034567890",
    customerPicture: null,
    address: "45 Airport Road, Benin City",
    bottleName: "50cl Kayora Table Water",
    bottleSize: "50cl",
    quantity: "12 Packs",
    paymentMethod: "Transfer",
    priority: "Medium",
    status: "Scheduled",
    deliveryTime: "1:05 PM",
    notes: "Call before arrival.",
    assignedAt: "11:40 AM",
  },
  {
    id: "TASK-2196",
    orderId: "ORD-3387",
    customerName: "Grace Idahosa",
    customerPhone: "+2348045678901",
    customerPicture: null,
    address: "7 Ring Road, Benin City",
    bottleName: "75cl Sharp-Sharp",
    bottleSize: "75cl",
    quantity: "8 Packs",
    paymentMethod: "Card",
    priority: "Low",
    status: "Scheduled",
    deliveryTime: "1:40 PM",
    assignedAt: "11:02 AM",
  },
  {
    id: "TASK-2188",
    orderId: "ORD-3379",
    customerName: "Michael Osaro",
    customerPhone: "+2348056789012",
    customerPicture: null,
    address: "18 New Lagos Road, Benin City",
    bottleName: "30cl Sharp-Sharp",
    bottleSize: "30cl",
    quantity: "30 Packs",
    paymentMethod: "Cash",
    priority: "High",
    status: "In Progress",
    deliveryTime: "1:15 PM",
    assignedAt: "10:20 AM",
    startedAt: "10:35 AM",
  },
];

const INITIAL_COMPLETED: DemoTask[] = [
  {
    id: "TASK-2140",
    orderId: "ORD-3350",
    customerName: "Ifeoma Chukwu",
    customerPhone: "+2348067890123",
    customerPicture: null,
    address: "3 Reservation Road, Benin City",
    bottleName: "50cl Kayora Table Water",
    bottleSize: "50cl",
    quantity: "15 Packs",
    paymentMethod: "Transfer",
    priority: "Medium",
    status: "Completed",
    deliveryTime: "9:50 AM",
    assignedAt: "8:52 AM",
    startedAt: "9:05 AM",
    completedAt: "9:48 AM",
  },
  {
    id: "TASK-2119",
    orderId: "ORD-3341",
    customerName: "Bassey Effiong",
    customerPhone: "+2348078901234",
    customerPicture: null,
    address: "22 Uselu Lagos Road, Benin City",
    bottleName: "30cl Sharp-Sharp",
    bottleSize: "30cl",
    quantity: "25 Packs",
    paymentMethod: "Cash",
    priority: "Low",
    status: "Completed",
    deliveryTime: "8:30 AM",
    assignedAt: "7:50 AM",
    startedAt: "8:02 AM",
    completedAt: "8:27 AM",
  },
];

/* ============================================================
   CHART DEMO DATA
============================================================ */
type ChartRange = "Day" | "Week" | "Month" | "Year";

const CHART_DATA: Record<ChartRange, { value: number; label: string }[]> = {
  Day: [
    { value: 1, label: "8AM" },
    { value: 3, label: "10AM" },
    { value: 2, label: "12PM" },
    { value: 4, label: "2PM" },
    { value: 3, label: "4PM" },
    { value: 1, label: "6PM" },
  ],
  Week: [
    { value: 6, label: "Mon" },
    { value: 9, label: "Tue" },
    { value: 7, label: "Wed" },
    { value: 11, label: "Thu" },
    { value: 8, label: "Fri" },
    { value: 5, label: "Sat" },
    { value: 3, label: "Sun" },
  ],
  Month: [
    { value: 28, label: "Wk 1" },
    { value: 34, label: "Wk 2" },
    { value: 31, label: "Wk 3" },
    { value: 22, label: "Wk 4" },
  ],
  Year: [
    { value: 96, label: "Jan" },
    { value: 110, label: "Feb" },
    { value: 102, label: "Mar" },
    { value: 118, label: "Apr" },
    { value: 124, label: "May" },
    { value: 108, label: "Jun" },
  ],
};

const CHART_RANGES: ChartRange[] = ["Day", "Week", "Month", "Year"];

/* ============================================================
   HELPERS
============================================================ */
function currentTimeLabel() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

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
            <Text style={styles.avatarFallbackText}>J</Text>
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
  const animatedValue = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    animatedValue.value = 0;
    animatedValue.value = withTiming(value, { duration: 700, easing: Easing.out(Easing.cubic) });
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
============================================================ */
function DeliveryChart({ palette }: { palette: ReturnType<typeof getPalette> }) {
  const [range, setRange] = useState<ChartRange>("Week");
  const data = CHART_DATA[range];

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
          const isActive = item === range;
          return (
            <Pressable
              key={item}
              onPress={() => setRange(item)}
              style={[styles.rangePill, isActive && { backgroundColor: palette.primary }]}
            >
              <Text style={[styles.rangePillText, { color: isActive ? "#FFFFFF" : palette.muted }]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 18, alignItems: "center" }}>
        <BarChart
          key={range}
          data={barData}
          barWidth={range === "Day" ? 22 : range === "Week" ? 26 : range === "Month" ? 40 : 30}
          spacing={range === "Year" ? 18 : 22}
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
}: {
  task: DemoTask;
  palette: ReturnType<typeof getPalette>;
  onMoreDetails: (task: DemoTask) => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const initial = task.customerName.trim().charAt(0).toUpperCase();

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[styles.taskCard, { backgroundColor: palette.card, borderColor: palette.border }, animatedStyle]}
    >
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
              {task.customerName}
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

      <Pressable
        onPressIn={() => (scale.value = withTiming(0.97, { duration: 100 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 12 }))}
        onPress={() => onMoreDetails(task)}
        style={[styles.moreDetailsButton, { backgroundColor: palette.primary }]}
      >
        <Text style={styles.moreDetailsButtonText}>More Details</Text>
        <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
      </Pressable>
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
  task: DemoTask;
  palette: ReturnType<typeof getPalette>;
  onViewDetails: (task: DemoTask) => void;
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
          {task.customerName}
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
  onYes,
  onNo,
}: {
  visible: boolean;
  palette: ReturnType<typeof getPalette>;
  title: string;
  message: string;
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
          <Pressable onPress={onNo} style={[styles.confirmButtonNo, { borderColor: palette.border }]}>
            <Text style={[styles.confirmButtonNoText, { color: palette.text }]}>No</Text>
          </Pressable>
          <Pressable onPress={onYes} style={[styles.confirmButtonYes, { backgroundColor: palette.primary }]}>
            <Text style={styles.confirmButtonYesText}>Yes</Text>
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
  task: DemoTask | null;
  palette: ReturnType<typeof getPalette>;
  onClose: () => void;
  onStartDelivery: (task: DemoTask) => void;
  onContinueDelivery: (task: DemoTask) => void;
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
                      {task.customerName.trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={[styles.taskCustomerName, { color: palette.text }]}>{task.customerName}</Text>
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

  /* Demo Task Store */
  const [scheduledTasks, setScheduledTasks] = useState<DemoTask[]>(INITIAL_SCHEDULED);
  const [completedTasks, setCompletedTasks] = useState<DemoTask[]>(INITIAL_COMPLETED);

  const [detailsTask, setDetailsTask] = useState<DemoTask | null>(null);
  const [confirmTask, setConfirmTask] = useState<DemoTask | null>(null);
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
  const handleMoreDetails = useCallback((task: DemoTask) => setDetailsTask(task), []);
  const handleViewCompletedDetails = useCallback((task: DemoTask) => setDetailsTask(task), []);

  const handleRequestStart = useCallback((task: DemoTask) => {
    setDetailsTask(null);
    setConfirmTask(task);
  }, []);

  const handleContinueDelivery = useCallback(
    (task: DemoTask) => {
      setDetailsTask(null);
      // In production this passes the target order id as a route param so
      // driver/orders.tsx opens the tracking modal for this exact delivery,
      // e.g. router.push(`/driver/orders?trackOrderId=${task.orderId}`).
      router.push(`/driver/orders?trackOrderId=${task.orderId}` as any);
    },
    [router]
  );

  const handleConfirmYes = useCallback(() => {
    if (!confirmTask) return;
    const target = confirmTask;
    setConfirmTask(null);

    setScheduledTasks((prev) =>
      prev.map((t) =>
        t.id === target.id ? { ...t, status: "In Progress", startedAt: currentTimeLabel() } : t
      )
    );

    showSuccess("Delivery Started");
    setTimeout(() => showToast("Customer has been notified that the delivery has started."), 900);
  }, [confirmTask]);

  const handleConfirmNo = useCallback(() => setConfirmTask(null), []);

  /* Analytics (derived from live demo state so it stays in sync) */
  const analytics = useMemo(() => {
    const activeCount = scheduledTasks.filter((t) => t.status === "In Progress").length;
    const pendingCount = scheduledTasks.filter((t) => t.status === "Scheduled").length;
    const completedTodayCount = completedTasks.length;
    const totalToday = scheduledTasks.length + completedTasks.length;
    return {
      totalToday,
      completedTodayCount,
      pendingCount,
      activeCount,
    };
  }, [scheduledTasks, completedTasks]);

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
        >
          <Animated.View style={contentEntrance}>
            <Text style={[styles.pageTitle, { color: palette.text }]}>Today's Tasks</Text>
            <Text style={[styles.pageSubtitle, { color: palette.muted }]}>
              Track your assigned deliveries and monitor your daily performance.
            </Text>

            <View style={styles.analyticsGrid}>
              <AnalyticsCard
                icon="cube-outline"
                label="Today's Deliveries"
                value={analytics.totalToday}
                color={palette.primary}
                palette={palette}
                delay={0}
              />
              <AnalyticsCard
                icon="checkmark-done-outline"
                label="Completed Today"
                value={analytics.completedTodayCount}
                color={palette.completed}
                palette={palette}
                delay={60}
              />
              <AnalyticsCard
                icon="hourglass-outline"
                label="Pending Today"
                value={analytics.pendingCount}
                color={palette.warning}
                palette={palette}
                delay={120}
              />
              <AnalyticsCard
                icon="navigate-outline"
                label="Active Deliveries"
                value={analytics.activeCount}
                color={palette.secondary}
                palette={palette}
                delay={180}
              />
            </View>

            <DeliveryChart palette={palette} />

            <Text style={[styles.sectionTitle, { color: palette.text, marginTop: 26, marginBottom: 14 }]}>
              Today's Scheduled Deliveries
            </Text>

            {scheduledTasks.length === 0 ? (
              <EmptyState palette={palette} icon="calendar-outline" title="No deliveries scheduled today." />
            ) : (
              <FlatList
                data={scheduledTasks}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <ScheduledTaskCard task={item} palette={palette} onMoreDetails={handleMoreDetails} />
                )}
                ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
              />
            )}

            <Text style={[styles.sectionTitle, { color: palette.text, marginTop: 26, marginBottom: 14 }]}>
              Completed Deliveries
            </Text>

            {completedTasks.length === 0 ? (
              <EmptyState palette={palette} icon="checkmark-done-circle-outline" title="No completed deliveries yet." />
            ) : (
              <FlatList
                data={completedTasks}
                keyExtractor={(item) => item.id}
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

  /* Success Overlay */
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