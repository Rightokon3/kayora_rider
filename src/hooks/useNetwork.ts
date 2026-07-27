import { useCallback, useEffect, useRef, useState } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

/**
 * Shared connectivity hook for all three Kayora apps (customer, driver,
 * admin). Wraps @react-native-community/netinfo so every app reports
 * "offline" the same way:
 *
 *   isConnected === false            -> device has no network interface up
 *   isInternetReachable === false    -> on wifi/cellular but no real internet
 *                                        (captive portal, router with no
 *                                        uplink, etc.) — this is the one
 *                                        plain `isConnected` misses.
 *
 * `isOffline` folds both into a single boolean the UI can key off of.
 *
 * Install once per app:
 *   npx expo install @react-native-community/netinfo
 */
export function useNetworkStatus() {
  const [state, setState] = useState<NetInfoState | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    NetInfo.fetch().then((s) => mounted.current && setState(s));
    const unsubscribe = NetInfo.addEventListener((s) => {
      if (mounted.current) setState(s);
    });
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, []);

  const checkNow = useCallback(async () => {
    const s = await NetInfo.fetch();
    if (mounted.current) setState(s);
    return s;
  }, []);

  // Treat "unknown" (state === null, right at app boot) as online so we
  // don't flash the offline screen before the first NetInfo read lands.
  const isConnected = state?.isConnected ?? true;
  const isInternetReachable = state?.isInternetReachable ?? true;
  const isOffline = !isConnected || isInternetReachable === false;

  return { isOffline, isConnected, isInternetReachable, checkNow, raw: state };
}