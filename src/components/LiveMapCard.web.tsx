import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const FALLBACK_LOCATION = { lat: 6.335, lng: 5.6037 };

// Free, no-API-key vector styles (CARTO basemaps, OSM data, attribution baked in).
const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export function LiveMapCard({ palette }: { palette: any }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [coords, setCoords] = useState(FALLBACK_LOCATION);
  const [mapReady, setMapReady] = useState(false);
  const [locationReady, setLocationReady] = useState(false);

  // Get the driver's real location once on mount.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const position = await Location.getCurrentPositionAsync({});
          if (isMounted) {
            setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
          }
        }
      } catch (e) {
        // Fall back silently to default coordinates
      } finally {
        if (isMounted) setLocationReady(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: palette.scheme === "dark" ? STYLE_DARK : STYLE_LIGHT,
      center: [coords.lng, coords.lat],
      zoom: 15,
      attributionControl: { compact: true },
      interactive: true,
    });

    map.on("load", () => {
      const el = document.createElement("div");
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.borderRadius = "10px";
      el.style.background = "#0D4A8C";
      el.style.border = "3px solid #FFFFFF";
      el.style.boxShadow = "0 0 0 4px rgba(13,74,140,0.25)";

      markerRef.current = new maplibregl.Marker({ element: el }).setLngLat([coords.lng, coords.lat]).addTo(map);
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap style when theme changes.
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(palette.scheme === "dark" ? STYLE_DARK : STYLE_LIGHT);
  }, [palette.scheme]);

  // Demo movement simulation — nudges the marker every few seconds.
  useEffect(() => {
    if (!mapReady) return;
    const interval = setInterval(() => {
      setCoords((prev) => {
        const next = {
          lat: prev.lat + (Math.random() - 0.5) * 0.0006,
          lng: prev.lng + (Math.random() - 0.5) * 0.0006,
        };
        markerRef.current?.setLngLat([next.lng, next.lat]);
        mapRef.current?.panTo([next.lng, next.lat], { animate: true, duration: 1200 });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [mapReady]);

  return (
    <Animated.View
      entering={FadeInDown.duration(500).delay(80)}
      style={[styles.mapCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      {/* Real DOM node — this file only ever runs on web, so a plain div is fine. */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {(!mapReady || !locationReady) && (
        <View style={[styles.mapLoadingOverlay, { backgroundColor: palette.card }]}>
          <ActivityIndicator size="small" color={palette.primary} />
          <Text style={[styles.mapLoadingText, { color: palette.muted }]}>Locating you…</Text>
        </View>
      )}

      <Pressable style={[styles.layersButton, { backgroundColor: palette.card }]}>
        <Ionicons name="layers-outline" size={18} color={palette.text} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    height: 260,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 22,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  mapLoadingText: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: "600",
  },
  layersButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
});