import MapLibreGL from "@maplibre/maplibre-react-native";

/**
 * Every native map component used to call `MapLibreGL.setAccessToken(null)`
 * directly at module scope. That runs the instant the file is IMPORTED —
 * not when a map is actually rendered — which happens eagerly for any
 * screen that imports a map component, even if that map is only shown
 * conditionally (e.g. inside a modal that isn't open yet).
 *
 * If the native module isn't fully linked in a given build, that call
 * throws synchronously during bundle evaluation, before anything has
 * mounted and before any error boundary exists to catch it. In a release
 * build (no red-screen overlay) an uncaught exception at that point can
 * take down the ENTIRE app — navbar, layout, everything — not just the
 * one map. That's the "blank grey screen, nothing renders" bug.
 *
 * Fix: every native map component now calls this lazily from inside a
 * useEffect (so it only runs once a map is genuinely about to render,
 * and never blocks anything else from mounting first), and it's wrapped
 * in try/catch so a real linking failure becomes a visible, contained
 * fallback instead of a silent full-app crash.
 */
let tokenInitialized = false;
let tokenAvailable = false;

export function ensureMapLibreReady(): boolean {
  if (tokenInitialized) return tokenAvailable;
  tokenInitialized = true;
  try {
    MapLibreGL.setAccessToken(null);
    tokenAvailable = true;
  } catch (e) {
    console.warn("[MapLibre] native module unavailable:", e);
    tokenAvailable = false;
  }
  return tokenAvailable;
}