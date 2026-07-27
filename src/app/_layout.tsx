import { Stack } from "expo-router";
import { OfflineGate } from "../components/OfflineGate";

export default function RootLayout() {
  return (
      <OfflineGate>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="driver" />
    </Stack>
    </OfflineGate>
  );
}