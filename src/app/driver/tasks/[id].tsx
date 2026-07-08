import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Appearance,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import Animated, {
    Easing,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    ZoomIn
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

/* ============================================================
   BRAND COLORS
============================================================ */
const BRAND = {
  primary: "#0D4A8C",
  secondary: "#1E5FAF",
  gold: "#D4A64A",
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
  completed: "#10B981",
  danger: "#EF4444",
};

type ThemeMode = "light" | "dark" | "system";
type Scheme = "light" | "dark";
type TaskPriority = "High" | "Medium" | "Low";
type TaskStatus = "Scheduled" | "In Progress" | "Completed";
type PaymentMethod = "Cash" | "Card" | "Transfer";

interface Task {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerPicture: string | null;
  address: string;
  bottleName: string;
  bottleSize: string;
  quantity: string;
  paymentMethod: PaymentMethod;
  priority: TaskPriority;
  status: TaskStatus;
  deliveryTime: string;
  notes?: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

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
    gold: BRAND.gold,
    success: BRAND.success,
    warning: BRAND.warning,
    completed: BRAND.completed,
    danger: BRAND.danger,
    headerBg: isDark ? "#0A2645" : BRAND.background,
    pillBg: isDark ? "#12335C" : "#EEF3FA",
    modalBg: isDark ? "#0E2D52" : "#FFFFFF",
  };
}

const THEME_STORAGE_KEY = "kayora_driver_theme_mode";

/* ============================================================
   HELPERS
============================================================ */
function priorityColor(
  priority: TaskPriority,
  palette: ReturnType<typeof getPalette>,
) {
  if (priority === "High") return palette.danger;
  if (priority === "Medium") return palette.warning;
  return palette.success;
}

function statusColor(
  status: TaskStatus,
  palette: ReturnType<typeof getPalette>,
) {
  if (status === "Completed") return palette.completed;
  if (status === "In Progress") return palette.secondary;
  return palette.primary;
}

/* ============================================================
   TASK DETAILS SCREEN
============================================================ */
export default function TaskDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 720;

  /* Theme */
  const colorScheme = Appearance.useColorScheme() ?? "light";
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const palette = useMemo(
    () =>
      getPalette(
        themeMode === "system"
          ? colorScheme
          : themeMode === "light"
            ? "light"
            : "dark",
      ),
    [themeMode, colorScheme],
  );

  /* State */
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "start" | "complete" | null
  >(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /* Animations */
  const entranceOpacity = useSharedValue(0);
  const entranceTranslate = useSharedValue(16);

  /* Load theme from storage */
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
        if (stored) setThemeMode(stored as ThemeMode);
      } catch (e) {
        console.warn("Theme preference not found", e);
      }
    })();
  }, []);

  /* Load task data */
  useEffect(() => {
    fetchTaskDetails();
  }, [id]);

  /* Entrance animation */
  useEffect(() => {
    entranceOpacity.value = withTiming(1, { duration: 450 });
    entranceTranslate.value = withTiming(0, {
      duration: 450,
      easing: Easing.out(Easing.quad),
    });
  }, []);

  const fetchTaskDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // For demo purposes, we're using mock data
      // In production, fetch from your API using the task ID
      const mockTasks: Record<string, Task> = {
        "1": {
          id: "1",
          orderId: "ORD-2024-001",
          customerName: "John Doe",
          customerPhone: "+1 (555) 123-4567",
          customerPicture: null,
          address: "123 Main St, Apartment 4B, New York, NY 10001",
          bottleName: "Premium Spring Water",
          bottleSize: "5L",
          quantity: "3",
          paymentMethod: "Cash",
          priority: "High",
          status: "Scheduled",
          deliveryTime: "2:30 PM - 3:00 PM",
          notes: "Please ring doorbell twice. Apartment is on 4th floor.",
          assignedAt: "Today at 9:00 AM",
        },
        "2": {
          id: "2",
          orderId: "ORD-2024-002",
          customerName: "Jane Smith",
          customerPhone: "+1 (555) 987-6543",
          customerPicture: null,
          address: "456 Oak Ave, Suite 200, Los Angeles, CA 90001",
          bottleName: "Mineral Water",
          bottleSize: "20L",
          quantity: "2",
          paymentMethod: "Card",
          priority: "Medium",
          status: "In Progress",
          deliveryTime: "1:00 PM - 1:30 PM",
          startedAt: "Today at 12:55 PM",
        },
      };

      const foundTask = mockTasks[id || "1"];
      if (foundTask) {
        setTask(foundTask);
      } else {
        setError("Task not found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load task");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleStartTask = useCallback(() => {
    setConfirmAction("start");
    setConfirmVisible(true);
  }, []);

  const handleCompleteTask = useCallback(() => {
    setConfirmAction("complete");
    setConfirmVisible(true);
  }, []);

  const handleConfirmAction = useCallback(async () => {
    setConfirmVisible(false);
    setActionLoading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (confirmAction === "start" && task) {
        setTask({ ...task, status: "In Progress", startedAt: "Now" });
        setSuccessMessage("Task started successfully!");
      } else if (confirmAction === "complete" && task) {
        setTask({ ...task, status: "Completed", completedAt: "Now" });
        setSuccessMessage("Task completed successfully!");
      }

      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err) {
      Alert.alert("Error", "Failed to update task status");
    } finally {
      setActionLoading(false);
    }
  }, [confirmAction, task]);

  const handleCall = useCallback(() => {
    if (task?.customerPhone) {
      Linking.openURL(`tel:${task.customerPhone}`);
    }
  }, [task?.customerPhone]);

  const handleMessage = useCallback(() => {
    if (task?.customerPhone) {
      Linking.openURL(`sms:${task.customerPhone}`);
    }
  }, [task?.customerPhone]);

  const handleCycleTheme = useCallback(async () => {
    const nextMode =
      themeMode === "light"
        ? "dark"
        : themeMode === "dark"
          ? "system"
          : "light";
    setThemeMode(nextMode);
    await SecureStore.setItemAsync(THEME_STORAGE_KEY, nextMode);
  }, [themeMode]);

  const contentEntrance = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    transform: [{ translateY: entranceTranslate.value }],
  }));

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: palette.background }]}
      >
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !task) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: palette.background }]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={palette.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            Task Details
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={palette.danger}
          />
          <Text style={[styles.errorText, { color: palette.text }]}>
            {error || "Task not found"}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={[styles.errorButton, { backgroundColor: palette.primary }]}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const confirmMessage =
    confirmAction === "start"
      ? "Are you sure you want to start this task?"
      : "Are you sure you want to mark this task as completed?";

  const confirmTitle =
    confirmAction === "start" ? "Start Task" : "Complete Task";

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={[styles.headerRow, { borderBottomColor: palette.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={palette.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            Task Details
          </Text>
          <Pressable onPress={handleCycleTheme} hitSlop={10}>
            <Ionicons
              name={
                themeMode === "light"
                  ? "sunny-outline"
                  : themeMode === "dark"
                    ? "moon-outline"
                    : "contrast-outline"
              }
              size={20}
              color={palette.text}
            />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1, backgroundColor: palette.background }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: isWideScreen ? 32 : 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={contentEntrance}>
            {/* Order Header */}
            <Animated.View
              entering={FadeInDown.duration(400)}
              style={[
                styles.orderHeaderCard,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  borderTopColor: statusColor(task.status, palette),
                  borderTopWidth: 4,
                },
              ]}
            >
              <View style={styles.orderHeaderTop}>
                <View>
                  <Text style={[styles.orderIdLabel, { color: palette.muted }]}>
                    ORDER ID
                  </Text>
                  <Text style={[styles.orderIdText, { color: palette.text }]}>
                    {task.orderId}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: `${statusColor(task.status, palette)}15`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: statusColor(task.status, palette) },
                    ]}
                  >
                    {task.status}
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { borderColor: palette.border }]} />

              <View style={styles.orderHeaderBottom}>
                <View style={styles.metaItem}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={palette.muted}
                  />
                  <Text style={[styles.metaLabel, { color: palette.muted }]}>
                    Assigned
                  </Text>
                  <Text style={[styles.metaValue, { color: palette.text }]}>
                    {task.assignedAt}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons
                    name={
                      task.priority === "High"
                        ? "alert-circle"
                        : task.priority === "Medium"
                          ? "alert-outline"
                          : "checkmark-circle-outline"
                    }
                    size={14}
                    color={priorityColor(task.priority, palette)}
                  />
                  <Text style={[styles.metaLabel, { color: palette.muted }]}>
                    Priority
                  </Text>
                  <Text
                    style={[
                      styles.metaValue,
                      { color: priorityColor(task.priority, palette) },
                    ]}
                  >
                    {task.priority}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Customer Info */}
            <Animated.View
              entering={FadeInDown.duration(450)}
              style={[
                styles.section,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Customer Information
              </Text>

              <View style={styles.customerInfoBox}>
                <View
                  style={[
                    styles.customerAvatar,
                    { backgroundColor: palette.primary },
                  ]}
                >
                  <Text style={styles.customerAvatarText}>
                    {(task.customerName || "C").charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.customerName, { color: palette.text }]}>
                    {task.customerName}
                  </Text>
                  <Text
                    style={[styles.customerPhone, { color: palette.muted }]}
                  >
                    {task.customerPhone}
                  </Text>
                </View>
              </View>

              <View style={styles.contactButtonsRow}>
                <Pressable
                  onPress={handleCall}
                  style={[
                    styles.contactButton,
                    { backgroundColor: palette.primary },
                  ]}
                >
                  <Ionicons name="call" size={18} color="#FFFFFF" />
                  <Text style={styles.contactButtonText}>Call</Text>
                </Pressable>

                <Pressable
                  onPress={handleMessage}
                  style={[
                    styles.contactButton,
                    { backgroundColor: palette.secondary },
                  ]}
                >
                  <Ionicons name="chatbubble" size={18} color="#FFFFFF" />
                  <Text style={styles.contactButtonText}>Message</Text>
                </Pressable>
              </View>
            </Animated.View>

            {/* Delivery Details */}
            <Animated.View
              entering={FadeInDown.duration(500)}
              style={[
                styles.section,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Delivery Details
              </Text>

              <View style={styles.detailRow}>
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={palette.primary}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.detailLabel, { color: palette.muted }]}>
                    Delivery Address
                  </Text>
                  <Text style={[styles.detailValue, { color: palette.text }]}>
                    {task.address}
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { borderColor: palette.border }]} />

              <View style={styles.detailRow}>
                <Ionicons
                  name="water-outline"
                  size={20}
                  color={palette.secondary}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.detailLabel, { color: palette.muted }]}>
                    Product
                  </Text>
                  <Text style={[styles.detailValue, { color: palette.text }]}>
                    {task.bottleName} ({task.bottleSize})
                  </Text>
                  <Text style={[styles.detailValue, { color: palette.muted }]}>
                    Quantity: {task.quantity}
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { borderColor: palette.border }]} />

              <View style={styles.detailRow}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={palette.warning}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.detailLabel, { color: palette.muted }]}>
                    Delivery Time
                  </Text>
                  <Text style={[styles.detailValue, { color: palette.text }]}>
                    {task.deliveryTime}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Payment Information */}
            <Animated.View
              entering={FadeInDown.duration(550)}
              style={[
                styles.section,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Payment Method
              </Text>

              <View style={styles.detailRow}>
                <Ionicons name="card-outline" size={20} color={palette.gold} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.detailLabel, { color: palette.muted }]}>
                    Payment Type
                  </Text>
                  <Text style={[styles.detailValue, { color: palette.text }]}>
                    {task.paymentMethod}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Notes */}
            {task.notes && (
              <Animated.View
                entering={FadeInDown.duration(600)}
                style={[
                  styles.section,
                  {
                    backgroundColor: palette.pillBg,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  Special Notes
                </Text>
                <Text style={[styles.notesText, { color: palette.text }]}>
                  {task.notes}
                </Text>
              </Animated.View>
            )}

            {/* Action Buttons */}
            <Animated.View entering={FadeInDown.duration(650)}>
              {task.status === "Scheduled" && (
                <Pressable
                  onPress={handleStartTask}
                  disabled={actionLoading}
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: palette.primary,
                      opacity: actionLoading ? 0.6 : 1,
                    },
                  ]}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="play-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Start Task</Text>
                    </>
                  )}
                </Pressable>
              )}

              {task.status === "In Progress" && (
                <Pressable
                  onPress={handleCompleteTask}
                  disabled={actionLoading}
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: palette.completed,
                      opacity: actionLoading ? 0.6 : 1,
                    },
                  ]}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.actionButtonText}>Complete Task</Text>
                    </>
                  )}
                </Pressable>
              )}

              {task.status === "Completed" && (
                <View
                  style={[
                    styles.completedMessage,
                    {
                      backgroundColor: `${palette.completed}15`,
                      borderColor: palette.completed,
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-done"
                    size={18}
                    color={palette.completed}
                  />
                  <Text
                    style={[
                      styles.completedMessageText,
                      { color: palette.completed },
                    ]}
                  >
                    Task completed at {task.completedAt}
                  </Text>
                </View>
              )}
            </Animated.View>

            <View style={{ height: 24 }} />
          </Animated.View>
        </ScrollView>

        {/* Confirm Dialog */}
        <Modal
          visible={confirmVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmVisible(false)}
        >
          <BlurView intensity={90} style={styles.confirmOverlay}>
            <Animated.View
              entering={ZoomIn.duration(220)}
              style={[styles.confirmCard, { backgroundColor: palette.modalBg }]}
            >
              <Text style={[styles.confirmTitle, { color: palette.text }]}>
                {confirmTitle}
              </Text>
              <Text style={[styles.confirmMessage, { color: palette.muted }]}>
                {confirmMessage}
              </Text>
              <View style={styles.confirmButtonsRow}>
                <Pressable
                  onPress={() => setConfirmVisible(false)}
                  disabled={actionLoading}
                  style={[
                    styles.confirmButtonNo,
                    {
                      borderColor: palette.border,
                      opacity: actionLoading ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.confirmButtonNoText,
                      { color: palette.text },
                    ]}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirmAction}
                  disabled={actionLoading}
                  style={[
                    styles.confirmButtonYes,
                    {
                      backgroundColor: palette.primary,
                      opacity: actionLoading ? 0.6 : 1,
                    },
                  ]}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmButtonYesText}>Confirm</Text>
                  )}
                </Pressable>
              </View>
            </Animated.View>
          </BlurView>
        </Modal>

        {/* Success Message */}
        {successMessage && (
          <View
            style={[
              styles.successMessage,
              { backgroundColor: palette.completed },
            ]}
          >
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
            <Text style={styles.successMessageText}>{successMessage}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ============================================================
   STYLES
============================================================ */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  scrollContent: {
    paddingVertical: 16,
  },
  orderHeaderCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  orderHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  orderIdLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  orderIdText: {
    fontSize: 18,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  orderHeaderBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 2,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },
  customerInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  customerAvatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  customerName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 12,
  },
  contactButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  contactButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  notesText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  completedMessage: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  completedMessageText: {
    fontWeight: "600",
    fontSize: 13,
  },
  confirmOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  confirmCard: {
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 320,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  confirmButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  confirmButtonNo: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmButtonNoText: {
    fontWeight: "600",
    fontSize: 13,
  },
  confirmButtonYes: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmButtonYesText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  successMessage: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  successMessageText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "600",
    marginVertical: 12,
  },
  errorButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 12,
  },
  errorButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
