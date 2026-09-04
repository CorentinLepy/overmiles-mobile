import { Redirect } from "expo-router";

import { AuthLoadingScreen } from "@/src/features/auth/screens/auth-loading-screen";
import { useAuth } from "@/src/providers/auth-provider";

export default function IndexRoute() {
  const { status, user } = useAuth();

  if (status === "restoring") {
    return <AuthLoadingScreen />;
  }

  if (status === "authenticated" || (status === "offline_auth_pending" && user)) {
    return <Redirect href="/home" />;
  }

  if (status === "mfa_required") {
    return <Redirect href="/mfa" />;
  }

  return <Redirect href="/login" />;
}
