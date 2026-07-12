import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Linking,
  ActivityIndicator,
  StyleSheet,
  Appearance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn, ZoomIn } from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import { DriverDashboardService } from "../../../services/driverDashboard";
import { DriverTask } from "../../../types/driverTask";
import TaskMapPreview from "../../../components/TaskMapPreview";

/* ============================================================
   BRAND COLORS (matches the rest of the driver app)
============================================================ */
const BRAND = {
  primary: "#0D4A8C",
  secondary: "#1E5FAF",
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
  warning: "#F59E0B",
  danger: "#EF4444",
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
    success: BRAND.success,
    warning: BRAND.warning,
    danger: BRAND.danger,
    pillBg: isDark ? "#12335C" : "#EEF3FA",
  };
}

const THEME_STORAGE_KEY = "kayora_driver_theme_mode";

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

/* ============================================================
   CONFIRM DIALOG (matches pattern used elsewhere in the driver app)
============================================================ */
function ConfirmDialog({
  visible,
  palette,
  title,
  message,
  loading,
  onYes,
  onNo,
}: {
  visible: boolean;
  palette: ReturnType<typeof getPalette>;
  title: string;
  message: string;
  loading: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={styles.confirmOverlay}>
      <Animated.View entering={ZoomIn.duration(220)} style={[styles.confirmCard, { backgroundColor: palette.card }]}>
        <Text style={[styles.confirmTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.confirmMessage, { color: palette.muted }]}>{message}</Text>
        <View style={styles.confirmButtonsRow}>
          <Pressable onPress={onNo} disabled={loading} style={[styles.confirmButtonNo, { borderColor: palette.border }]}>
            <Text style={[styles.confirmButtonNoText, { color: palette.text }]}>No</Text>
          </Pressable>
          <Pressable onPress={onYes} disabled={loading} style={[styles.confirmButtonYes, { backgroundColor: palette.primary }]}>
            {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.confirmButtonYesText}>Yes</Text>}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function SuccessOverlay({ visible, palette, message }: { visible: boolean; palette: ReturnType<typeof getPalette>; message: string }) {
  if (!visible) return null;
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.successOverlay}>
      <Animated.View entering={ZoomIn.duration(300)} style={[styles.successCard, { backgroundColor: palette.card }]}>
        <View style={[styles.successCircle, { backgroundColor: palette.success }]}>
          <Ionicons name="checkmark" size={36} color="#FFFFFF" />
        </View>
        <Text style={[styles.successMessage, { color: palette.text }]}>{message}</Text>
      </Animated.View>
    </Animated.View>
  );
}

function DetailRow({ label, value, palette }: { label: string; value: string; palette: ReturnType<typeof getPalette> }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

/* ============================================================
   MAIN SCREEN
============================================================ */
export default function TaskDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [scheme, setScheme] = useState<Scheme>((Appearance.getColorScheme() as Scheme) || "light");
  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(THEME_STORAGE_KEY).catch(() => null);
      if (saved === "light" || saved === "dark") setScheme(saved);
    })();
  }, []);
  const palette = useMemo(() => getPalette(scheme), [scheme]);

  const [task, setTask] = useState<DriverTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [confirmAction, setConfirmAction] = useState<"start" | "complete" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadTask = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await DriverDashboardService.getTaskById(id);
      setTask(result);
    } catch (e) {
      setErrorMessage("Could not load this order. Pull down to try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const handleConfirmAction = useCallback(async () => {
    if (!task || !confirmAction) return;
    setActionLoading(true);
    try {
      const updated =
        confirmAction === "start"
          ? await DriverDashboardService.startTask(task.id)
          : await DriverDashboardService.completeTask(task.id);
      setTask(updated);
      setConfirmAction(null);
      setSuccessMessage(confirmAction === "start" ? "Delivery Started" : "Delivery Completed");
      setTimeout(() => setSuccessMessage(null), 1500);
    } catch (e) {
      setErrorMessage("Could not update this order. Please try again.");
      setConfirmAction(null);
    } finally {
      setActionLoading(false);
    }
  }, [task, confirmAction]);

  const handleOpenInMaps = () => {
    if (!task) return;
    // Was opening OpenStreetMap externally — now opens the in-app map
    // showing all of today's stops, focused/popup-opened on this one.
    router.push(`/driver/maps?focusId=${task.id}` as any);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
        <View style={styles.centerFill}>
          <Ionicons name="alert-circle-outline" size={40} color={palette.muted} />
          <Text style={[styles.errorText, { color: palette.muted }]}>{errorMessage ?? "Order not found."}</Text>
<Pressable
  onPress={() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/driver/dashboard");
    }
  }}
  style={[styles.backLinkButton, { backgroundColor: palette.primary }]}
>
  <Text style={styles.backLinkButtonText}>Go Back</Text>
</Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const initial = task.customerName.trim().charAt(0).toUpperCase();
  const canStart = task.status === "Assigned" || task.status === "Preparing";
  const canComplete = task.status === "Out For Delivery";
  const isDelivered = task.status === "Delivered";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={["top", "bottom"]}>
      <View style={[styles.headerRow, { borderBottomColor: palette.border }]}>
<Pressable
  onPress={() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/driver/dashboard");
    }
  }}
  style={[styles.backLinkButton, { backgroundColor: palette.primary }]}
>
  <Text style={styles.backLinkButtonText}>Go Back</Text>
</Pressable>
        <View style={{ marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Order #{task.orderNumber}</Text>
          <Text style={[styles.headerSubtitle, { color: palette.muted }]}>{task.status}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {errorMessage && (
          <View style={[styles.errorBanner, { backgroundColor: palette.danger + "1A" }]}>
            <Text style={[styles.errorBannerText, { color: palette.danger }]}>{errorMessage}</Text>
          </View>
        )}

        {/* ---------- Map ---------- */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.mapWrap, { borderColor: palette.border }]}>
          <TaskMapPreview latitude={task.latitude} longitude={task.longitude} isDark={palette.scheme === "dark"} />
          <Pressable onPress={handleOpenInMaps} style={[styles.navigateButton, { backgroundColor: palette.card }]}>
            <Ionicons name="navigate-outline" size={17} color={palette.primary} />
          </Pressable>
        </Animated.View>

        {/* ---------- Customer Info ---------- */}
        <Animated.View entering={FadeInDown.duration(400).delay(60)} style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Customer Information</Text>
          <View style={styles.customerRow}>
            <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[styles.customerName, { color: palette.text }]}>{task.customerName}</Text>
              <Text style={[styles.customerAddress, { color: palette.muted }]}>{task.deliveryAddress}</Text>
            </View>
          </View>
          {task.nearestLandmark && <DetailRow label="Landmark" value={task.nearestLandmark} palette={palette} />}
          <View style={styles.contactButtonsRow}>
            <Pressable onPress={() => Linking.openURL(`tel:${task.customerPhone}`)} style={[styles.contactButton, { backgroundColor: palette.primary }]}>
              <Ionicons name="call-outline" size={15} color="#FFFFFF" />
              <Text style={styles.contactButtonText}>Call</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(`sms:${task.customerPhone}`)} style={[styles.contactButtonGhost, { borderColor: palette.border }]}>
              <Ionicons name="chatbubble-outline" size={15} color={palette.text} />
              <Text style={[styles.contactButtonGhostText, { color: palette.text }]}>Message</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* ---------- Ordered Products ---------- */}
        <Animated.View entering={FadeInDown.duration(400).delay(120)} style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Ordered Products</Text>
          {task.items.map((item, index) => (
            <View key={item.id} style={[styles.productRow, index !== task.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: palette.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.productName, { color: palette.text }]}>{item.bottleName}</Text>
                <Text style={[styles.productMeta, { color: palette.muted }]}>{item.size} · Qty {item.quantity}</Text>
              </View>
              <Text style={[styles.productSubtotal, { color: palette.text }]}>{formatNaira(item.subtotal)}</Text>
            </View>
          ))}
          <View style={[styles.totalRow, { borderTopColor: palette.border }]}>
            <Text style={[styles.totalLabel, { color: palette.muted }]}>Total</Text>
            <Text style={[styles.totalValue, { color: palette.text }]}>{formatNaira(task.amount)}</Text>
          </View>
        </Animated.View>

        {/* ---------- Delivery Info ---------- */}
        <Animated.View entering={FadeInDown.duration(400).delay(180)} style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Delivery Information</Text>
          <DetailRow label="Priority" value={task.priority} palette={palette} />
          <DetailRow label="Payment Method" value={task.paymentMethod ?? "—"} palette={palette} />
          <DetailRow label="Payment Status" value={task.paymentStatus ?? "—"} palette={palette} />
          <DetailRow label="Distance" value={task.distanceKm != null ? `${task.distanceKm} km` : "—"} palette={palette} />
          <DetailRow label="ETA" value={task.eta ?? "—"} palette={palette} />
          {task.specialInstructions && <DetailRow label="Notes" value={task.specialInstructions} palette={palette} />}
        </Animated.View>

        {/* ---------- Actions ---------- */}
        {!isDelivered && (
          <View style={styles.actionsRow}>
            {canStart && (
              <Pressable onPress={() => setConfirmAction("start")} style={[styles.actionButton, { backgroundColor: palette.secondary }]}>
                <Ionicons name="play-outline" size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Start Delivery</Text>
              </Pressable>
            )}
            {canComplete && (
              <Pressable onPress={() => setConfirmAction("complete")} style={[styles.actionButton, { backgroundColor: palette.success }]}>
                <Ionicons name="checkmark-done-outline" size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Complete Delivery</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <ConfirmDialog
        visible={!!confirmAction}
        palette={palette}
        title={confirmAction === "start" ? "Start this delivery?" : "Complete this delivery?"}
        message={
          confirmAction === "start"
            ? "This marks the order as Out For Delivery."
            : "This marks the order as Delivered and cannot be undone."
        }
        loading={actionLoading}
        onYes={handleConfirmAction}
        onNo={() => setConfirmAction(null)}
      />

      <SuccessOverlay visible={!!successMessage} palette={palette} message={successMessage ?? ""} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 32 },
  errorText: { fontSize: 13.5, textAlign: "center" },
  backLinkButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  backLinkButtonText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "700" },

  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800" },
  headerSubtitle: { fontSize: 12, marginTop: 2 },

  scrollContent: { padding: 16, gap: 16 },
  errorBanner: { borderRadius: 12, padding: 12 },
  errorBannerText: { fontSize: 12.5, fontWeight: "700" },

  mapWrap: { height: 200, borderRadius: 18, borderWidth: 1, overflow: "hidden", position: "relative" },
  navigateButton: { position: "absolute", top: 12, right: 12, width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  sectionCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
  sectionTitle: { fontSize: 14.5, fontWeight: "800", marginBottom: 12 },

  customerRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  customerName: { fontSize: 14.5, fontWeight: "700" },
  customerAddress: { fontSize: 12, marginTop: 2 },

  contactButtonsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  contactButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 42, borderRadius: 10 },
  contactButtonText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "700" },
  contactButtonGhost: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 42, borderRadius: 10, borderWidth: 1 },
  contactButtonGhostText: { fontSize: 12.5, fontWeight: "700" },

  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  detailLabel: { fontSize: 12.5, fontWeight: "600" },
  detailValue: { fontSize: 12.5, fontWeight: "700", flexShrink: 1, textAlign: "right" },

  productRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  productName: { fontSize: 13.5, fontWeight: "700" },
  productMeta: { fontSize: 11.5, marginTop: 2 },
  productSubtotal: { fontSize: 13.5, fontWeight: "800" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 12.5, fontWeight: "700" },
  totalValue: { fontSize: 15, fontWeight: "800" },

  actionsRow: { flexDirection: "row", gap: 10 },
  actionButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 12 },
  actionButtonText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "700" },

  confirmOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", paddingHorizontal: 32, zIndex: 50 },
  confirmCard: { width: "100%", maxWidth: 340, borderRadius: 22, padding: 24 },
  confirmTitle: { fontSize: 17, fontWeight: "800", marginBottom: 8 },
  confirmMessage: { fontSize: 13.5, lineHeight: 19, marginBottom: 22 },
  confirmButtonsRow: { flexDirection: "row", gap: 10 },
  confirmButtonNo: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  confirmButtonNoText: { fontSize: 14, fontWeight: "700" },
  confirmButtonYes: { flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  confirmButtonYesText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  successOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", zIndex: 60 },
  successCard: { width: "78%", maxWidth: 320, borderRadius: 24, paddingVertical: 36, paddingHorizontal: 32, alignItems: "center" },
  successCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  successMessage: { fontSize: 16, fontWeight: "800", textAlign: "center" },
});