import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const ROUTE_SOURCE_ID = "tracking-route";
const ROUTE_LAYER_ID = "tracking-route-line";

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: isDark ? STYLE_DARK : STYLE_LIGHT,
      center: [driverLng, driverLat],
      zoom: 13,
      attributionControl: { compact: true },
    });

    map.on("load", () => {
      // Destination marker (static — doesn't move after mount).
      const destEl = document.createElement("div");
      destEl.style.width = "18px";
      destEl.style.height = "18px";
      destEl.style.borderRadius = "9px";
      destEl.style.background = "#D4A64A";
      destEl.style.border = "3px solid #FFFFFF";
      destEl.style.boxShadow = "0 0 0 4px rgba(212,166,74,0.25)";
      new maplibregl.Marker({ element: destEl }).setLngLat([destLng, destLat]).addTo(map);

      // Driver marker (moves as location updates arrive).
      const driverEl = document.createElement("div");
      driverEl.style.width = "18px";
      driverEl.style.height = "18px";
      driverEl.style.borderRadius = "9px";
      driverEl.style.background = "#0D4A8C";
      driverEl.style.border = "3px solid #FFFFFF";
      driverEl.style.boxShadow = "0 0 0 4px rgba(13,74,140,0.25)";
      driverMarkerRef.current = new maplibregl.Marker({ element: driverEl })
        .setLngLat([driverLng, driverLat])
        .addTo(map);

      // Route line between driver and destination.
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [driverLng, driverLat],
              [destLng, destLat],
            ],
          },
        },
      });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        paint: {
          "line-color": "#1E5FAF",
          "line-width": 4,
          "line-opacity": 0.85,
          "line-dasharray": [1, 2],
        },
      });

      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([driverLng, driverLat]);
      bounds.extend([destLng, destLat]);
      map.fitBounds(bounds, { padding: 60, animate: false });

      onReady?.();
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      driverMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap style when theme changes.
  useEffect(() => {
    mapRef.current?.setStyle(isDark ? STYLE_DARK : STYLE_LIGHT);
  }, [isDark]);

  // Move the driver marker + redraw the route line on each location update.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !driverMarkerRef.current) return;

    driverMarkerRef.current.setLngLat([driverLng, driverLat]);
    map.panTo([driverLng, driverLat], { animate: true, duration: 1000 });

    const source = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [driverLng, driverLat],
          [destLng, destLat],
        ],
      },
    });
  }, [driverLat, driverLng, destLat, destLng]);

  // Real DOM node — this file only ever runs on web, so a plain div is fine.
  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}