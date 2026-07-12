import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import MapLibreGL from "@maplibre/maplibre-react-native";

MapLibreGL.setAccessToken(null);

const FALLBACK_LOCATION = { lat: 6.335, lng: 5.6037 };

// Same free, no-API-key styles used on web — keeps both platforms visually consistent.
const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export function LiveMapCard({ palette }: { palette: any }) {
  const cameraRef = useRef<MapLibreGL.Camera>(null);
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

  // Demo movement simulation — nudges the marker every few seconds.
  // The MarkerView's coordinate prop just follows `coords` state, so there's
  // no injectJavaScript/bridge step needed like the old WebView version.
  useEffect(() => {
    if (!mapReady) return;
    const interval = setInterval(() => {
      setCoords((prev) => ({
        lat: prev.lat + (Math.random() - 0.5) * 0.0006,
        lng: prev.lng + (Math.random() - 0.5) * 0.0006,
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, [mapReady]);

  // Smoothly pan the camera to follow the marker on each nudge.
  useEffect(() => {
    if (!mapReady) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [coords.lng, coords.lat],
      animationDuration: 1200,
    });
  }, [coords, mapReady]);

  return (
    <Animated.View
      entering={FadeInDown.duration(500).delay(80)}
      style={[styles.mapCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <MapLibreGL.MapView
        style={styles.mapView}
        styleURL={palette.scheme === "dark" ? STYLE_DARK : STYLE_LIGHT}
        logoEnabled={false}
        attributionEnabled
        scrollEnabled={false}
        zoomEnabled={false}
        onDidFinishLoadingMap={() => setMapReady(true)}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [coords.lng, coords.lat],
            zoomLevel: 15,
          }}
        />
        <MapLibreGL.MarkerView coordinate={[coords.lng, coords.lat]} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.driverPin} />
        </MapLibreGL.MarkerView>
      </MapLibreGL.MapView>

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
  mapView: {
    flex: 1,
  },
  driverPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#0D4A8C",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#0D4A8C",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
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