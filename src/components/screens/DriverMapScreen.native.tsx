import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Appearance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import MapLibreGL from "@maplibre/maplibre-react-native";
import { DriverDashboardService } from "../../services/driverDashboard";
import { DriverTask } from "../../types/driverTask";

// No token needed for CARTO/OpenFreeMap style URLs — this just tells the
// native SDK not to look for a Mapbox-style access token.
MapLibreGL.setAccessToken(null);

/* ============================================================
   BRAND COLORS (matches the rest of the driver app)
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
};

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
    pillBg: isDark ? "#12335C" : "#EEF3FA",
  };
}

const THEME_STORAGE_KEY = "kayora_driver_theme_mode";
const FALLBACK_LOCATION = { lat: 6.335, lng: 5.6037 };

// Same free, no-API-key styles used on web — keeps both platforms visually consistent.
const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/* ============================================================
   MAIN SCREEN (native)
============================================================ */
export default function DriverMapsScreen() {
  const router = useRouter();
  const { focusId } = useLocalSearchParams<{ focusId?: string }>();
  const cameraRef = useRef<MapLibreGL.Camera>(null);

  const [scheme, setScheme] = useState<Scheme>((Appearance.getColorScheme() as Scheme) || "light");
  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(THEME_STORAGE_KEY).catch(() => null);
      if (saved === "light" || saved === "dark") setScheme(saved);
    })();
  }, []);
  const palette = useMemo(() => getPalette(scheme), [scheme]);

  const [tasks, setTasks] = useState<DriverTask[]>([]);
  const [driverLocation, setDriverLocation] = useState(FALLBACK_LOCATION);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [taskList] = await Promise.all([DriverDashboardService.getTodayTasks()]);
        setTasks(taskList);
      } catch (e) {
        // Keep the map usable even if tasks fail to load.
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const position = await Location.getCurrentPositionAsync({});
          setDriverLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        }
      } catch (e) {
        // Fall back to the default location silently.
      }

      setLoading(false);
    })();
  }, []);

  const allCoords = useMemo(
    () => [
      [driverLocation.lng, driverLocation.lat] as [number, number],
      ...tasks.map((t) => [t.longitude, t.latitude] as [number, number]),
    ],
    [driverLocation, tasks]
  );

  // Auto-fit / auto-focus once the map + data are ready.
  useEffect(() => {
    if (!mapReady || !cameraRef.current) return;

    if (focusId) {
      const focusTask = tasks.find((t) => String(t.id) === focusId);
      if (focusTask) {
        cameraRef.current.setCamera({
          centerCoordinate: [focusTask.longitude, focusTask.latitude],
          zoomLevel: 16,
          animationDuration: 400,
        });
        return;
      }
    }

    if (allCoords.length > 1) {
      cameraRef.current.fitBounds(
        boundsMin(allCoords),
        boundsMax(allCoords),
        [80, 80, 140, 80], // padding: top, right, bottom, left
        400
      );
    } else {
      cameraRef.current.setCamera({
        centerCoordinate: [driverLocation.lng, driverLocation.lat],
        zoomLevel: 14,
        animationDuration: 400,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, focusId, tasks]);

  const handleViewTask = useCallback(
    (taskId: number | string) => {
      router.push(`/driver/tasks/${taskId}` as any);
    },
    [router]
  );

  const handleRecenter = () => {
    cameraRef.current?.setCamera({
      centerCoordinate: [driverLocation.lng, driverLocation.lat],
      zoomLevel: 15,
      animationDuration: 400,
    });
  };

  const handleFitAll = () => {
    if (allCoords.length > 1) {
      cameraRef.current?.fitBounds(boundsMin(allCoords), boundsMax(allCoords), [80, 80, 140, 80], 400);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={["top", "bottom"]}>
      <View style={[styles.headerRow, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.iconButton, { backgroundColor: palette.pillBg }]}>
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </Pressable>
        <View style={{ marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Today's Deliveries Map</Text>
          <Text style={[styles.headerSubtitle, { color: palette.muted }]}>
            {tasks.length} {tasks.length === 1 ? "stop" : "stops"} · updates live
          </Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <MapLibreGL.MapView
          style={{ flex: 1 }}
          styleURL={palette.scheme === "dark" ? STYLE_DARK : STYLE_LIGHT}
          logoEnabled={false}
          attributionEnabled
          onDidFinishLoadingMap={() => setMapReady(true)}
        >
          <MapLibreGL.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: [driverLocation.lng, driverLocation.lat],
              zoomLevel: 13,
            }}
          />

          <MapLibreGL.MarkerView coordinate={[driverLocation.lng, driverLocation.lat]} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverPin} />
          </MapLibreGL.MarkerView>

          {tasks.map((task) => (
            <MapLibreGL.MarkerView
              key={task.id}
              coordinate={[task.longitude, task.latitude]}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <Pressable onPress={() => handleViewTask(task.id)}>
                <View style={styles.taskPin} />
              </Pressable>
            </MapLibreGL.MarkerView>
          ))}
        </MapLibreGL.MapView>

        {(loading || !mapReady) && (
          <View style={[styles.loadingOverlay, { backgroundColor: palette.card }]}>
            <ActivityIndicator size="small" color={palette.primary} />
          </View>
        )}

        <View style={styles.controlsColumn}>
          <Pressable onPress={handleRecenter} style={[styles.controlButton, { backgroundColor: palette.card }]}>
            <Ionicons name="locate-outline" size={18} color={palette.text} />
          </Pressable>
          <Pressable onPress={handleFitAll} style={[styles.controlButton, { backgroundColor: palette.card }]}>
            <Ionicons name="scan-outline" size={18} color={palette.text} />
          </Pressable>
        </View>

        <Animated.View entering={FadeIn.duration(300)} style={[styles.legend, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: palette.secondary }]} />
            <Text style={[styles.legendText, { color: palette.muted }]}>You</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSquare, { backgroundColor: palette.gold }]} />
            <Text style={[styles.legendText, { color: palette.muted }]}>Delivery stop</Text>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

// Simple lng/lat bounding-box helpers for Camera.fitBounds ([lng, lat] northeast / southwest corners).
function boundsMax(coords: [number, number][]): [number, number] {
  return [Math.max(...coords.map((c) => c[0])), Math.max(...coords.map((c) => c[1]))];
}
function boundsMin(coords: [number, number][]): [number, number] {
  return [Math.min(...coords.map((c) => c[0])), Math.min(...coords.map((c) => c[1]))];
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800" },
  headerSubtitle: { fontSize: 12, marginTop: 2 },

  loadingOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },

  driverPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#1E5FAF",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#1E5FAF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  taskPin: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: "#D4A64A",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },

  controlsColumn: { position: "absolute", top: 16, right: 16, gap: 10 },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },

  legend: {
    position: "absolute",
    bottom: 16,
    left: 16,
    flexDirection: "row",
    gap: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendSquare: { width: 9, height: 9, borderRadius: 3 },
  legendText: { fontSize: 11.5, fontWeight: "600" },
});