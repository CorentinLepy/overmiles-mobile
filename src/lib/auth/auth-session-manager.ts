import { ApiError } from "../api/api-error";
import { localDataSessionGuard } from "../storage/local-data-session-guard";
import type { TokenStore } from "./token-store";

export type MobileSessionTokens = Readonly<{
  accessToken: string;
  refreshToken: string;
}>;

export type RefreshTransport = (refreshToken: string) => Promise<MobileSessionTokens>;
export type LogoutTransport = (accessToken: string) => Promise<void>;

export type AuthRestoreState = "anonymous" | "authenticated" | "offline_auth_pending";

export class AuthSessionManager {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;
  private credentialMutation: Promise<void> = Promise.resolve();
  private sessionEpoch = 0;
  private endingSession = false;

  constructor(
    private readonly tokenStore: TokenStore,
    private readonly refreshTransport: RefreshTransport,
    private readonly logoutTransport: LogoutTransport,
  ) {}

  getAccessToken(): string | null {
    return this.accessToken;
  }

  async acceptSession(tokens: MobileSessionTokens): Promise<void> {
    const acceptEpoch = ++this.sessionEpoch;
    this.endingSession = false;
    await this.enqueueCredentialMutation(async () => {
      await this.tokenStore.writeRefreshToken(tokens.refreshToken);
      await this.tokenStore.clearLogoutTombstone?.();
    });
    this.assertRefreshStillCurrent(acceptEpoch);
    this.accessToken = tokens.accessToken;
    localDataSessionGuard.activate();
  }

  async restore(): Promise<AuthRestoreState> {
    try {
      if (await this.hasLogoutTombstone()) {
        this.accessToken = null;
        localDataSessionGuard.invalidate();
        await this.clearRefreshTokenBestEffort();
        return "anonymous";
      }

      const refreshToken = await this.tokenStore.readRefreshToken();
      if (!refreshToken) {
        this.accessToken = null;
        localDataSessionGuard.invalidate();
        return "anonymous";
      }
    } catch {
      this.accessToken = null;
      localDataSessionGuard.invalidate();
      return "anonymous";
    }

    try {
      await this.refresh();
      return "authenticated";
    } catch (error) {
      if (error instanceof ApiError && (error.kind === "network" || error.kind === "timeout")) {
        this.accessToken = null;
        localDataSessionGuard.invalidate();
        return "offline_auth_pending";
      }
      localDataSessionGuard.invalidate();
      return "anonymous";
    }
  }

  async getOrRefreshAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    return this.refresh();
  }

  refresh(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  async logout(): Promise<void> {
    const accessToken = this.accessToken;
    this.endingSession = true;
    localDataSessionGuard.invalidate();

    try {
      await this.clearLocalSession();
    } finally {
      this.endingSession = false;
      this.revokeAccessTokenBestEffort(accessToken);
    }
  }

  async clearLocalSession(): Promise<void> {
    this.sessionEpoch += 1;
    localDataSessionGuard.invalidate();
    this.accessToken = null;

    await this.enqueueCredentialMutation(async () => {
      let tombstoneWritten = false;
      let refreshTokenCleared = false;

      try {
        if (this.tokenStore.writeLogoutTombstone) {
          await this.tokenStore.writeLogoutTombstone();
          tombstoneWritten = true;
        }
      } catch {
        // Refresh-token deletion below is an independent fail-closed path.
      }

      try {
        await this.tokenStore.clearRefreshToken();
        refreshTokenCleared = true;
      } catch {
        // A durable logout tombstone blocks restore even if deletion is interrupted.
      }

      if (!tombstoneWritten && !refreshTokenCleared) {
        throw new Error("Impossible d’invalider les credentials locaux.");
      }
    });
  }

  private async performRefresh(): Promise<string> {
    const refreshEpoch = this.sessionEpoch;
    await this.assertLogoutNotPending();
    const refreshToken = await this.tokenStore.readRefreshToken();
    if (!refreshToken) {
      this.accessToken = null;
      localDataSessionGuard.invalidate();
      throw new ApiError({
        kind: "unauthorized",
        status: 401,
        retryable: false,
        userMessage: "Reconnectez-vous pour continuer.",
      });
    }

    try {
      const next = await this.refreshTransport(refreshToken);
      this.assertRefreshStillCurrent(refreshEpoch);

      await this.enqueueCredentialMutation(async () => {
        this.assertRefreshStillCurrent(refreshEpoch);
        await this.assertLogoutNotPending();
        await this.tokenStore.writeRefreshToken(next.refreshToken);
      });
      this.assertRefreshStillCurrent(refreshEpoch);

      this.accessToken = next.accessToken;
      if (!this.endingSession) {
        localDataSessionGuard.activate();
      }
      return next.accessToken;
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.kind === "unauthorized" &&
        error.code !== "LOCAL_SESSION_INVALIDATED"
      ) {
        await this.clearLocalSession();
      }
      throw error;
    }
  }

  private enqueueCredentialMutation(task: () => Promise<void>): Promise<void> {
    const next = this.credentialMutation.then(task, task);
    this.credentialMutation = next.catch(() => undefined);
    return next;
  }

  private async hasLogoutTombstone(): Promise<boolean> {
    return (await this.tokenStore.hasLogoutTombstone?.()) ?? false;
  }

  private async assertLogoutNotPending(): Promise<void> {
    if (!(await this.hasLogoutTombstone())) return;
    throw this.localSessionInvalidatedError();
  }

  private async clearRefreshTokenBestEffort(): Promise<void> {
    try {
      await this.enqueueCredentialMutation(() => this.tokenStore.clearRefreshToken());
    } catch {
      // Tombstone remains authoritative and cleanup can be retried next launch.
    }
  }

  private revokeAccessTokenBestEffort(accessToken: string | null): void {
    if (!accessToken) return;
    void this.logoutTransport(accessToken).catch(() => undefined);
  }

  private assertRefreshStillCurrent(refreshEpoch: number): void {
    if (refreshEpoch === this.sessionEpoch) return;
    throw this.localSessionInvalidatedError();
  }

  private localSessionInvalidatedError(): ApiError {
    return new ApiError({
      kind: "unauthorized",
      status: 401,
      retryable: false,
      code: "LOCAL_SESSION_INVALIDATED",
      userMessage: "Reconnectez-vous pour continuer.",
    });
  }
}
