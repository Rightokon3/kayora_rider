import React, { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Appearance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DriverDashboardService } from "../../services/driverDashboard";
import { DriverTask } from "../../types/driverTask";

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

// Free, no-API-key vector styles (CARTO basemaps, OSM data, attribution baked in).
const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/* ============================================================
   MAIN SCREEN (web)
============================================================ */
export default function DriverMapsScreen() {
  const router = useRouter();
  const { focusId } = useLocalSearchParams<{ focusId?: string }>();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);

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

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: palette.scheme === "dark" ? STYLE_DARK : STYLE_LIGHT,
      center: [FALLBACK_LOCATION.lng, FALLBACK_LOCATION.lat],
      zoom: 13,
      attributionControl: { compact: true },
    });

    map.on("load", () => setMapReady(true));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap style when theme changes.
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(palette.scheme === "dark" ? STYLE_DARK : STYLE_LIGHT);
  }, [palette.scheme]);

  // Rebuild markers + fit/focus whenever data changes.
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;

    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = [];

    const driverEl = document.createElement("div");
    driverEl.style.width = "18px";
    driverEl.style.height = "18px";
    driverEl.style.borderRadius = "9px";
    driverEl.style.background = "#1E5FAF";
    driverEl.style.border = "3px solid #FFFFFF";
    driverEl.style.boxShadow = "0 0 0 4px rgba(30,95,175,0.25)";

    const driverMarker = new maplibregl.Marker({ element: driverEl })
      .setLngLat([driverLocation.lng, driverLocation.lat])
      .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML("<b>You are here</b>"))
      .addTo(map);
    markerRefs.current.push(driverMarker);

    tasks.forEach((task) => {
      const taskEl = document.createElement("div");
      taskEl.style.width = "20px";
      taskEl.style.height = "20px";
      taskEl.style.borderRadius = "6px";
      taskEl.style.background = "#D4A64A";
      taskEl.style.border = "3px solid #FFFFFF";
      taskEl.style.boxShadow = "0 0 0 4px rgba(212,166,74,0.25)";
      taskEl.style.cursor = "pointer";

      const popupNode = document.createElement("div");
      popupNode.style.fontFamily = "sans-serif";
      popupNode.style.minWidth = "160px";
      popupNode.innerHTML = `
        <div style="font-weight:700;font-size:13px;margin-bottom:2px">${escapeHtml(task.customerName)}</div>
        <div style="font-size:11px;color:#6B7280;margin-bottom:8px">${escapeHtml(task.deliveryAddress)}</div>
      `;
      const viewButton = document.createElement("button");
      viewButton.textContent = "View Order";
      viewButton.style.cssText =
        "background:#0D4A8C;color:#fff;border:none;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;";
      viewButton.onclick = () => router.push(`/driver/tasks/${task.id}` as any);
      popupNode.appendChild(viewButton);

      const marker = new maplibregl.Marker({ element: taskEl })
        .setLngLat([task.longitude, task.latitude])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setDOMContent(popupNode))
        .addTo(map);

      markerRefs.current.push(marker);

      if (focusId && String(task.id) === focusId) {
        marker.togglePopup();
      }
    });

    if (focusId) {
      const focusTask = tasks.find((t) => String(t.id) === focusId);
      if (focusTask) {
        map.flyTo({ center: [focusTask.longitude, focusTask.latitude], zoom: 16 });
        return;
      }
    }

    if (tasks.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([driverLocation.lng, driverLocation.lat]);
      tasks.forEach((t) => bounds.extend([t.longitude, t.latitude]));
      map.fitBounds(bounds, { padding: 80, animate: true });
    } else {
      map.flyTo({ center: [driverLocation.lng, driverLocation.lat], zoom: 14 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, driverLocation, mapReady, focusId]);

  const handleRecenter = () => {
    mapRef.current?.flyTo({ center: [driverLocation.lng, driverLocation.lat], zoom: 15 });
  };

  const handleFitAll = () => {
    if (!mapRef.current || tasks.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend([driverLocation.lng, driverLocation.lat]);
    tasks.forEach((t) => bounds.extend([t.longitude, t.latitude]));
    mapRef.current.fitBounds(bounds, { padding: 80, animate: true });
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
        {/* Real DOM node — this file only ever runs on web, so a plain div is fine. */}
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800" },
  headerSubtitle: { fontSize: 12, marginTop: 2 },

  loadingOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },

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