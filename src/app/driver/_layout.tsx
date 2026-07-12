import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect, Stack, usePathname } from "expo-router";
import { DriverAuthProvider, useDriverAuth } from "../../context/DriverAuthContext";

/* ============================================================
   DRIVER ROUTE GUARD
   ------------------------------------------------------------
   Auth status now comes from DriverAuthContext (shared, reactive)
   instead of a one-time local check — see that file for why.
   Still guards every screen under app/driver/, including
   login.tsx, so we still need the "don't redirect if already on
   the login route" check to avoid looping there too.
============================================================ */
function DriverGuard() {
  const pathname = usePathname();
  const isLoginRoute = pathname === "/driver/login";
  const { status } = useDriverAuth();

  if (status === "checking") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
        <ActivityIndicator size="large" color="#0D4A8C" />
      </View>
    );
  }

  if (status === "guest" && !isLoginRoute) {
    return <Redirect href="/driver/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function DriverLayout() {
  return (
    <DriverAuthProvider>
      <DriverGuard />
    </DriverAuthProvider>
  );
}