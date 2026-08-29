import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BiometricLockScreen } from "@/src/features/auth/screens/biometric-lock-screen";
import { AuthProvider, useAuth } from "@/src/providers/auth-provider";

function RootNavigator() {
  const { status, biometricState } = useAuth();
  const isLocallyLocked =
    status === "authenticated" &&
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
