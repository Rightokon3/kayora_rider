import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  Appearance,
  Linking,
  Platform,
  useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  Easing,
  interpolate,
} from 'react-native-reanimated';

// ============================================================
// KAYORA BRAND TOKENS
// ============================================================
const BRAND = {
  primary: '#0D4A8C',
  secondary: '#1E5FAF',
  gold: '#D4A64A',
  bg: '#FFFFFF',
  bgDark: '#071D38',
  card: '#F8FAFC',
  cardDark: '#102E56',
  border: '#E5E7EB',
  borderDark: '#1C3A5E',
  text: '#1F2937',
  textDark: '#F1F5F9',
  muted: '#6B7280',
  mutedDark: '#93A5BD',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
};

type ThemeMode = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = '@kayora_driver_theme_mode';

// ============================================================
// DEMO DATA
// ============================================================
const DEMO_DRIVER = {
  name: 'John Sunday',
  phone: '+2348012345678',
  driverId: 'DRV-0001',
  vehicle: 'Kayora Delivery Van',
  plate: 'AKD-245-KY',
  profilePicture: null as string | null,
};

type TaskPriority = 'High' | 'Medium' | 'Low';
type TaskStatus = 'Assigned' | 'In Progress' | 'Picked Up';

interface DemoTask {
  id: string;
  customerName: string;
  customerPicture: string | null;
  phone: string;
  address: string;
  bottleName: string;
  quantity: string;
  status: TaskStatus;
  priority: TaskPriority;
  distance: string;
  eta: string;
  lat: number;
  lng: number;
}

const DEMO_TASKS: DemoTask[] = [
  {
    id: 'KYR-1042',
    customerName: 'Amaka Obi',
    customerPicture: null,
    phone: '+2348023456789',
    address: '14 Airport Road, Benin City',
    bottleName: '30cl Sharp-Sharp',
    quantity: '20 Packs',
    status: 'Assigned',
    priority: 'High',
    distance: '5.4 km',
    eta: '12:30 PM',
    lat: 6.3350,
    lng: 5.6037,
  },
  {
    id: 'KYR-1043',
    customerName: 'Tunde Bakare',
    customerPicture: null,
    phone: '+2348034567891',
    address: '9 Sapele Road, Benin City',
    bottleName: '50cl Kayora Table Water',
    quantity: '12 Packs',
    status: 'In Progress',
    priority: 'Medium',
    distance: '2.1 km',
    eta: '1:05 PM',
    lat: 6.3400,
    lng: 5.6150,
  },
  {
    id: 'KYR-1044',
    customerName: 'Grace Eze',
    customerPicture: null,
    phone: '+2348045678912',
    address: '22 Ring Road, Benin City',
    bottleName: '75cl Sharp-Sharp',
    quantity: '8 Packs',
    status: 'Assigned',
    priority: 'Low',
    distance: '7.8 km',
    eta: '1:45 PM',
    lat: 6.3280,
    lng: 5.5950,
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// HELPERS
// ============================================================
function getAvailability() {
  const hour = new Date().getHours();
  const available = hour >= 7 && hour < 17;
  return {
    available,
    label: available ? 'Driver is Available' : 'Off Duty',
  };
}

function priorityColor(priority: TaskPriority) {
  if (priority === 'High') return BRAND.danger;
  if (priority === 'Medium') return BRAND.warning;
  return BRAND.success;
}

function statusColor(status: TaskStatus) {
  if (status === 'Assigned') return BRAND.secondary;
  if (status === 'In Progress') return BRAND.warning;
  return BRAND.success;
}

function buildMapHtml(lat: number, lng: number) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #102E56; }
    .kayora-pulse {
      width: 18px; height: 18px; border-radius: 9px; background: #1E5FAF;
      border: 3px solid #ffffff; box-shadow: 0 0 0 rgba(30,95,175,0.6);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(30,95,175,0.55); }
      70% { box-shadow: 0 0 0 16px rgba(30,95,175,0); }
      100% { box-shadow: 0 0 0 0 rgba(30,95,175,0); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([${lat}, ${lng}], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var icon = L.divIcon({ className: 'kayora-pulse', iconSize: [18, 18] });
    var marker = L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);

    function moveMarker(lat, lng) {
      marker.setLatLng([lat, lng]);
      map.panTo([lat, lng], { animate: true, duration: 1 });
    }

    document.addEventListener('message', function (e) {
      try {
        var data = JSON.parse(e.data);
        if (data.type === 'update' ) { moveMarker(data.lat, data.lng); }
      } catch (err) {}
    });
    window.addEventListener('message', function (e) {
      try {
        var data = JSON.parse(e.data);
        if (data.type === 'update') { moveMarker(data.lat, data.lng); }
      } catch (err) {}
    });
  </script>
</body>
</html>`;
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function DriverDashboard() {
  const router = useRouter();
  const systemScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const webviewRef = useRef<WebView>(null);

  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [activeTab, setActiveTab] = useState<'orders' | 'tasks' | 'account'>('orders');
  const [coords, setCoords] = useState({ lat: 6.335, lng: 5.6037 });
  const [mapReady, setMapReady] = useState(false);
  const [availability, setAvailability] = useState(getAvailability());

  // ---------- Theme persistence ----------
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeMode(saved);
        }
      } catch (e) {
        // ignore, default to system
      }
    })();
  }, []);

  const cycleTheme = useCallback(async () => {
    setThemeMode((prev) => {
      const next: ThemeMode = prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light';
      AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const resolvedScheme = themeMode === 'system' ? systemScheme ?? 'light' : themeMode;
  const isDark = resolvedScheme === 'dark';

  const palette = useMemo(
    () => ({
      bg: isDark ? BRAND.bgDark : BRAND.bg,
      card: isDark ? BRAND.cardDark : BRAND.card,
      border: isDark ? BRAND.borderDark : BRAND.border,
      text: isDark ? BRAND.textDark : BRAND.text,
      muted: isDark ? BRAND.mutedDark : BRAND.muted,
    }),
    [isDark]
  );

  // ---------- Availability clock ----------
  useEffect(() => {
    const interval = setInterval(() => {
      setAvailability(getAvailability());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // ---------- GPS + demo location updates ----------
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch (e) {
        // keep default demo coords if permission denied / unavailable
      }

      intervalId = setInterval(() => {
        setCoords((prev) => {
          const jitterLat = prev.lat + (Math.random() - 0.5) * 0.0015;
          const jitterLng = prev.lng + (Math.random() - 0.5) * 0.0015;
          const next = { lat: jitterLat, lng: jitterLng };
          const payload = JSON.stringify({ type: 'update', lat: next.lat, lng: next.lng });
          webviewRef.current?.postMessage(payload);
          return next;
        });
      }, 4000);
    })();
    return () => intervalId && clearInterval(intervalId);
  }, []);

  const mapHtml = useMemo(() => buildMapHtml(coords.lat, coords.lng), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Animated tab underline ----------
  const tabs = [
    { key: 'orders', label: 'My Orders', route: '/driver/orders' },
    { key: 'tasks', label: 'My Tasks', route: '/driver/tasks' },
    { key: 'account', label: 'My Account', route: '/driver/account' },
  ] as const;

  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([
    { x: 0, width: 0 },
    { x: 0, width: 0 },
    { x: 0, width: 0 },
  ]);

  const underlineX = useSharedValue(0);
  const underlineW = useSharedValue(0);

  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: underlineX.value }],
    width: underlineW.value,
  }));

  const activeIndex = tabs.findIndex((t) => t.key === activeTab);

  useEffect(() => {
    const layout = tabLayouts[activeIndex];
    if (layout && layout.width > 0) {
      underlineX.value = withSpring(layout.x, { damping: 18, stiffness: 180 });
      underlineW.value = withSpring(layout.width, { damping: 18, stiffness: 180 });
    }
  }, [activeIndex, tabLayouts]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTabPress = (key: typeof activeTab, route: string) => {
    setActiveTab(key);
    router.push(route as any);
  };

  // ---------- Map loading pulse ----------
  const mapPulse = useSharedValue(0.4);
  useEffect(() => {
    mapPulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const mapPulseStyle = useAnimatedStyle(() => ({ opacity: mapPulse.value }));

  // ---------- Bottom nav ----------
  const [bottomTab, setBottomTab] = useState<'dashboard' | 'orders' | 'tasks' | 'account'>('dashboard');
  const bottomTabs = [
    { key: 'dashboard', label: 'Dashboard', route: '/driver/dashboard', icon: 'car-sport' },
    { key: 'orders', label: 'Orders', route: '/driver/orders', icon: 'receipt-outline' },
    { key: 'tasks', label: 'Tasks', route: '/driver/tasks', icon: 'list-outline' },
    { key: 'account', label: 'Account', route: '/driver/account', icon: 'person-outline' },
  ] as const;

  const onBottomTabPress = (key: typeof bottomTab, route: string) => {
    setBottomTab(key);
    router.push(route as any);
  };

  // ---------- Quick stats ----------
  const completed = DEMO_TASKS.filter((t) => t.status === 'In Progress').length + 5;
  const pending = DEMO_TASKS.filter((t) => t.status !== 'In Progress').length;
  const distanceTravelled = '38.2 km';

  const themeIcon = themeMode === 'light' ? 'sunny' : themeMode === 'dark' ? 'moon' : 'contrast';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={{ backgroundColor: palette.bg }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- HEADER ---------------- */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="truck-delivery" size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={[styles.brandTitle, { color: palette.text }]}>
                Kayora <Text style={{ color: BRAND.secondary }}>Driver</Text>
              </Text>
              <Text style={[styles.brandSubtitle, { color: palette.muted }]}>Delivery Partner</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={cycleTheme}
              style={[styles.iconButton, { borderColor: palette.border, backgroundColor: palette.card }]}
              activeOpacity={0.7}
            >
              <Ionicons name={themeIcon as any} size={18} color={palette.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, { borderColor: palette.border, backgroundColor: palette.card }]}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={18} color={palette.text} />
              <View style={styles.notifDot} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/driver/account' as any)}
              activeOpacity={0.8}
            >
              {DEMO_DRIVER.profilePicture ? (
                <Image source={{ uri: DEMO_DRIVER.profilePicture }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>{DEMO_DRIVER.name.charAt(0)}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ---------------- TOP TABS ---------------- */}
        <View style={[styles.tabsRow, { borderBottomColor: palette.border }]}>
          {tabs.map((tab, index) => (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              activeOpacity={0.7}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                setTabLayouts((prev) => {
                  const copy = [...prev];
                  copy[index] = { x, width };
                  return copy;
                });
              }}
              onPress={() => onTabPress(tab.key, tab.route)}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === tab.key ? BRAND.primary : palette.muted },
                  activeTab === tab.key && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
          <Animated.View style={[styles.tabUnderline, underlineStyle]} />
        </View>

        {/* ---------------- WORK STATUS ---------------- */}
        <Animated.View
          entering={FadeInDown.duration(450).delay(80)}
          style={[styles.statusCard, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: palette.text }]}>
              {availability.label}
            </Text>
            <Text style={[styles.statusSubtitle, { color: palette.muted }]}>
              Working hours: 7:00 AM – 5:00 PM · Automatic tracking
            </Text>
          </View>
          <View style={styles.statusIndicatorWrap}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: availability.available ? BRAND.success : '#9CA3AF' },
              ]}
            />
          </View>
        </Animated.View>

        {/* ---------------- LIVE MAP ---------------- */}
        <Animated.View
          entering={FadeInDown.duration(450).delay(140)}
          style={[styles.mapCard, { borderColor: palette.border }]}
        >
          {!mapReady && (
            <Animated.View style={[styles.mapLoading, mapPulseStyle]}>
              <MaterialCommunityIcons name="map-marker-radius" size={32} color={BRAND.secondary} />
              <Text style={styles.mapLoadingText}>Locating you…</Text>
            </Animated.View>
          )}
          <WebView
            ref={webviewRef}
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            style={styles.map}
            onLoadEnd={() => setMapReady(true)}
            javaScriptEnabled
            domStorageEnabled
          />
          <TouchableOpacity style={styles.layersButton} activeOpacity={0.8}>
            <Ionicons name="layers-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        {/* ---------------- TODAY'S ACTIVE TASKS ---------------- */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Today's Active Tasks</Text>
          <TouchableOpacity onPress={() => router.push('/driver/tasks' as any)} activeOpacity={0.7}>
            <Text style={styles.viewAllLink}>View All →</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={DEMO_TASKS}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item, index }) => (
            <TaskCard
              task={item}
              index={index}
              palette={palette}
              onViewDetails={() => router.push(`/driver/tasks/${item.id}` as any)}
              onNavigate={() => {
                const url = Platform.select({
                  ios: `http://maps.apple.com/?daddr=${item.lat},${item.lng}`,
                  default: `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lng}#map=16/${item.lat}/${item.lng}`,
                });
                if (url) Linking.openURL(url).catch(() => {});
              }}
            />
          )}
        />

        {/* ---------------- QUICK STATS ---------------- */}
        <Text style={[styles.sectionTitle, { color: palette.text, marginTop: 8 }]}>Quick Stats</Text>
        <View style={styles.statsRow}>
          <StatCard
            palette={palette}
            icon="checkmark-done-circle"
            iconColor={BRAND.success}
            label="Completed"
            value={String(completed)}
            delay={100}
          />
          <StatCard
            palette={palette}
            icon="time-outline"
            iconColor={BRAND.warning}
            label="Pending"
            value={String(pending)}
            delay={180}
          />
          <StatCard
            palette={palette}
            icon="speedometer-outline"
            iconColor={BRAND.secondary}
            label="Distance"
            value={distanceTravelled}
            delay={260}
          />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ---------------- BOTTOM NAVIGATION ---------------- */}
      <View
        style={[
          styles.bottomNav,
          {
            backgroundColor: palette.bg,
            borderTopColor: palette.border,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        {bottomTabs.map((tab) => (
          <BottomNavItem
            key={tab.key}
            label={tab.label}
            icon={tab.icon}
            active={bottomTab === tab.key}
            onPress={() => onBottomTabPress(tab.key, tab.route)}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// SUB COMPONENTS
// ============================================================
const BottomNavItem = React.memo(function BottomNavItem({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(1.15, { damping: 6 }, () => {
      scale.value = withSpring(1);
    });
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.bottomNavItem}>
      <Animated.View style={animatedStyle}>
        <Ionicons name={icon as any} size={22} color={active ? BRAND.primary : '#9CA3AF'} />
      </Animated.View>
      <Text style={[styles.bottomNavLabel, { color: active ? BRAND.primary : '#9CA3AF' }]}>{label}</Text>
    </TouchableOpacity>
  );
});

const StatCard = React.memo(function StatCard({
  palette,
  icon,
  iconColor,
  label,
  value,
  delay,
}: {
  palette: { card: string; border: string; text: string; muted: string };
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(400).delay(delay)}
      style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <Ionicons name={icon as any} size={20} color={iconColor} />
      <Text style={[styles.statValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.muted }]}>{label}</Text>
    </Animated.View>
  );
});

const TaskCard = React.memo(function TaskCard({
  task,
  index,
  palette,
  onViewDetails,
  onNavigate,
}: {
  task: DemoTask;
  index: number;
  palette: { card: string; border: string; text: string; muted: string };
  onViewDetails: () => void;
  onNavigate: () => void;
}) {
  const pressScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.duration(450).delay(index * 90)}
      style={[cardStyle, styles.taskCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <View style={styles.taskCardTop}>
        <View style={styles.customerRow}>
          {task.customerPicture ? (
            <Image source={{ uri: task.customerPicture }} style={styles.customerAvatarImage} />
          ) : (
            <View style={styles.customerAvatarFallback}>
              <Text style={styles.customerAvatarLetter}>{task.customerName.charAt(0)}</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.customerName, { color: palette.text }]} numberOfLines={1}>
              {task.customerName}
            </Text>
            <Text style={[styles.customerAddress, { color: palette.muted }]} numberOfLines={1}>
              {task.address}
            </Text>
          </View>
        </View>
        <View style={styles.badgeColumn}>
          <View style={[styles.badge, { backgroundColor: `${priorityColor(task.priority)}20` }]}>
            <Text style={[styles.badgeText, { color: priorityColor(task.priority) }]}>{task.priority}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: `${statusColor(task.status)}20`, marginTop: 6 }]}>
            <Text style={[styles.badgeText, { color: statusColor(task.status) }]}>{task.status}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.taskDivider, { backgroundColor: palette.border }]} />

      <View style={styles.bottleRow}>
        <View style={styles.bottleIconWrap}>
          <MaterialCommunityIcons name="bottle-soda-classic-outline" size={20} color={BRAND.secondary} />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[styles.bottleName, { color: palette.text }]}>{task.bottleName}</Text>
          <Text style={[styles.bottleQty, { color: palette.muted }]}>{task.quantity}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.metaLabel, { color: palette.muted }]}>{task.distance}</Text>
          <Text style={[styles.metaLabel, { color: palette.muted }]}>ETA {task.eta}</Text>
        </View>
      </View>

      <View style={styles.taskButtonsRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: palette.border }]}
          activeOpacity={0.75}
          onPress={onViewDetails}
        >
          <Text style={[styles.secondaryButtonText, { color: palette.text }]}>View Details</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.8} onPress={onNavigate}>
          <Ionicons name="navigate" size={15} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Navigate</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandTitle: { fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  brandSubtitle: { fontSize: 11, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND.danger,
  },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    position: 'relative',
    marginBottom: 16,
  },
  tabItem: { paddingVertical: 12, marginRight: 24 },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  tabLabelActive: { fontWeight: '800' },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: BRAND.primary,
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  statusTitle: { fontSize: 15, fontWeight: '700' },
  statusSubtitle: { fontSize: 12, marginTop: 3 },
  statusIndicatorWrap: { paddingLeft: 12 },
  statusDot: { width: 14, height: 14, borderRadius: 7 },

  mapCard: {
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 20,
    position: 'relative',
    backgroundColor: BRAND.cardDark,
  },
  map: { flex: 1 },
  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    backgroundColor: BRAND.cardDark,
  },
  mapLoadingText: { color: '#CBD5E1', marginTop: 8, fontSize: 12, fontWeight: '600' },
  layersButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(7,29,56,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  viewAllLink: { fontSize: 13, fontWeight: '700', color: BRAND.secondary },

  taskCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  taskCardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  customerRow: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 },
  customerAvatarImage: { width: 42, height: 42, borderRadius: 21 },
  customerAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarLetter: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  customerName: { fontSize: 14, fontWeight: '700' },
  customerAddress: { fontSize: 12, marginTop: 2 },
  badgeColumn: { alignItems: 'flex-end' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  taskDivider: { height: 1, marginVertical: 12 },

  bottleRow: { flexDirection: 'row', alignItems: 'center' },
  bottleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(30,95,175,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottleName: { fontSize: 13, fontWeight: '700' },
  bottleQty: { fontSize: 12, marginTop: 1 },
  metaLabel: { fontSize: 11, marginTop: 1 },

  taskButtonsRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: { fontSize: 13, fontWeight: '700' },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: BRAND.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statValue: { fontSize: 17, fontWeight: '800', marginTop: 6 },
  statLabel: { fontSize: 11, marginTop: 2 },

  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  bottomNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomNavLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
});