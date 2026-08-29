import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BiometricLockScreen } from "@/src/features/auth/screens/biometric-lock-screen";
import { AuthProvider, useAuth } from "@/src/providers/auth-provider";

function RootNavigator() {
  const { status, user, biometricState } = useAuth();
  const hasLocalContentSession =
    status === "authenticated" ||
    (status === "offline_auth_pending" && user !== null);
  const isLocallyLocked =
    hasLocalContentSession &&
    (biometricState === "locked" || biometricState === "reauth_required");

  if (isLocallyLocked) {
    return <BiometricLockScreen />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
