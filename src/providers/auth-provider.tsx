import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { readPublicRuntimeConfig } from "@/src/config/env";
import { ApiError } from "@/src/lib/api/api-error";
import {
  AuthSessionManager,
  type AuthRestoreState,
} from "@/src/lib/auth/auth-session-manager";
import {
  createMobileAuthTransport,
  type MobileAuthUser,
} from "@/src/lib/auth/mobile-auth-transport";
import { createSecureStoreTokenStore } from "@/src/lib/auth/secure-store-token-store";

export type AuthStatus = "restoring" | AuthRestoreState;

type AuthContextValue = Readonly<{
  status: AuthStatus;
  user: MobileAuthUser | null;
  errorMessage: string | null;
  isBusy: boolean;
  login(email: string, password: string): Promise<boolean>;
  logout(): Promise<void>;
  retryRestore(): Promise<void>;
}>;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const runtimeConfig = useMemo(() => readPublicRuntimeConfig(), []);
  const transport = useMemo(
    () =>
      runtimeConfig.apiBaseUrl ? createMobileAuthTransport(runtimeConfig.apiBaseUrl) : null,
    [runtimeConfig.apiBaseUrl],
  );
  const sessionManager = useMemo(
    () =>
      transport
        ? new AuthSessionManager(
            createSecureStoreTokenStore(),
            transport.refresh,
            transport.logout,
          )
        : null,
    [transport],
  );

  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [user, setUser] = useState<MobileAuthUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const restoreSession = useCallback(async () => {
    if (!sessionManager) {
      setStatus("anonymous");
      setErrorMessage(runtimeConfig.errors[0] ?? "Configuration API mobile invalide.");
      return;
    }

    setStatus("restoring");
    setErrorMessage(null);

    const nextState = await sessionManager.restore();
    setStatus(nextState);

    if (nextState !== "authenticated") {
      setUser(null);
    }

    if (nextState === "offline_auth_pending") {
      setErrorMessage(
        "Votre session est conservée sur cet appareil, mais le réseau est nécessaire pour la vérifier.",
      );
    }
  }, [runtimeConfig.errors, sessionManager]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      if (!transport || !sessionManager) {
        setErrorMessage(runtimeConfig.errors[0] ?? "Configuration API mobile invalide.");
        return false;
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !password) {
        setErrorMessage("Saisissez votre e-mail et votre mot de passe.");
        return false;
      }

      setIsBusy(true);
      setErrorMessage(null);

      try {
        const response = await transport.login({ email: normalizedEmail, password });
        await sessionManager.acceptSession(response);
        setUser(response.user);
        setStatus("authenticated");
        return true;
      } catch (error) {
        setStatus("anonymous");
        setUser(null);
        if (error instanceof ApiError && error.kind === "unauthorized") {
          setErrorMessage("E-mail ou mot de passe incorrect.");
        } else if (error instanceof ApiError) {
          setErrorMessage(error.userMessage);
        } else {
          setErrorMessage("Impossible de vous connecter pour le moment.");
        }
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [runtimeConfig.errors, sessionManager, transport],
  );

  const logout = useCallback(async () => {
    if (!sessionManager) {
      setStatus("anonymous");
      setUser(null);
      return;
    }

    setIsBusy(true);
    try {
      await sessionManager.logout();
    } finally {
      setUser(null);
      setStatus("anonymous");
      setErrorMessage(null);
      setIsBusy(false);
    }
  }, [sessionManager]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      errorMessage,
      isBusy,
      login,
      logout,
      retryRestore: restoreSession,
    }),
    [errorMessage, isBusy, login, logout, restoreSession, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé sous AuthProvider.");
  }
  return context;
}
