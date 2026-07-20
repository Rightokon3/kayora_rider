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
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  FadeInDown,
} from "react-native-reanimated";
import { DriverDashboardService } from "../../services/driverDashboard";
import { DriverProfileService } from "../../services/driverProfile";
import { DriverTask, DriverDailyStats } from "../../types/driverTask";
import { LiveMapCard } from "../../components/LiveMapCard";

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
    danger: BRAND.danger,
    headerBg: isDark ? "#0A2645" : BRAND.background,
    pillBg: isDark ? "#12335C" : "#EEF3FA",
  };
}

const THEME_STORAGE_KEY = "kayora_driver_theme_mode";

/* ============================================================
   SIGNED-IN DRIVER (fetched, not hardcoded)
   ------------------------------------------------------------
   Replaces the old DEMO_DRIVER constant. Shown as "Driver" with
   no avatar while loading/on error, rather than a fake name, so
   it never lies about who's actually logged in.
============================================================ */
interface SignedInDriver {
  name: string;
  profilePicture: string | null;
}

/* ============================================================
   TASK DISPLAY TYPES
   ------------------------------------------------------------
   TaskCard renders a simplified 3-value status/priority. Real
   DriverTask records from the backend (8-value status, 3-value
   priority) are mapped into this shape below — mapDriverTaskTo
   DisplayTask is the ONLY place that needs to know how one
   collapses into the other.
============================================================ */
type TaskPriority = "High" | "Medium" | "Low";
type TaskStatus = "Assigned" | "In Progress" | "Completed";

interface DisplayTask {
  id: string;
  customerName: string;
  customerPicture: string | null;
  phone: string;
  address: string;
  bottleName: string;
  quantity: string;
  status: TaskStatus;
  priority: TaskPriority;
  distanceKm: number;
  eta: string;
  lat: number;
  lng: number;
}

function mapDriverTaskToDisplayTask(task: DriverTask): DisplayTask {
  const statusMap: Record<string, TaskStatus> = {
    Assigned: "Assigned",
    Preparing: "Assigned",
    "Out For Delivery": "In Progress",
    Delivered: "Completed",
  };

  const priorityMap: Record<string, TaskPriority> = {
    Urgent: "High",
    High: "High",
    Normal: "Medium",
  };

  const firstItem = task.items[0];
  const bottleSummary =
    task.items.length > 1
      ? `${firstItem?.bottleName ?? "Order"} +${task.items.length - 1} more`
      : firstItem?.bottleName ?? "—";
  const totalQuantity = task.items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: String(task.id),
    customerName: task.customerName,
    customerPicture: null,
    phone: task.customerPhone,
    address: task.deliveryAddress,
    bottleName: bottleSummary,
    quantity: `${totalQuantity} Pack${totalQuantity === 1 ? "" : "s"}`,
    status: statusMap[task.status] ?? "Assigned",
    priority: priorityMap[task.priority] ?? "Medium",
    distanceKm: task.distanceKm ?? 0,
    eta: task.eta ?? "—",
    lat: task.latitude,
    lng: task.longitude,
  };
}

/* ============================================================
   TOP / BOTTOM NAV CONFIG
============================================================ */
const TOP_TABS = [
  { key: "orders", label: "My Orders", route: "/driver/orders" as const },
  { key: "tasks", label: "My Tasks", route: "/driver/tasks" as const },
  { key: "account", label: "My Account", route: "/driver/account" as const },
];

const BOTTOM_TABS = [
  { key: "dashboard", label: "Dashboard", icon: "car-sport", route: "/driver/dashboard" as const },
  { key: "orders", label: "Orders", icon: "receipt-outline", route: "/driver/orders" as const },
  { key: "tasks", label: "Tasks", icon: "list-outline", route: "/driver/tasks" as const },
  { key: "account", label: "Account", icon: "person-outline", route: "/driver/account" as const },
];

/* ============================================================
   HEADER
============================================================ */
function DashboardHeader({
  palette,
  driver,
  themeMode,
  onCycleTheme,
  onOpenNotifications,
  onOpenProfile,
}: {
  palette: ReturnType<typeof getPalette>;
  driver: SignedInDriver;
  themeMode: ThemeMode;
  onCycleTheme: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
}) {
  const themeIcon =
    themeMode === "light" ? "sunny-outline" : themeMode === "dark" ? "moon-outline" : "contrast-outline";

  const initial = driver.name.trim().charAt(0).toUpperCase() || "D";

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
        <Pressable
          onPress={onCycleTheme}
          hitSlop={10}
          style={[styles.iconButton, { backgroundColor: palette.pillBg }]}
        >
          <Ionicons name={themeIcon as any} size={18} color={palette.text} />
        </Pressable>

        <Pressable
          onPress={onOpenNotifications}
          hitSlop={10}
          style={[styles.iconButton, { backgroundColor: palette.pillBg }]}
        >
          <Ionicons name="notifications-outline" size={18} color={palette.text} />
          <View style={[styles.notifDot, { backgroundColor: palette.danger }]} />
        </Pressable>

        <Pressable onPress={onOpenProfile} hitSlop={6}>
          {driver.profilePicture ? (
            <Image source={{ uri: driver.profilePicture }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: palette.secondary }]}>
              <Text style={styles.avatarFallbackText}>{initial}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/* ============================================================
   TOP TABS
============================================================ */
function TopTabsBar({ palette, onNavigate }: { palette: ReturnType<typeof getPalette>; onNavigate: (route: string) => void }) {
  const [pressedKey, setPressedKey] = useState<string | null>(null);
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
    setTimeout(() => onNavigate(route), 140);
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
            }}
            onPress={() => handlePress(tab.key, tab.route)}
            style={styles.topTabItem}
          >
            <Text
              style={[
                styles.topTabLabel,
                { color: pressedKey === tab.key ? palette.primary : palette.muted },
              ]}
            >
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
   WORK STATUS CARD (Automatic availability, synced to backend)
============================================================ */
function WorkStatusCard({ palette }: { palette: ReturnType<typeof getPalette> }) {
  const [isAvailable, setIsAvailable] = useState(() => {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 17;
  });

  useEffect(() => {
    DriverDashboardService.updateDutyStatus(isAvailable ? "on_duty" : "off_duty").catch(() => {
      // Non-fatal — the UI's own automatic calculation still works locally
      // even if this particular sync call fails (e.g. a transient network drop).
    });
  }, [isAvailable]);

  useEffect(() => {
    const interval = setInterval(() => {
      const hour = new Date().getHours();
      setIsAvailable(hour >= 7 && hour < 17);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 0 })
      ),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 1 - (pulse.value - 1) / 0.6,
    transform: [{ scale: pulse.value }],
  }));

  const statusColor = isAvailable ? palette.success : palette.muted;

  return (
    <Animated.View
      entering={FadeInDown.duration(500)}
      style={[styles.statusCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.statusTitle, { color: palette.text }]}>
          {isAvailable ? "Driver is Available" : "Off Duty"}
        </Text>
        <Text style={[styles.statusSubtitle, { color: palette.muted }]}>
          Working hours: 7:00 AM – 5:00 PM · Automatic tracking
        </Text>
      </View>
      <View style={styles.statusIndicatorWrap}>
        <Animated.View style={[styles.statusPulse, { backgroundColor: statusColor }, pulseStyle]} />
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>
    </Animated.View>
  );
}

/* ============================================================
   TASK CARD
============================================================ */
const priorityColor = (priority: TaskPriority, palette: ReturnType<typeof getPalette>) => {
  if (priority === "High") return palette.danger;
  if (priority === "Medium") return palette.warning;
  return palette.success;
};

const taskStatusColor = (status: TaskStatus, palette: ReturnType<typeof getPalette>) => {
  if (status === "Completed") return palette.success;
  if (status === "In Progress") return palette.secondary;
  return palette.primary;
};

const TaskCard = memo(function TaskCard({
  task,
  palette,
  onViewDetails,
  onNavigate,
}: {
  task: DisplayTask;
  palette: ReturnType<typeof getPalette>;
  onViewDetails: (id: string) => void;
  onNavigate: (task: DisplayTask) => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const initial = task.customerName.trim().charAt(0).toUpperCase();

  return (
    <Animated.View
      style={[
        styles.taskCard,
        { backgroundColor: palette.card, borderColor: palette.border },
        animatedStyle,
      ]}
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

        <View
          style={[
            styles.priorityBadge,
            { backgroundColor: priorityColor(task.priority, palette) + "1A" },
          ]}
        >
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
          <Text style={[styles.bottleQuantity, { color: palette.muted }]}>{task.quantity}</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: taskStatusColor(task.status, palette) + "1A" },
          ]}
        >
          <Text style={[styles.statusBadgeText, { color: taskStatusColor(task.status, palette) }]}>
            {task.status}
          </Text>
        </View>
      </View>

      <View style={styles.taskMetaRow}>
        <View style={styles.taskMetaItem}>
          <Ionicons name="navigate-outline" size={14} color={palette.muted} />
          <Text style={[styles.taskMetaText, { color: palette.muted }]}>{task.distanceKm} km</Text>
        </View>
        <View style={styles.taskMetaItem}>
          <Ionicons name="time-outline" size={14} color={palette.muted} />
          <Text style={[styles.taskMetaText, { color: palette.muted }]}>ETA {task.eta}</Text>
        </View>
      </View>

      <View style={styles.taskButtonsRow}>
        <Pressable
          onPressIn={() => (scale.value = withTiming(0.97, { duration: 100 }))}
          onPressOut={() => (scale.value = withSpring(1, { damping: 12 }))}
          onPress={() => onViewDetails(task.id)}
          style={[styles.taskButtonPrimary, { backgroundColor: palette.primary }]}
        >
          <Text style={styles.taskButtonPrimaryText}>View Details</Text>
        </Pressable>

        <Pressable
          onPress={() => onNavigate(task)}
          style={[styles.taskButtonSecondary, { borderColor: palette.border }]}
        >
          <Ionicons name="map-outline" size={16} color={palette.text} />
          <Text style={[styles.taskButtonSecondaryText, { color: palette.text }]}>Navigate</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
});

/* ============================================================
   EMPTY TASKS STATE
============================================================ */
function EmptyTasksState({ palette }: { palette: ReturnType<typeof getPalette> }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[
        styles.emptyState,
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}
    >
      <View style={[styles.emptyIconWrap, { backgroundColor: palette.primary + "1A" }]}>
        <Ionicons name="checkbox-outline" size={30} color={palette.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>All caught up</Text>
      <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
        No active deliveries assigned right now.
      </Text>
    </Animated.View>
  );
}

/* ============================================================
   QUICK STATS
============================================================ */
function QuickStatCard({
  icon,
  label,
  value,
  color,
  palette,
  delay,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  palette: ReturnType<typeof getPalette>;
  delay: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(450).delay(delay)}
      style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <View style={[styles.statIconWrap, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.muted }]}>{label}</Text>
    </Animated.View>
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
      <Text style={[styles.bottomNavLabel, { color, fontWeight: isActive ? "700" : "500" }]}>
        {label}
      </Text>
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
   MAIN DASHBOARD SCREEN
============================================================ */
export default function DriverDashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 720;

  /* ---------- Theme ---------- */
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [systemScheme, setSystemScheme] = useState<Scheme>(
    (Appearance.getColorScheme() as Scheme) || "light"
  );

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark" || saved === "system") {
          setThemeMode(saved);
        }
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
    const nextIndex = (order.indexOf(themeMode) + 1) % order.length;
    const next = order[nextIndex];
    setThemeMode(next);
    try {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, next);
    } catch (e) {
      // ignore persistence failure
    }
  }, [themeMode]);

  /* ---------- Entrance animation ---------- */
  const entranceOpacity = useSharedValue(0);
  const entranceTranslate = useSharedValue(16);
  useEffect(() => {
    entranceOpacity.value = withTiming(1, { duration: 500 });
    entranceTranslate.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.quad) });
  }, []);
  const contentEntrance = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    transform: [{ translateY: entranceTranslate.value }],
  }));

  /* ---------- Signed-in driver (real, not hardcoded) ---------- */
  const [driver, setDriver] = useState<SignedInDriver>({ name: "Driver", profilePicture: null });

  useEffect(() => {
    DriverProfileService.getMyProfile()
      .then((data) => {
        setDriver({
          name: data.driver.name,
          profilePicture: (data.profile?.profile_image as string | undefined) ?? null,
        });
      })
      .catch(() => {
        // Keep the "Driver" placeholder rather than showing a broken state —
        // the rest of the dashboard still works even if this call fails.
      });
  }, []);

  /* ---------- Navigation handlers ---------- */
  const handleTopTabNavigate = useCallback(
    (route: string) => {
      router.push(route as any);
    },
    [router]
  );

  const handleBottomNavNavigate = useCallback(
    (route: string) => {
      if (route === "/driver/dashboard") return;
      router.push(route as any);
    },
    [router]
  );

  const handleOpenProfile = useCallback(() => {
    router.push("/driver/account" as any);
  }, [router]);

  const handleOpenNotifications = useCallback(() => {
    // Notification page will be built later.
  }, []);

  const handleViewAllTasks = useCallback(() => {
    router.push("/driver/tasks" as any);
  }, [router]);

  const handleViewTaskDetails = useCallback(
    (id: string) => {
      router.push(`/driver/tasks/${id}` as any);
    },
    [router]
  );

  const handleNavigateToTask = useCallback(
    (task: DisplayTask) => {
      router.push(`/driver/maps?focusId=${task.id}` as any);
    },
    [router]
  );

  /* ---------- Real tasks + stats from the backend ---------- */
  const [tasks, setTasks] = useState<DriverTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [stats, setStats] = useState<DriverDailyStats>({
    todayDeliveries: 0,
    completed: 0,
    pending: 0,
    active: 0,
    distanceKm: 0,
  });

  const loadDashboardData = useCallback(async () => {
    try {
      const [tasksResult, statsResult] = await Promise.all([
        DriverDashboardService.getTodayTasks(),
        DriverDashboardService.getTodayStats(),
      ]);
      setTasks(tasksResult);
      setStats(statsResult);
    } catch (e) {
      // Keep whatever was last successfully loaded rather than clearing the
      // screen on a transient network error.
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  /* ---------- Real-time distance tracking (Haversine, server-side) ---------- */
  const isOnDuty = useMemo(() => {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 17;
  }, []);

  useEffect(() => {
    if (!isOnDuty) return;

    let cancelled = false;

    const pingLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const position = await Location.getCurrentPositionAsync({});
        const updatedDistanceKm = await DriverDashboardService.sendLocationPing(
          position.coords.latitude,
          position.coords.longitude
        );
        if (!cancelled) {
          setStats((prev) => ({ ...prev, distanceKm: updatedDistanceKm }));
        }
      } catch (e) {
        // Skip this tick silently — GPS/network hiccups shouldn't interrupt
        // the interval or surface an error to the driver mid-delivery.
      }
    };

    pingLocation();
    const interval = setInterval(pingLocation, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOnDuty]);

  const displayTasks = useMemo(() => tasks.map(mapDriverTaskToDisplayTask), [tasks]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
      <DashboardHeader
        palette={palette}
        driver={driver}
        themeMode={themeMode}
        onCycleTheme={handleCycleTheme}
        onOpenNotifications={handleOpenNotifications}
        onOpenProfile={handleOpenProfile}
      />

      <TopTabsBar palette={palette} onNavigate={handleTopTabNavigate} />

      <ScrollView
        style={{ flex: 1, backgroundColor: palette.background }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: isWideScreen ? 32 : 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={contentEntrance}>
          <WorkStatusCard palette={palette} />

          <LiveMapCard palette={palette} />

          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Today's Active Tasks</Text>
            <Pressable onPress={handleViewAllTasks} hitSlop={8}>
              <Text style={[styles.sectionAction, { color: palette.primary }]}>View All →</Text>
            </Pressable>
          </View>

          <FlatList
            data={displayTasks}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TaskCard
                task={item}
                palette={palette}
                onViewDetails={handleViewTaskDetails}
                onNavigate={handleNavigateToTask}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
            ListEmptyComponent={
              tasksLoading ? (
                <ActivityIndicator color={palette.primary} style={{ marginVertical: 20 }} />
              ) : (
                <EmptyTasksState palette={palette} />
              )
            }
          />

          <Text style={[styles.sectionTitle, { color: palette.text, marginTop: 26, marginBottom: 14 }]}>
            Quick Stats
          </Text>

          <View style={styles.statsGrid}>
            <QuickStatCard
              icon="cube-outline"
              label="Today's Deliveries"
              value={String(stats.todayDeliveries)}
              color={palette.primary}
              palette={palette}
              delay={0}
            />
            <QuickStatCard
              icon="checkmark-done-outline"
              label="Completed"
              value={String(stats.completed)}
              color={palette.success}
              palette={palette}
              delay={60}
            />
            <QuickStatCard
              icon="hourglass-outline"
              label="Pending"
              value={String(stats.pending)}
              color={palette.warning}
              palette={palette}
              delay={120}
            />
            <QuickStatCard
              icon="speedometer-outline"
              label="Distance Travelled"
              value={`${stats.distanceKm.toFixed(1)} km`}
              color={palette.secondary}
              palette={palette}
              delay={180}
            />
          </View>

          <View style={{ height: 24 }} />
        </Animated.View>
      </ScrollView>

      <BottomNav palette={palette} activeKey="dashboard" onNavigate={handleBottomNavNavigate} />
    </SafeAreaView>
  );
}

/* ============================================================
   STYLES
============================================================ */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },

  /* Header */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  logoBadgeText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 17,
  },
  headerBrand: {
    fontSize: 18,
    fontWeight: "800",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },

  /* Top Tabs */
  topTabsWrapper: {
    paddingHorizontal: 16,
  },
  topTabsRow: {
    flexDirection: "row",
    gap: 26,
  },
  topTabItem: {
    paddingBottom: 12,
  },
  topTabLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  topTabsBaseline: {
    height: 1,
    width: "100%",
  },
  topTabsUnderline: {
    position: "absolute",
    bottom: 0,
    height: 2,
    borderRadius: 2,
  },

  /* Work Status */
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 12.5,
  },
  statusIndicatorWrap: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPulse: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  /* Section header */
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  sectionAction: {
    fontSize: 13.5,
    fontWeight: "700",
  },

  /* Task Card */
  taskCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  taskTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  taskCustomerRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  taskAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  taskAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  taskAvatarFallbackText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  taskCustomerName: {
    fontSize: 15,
    fontWeight: "700",
  },
  taskAddress: {
    fontSize: 12.5,
    marginTop: 2,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  priorityBadgeText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  taskDivider: {
    height: 1,
    marginVertical: 14,
  },
  taskBottleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bottleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bottleName: {
    fontSize: 14,
    fontWeight: "700",
  },
  bottleQuantity: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  taskMetaRow: {
    flexDirection: "row",
    gap: 18,
    marginTop: 14,
  },
  taskMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  taskMetaText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  taskButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  taskButtonPrimary: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  taskButtonPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
  taskButtonSecondary: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  taskButtonSecondaryText: {
    fontSize: 13.5,
    fontWeight: "700",
  },

  /* Empty Tasks State */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
  },

  /* Quick Stats */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: "47%",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },

  /* Bottom Nav */
  bottomNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 22 : 12,
    paddingHorizontal: 8,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bottomNavLabel: {
    fontSize: 11,
  },
});