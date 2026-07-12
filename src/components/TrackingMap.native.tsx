import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import MapLibreGL from "@maplibre/maplibre-react-native";

MapLibreGL.setAccessToken(null);

const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export default function TrackingMap({
  driverLat,
  driverLng,
  destLat,
  destLng,
  isDark,
  onReady,
}: {
  driverLat: number;
  driverLng: number;
  destLat: number;
  destLng: number;
  isDark: boolean;
  onReady?: () => void;
}) {
  const cameraRef = useRef<MapLibreGL.Camera>(null);
  const hasFitOnce = useRef(false);

  // Fit both points in view once on first load; after that, just pan to
  // follow the driver as updates arrive (keeps the destination steady).
  useEffect(() => {
    if (!hasFitOnce.current) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [driverLng, driverLat],
      animationDuration: 1000,
    });
  }, [driverLat, driverLng]);

  const routeGeoJson = {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: [
        [driverLng, driverLat],
        [destLng, destLat],
      ],
    },
  };

  return (
    <MapLibreGL.MapView
      style={styles.map}
      styleURL={isDark ? STYLE_DARK : STYLE_LIGHT}
      logoEnabled={false}
      attributionEnabled
      onDidFinishLoadingMap={() => {
        const ne: [number, number] = [Math.max(driverLng, destLng), Math.max(driverLat, destLat)];
        const sw: [number, number] = [Math.min(driverLng, destLng), Math.min(driverLat, destLat)];
        cameraRef.current?.fitBounds(ne, sw, [60, 60, 60, 60], 0);
        hasFitOnce.current = true;
        onReady?.();
      }}
    >
      <MapLibreGL.Camera ref={cameraRef} defaultSettings={{ centerCoordinate: [driverLng, driverLat], zoomLevel: 13 }} />

      <MapLibreGL.ShapeSource id="tracking-route" shape={routeGeoJson}>
        <MapLibreGL.LineLayer
          id="tracking-route-line"
          style={{ lineColor: "#1E5FAF", lineWidth: 4, lineOpacity: 0.85, lineDasharray: [1, 2] }}
        />
      </MapLibreGL.ShapeSource>

      <MapLibreGL.MarkerView coordinate={[destLng, destLat]} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={styles.destPin} />
      </MapLibreGL.MarkerView>

      <MapLibreGL.MarkerView coordinate={[driverLng, driverLat]} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={styles.driverPin} />
      </MapLibreGL.MarkerView>
    </MapLibreGL.MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  driverPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#0D4A8C",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#0D4A8C",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  destPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#D4A64A",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#D4A64A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
});