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
    this.sessionEpoch += 1;
    this.endingSession = false;
    await this.tokenStore.writeRefreshToken(tokens.refreshToken);
    this.accessToken = tokens.accessToken;
    localDataSessionGuard.activate();
  }

  async restore(): Promise<AuthRestoreState> {
    const refreshToken = await this.tokenStore.readRefreshToken();
    if (!refreshToken) {
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
    this.endingSession = true;
    localDataSessionGuard.invalidate();
    try {
      const accessToken = this.accessToken ?? (await this.getOrRefreshAccessToken());
      await this.logoutTransport(accessToken);
    } finally {
      try {
        // A user-requested logout always removes local credentials, including
        // when the server is temporarily unreachable. Server sessions still
        // expire/revoke independently according to backend policy.
        await this.clearLocalSession();
      } finally {
        this.endingSession = false;
      }
    }
  }

  async clearLocalSession(): Promise<void> {
    this.sessionEpoch += 1;
    localDataSessionGuard.invalidate();
    this.accessToken = null;
    await this.tokenStore.clearRefreshToken();
  }

  private async performRefresh(): Promise<string> {
    const refreshEpoch = this.sessionEpoch;
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

      // Rotation invariant: persist the successor refresh token before any
      // request can observe/replay with the new in-memory access token.
      await this.tokenStore.writeRefreshToken(next.refreshToken);
      this.assertRefreshStillCurrent(refreshEpoch);

      this.accessToken = next.accessToken;
      if (!this.endingSession) {
        localDataSessionGuard.activate();
      }
      return next.accessToken;
    } catch (error) {
      if (error instanceof ApiError && error.kind === "unauthorized") {
        await this.clearLocalSession();
      }
      throw error;
    }
  }

  private assertRefreshStillCurrent(refreshEpoch: number): void {
    if (refreshEpoch === this.sessionEpoch) return;

    throw new ApiError({
      kind: "unauthorized",
      status: 401,
      retryable: false,
      code: "LOCAL_SESSION_INVALIDATED",
      userMessage: "Reconnectez-vous pour continuer.",
    });
  }
}
