import React from "react";
import { useNetworkStatus } from "../hooks/useNetwork";
import { OfflineScreen, OfflineScreenProps } from "./OfflineScreen";

interface OfflineGateProps {
  children: React.ReactNode;
  /** Pass through if the host app wants OfflineScreen to use its own
   *  ThemeContext colors instead of the bundled Kayora defaults. */
  colors?: OfflineScreenProps["colors"];
  title?: string;
  subtitle?: string;
}

/**
 * Wrap the app's root content with this once, in each app's root layout
 * (e.g. app/_layout.tsx). While offline it renders OfflineScreen instead
 * of children; as soon as connectivity returns, children render again
 * automatically — no navigation needed either direction.
 *
 * Customer app / Driver app / Admin dashboard all use this same file, so
 * a fix to the offline UX in one place covers all three.
 *
 * Example (admin dashboard, which already has a ThemeContext):
 *
 *   import { OfflineGate } from "../components/OfflineGate";
 *   import { useTheme } from "../contexts/ThemeContext";
 *
 *   function RootLayout() {
 *     const { colors } = useTheme();
 *     return (
 *       <OfflineGate colors={colors}>
 *         <Stack />
 *       </OfflineGate>
 *     );
 *   }
 *
 * Example (an app with no ThemeContext yet — just uses the bundled
 * Kayora light/dark defaults automatically):
 *
 *   export default function RootLayout() {
 *     return (
 *       <OfflineGate>
 *         <Stack />
 *       </OfflineGate>
 *     );
 *   }
 */
export function OfflineGate({ children, colors, title, subtitle }: OfflineGateProps) {
  const { isOffline, checkNow } = useNetworkStatus();

  if (isOffline) {
    return <OfflineScreen onRetry={checkNow} colors={colors} title={title} subtitle={subtitle} />;
  }

  return <>{children}</>;
}

export default OfflineGate;