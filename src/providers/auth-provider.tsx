import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";

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
import {
  BiometricLockController,
  type BiometricLockState,
} from "@/src/lib/security/biometric-lock-controller";
import { biometricLockService } from "@/src/lib/security/biometric-lock";

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
  biometricState: BiometricLockState;
  biometricBusy: boolean;
  biometricMessage: string | null;
  login(email: string, password: string): Promise<boolean>;
  completeMfa(factor: MobileMfaFactor, code: string): Promise<boolean>;
  cancelMfa(): void;
  logout(): Promise<void>;
  retryRestore(): Promise<void>;
  enableBiometricLock(): Promise<void>;
  disableBiometricLock(): Promise<void>;
  unlockBiometricLock(): Promise<void>;
  reauthenticateFromBiometricLock(): Promise<void>;
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
  const biometricController = useMemo(() => new BiometricLockController(biometricLockService), []);

  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [user, setUser] = useState<MobileAuthUser | null>(null);
  const [pendingMfa, setPendingMfa] = useState<PendingMfaChallenge | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [biometricState, setBiometricState] = useState<BiometricLockState>("disabled");
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricMessage, setBiometricMessage] = useState<string | null>(null);

  const resetBiometricRuntimeState = useCallback(() => {
    setBiometricState(biometricController.clearAfterLogout());
    setBiometricBusy(false);
    setBiometricMessage(null);
  }, [biometricController]);

  const applyRestoreState = useCallback(
    (nextState: AuthRestoreState) => {
      setStatus(nextState);
      setPendingMfa(null);

      if (nextState !== "authenticated") {
        setUser(null);
        resetBiometricRuntimeState();
      }

      setErrorMessage(
        nextState === "offline_auth_pending"
          ? "Votre session est conservée sur cet appareil, mais le réseau est nécessaire pour la vérifier."
          : null,
      );
    },
    [resetBiometricRuntimeState],
  );

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
      resetBiometricRuntimeState();
      return true;
    },
    [resetBiometricRuntimeState, sessionManager],
  );

  useEffect(() => {
    let active = true;

    async function restoreInitialSession() {
      if (!sessionManager) {
        if (!active) return;
        setStatus("anonymous");
        setErrorMessage(runtimeConfig.errors[0] ?? "Configuration API mobile invalide.");
        resetBiometricRuntimeState();
        return;
      }

      const nextState = await sessionManager.restore();
      if (!active) return;

      if (nextState === "authenticated") {
        const nextBiometricState = await biometricController.restoreForAuthenticatedSession();
        if (!active) return;
        setBiometricState(nextBiometricState);
      }

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
    biometricController,
    invalidateUnauthorizedProfile,
    loadCurrentUser,
    resetBiometricRuntimeState,
    runtimeConfig.errors,
    sessionManager,
  ]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState !== "active") {
        setBiometricState(biometricController.lock());
        setBiometricMessage(null);
      }
    });

    return () => subscription.remove();
  }, [biometricController, status]);

  const retryRestore = useCallback(async () => {
    if (!sessionManager) {
      setStatus("anonymous");
      setErrorMessage(runtimeConfig.errors[0] ?? "Configuration API mobile invalide.");
      resetBiometricRuntimeState();
      return;
    }

    setStatus("restoring");
    setErrorMessage(null);
    const nextState = await sessionManager.restore();

    if (nextState === "authenticated") {
      setBiometricState(await biometricController.restoreForAuthenticatedSession());
    }

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
    biometricController,
    invalidateUnauthorizedProfile,
    loadCurrentUser,
    resetBiometricRuntimeState,
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
        setBiometricState(await biometricController.acceptExplicitAuthentication());
        setBiometricMessage(null);
        setUser(response.user);
        setStatus("authenticated");
        return true;
      } catch (error) {
        setStatus("anonymous");
        setUser(null);
        setPendingMfa(null);
        resetBiometricRuntimeState();
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
    [
      biometricController,
      resetBiometricRuntimeState,
      runtimeConfig.errors,
      sessionManager,
      transport,
    ],
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
        setBiometricState(await biometricController.acceptExplicitAuthentication());
        setBiometricMessage(null);
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
    [biometricController, pendingMfa, sessionManager, transport],
  );

  const cancelMfa = useCallback(() => {
    setPendingMfa(null);
    setUser(null);
    setErrorMessage(null);
    setStatus("anonymous");
    resetBiometricRuntimeState();
  }, [resetBiometricRuntimeState]);

  const logout = useCallback(async () => {
    if (!sessionManager) {
      setStatus("anonymous");
      setUser(null);
      setPendingMfa(null);
      resetBiometricRuntimeState();
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
      resetBiometricRuntimeState();
    }
  }, [resetBiometricRuntimeState, sessionManager]);

  const enableBiometricLock = useCallback(async () => {
    setBiometricBusy(true);
    setBiometricMessage(null);
    try {
      const result = await biometricLockService.enable();
      switch (result.status) {
        case "unlocked":
          setBiometricState(biometricController.markEnabledAndUnlocked());
          setBiometricMessage("Verrou biométrique activé.");
          return;
        case "cancelled":
          setBiometricMessage("Activation annulée.");
          return;
        case "unavailable":
          setBiometricMessage("Aucune biométrie forte n’est disponible sur cet appareil.");
          return;
        case "requires_reauth":
          setBiometricMessage("Réauthentifiez-vous avant de réessayer l’activation.");
          return;
        case "not_enabled":
        case "failed":
          setBiometricMessage("Impossible d’activer le verrou biométrique pour le moment.");
      }
    } finally {
      setBiometricBusy(false);
    }
  }, [biometricController]);

  const disableBiometricLock = useCallback(async () => {
    setBiometricBusy(true);
    setBiometricMessage(null);
    try {
      await biometricLockService.disable();
      setBiometricState(biometricController.markDisabled());
      setBiometricMessage("Verrou biométrique désactivé.");
    } catch {
      setBiometricMessage("Impossible de désactiver le verrou biométrique pour le moment.");
    } finally {
      setBiometricBusy(false);
    }
  }, [biometricController]);

  const unlockBiometricLock = useCallback(async () => {
    setBiometricBusy(true);
    setBiometricMessage(null);
    try {
      const nextState = await biometricController.unlock();
      setBiometricState(nextState);
      if (nextState === "locked") {
        setBiometricMessage("Déverrouillage annulé ou refusé. Réessayez.");
      } else if (nextState === "reauth_required") {
        setBiometricMessage("Une reconnexion OverMiles est nécessaire.");
      }
    } finally {
      setBiometricBusy(false);
    }
  }, [biometricController]);

  const reauthenticateFromBiometricLock = useCallback(async () => {
    setBiometricBusy(true);
    try {
      await sessionManager?.clearLocalSession();
    } finally {
      setUser(null);
      setPendingMfa(null);
      setStatus("anonymous");
      setErrorMessage(null);
      resetBiometricRuntimeState();
    }
  }, [resetBiometricRuntimeState, sessionManager]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      pendingMfa,
      errorMessage,
      isBusy,
      apiClient,
      biometricState,
      biometricBusy,
      biometricMessage,
      login,
      completeMfa,
      cancelMfa,
      logout,
      retryRestore,
      enableBiometricLock,
      disableBiometricLock,
      unlockBiometricLock,
      reauthenticateFromBiometricLock,
    }),
    [
      apiClient,
      biometricBusy,
      biometricMessage,
      biometricState,
      cancelMfa,
      completeMfa,
      disableBiometricLock,
      enableBiometricLock,
      errorMessage,
      isBusy,
      login,
      logout,
      pendingMfa,
      reauthenticateFromBiometricLock,
      retryRestore,
      status,
      unlockBiometricLock,
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
