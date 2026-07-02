import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Modal,
  Linking,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  withSpring,
  withDelay,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

/* ============================================================
   COLORS
============================================================ */
const COLORS = {
  primary: "#0D4A8C",
  secondary: "#1E5FAF",
  gold: "#D4A64A",
  background: "#FFFFFF",
  card: "#F8FAFC",
  border: "#E5E7EB",
  text: "#1F2937",
  subtitle: "#6B7280",
  error: "#EF4444",
  success: "#22C55E",
};

/* ============================================================
   DEMO AUTH UTILITY
   Simulated authentication until backend is available.
============================================================ */
const DEMO_DRIVER = {
  id: "DRV0001",
  email: "driver@kayora.com",
  password: "driver123",
  name: "John Sunday",
};

const REMEMBER_ME_KEY = "kayora_driver_remember_me";
const SESSION_KEY = "kayora_driver_session";

type DemoAuthResult =
  | { success: true; driverName: string }
  | { success: false };

const DemoAuth = {
  async login(identifier: string, password: string): Promise<DemoAuthResult> {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 900));

    const normalized = identifier.trim().toLowerCase();
    const isIdMatch = normalized === DEMO_DRIVER.id.toLowerCase();
    const isEmailMatch = normalized === DEMO_DRIVER.email.toLowerCase();

    if ((isIdMatch || isEmailMatch) && password === DEMO_DRIVER.password) {
      return { success: true, driverName: DEMO_DRIVER.name };
    }
    return { success: false };
  },

async persistSession(remember: boolean) {
    if (!remember) return;

    if (Platform.OS === "web") {
      // Fallback for local web browser testing
      try {
        localStorage.setItem(REMEMBER_ME_KEY, "true");
        localStorage.setItem(SESSION_KEY, DEMO_DRIVER.id);
      } catch (error) {
        console.error("Failed to save session to localStorage:", error);
      }
    } else {
      // Native Mobile execution
      try {
        await SecureStore.setItemAsync(REMEMBER_ME_KEY, "true");
        await SecureStore.setItemAsync(SESSION_KEY, DEMO_DRIVER.id);
      } catch (error) {
        console.error("Failed to save secure session:", error);
      }
    }
  },
};

/* ============================================================
   MAIN COMPONENT
============================================================ */
export default function DriverLoginScreen() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [forgotVisible, setForgotVisible] = useState(false);

  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- Entrance Animation ---------- */
  const entranceOpacity = useSharedValue(0);
  const entranceTranslate = useSharedValue(24);

  useEffect(() => {
    entranceOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });
    entranceTranslate.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) });
  }, []);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    transform: [{ translateY: entranceTranslate.value }],
  }));

  /* ---------- Shake Animation (errors) ---------- */
  const shakeX = useSharedValue(0);
  const borderProgress = useSharedValue(0); // 0 = normal, 1 = error

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 60 }),
      withTiming(10, { duration: 60 }),
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
    borderProgress.value = withTiming(1, { duration: 150 });
  };

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const inputBorderStyle = useAnimatedStyle(() => ({
    borderColor: borderProgress.value === 1 ? COLORS.error : COLORS.border,
  }));

  /* ---------- Button Press Scale ---------- */
  const buttonScale = useSharedValue(1);
  const handlePressIn = () => {
    buttonScale.value = withTiming(0.97, { duration: 100 });
  };
  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 12 });
  };
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  /* ---------- Success Animation ---------- */
  const successOpacity = useSharedValue(0);
  const successScale = useSharedValue(0.6);

  const showSuccessAnimation = () => {
    setShowSuccess(true);
    successOpacity.value = withTiming(1, { duration: 250 });
    successScale.value = withSequence(
      withTiming(1.1, { duration: 250, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 120 })
    );
  };

  const successAnimatedStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ scale: successScale.value }],
  }));

  /* ---------- Auth check on mount ---------- */
  useEffect(() => {
    (async () => {
      try {
        const remembered = await SecureStore.getItemAsync(REMEMBER_ME_KEY);
        const session = await SecureStore.getItemAsync(SESSION_KEY);
        if (remembered === "true" && session) {
          router.replace("/driver/dashboard");
        }
      } catch (e) {
        // No stored session, remain on login
      }
    })();
  }, []);

  /* ---------- Handlers ---------- */
  const resetErrorAfterDelay = () => {
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      setShowError(false);
      borderProgress.value = withTiming(0, { duration: 200 });
    }, 2000);
  };

  const handleLogin = useCallback(async () => {
    if (loading) return;
    setShowError(false);

    if (!identifier.trim() || !password.trim()) {
      triggerShake();
      setShowError(true);
      resetErrorAfterDelay();
      return;
    }

    setLoading(true);
    const result = await DemoAuth.login(identifier, password);
    setLoading(false);

    if (result.success) {
      await DemoAuth.persistSession(rememberMe);
      setDriverName(result.driverName);
      showSuccessAnimation();
      setTimeout(() => {
        router.replace("/driver/dashboard");
      }, 1000);
    } else {
      triggerShake();
      setShowError(true);
      resetErrorAfterDelay();
    }
  }, [identifier, password, rememberMe, loading]);

  const handleCallAdmin = () => {
    Linking.openURL("tel:+2348000000000");
  };

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.container, entranceStyle]}>
            {/* ---------- TOP BRANDING ---------- */}
            <View style={styles.brandingBlock}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoLetter}>K</Text>
              </View>
              <Text style={styles.brandTitle}>Kayora Driver</Text>
              <Text style={styles.brandSubtitle}>Driver Delivery Management</Text>
            </View>

            {/* ---------- LOGIN CARD ---------- */}
            <Animated.View style={[styles.card, shakeStyle]}>
              {/* Driver ID / Email */}
              <Text style={styles.label}>Driver ID or Email</Text>
              <Animated.View style={[styles.inputWrapper, inputBorderStyle]}>
                <Ionicons name="person-outline" size={20} color={COLORS.subtitle} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="DRV0001 or driver@kayora.com"
                  placeholderTextColor={COLORS.subtitle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={identifier}
                  onChangeText={setIdentifier}
                  editable={!loading}
                />
              </Animated.View>

              {/* Password */}
              <Text style={[styles.label, { marginTop: 18 }]}>Password</Text>
              <Animated.View style={[styles.inputWrapper, inputBorderStyle]}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.subtitle} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.subtitle}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={COLORS.subtitle}
                  />
                </Pressable>
              </Animated.View>

              {/* Error Message */}
              {showError && (
                <Animated.View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                  <Text style={styles.errorText}>Incorrect Driver ID or Password</Text>
                </Animated.View>
              )}

              {/* Remember Me + Forgot Password */}
              <View style={styles.rowBetween}>
                <Pressable
                  style={styles.rememberRow}
                  onPress={() => setRememberMe((v) => !v)}
                  hitSlop={8}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.rememberText}>Remember Me</Text>
                </Pressable>

                <Pressable onPress={() => setForgotVisible(true)} hitSlop={8}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </Pressable>
              </View>

              {/* Login Button */}
              <Animated.View style={buttonAnimatedStyle}>
                <Pressable
                  style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                  onPress={handleLogin}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  disabled={loading}
                  android_ripple={{ color: "rgba(255,255,255,0.2)" }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.loginButtonText}>Login</Text>
                  )}
                </Pressable>
              </Animated.View>
            </Animated.View>

            <Text style={styles.footerText}>
              Access restricted to registered Kayora drivers.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ---------- SUCCESS OVERLAY ---------- */}
      {showSuccess && (
        <View style={styles.overlay}>
          <Animated.View style={[styles.successCard, successAnimatedStyle]}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.successTitle}>Welcome back</Text>
            <Text style={styles.successName}>{driverName}</Text>
          </Animated.View>
        </View>
      )}

      {/* ---------- FORGOT PASSWORD MODAL ---------- */}
      <Modal
        visible={forgotVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="key-outline" size={26} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>Forgot Password?</Text>
            <Text style={styles.modalMessage}>
              Please contact your administrator to reset your password.
            </Text>

            <Pressable style={styles.modalPrimaryButton} onPress={handleCallAdmin}>
              <Ionicons name="call-outline" size={18} color="#FFFFFF" />
              <Text style={styles.modalPrimaryButtonText}>Call Admin</Text>
            </Pressable>

            <Pressable
              style={styles.modalSecondaryButton}
              onPress={() => setForgotVisible(false)}
            >
              <Text style={styles.modalSecondaryButtonText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ============================================================
   STYLES
============================================================ */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  container: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },

  /* Branding */
  brandingBlock: {
    alignItems: "center",
    marginBottom: 36,
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  logoLetter: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  brandSubtitle: {
    fontSize: 14,
    color: COLORS.subtitle,
    marginTop: 6,
    textAlign: "center",
  },

  /* Card */
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    height: "100%",
  },

  /* Error */
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
    gap: 8,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: "600",
  },

  /* Remember Me / Forgot Password */
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 24,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: COLORS.background,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  rememberText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
  },
  forgotText: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: "600",
  },

  /* Login Button */
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.75,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  footerText: {
    textAlign: "center",
    fontSize: 12,
    color: COLORS.subtitle,
    marginTop: 24,
  },

  /* Success Overlay */
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  successCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 40,
    alignItems: "center",
    width: "78%",
    maxWidth: 320,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  successTitle: {
    fontSize: 15,
    color: COLORS.subtitle,
    fontWeight: "500",
  },
  successName: {
    fontSize: 20,
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 4,
  },

  /* Forgot Password Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 26,
    alignItems: "center",
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EAF1FB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: COLORS.subtitle,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
  },
  modalPrimaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    width: "100%",
    height: 50,
    borderRadius: 14,
    marginBottom: 10,
  },
  modalPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  modalSecondaryButton: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryButtonText: {
    color: COLORS.subtitle,
    fontSize: 15,
    fontWeight: "600",
  },
});