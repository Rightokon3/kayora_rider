import React from "react";
import { View, StyleSheet } from "react-native";
import MapLibreGL from "@maplibre/maplibre-react-native";

MapLibreGL.setAccessToken(null);

const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export default function TaskMapPreview({
  latitude,
  longitude,
  isDark,
}: {
  latitude: number;
  longitude: number;
  isDark: boolean;
}) {
  return (
    <MapLibreGL.MapView
      style={styles.map}
      styleURL={isDark ? STYLE_DARK : STYLE_LIGHT}
      logoEnabled={false}
      attributionEnabled
    >
      <MapLibreGL.Camera
        defaultSettings={{
          centerCoordinate: [longitude, latitude],
          zoomLevel: 15,
        }}
      />
      <MapLibreGL.MarkerView coordinate={[longitude, latitude]} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={styles.pin} />
      </MapLibreGL.MarkerView>
    </MapLibreGL.MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  pin: {
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
});