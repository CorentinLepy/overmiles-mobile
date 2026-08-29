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
import { createApiClient, type ApiClient } from "@/src/lib/api/api-client";
import { ApiError } from "@/src/lib/api/api-error";
import { AuthSessionManager, type AuthRestoreState } from "@/src/lib/auth/auth-session-manager";
import {
  createMobileAuthTransport,
  type MobileAuthUser,
  type MobileMfaFactor,
} from "@/src/lib/auth/mobile-auth-transport";
import { createSecureStoreTokenStore } from "@/src/lib/auth/secure-store-token-store";

export type AuthStatus = "restoring" | AuthRestoreState | "mfa_required";

export type PendingMfaChallenge = Readonly<{
  challengeId: string;
  expiresAt: string;
}>;

type AuthContextValue = Readonly<{
  status: AuthStatus;
  user: MobileAuthUser | null;
  pendingMfa: PendingMfaChallenge | null;
  errorMessage: string | null;
  isBusy: boolean;
  apiClient: ApiClient | null;
  login(email: string, password: string): Promise<boolean>;
  completeMfa(factor: MobileMfaFactor, code: string): Promise<boolean>;
  cancelMfa(): void;
  logout(): Promise<void>;
  retryRestore(): Promise<void>;
}>;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const runtimeConfig = useMemo(() => readPublicRuntimeConfig(), []);
  const transport = useMemo(
    () => (runtimeConfig.apiBaseUrl ? createMobileAuthTransport(runtimeConfig.apiBaseUrl) : null),
    [runtimeConfig.apiBaseUrl],
  );
  const sessionManager = useMemo(
    () =>
      transport
        ? new AuthSessionManager(createSecureStoreTokenStore(), transport.refresh, transport.logout)
        : null,
    [transport],
  );
  const apiClient = useMemo(
    () =>
      runtimeConfig.apiBaseUrl && sessionManager
        ? createApiClient({ baseUrl: runtimeConfig.apiBaseUrl, auth: sessionManager })
        : null,
    [runtimeConfig.apiBaseUrl, sessionManager],
  );

  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [user, setUser] = useState<MobileAuthUser | null>(null);
  const [pendingMfa, setPendingMfa] = useState<PendingMfaChallenge | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const applyRestoreState = useCallback((nextState: AuthRestoreState) => {
    setStatus(nextState);
    setPendingMfa(null);

    if (nextState !== "authenticated") {
      setUser(null);
    }

    setErrorMessage(
      nextState === "offline_auth_pending"
        ? "Votre session est conservée sur cet appareil, mais le réseau est nécessaire pour la vérifier."
        : null,
    );
  }, []);

  const loadCurrentUser = useCallback(async (): Promise<MobileAuthUser | null> => {
    if (!apiClient) return null;
    return apiClient.request<MobileAuthUser>({
      path: "/users/me",
      kind: "json",
      auth: "required",
    });
  }, [apiClient]);

  const invalidateUnauthorizedProfile = useCallback(
    async (error: unknown): Promise<boolean> => {
      if (!(error instanceof ApiError) || error.kind !== "unauthorized" || !sessionManager) {
        return false;
      }

      await sessionManager.clearLocalSession();
      setUser(null);
      setPendingMfa(null);
      setStatus("anonymous");
      return true;
    },
    [sessionManager],
  );

  useEffect(() => {
    let active = true;

    async function restoreInitialSession() {
      if (!sessionManager) {
        if (!active) return;
        setStatus("anonymous");
        setErrorMessage(runtimeConfig.errors[0] ?? "Configuration API mobile invalide.");
        return;
      }

      const nextState = await sessionManager.restore();
      if (!active) return;
      applyRestoreState(nextState);

      if (nextState !== "authenticated") return;

      try {
        const restoredUser = await loadCurrentUser();
        if (active && restoredUser) setUser(restoredUser);
      } catch (error) {
        if (!active) return;
        await invalidateUnauthorizedProfile(error);
      }
    }

    void restoreInitialSession();

    return () => {
      active = false;
    };
  }, [
    applyRestoreState,
    invalidateUnauthorizedProfile,
    loadCurrentUser,
    runtimeConfig.errors,
    sessionManager,
  ]);

  const retryRestore = useCallback(async () => {
    if (!sessionManager) {
      setStatus("anonymous");
      setErrorMessage(runtimeConfig.errors[0] ?? "Configuration API mobile invalide.");
      return;
    }

    setStatus("restoring");
    setErrorMessage(null);
    const nextState = await sessionManager.restore();
    applyRestoreState(nextState);

    if (nextState !== "authenticated") return;

    try {
      const restoredUser = await loadCurrentUser();
      if (restoredUser) setUser(restoredUser);
    } catch (error) {
      await invalidateUnauthorizedProfile(error);
    }
  }, [
    applyRestoreState,
    invalidateUnauthorizedProfile,
    loadCurrentUser,
    runtimeConfig.errors,
    sessionManager,
  ]);

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
      setPendingMfa(null);

      try {
        const response = await transport.login({ email: normalizedEmail, password });
        if (response.mfaRequired) {
          setUser(null);
          setPendingMfa({
            challengeId: response.challengeId,
            expiresAt: response.challengeExpiresAt,
          });
          setStatus("mfa_required");
          return false;
        }

        await sessionManager.acceptSession(response);
        setUser(response.user);
        setStatus("authenticated");
        return true;
      } catch (error) {
        setStatus("anonymous");
        setUser(null);
        setPendingMfa(null);
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

  const completeMfa = useCallback(
    async (factor: MobileMfaFactor, code: string): Promise<boolean> => {
      if (!transport || !sessionManager || !pendingMfa) {
        setPendingMfa(null);
        setStatus("anonymous");
        setErrorMessage("La vérification MFA a expiré. Reconnectez-vous.");
        return false;
      }

      const normalizedCode = code.trim();
      if (!normalizedCode) {
        setErrorMessage(
          factor === "totp"
            ? "Saisissez le code à 6 chiffres."
            : "Saisissez votre code de récupération.",
        );
        return false;
      }

      setIsBusy(true);
      setErrorMessage(null);

      try {
        const response = await transport.completeMfa({
          challengeId: pendingMfa.challengeId,
          factor,
          code: normalizedCode,
        });
        await sessionManager.acceptSession(response);
        setPendingMfa(null);
        setUser(response.user);
        setStatus("authenticated");
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.kind === "unauthorized") {
          const expired =
            error.code === "MFA_CHALLENGE_EXPIRED" ||
            Date.parse(pendingMfa.expiresAt) <= Date.now();
          if (expired) {
            setPendingMfa(null);
            setStatus("anonymous");
            setErrorMessage("La vérification MFA a expiré. Reconnectez-vous.");
          } else {
            setStatus("mfa_required");
            setErrorMessage(
              factor === "totp"
                ? "Code de vérification incorrect ou déjà utilisé."
                : "Code de récupération incorrect ou déjà utilisé.",
            );
          }
        } else if (error instanceof ApiError) {
          setStatus("mfa_required");
          setErrorMessage(error.userMessage);
        } else {
          setStatus("mfa_required");
          setErrorMessage("Impossible de vérifier le second facteur pour le moment.");
        }
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [pendingMfa, sessionManager, transport],
  );

  const cancelMfa = useCallback(() => {
    setPendingMfa(null);
    setUser(null);
    setErrorMessage(null);
    setStatus("anonymous");
  }, []);

  const logout = useCallback(async () => {
    if (!sessionManager) {
      setStatus("anonymous");
      setUser(null);
      setPendingMfa(null);
      return;
    }

    setIsBusy(true);
    try {
      await sessionManager.logout();
    } finally {
      setUser(null);
      setPendingMfa(null);
      setStatus("anonymous");
      setErrorMessage(null);
      setIsBusy(false);
    }
  }, [sessionManager]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      pendingMfa,
      errorMessage,
      isBusy,
      apiClient,
      login,
      completeMfa,
      cancelMfa,
      logout,
      retryRestore,
    }),
    [
      apiClient,
      cancelMfa,
      completeMfa,
      errorMessage,
      isBusy,
      login,
      logout,
      pendingMfa,
      retryRestore,
      status,
      user,
    ],
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
