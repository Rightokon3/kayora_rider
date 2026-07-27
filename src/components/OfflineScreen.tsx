import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, useColorScheme } from "react-native";
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop } from "react-native-svg";

// ---------------------------------------------------------------------------
// Brand tokens — kept local so this file drops into any of the three Kayora
// apps with zero setup. If the app already has a ThemeContext, pass its
// `colors` object in as the `colors` prop and it overrides these.
// ---------------------------------------------------------------------------
const BRAND = {
  primary: "#0D4A8C",
  gold: "#D4A64A",
};

type OfflineColors = {
  background: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  gold: string;
};

function defaultColors(isDark: boolean): OfflineColors {
  return isDark
    ? {
        background: "#0B1220",
        card: "#141E33",
        text: "#F2F5FA",
        muted: "#8B96A8",
        border: "#22304A",
        primary: "#4E8FD9",
        gold: BRAND.gold,
      }
    : {
        background: "#F5F8FC",
        card: "#FFFFFF",
        text: "#101828",
        muted: "#667085",
        border: "#E2E5EA",
        primary: BRAND.primary,
        gold: BRAND.gold,
      };
}

// ---------------------------------------------------------------------------
// Illustration — a water droplet (the Kayora mark) with a severed signal
// arc next to it, in brand blue + gold. Hand-drawn-path style to match the
// onboarding illustrations rather than a generic stock "wifi-off" icon.
// ---------------------------------------------------------------------------
function OfflineIllustration({ colors }: { colors: OfflineColors }) {
  return (
    <Svg width={168} height={168} viewBox="0 0 168 168">
      <Defs>
        <LinearGradient id="dropFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity={1} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0.75} />
        </LinearGradient>
      </Defs>

      <Circle cx={84} cy={84} r={80} fill={colors.primary} fillOpacity={0.08} />

      {/* Water droplet */}
      <Path
        d="M84 34
           C 100 58, 118 76, 118 98
           C 118 121, 102 137, 84 137
           C 66 137, 50 121, 50 98
           C 50 76, 68 58, 84 34 Z"
        fill="url(#dropFill)"
      />
      {/* Droplet highlight */}
      <Path
        d="M72 92 C 72 104, 80 112, 90 113"
        stroke="#FFFFFF"
        strokeOpacity={0.55}
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />

      {/* Broken signal arcs, gold, top-right of the drop */}
      <G opacity={0.9}>
        <Path
          d="M112 44 C 122 54, 122 68, 112 78"
          stroke={colors.gold}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M122 32 C 138 48, 138 74, 122 90"
          stroke={colors.gold}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
          opacity={0.5}
        />
      </G>
      {/* Slash through the signal to read as "disconnected" */}
      <Path
        d="M100 30 L 138 92"
        stroke={colors.muted}
        strokeWidth={5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export interface OfflineScreenProps {
  /** Called when the user taps "Try Again". Should re-check connectivity
   *  and/or retry the failed request. May be async. */
  onRetry: () => void | Promise<void>;
  /** Optional override — pass the host app's own theme colors so this
   *  matches exactly instead of using the bundled defaults. */
  colors?: Partial<OfflineColors>;
  title?: string;
  subtitle?: string;
}

export function OfflineScreen({
  onRetry,
  colors: colorsOverride,
  title = "You're Offline",
  subtitle = "Check your internet connection and try again. Your cart and orders are safe — we'll sync them once you're back online.",
}: OfflineScreenProps) {
  const scheme = useColorScheme();
  const colors = { ...defaultColors(scheme === "dark"), ...colorsOverride };
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.illustrationWrap}>
        <OfflineIllustration colors={colors} />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <Pressable
        onPress={handleRetry}
        disabled={retrying}
        style={({ pressed }) => [
          styles.button,
          pressed && { opacity: 0.85 },
          retrying && { opacity: 0.7 },
        ]}
      >
        {retrying ? (
          <ActivityIndicator color="#101828" />
        ) : (
          <Text style={styles.buttonText}>Try Again</Text>
        )}
      </Pressable>

      <View style={styles.dotRow}>
        <View style={[styles.dot, { backgroundColor: colors.border }]} />
        <View style={[styles.dot, { backgroundColor: colors.gold }]} />
        <View style={[styles.dot, { backgroundColor: colors.border }]} />
      </View>
    </View>
  );
}

function makeStyles(colors: OfflineColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      backgroundColor: colors.background,
    },
    illustrationWrap: {
      marginBottom: 28,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 10,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.muted,
      textAlign: "center",
      maxWidth: 320,
      marginBottom: 28,
    },
    button: {
      backgroundColor: colors.gold,
      paddingVertical: 14,
      paddingHorizontal: 36,
      borderRadius: 12,
      minWidth: 180,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonText: {
      color: "#101828",
      fontSize: 15,
      fontWeight: "700",
    },
    dotRow: {
      flexDirection: "row",
      gap: 6,
      marginTop: 26,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
  });
}

export default OfflineScreen;