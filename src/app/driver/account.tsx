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
  Image,
  Switch,
  Linking,
  Appearance,
  Platform,
  Modal,
  useWindowDimensions,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useDriverAuth } from "../../context/DriverAuthContext";
import * as SecureStore from "expo-secure-store";
import { BlurView } from "expo-blur";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
  backgroundDark: "#0B1220",
  card: "#F8FAFC",
  cardDark: "#141E30",
  border: "#E5E7EB",
  borderDark: "rgba(255,255,255,0.08)",
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
    headerBg: isDark ? "#0A1729" : BRAND.background,
    pillBg: isDark ? "#1B2942" : "#EEF3FA",
    modalBg: isDark ? "#122036" : "#FFFFFF",
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
  { key: "tasks", label: "Tasks", icon: "list-outline", route: "/driver/tasks" as const },
  { key: "account", label: "Account", icon: "person", route: "/driver/account" as const },
];

/* ============================================================
   DEMO DRIVER DATA
============================================================ */
const DRIVER = {
  name: "John Sunday",
  employeeId: "KYA-EMP-0452",
  driverId: "DRV-0001",
  profilePicture: null as string | null,
  onlineStatus: "Available" as "Available" | "Busy" | "Off Duty",
  yearsWithKayora: 3,
  rating: 4.8,
  completedDeliveries: 1284,
  currentAssignment: "ORD-3387 · Ring Road",

  personal: {
    fullName: "John Chukwuemeka Sunday",
    gender: "Male",
    dob: "14 March 1991",
    maritalStatus: "Married",
    nationality: "Nigerian",
    stateOfOrigin: "Edo State",
    residentialAddress: "9 Isekhure Street, Benin City",
    phone: "+234 801 234 5678",
    email: "driver@kayora.com",
    emergencyContactName: "Blessing Sunday",
    emergencyContactPhone: "+234 809 876 5432",
    bloodGroup: "O+",
    genotype: "AA",
    nationalId: "NIN-2938471029",
    employmentDate: "2 June 2022",
    department: "Fleet Operations",
    branch: "Benin City Depot",
    supervisor: "Engr. Patrick Obaseki",
  },

  license: {
    number: "EDS-DL-88213409",
    issueDate: "10 Jan 2023",
    expiryDate: "10 Jan 2028",
    licenseClass: "Class C",
    issuingAuthority: "FRSC Nigeria",
    status: "Valid" as const,
  },

  vehicle: {
    type: "Delivery Van" as const,
    brand: "Toyota",
    model: "Hiace",
    color: "White / Kayora Blue",
    plateNumber: "AKD-245-KY",
    engineNumber: "ENG-33920184",
    chassisNumber: "CHS-77281940",
    fuelType: "Diesel",
    insuranceStatus: "Active",
    insuranceExpiry: "22 Sep 2026",
    vehicleLicenseNumber: "VL-990213",
    registrationDate: "5 Feb 2022",
    roadWorthinessExpiry: "18 Nov 2026",
    assignedDepot: "Benin City Depot",
    currentMileage: "48,210 km",
  },

  work: {
    todaysTasks: 5,
    completedToday: 2,
    pendingTasks: 3,
    currentShift: "Morning Shift",
    workingHours: "7:00 AM – 5:00 PM",
    depot: "Benin City Depot",
    supervisor: "Engr. Patrick Obaseki",
  },
};

const DOCUMENTS = [
  { key: "insurance", title: "Vehicle Insurance", icon: "shield-checkmark-outline" as const, verified: true },
  { key: "roadworthiness", title: "Road Worthiness", icon: "construct-outline" as const, verified: true },
  { key: "vehicleLicense", title: "Vehicle License", icon: "document-text-outline" as const, verified: true },
  { key: "companyId", title: "Company ID Card", icon: "id-card-outline" as const, verified: true },
  { key: "medical", title: "Medical Certificate", icon: "medkit-outline" as const, verified: true },
  { key: "policeClearance", title: "Police Clearance", icon: "shield-outline" as const, verified: false },
];

/* ============================================================
   HELPERS
============================================================ */
function statusColorFor(status: string, palette: ReturnType<typeof getPalette>) {
  if (status === "Available") return palette.success;
  if (status === "Busy") return palette.warning;
  return palette.muted;
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
  const initial = DRIVER.name.trim().charAt(0).toUpperCase();

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
          {DRIVER.profilePicture ? (
            <Image source={{ uri: DRIVER.profilePicture }} style={styles.avatarImage} />
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
  const [pressedKey, setPressedKey] = useState<string>("account");
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
    if (key !== "account") setTimeout(() => onNavigate(route), 140);
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
              if (tab.key === "account") {
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
   GENERIC SECTION CARD
============================================================ */
function SectionCard({
  palette,
  title,
  subtitle,
  delay = 0,
  children,
}: {
  palette: ReturnType<typeof getPalette>;
  title: string;
  subtitle?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(450).delay(delay)}
      style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <Text style={[styles.sectionCardTitle, { color: palette.text }]}>{title}</Text>
      {subtitle && <Text style={[styles.sectionCardSubtitle, { color: palette.muted }]}>{subtitle}</Text>}
      <View style={{ marginTop: 14 }}>{children}</View>
    </Animated.View>
  );
}

/* ============================================================
   DETAIL ROW (personal info)
============================================================ */
const InfoRow = memo(function InfoRow({
  label,
  value,
  palette,
  isLast,
}: {
  label: string;
  value: string;
  palette: ReturnType<typeof getPalette>;
  isLast?: boolean;
}) {
  return (
    <Pressable style={[styles.infoRow, !isLast && { borderBottomWidth: 1, borderBottomColor: palette.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoRowLabel, { color: palette.muted }]}>{label}</Text>
        <Text style={[styles.infoRowValue, { color: palette.text }]}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.muted} />
    </Pressable>
  );
});

/* ============================================================
   TOGGLE ROW
============================================================ */
function ToggleRow({
  palette,
  title,
  subtitle,
  value,
  onChange,
  isLast,
}: {
  palette: ReturnType<typeof getPalette>;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, !isLast && { borderBottomWidth: 1, borderBottomColor: palette.border }]}>
      <View style={{ flex: 1, marginRight: 14 }}>
        <Text style={[styles.toggleTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.toggleSubtitle, { color: palette.muted }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: palette.border, true: palette.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

/* ============================================================
   THEME SEGMENTED SELECTOR
============================================================ */
function ThemeSelector({
  palette,
  themeMode,
  onChange,
}: {
  palette: ReturnType<typeof getPalette>;
  themeMode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}) {
  const options: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "light", label: "Light", icon: "sunny-outline" },
    { key: "dark", label: "Dark", icon: "moon-outline" },
    { key: "system", label: "System", icon: "phone-portrait-outline" },
  ];

  const indicatorX = useSharedValue(0);
  const segmentWidth = useSharedValue(0);
  const containerWidth = useRef(0);

  useEffect(() => {
    if (containerWidth.current > 0) {
      const w = containerWidth.current / 3;
      const index = options.findIndex((o) => o.key === themeMode);
      segmentWidth.value = w;
      indicatorX.value = withTiming(w * index, { duration: 260, easing: Easing.out(Easing.quad) });
    }
  }, [themeMode]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: segmentWidth.value,
  }));

  return (
    <View
      style={[styles.themeSelectorWrap, { backgroundColor: palette.pillBg }]}
      onLayout={(e) => {
        containerWidth.current = e.nativeEvent.layout.width;
        const w = e.nativeEvent.layout.width / 3;
        segmentWidth.value = w;
        const index = options.findIndex((o) => o.key === themeMode);
        indicatorX.value = w * index;
      }}
    >
      <Animated.View style={[styles.themeSelectorIndicator, { backgroundColor: palette.primary }, indicatorStyle]} />
      {options.map((option) => {
        const isActive = option.key === themeMode;
        return (
          <Pressable key={option.key} style={styles.themeSelectorOption} onPress={() => onChange(option.key)}>
            <Ionicons name={option.icon} size={16} color={isActive ? "#FFFFFF" : palette.muted} />
            <Text style={[styles.themeSelectorLabel, { color: isActive ? "#FFFFFF" : palette.muted }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ============================================================
   IMAGE PREVIEW MODAL (placeholder art since no real assets)
============================================================ */
function ImagePreviewModal({
  visible,
  palette,
  title,
  icon,
  onClose,
}: {
  visible: boolean;
  palette: ReturnType<typeof getPalette>;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <BlurView intensity={50} tint={palette.scheme === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill}>
        <View style={styles.previewOverlay}>
          <Animated.View entering={ZoomIn.duration(280)} style={[styles.previewCard, { backgroundColor: palette.modalBg }]}>
            <View style={styles.previewHeaderRow}>
              <Text style={[styles.previewTitle, { color: palette.text }]}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={10} style={[styles.iconButton, { backgroundColor: palette.pillBg }]}>
                <Ionicons name="close" size={18} color={palette.text} />
              </Pressable>
            </View>
            <View style={[styles.previewImageArea, { backgroundColor: palette.pillBg }]}>
              <Ionicons name={icon} size={56} color={palette.primary} />
              <Text style={[styles.previewPlaceholderText, { color: palette.muted }]}>
                Preview unavailable in demo mode
              </Text>
            </View>
          </Animated.View>
        </View>
      </BlurView>
    </Modal>
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
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  palette: ReturnType<typeof getPalette>;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={styles.confirmOverlay}>
      <Animated.View entering={ZoomIn.duration(220)} style={[styles.confirmCard, { backgroundColor: palette.modalBg }]}>
        <View style={[styles.confirmIconCircle, { backgroundColor: palette.danger + "1A" }]}>
          <Ionicons name="log-out-outline" size={26} color={palette.danger} />
        </View>
        <Text style={[styles.confirmTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.confirmMessage, { color: palette.muted }]}>{message}</Text>
        <View style={styles.confirmButtonsRow}>
          <Pressable onPress={onCancel} style={[styles.confirmButtonNo, { borderColor: palette.border }]}>
            <Text style={[styles.confirmButtonNoText, { color: palette.text }]}>Cancel</Text>
          </Pressable>
          <Pressable onPress={onConfirm} style={[styles.confirmButtonYes, { backgroundColor: palette.danger }]}>
            <Text style={styles.confirmButtonYesText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/* ============================================================
   HELP ROW
============================================================ */
function HelpRow({
  icon,
  label,
  palette,
  onPress,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  palette: ReturnType<typeof getPalette>;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.helpRow, !isLast && { borderBottomWidth: 1, borderBottomColor: palette.border }]}
    >
      <View style={[styles.helpIconWrap, { backgroundColor: palette.pillBg }]}>
        <Ionicons name={icon} size={17} color={palette.primary} />
      </View>
      <Text style={[styles.helpLabel, { color: palette.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={palette.muted} />
    </Pressable>
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
   MAIN ACCOUNT SCREEN
============================================================ */
export default function DriverAccountScreen() {
  const router = useRouter();
  const { signOut } = useDriverAuth();
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

  const handleThemeChange = useCallback(async (mode: ThemeMode) => {
    setThemeMode(mode);
    try {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, mode);
    } catch (e) {
      // ignore persistence failure
    }
  }, []);

  const handleCycleTheme = useCallback(() => {
    const order: ThemeMode[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(themeMode) + 1) % order.length];
    handleThemeChange(next);
  }, [themeMode, handleThemeChange]);

  /* Toggles */
  const [taskNotifications, setTaskNotifications] = useState(true);
  const [deliveryUpdates, setDeliveryUpdates] = useState(true);
  const [announcements, setAnnouncements] = useState(true);
  const [emergencyAlerts, setEmergencyAlerts] = useState(true);

  /* Preview modal */
  const [preview, setPreview] = useState<{ title: string; icon: keyof typeof Ionicons.glyphMap } | null>(null);

  /* Sign out */
  const [signOutVisible, setSignOutVisible] = useState(false);

  const handleSignOut = useCallback(async () => {
    setSignOutVisible(false);
    // Goes through the shared DriverAuthContext (not raw SecureStore calls
    // for the old demo keys) so it clears the REAL token/expiry AND updates
    // the same status the route guard reads from — otherwise the guard
    // would still think "authed" after this, exactly the stale-status bug
    // that caused the login redirect loop, just triggered from the other
    // direction.
    await signOut();
    router.replace("/driver/login" as any);
  }, [router, signOut]);

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
      if (route === "/driver/account") return;
      router.push(route as any);
    },
    [router]
  );
  const handleOpenNotifications = useCallback(() => {
    // Notification page will be built later.
  }, []);
  const handleOpenProfile = useCallback(() => {}, []);

  const workStatusColor = statusColorFor(DRIVER.onlineStatus, palette);

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
            <Text style={[styles.pageTitle, { color: palette.text }]}>Account</Text>
            <Text style={[styles.pageSubtitle, { color: palette.muted }]}>
              Manage your profile, documents and preferences.
            </Text>

            {/* ---------- SECTION 1: PROFILE ---------- */}
            <Animated.View
              entering={FadeInDown.duration(450)}
              style={[styles.profileCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <Pressable onPress={() => setPreview({ title: "Profile Picture", icon: "person-outline" })}>
                {DRIVER.profilePicture ? (
                  <Image source={{ uri: DRIVER.profilePicture }} style={styles.profileAvatarImage} />
                ) : (
                  <View style={[styles.profileAvatarFallback, { backgroundColor: palette.primary }]}>
                    <Text style={styles.profileAvatarFallbackText}>{DRIVER.name.charAt(0)}</Text>
                  </View>
                )}
              </Pressable>

              <Text style={[styles.profileName, { color: palette.text }]}>{DRIVER.name}</Text>
              <View style={styles.profileIdRow}>
                <Text style={[styles.profileIdText, { color: palette.muted }]}>
                  {DRIVER.employeeId} · {DRIVER.driverId}
                </Text>
              </View>

              <View style={[styles.onlineBadge, { backgroundColor: workStatusColor + "1A" }]}>
                <View style={[styles.onlineDot, { backgroundColor: workStatusColor }]} />
                <Text style={[styles.onlineBadgeText, { color: workStatusColor }]}>{DRIVER.onlineStatus}</Text>
              </View>

              <View style={styles.profileStatsRow}>
                <View style={styles.profileStatItem}>
                  <Text style={[styles.profileStatValue, { color: palette.text }]}>{DRIVER.yearsWithKayora}</Text>
                  <Text style={[styles.profileStatLabel, { color: palette.muted }]}>Years</Text>
                </View>
                <View style={[styles.profileStatDivider, { backgroundColor: palette.border }]} />
                <View style={styles.profileStatItem}>
                  <Text style={[styles.profileStatValue, { color: palette.text }]}>★ {DRIVER.rating}</Text>
                  <Text style={[styles.profileStatLabel, { color: palette.muted }]}>Rating</Text>
                </View>
                <View style={[styles.profileStatDivider, { backgroundColor: palette.border }]} />
                <View style={styles.profileStatItem}>
                  <Text style={[styles.profileStatValue, { color: palette.text }]}>{DRIVER.completedDeliveries}</Text>
                  <Text style={[styles.profileStatLabel, { color: palette.muted }]}>Deliveries</Text>
                </View>
              </View>

              <View style={[styles.assignmentPill, { backgroundColor: palette.pillBg }]}>
                <Ionicons name="navigate-outline" size={14} color={palette.primary} />
                <Text style={[styles.assignmentPillText, { color: palette.text }]} numberOfLines={1}>
                  Current: {DRIVER.currentAssignment}
                </Text>
              </View>

              <Pressable style={[styles.editProfileButton, { borderColor: palette.border }]}>
                <Ionicons name="create-outline" size={15} color={palette.text} />
                <Text style={[styles.editProfileButtonText, { color: palette.text }]}>Edit Profile</Text>
              </Pressable>
            </Animated.View>

            {/* ---------- SECTION 2: PERSONAL INFORMATION ---------- */}
            <SectionCard palette={palette} title="Personal Information" delay={60}>
              <InfoRow label="Full Name" value={DRIVER.personal.fullName} palette={palette} />
              <InfoRow label="Gender" value={DRIVER.personal.gender} palette={palette} />
              <InfoRow label="Date of Birth" value={DRIVER.personal.dob} palette={palette} />
              <InfoRow label="Marital Status" value={DRIVER.personal.maritalStatus} palette={palette} />
              <InfoRow label="Nationality" value={DRIVER.personal.nationality} palette={palette} />
              <InfoRow label="State of Origin" value={DRIVER.personal.stateOfOrigin} palette={palette} />
              <InfoRow label="Residential Address" value={DRIVER.personal.residentialAddress} palette={palette} />
              <InfoRow label="Phone Number" value={DRIVER.personal.phone} palette={palette} />
              <InfoRow label="Email Address" value={DRIVER.personal.email} palette={palette} />
              <InfoRow label="Emergency Contact Name" value={DRIVER.personal.emergencyContactName} palette={palette} />
              <InfoRow label="Emergency Contact Phone" value={DRIVER.personal.emergencyContactPhone} palette={palette} />
              <InfoRow label="Blood Group" value={DRIVER.personal.bloodGroup} palette={palette} />
              <InfoRow label="Genotype" value={DRIVER.personal.genotype} palette={palette} />
              <InfoRow label="National ID Number" value={DRIVER.personal.nationalId} palette={palette} />
              <InfoRow label="Employment Date" value={DRIVER.personal.employmentDate} palette={palette} />
              <InfoRow label="Department" value={DRIVER.personal.department} palette={palette} />
              <InfoRow label="Branch" value={DRIVER.personal.branch} palette={palette} />
              <InfoRow label="Supervisor" value={DRIVER.personal.supervisor} palette={palette} isLast />
            </SectionCard>

            {/* ---------- SECTION 3: LICENSE INFORMATION ---------- */}
            <Animated.View
              entering={FadeInDown.duration(450).delay(120)}
              style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <Text style={[styles.sectionCardTitle, { color: palette.text }]}>License Information</Text>

              <View style={[styles.licenseCard, { backgroundColor: palette.primary }]}>
                <View style={styles.licenseTopRow}>
                  <View style={styles.licensePhotoWrap}>
                    <Text style={styles.licensePhotoInitial}>{DRIVER.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.licenseName}>{DRIVER.name}</Text>
                    <Text style={styles.licenseSubLabel}>{DRIVER.license.licenseClass} · {DRIVER.license.issuingAuthority}</Text>
                  </View>
                  <View style={styles.licenseStatusBadge}>
                    <Text style={styles.licenseStatusText}>{DRIVER.license.status}</Text>
                  </View>
                </View>

                <View style={styles.licenseDivider} />

                <View style={styles.licenseGrid}>
                  <View style={styles.licenseGridItem}>
                    <Text style={styles.licenseGridLabel}>License Number</Text>
                    <Text style={styles.licenseGridValue}>{DRIVER.license.number}</Text>
                  </View>
                  <View style={styles.licenseGridItem}>
                    <Text style={styles.licenseGridLabel}>Issue Date</Text>
                    <Text style={styles.licenseGridValue}>{DRIVER.license.issueDate}</Text>
                  </View>
                  <View style={styles.licenseGridItem}>
                    <Text style={styles.licenseGridLabel}>Expiry Date</Text>
                    <Text style={styles.licenseGridValue}>{DRIVER.license.expiryDate}</Text>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => setPreview({ title: "Driver License", icon: "card-outline" })}
                style={[styles.smallOutlineButton, { borderColor: palette.border }]}
              >
                <Ionicons name="expand-outline" size={15} color={palette.text} />
                <Text style={[styles.smallOutlineButtonText, { color: palette.text }]}>View Full License</Text>
              </Pressable>
            </Animated.View>

            {/* ---------- SECTION 4: VEHICLE INFORMATION ---------- */}
            <SectionCard palette={palette} title="Vehicle Information" delay={160}>
              <Pressable
                onPress={() => setPreview({ title: "Vehicle Photo", icon: "car-outline" })}
                style={[styles.vehiclePreviewBox, { backgroundColor: palette.pillBg }]}
              >
                <Ionicons name="car-sport-outline" size={40} color={palette.primary} />
                <Text style={[styles.vehiclePreviewText, { color: palette.muted }]}>
                  {DRIVER.vehicle.brand} {DRIVER.vehicle.model}
                </Text>
              </Pressable>

              <InfoRow label="Vehicle Type" value={DRIVER.vehicle.type} palette={palette} />
              <InfoRow label="Vehicle Brand" value={DRIVER.vehicle.brand} palette={palette} />
              <InfoRow label="Vehicle Model" value={DRIVER.vehicle.model} palette={palette} />
              <InfoRow label="Vehicle Color" value={DRIVER.vehicle.color} palette={palette} />
              <InfoRow label="Vehicle Plate Number" value={DRIVER.vehicle.plateNumber} palette={palette} />
              <InfoRow label="Engine Number" value={DRIVER.vehicle.engineNumber} palette={palette} />
              <InfoRow label="Chassis Number" value={DRIVER.vehicle.chassisNumber} palette={palette} />
              <InfoRow label="Fuel Type" value={DRIVER.vehicle.fuelType} palette={palette} />
              <InfoRow label="Insurance Status" value={DRIVER.vehicle.insuranceStatus} palette={palette} />
              <InfoRow label="Insurance Expiry" value={DRIVER.vehicle.insuranceExpiry} palette={palette} />
              <InfoRow label="Vehicle License Number" value={DRIVER.vehicle.vehicleLicenseNumber} palette={palette} />
              <InfoRow label="Registration Date" value={DRIVER.vehicle.registrationDate} palette={palette} />
              <InfoRow label="Road Worthiness Expiry" value={DRIVER.vehicle.roadWorthinessExpiry} palette={palette} />
              <InfoRow label="Assigned Depot" value={DRIVER.vehicle.assignedDepot} palette={palette} />
              <InfoRow label="Current Mileage" value={DRIVER.vehicle.currentMileage} palette={palette} isLast />

              <View style={styles.taskButtonsRow}>
                <Pressable
                  onPress={() => setPreview({ title: "Vehicle Photo", icon: "car-outline" })}
                  style={[styles.smallOutlineButton, { flex: 1, borderColor: palette.border }]}
                >
                  <Ionicons name="image-outline" size={15} color={palette.text} />
                  <Text style={[styles.smallOutlineButtonText, { color: palette.text }]}>Vehicle Photo</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPreview({ title: "Vehicle License", icon: "document-text-outline" })}
                  style={[styles.smallOutlineButton, { flex: 1, borderColor: palette.border }]}
                >
                  <Ionicons name="document-text-outline" size={15} color={palette.text} />
                  <Text style={[styles.smallOutlineButtonText, { color: palette.text }]}>Vehicle License</Text>
                </Pressable>
              </View>
            </SectionCard>

            {/* ---------- SECTION 5: DOCUMENTS ---------- */}
            <SectionCard palette={palette} title="Documents" subtitle="Compliance and verification status" delay={200}>
              {DOCUMENTS.map((doc, index) => (
                <View
                  key={doc.key}
                  style={[
                    styles.documentRow,
                    index !== DOCUMENTS.length - 1 && { borderBottomWidth: 1, borderBottomColor: palette.border },
                  ]}
                >
                  <View style={[styles.helpIconWrap, { backgroundColor: palette.pillBg }]}>
                    <Ionicons name={doc.icon} size={17} color={palette.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.documentTitle, { color: palette.text }]}>{doc.title}</Text>
                    <View
                      style={[
                        styles.documentStatusBadge,
                        { backgroundColor: (doc.verified ? palette.success : palette.warning) + "1A" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.documentStatusText,
                          { color: doc.verified ? palette.success : palette.warning },
                        ]}
                      >
                        {doc.verified ? "Verified" : "Pending"}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setPreview({ title: doc.title, icon: doc.icon })}
                    style={[styles.previewSmallButton, { borderColor: palette.border }]}
                  >
                    <Text style={[styles.previewSmallButtonText, { color: palette.text }]}>Preview</Text>
                  </Pressable>
                </View>
              ))}
            </SectionCard>

            {/* ---------- SECTION 6: NOTIFICATIONS ---------- */}
            <SectionCard palette={palette} title="Notifications" delay={240}>
              <ToggleRow
                palette={palette}
                title="Receive New Task Notifications"
                subtitle="Receive instant notifications when the admin assigns a new delivery."
                value={taskNotifications}
                onChange={setTaskNotifications}
              />
              <ToggleRow
                palette={palette}
                title="Delivery Updates"
                subtitle="Get notified about changes to your active deliveries."
                value={deliveryUpdates}
                onChange={setDeliveryUpdates}
              />
              <ToggleRow
                palette={palette}
                title="Announcements"
                subtitle="Company-wide announcements from Kayora management."
                value={announcements}
                onChange={setAnnouncements}
              />
              <ToggleRow
                palette={palette}
                title="Emergency Alerts"
                subtitle="Critical safety and emergency notifications."
                value={emergencyAlerts}
                onChange={setEmergencyAlerts}
                isLast
              />
            </SectionCard>

            {/* ---------- SECTION 7: THEME ---------- */}
            <SectionCard palette={palette} title="Theme" subtitle="Changes apply across the entire app instantly." delay={280}>
              <ThemeSelector palette={palette} themeMode={themeMode} onChange={handleThemeChange} />
            </SectionCard>

            {/* ---------- SECTION 8: WORK INFORMATION ---------- */}
            <SectionCard palette={palette} title="Work Information" delay={320}>
              <View style={styles.workStatsGrid}>
                <View style={[styles.workStatCard, { backgroundColor: palette.pillBg }]}>
                  <Text style={[styles.workStatValue, { color: palette.text }]}>{DRIVER.work.todaysTasks}</Text>
                  <Text style={[styles.workStatLabel, { color: palette.muted }]}>Today's Tasks</Text>
                </View>
                <View style={[styles.workStatCard, { backgroundColor: palette.pillBg }]}>
                  <Text style={[styles.workStatValue, { color: palette.text }]}>{DRIVER.work.completedToday}</Text>
                  <Text style={[styles.workStatLabel, { color: palette.muted }]}>Completed Today</Text>
                </View>
                <View style={[styles.workStatCard, { backgroundColor: palette.pillBg }]}>
                  <Text style={[styles.workStatValue, { color: palette.text }]}>{DRIVER.work.pendingTasks}</Text>
                  <Text style={[styles.workStatLabel, { color: palette.muted }]}>Pending Tasks</Text>
                </View>
              </View>

              <InfoRow label="Current Shift" value={DRIVER.work.currentShift} palette={palette} />
              <InfoRow label="Working Hours" value={DRIVER.work.workingHours} palette={palette} />
              <InfoRow label="Depot" value={DRIVER.work.depot} palette={palette} />
              <InfoRow label="Supervisor" value={DRIVER.work.supervisor} palette={palette} isLast />

              <View style={[styles.onlineBadge, { backgroundColor: workStatusColor + "1A", marginTop: 14 }]}>
                <View style={[styles.onlineDot, { backgroundColor: workStatusColor }]} />
                <Text style={[styles.onlineBadgeText, { color: workStatusColor }]}>
                  Employment Status: {DRIVER.onlineStatus}
                </Text>
              </View>
            </SectionCard>

            {/* ---------- SECTION 9: HELP & SUPPORT ---------- */}
            <SectionCard palette={palette} title="Help & Support" delay={360}>
              <HelpRow
                icon="headset-outline"
                label="Contact Dispatcher"
                palette={palette}
                onPress={() => Linking.openURL("tel:+2348000000001")}
              />
              <HelpRow
                icon="call-outline"
                label="Call Supervisor"
                palette={palette}
                onPress={() => Linking.openURL("tel:+2348000000002")}
              />
              <HelpRow
                icon="book-outline"
                label="Driver Handbook"
                palette={palette}
                onPress={() => {}}
              />
              <HelpRow
                icon="warning-outline"
                label="Report Vehicle Issue"
                palette={palette}
                onPress={() => {}}
              />
              <HelpRow
                icon="help-circle-outline"
                label="Frequently Asked Questions"
                palette={palette}
                onPress={() => {}}
                isLast
              />
            </SectionCard>

            {/* ---------- SECTION 10: APP INFORMATION ---------- */}
            <SectionCard palette={palette} title="App Information" delay={400}>
              <InfoRow label="Version" value="1.0.0" palette={palette} />
              <InfoRow label="Build Number" value="100" palette={palette} />
              <InfoRow label="Terms of Service" value="View" palette={palette} />
              <InfoRow label="Privacy Policy" value="View" palette={palette} />
              <InfoRow label="Open Source Licenses" value="View" palette={palette} isLast />
            </SectionCard>

            {/* ---------- SECTION 11: DANGER ZONE ---------- */}
            <Animated.View
              entering={FadeInDown.duration(450).delay(440)}
              style={[styles.dangerCard, { backgroundColor: palette.danger + "12", borderColor: palette.danger + "40" }]}
            >
              <Pressable onPress={() => setSignOutVisible(true)} style={[styles.signOutButton, { backgroundColor: palette.danger }]}>
                <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
                <Text style={styles.signOutButtonText}>Sign Out</Text>
              </Pressable>
            </Animated.View>

            <View style={{ height: 24 }} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomNav palette={palette} activeKey="account" onNavigate={handleBottomNavNavigate} />

      <ImagePreviewModal
        visible={!!preview}
        palette={palette}
        title={preview?.title ?? ""}
        icon={preview?.icon ?? "image-outline"}
        onClose={() => setPreview(null)}
      />

      <ConfirmDialog
        visible={signOutVisible}
        palette={palette}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        onConfirm={handleSignOut}
        onCancel={() => setSignOutVisible(false)}
      />
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
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },

  /* Top Tabs */
  topTabsWrapper: { paddingHorizontal: 16 },
  topTabsRow: { flexDirection: "row", gap: 26 },
  topTabItem: { paddingBottom: 12 },
  topTabLabel: { fontSize: 15, fontWeight: "700" },
  topTabsBaseline: { height: 1, width: "100%" },
  topTabsUnderline: { position: "absolute", bottom: 0, height: 2, borderRadius: 2 },

  /* Page Title */
  pageTitle: { fontSize: 26, fontWeight: "800", marginTop: 6 },
  pageSubtitle: { fontSize: 13.5, marginTop: 6, marginBottom: 20, lineHeight: 19 },

  /* Profile Card */
  profileCard: { alignItems: "center", borderWidth: 1, borderRadius: 24, padding: 26, marginBottom: 16 },
  profileAvatarImage: { width: 92, height: 92, borderRadius: 46, marginBottom: 14 },
  profileAvatarFallback: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  profileAvatarFallbackText: { color: "#FFFFFF", fontWeight: "800", fontSize: 34 },
  profileName: { fontSize: 20, fontWeight: "800" },
  profileIdRow: { marginTop: 4, marginBottom: 12 },
  profileIdText: { fontSize: 12.5, fontWeight: "600" },
  onlineBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineBadgeText: { fontSize: 12, fontWeight: "800" },
  profileStatsRow: { flexDirection: "row", alignItems: "center", marginTop: 20, width: "100%" },
  profileStatItem: { flex: 1, alignItems: "center" },
  profileStatValue: { fontSize: 17, fontWeight: "800" },
  profileStatLabel: { fontSize: 11.5, marginTop: 3 },
  profileStatDivider: { width: 1, height: 30 },
  assignmentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    maxWidth: "100%",
  },
  assignmentPillText: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
  editProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  editProfileButtonText: { fontSize: 12.5, fontWeight: "700" },

  /* Generic Section Card */
  sectionCard: { borderWidth: 1, borderRadius: 20, padding: 18, marginBottom: 16 },
  sectionCardTitle: { fontSize: 16, fontWeight: "800" },
  sectionCardSubtitle: { fontSize: 12.5, marginTop: 4 },

  /* Info Row */
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  infoRowLabel: { fontSize: 11.5, fontWeight: "600", marginBottom: 3 },
  infoRowValue: { fontSize: 14, fontWeight: "700" },

  /* Toggle Row */
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  toggleTitle: { fontSize: 14, fontWeight: "700" },
  toggleSubtitle: { fontSize: 12, marginTop: 3, lineHeight: 16 },

  /* License */
  licenseCard: { borderRadius: 18, padding: 18, marginTop: 14 },
  licenseTopRow: { flexDirection: "row", alignItems: "center" },
  licensePhotoWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  licensePhotoInitial: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  licenseName: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  licenseSubLabel: { color: "rgba(255,255,255,0.75)", fontSize: 11.5, marginTop: 2 },
  licenseStatusBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  licenseStatusText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  licenseDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: 16 },
  licenseGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  licenseGridItem: { minWidth: "40%" },
  licenseGridLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10.5, fontWeight: "600" },
  licenseGridValue: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "800", marginTop: 3 },

  smallOutlineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  smallOutlineButtonText: { fontSize: 12.5, fontWeight: "700" },

  /* Vehicle */
  vehiclePreviewBox: {
    height: 140,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    gap: 8,
  },
  vehiclePreviewText: { fontSize: 12.5, fontWeight: "700" },
  taskButtonsRow: { flexDirection: "row", gap: 10, marginTop: 6 },

  /* Documents */
  documentRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  helpIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  documentTitle: { fontSize: 13.5, fontWeight: "700" },
  documentStatusBadge: { alignSelf: "flex-start", marginTop: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  documentStatusText: { fontSize: 10.5, fontWeight: "800" },
  previewSmallButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  previewSmallButtonText: { fontSize: 11.5, fontWeight: "700" },

  /* Theme Selector */
  themeSelectorWrap: { flexDirection: "row", borderRadius: 14, padding: 4, position: "relative", overflow: "hidden" },
  themeSelectorIndicator: { position: "absolute", top: 4, bottom: 4, borderRadius: 11 },
  themeSelectorOption: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 11 },
  themeSelectorLabel: { fontSize: 12.5, fontWeight: "700" },

  /* Work Info */
  workStatsGrid: { flexDirection: "row", gap: 10, marginBottom: 6 },
  workStatCard: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  workStatValue: { fontSize: 18, fontWeight: "800" },
  workStatLabel: { fontSize: 10.5, marginTop: 3, textAlign: "center" },

  /* Help Row */
  helpRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, gap: 12 },
  helpLabel: { flex: 1, fontSize: 13.5, fontWeight: "700" },

  /* Danger Zone */
  dangerCard: { borderWidth: 1, borderRadius: 20, padding: 18, marginBottom: 16 },
  signOutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 14 },
  signOutButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },

  /* Preview Modal */
  previewOverlay: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  previewCard: { width: "100%", maxWidth: 380, borderRadius: 22, padding: 18 },
  previewHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  previewTitle: { fontSize: 15.5, fontWeight: "800" },
  previewImageArea: { height: 220, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 10 },
  previewPlaceholderText: { fontSize: 12, fontWeight: "600" },

  /* Confirm Dialog */
  confirmOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15,23,42,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    zIndex: 50,
  },
  confirmCard: { width: "100%", maxWidth: 340, borderRadius: 22, padding: 24, alignItems: "center" },
  confirmIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  confirmTitle: { fontSize: 17, fontWeight: "800", marginBottom: 8, textAlign: "center" },
  confirmMessage: { fontSize: 13.5, lineHeight: 19, marginBottom: 22, textAlign: "center" },
  confirmButtonsRow: { flexDirection: "row", gap: 10, width: "100%" },
  confirmButtonNo: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  confirmButtonNoText: { fontSize: 14, fontWeight: "700" },
  confirmButtonYes: { flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  confirmButtonYesText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

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