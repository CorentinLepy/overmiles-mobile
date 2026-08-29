import { Redirect } from "expo-router";

import { AuthLoadingScreen } from "@/src/features/auth/screens/auth-loading-screen";
import { useAuth } from "@/src/providers/auth-provider";

export default function IndexRoute() {
  const { status } = useAuth();

  if (status === "restoring") {
    return <AuthLoadingScreen />;
  }

  if (status === "authenticated") {
    return <Redirect href="/home" />;
  }

  if (status === "mfa_required") {
    return <Redirect href="/mfa" />;
  }

  return <Redirect href="/login" />;
}
