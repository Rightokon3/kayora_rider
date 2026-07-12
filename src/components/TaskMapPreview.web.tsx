import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: isDark ? STYLE_DARK : STYLE_LIGHT,
      center: [longitude, latitude],
      zoom: 15,
      attributionControl: { compact: true },
    });

    map.on("load", () => {
      const el = document.createElement("div");
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.borderRadius = "10px";
      el.style.background = "#0D4A8C";
      el.style.border = "3px solid #FFFFFF";
      el.style.boxShadow = "0 0 0 4px rgba(13,74,140,0.25)";
      new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap style when theme changes.
  useEffect(() => {
    mapRef.current?.setStyle(isDark ? STYLE_DARK : STYLE_LIGHT);
  }, [isDark]);

  // Recenter if the task's coordinates ever change (e.g. after a refetch).
  useEffect(() => {
    mapRef.current?.setCenter([longitude, latitude]);
  }, [latitude, longitude]);

  // Real DOM node — this file only ever runs on web, so a plain div is fine.
  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}