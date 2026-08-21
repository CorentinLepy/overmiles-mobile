import { ApiError } from "../api/api-error";
import type { TokenStore } from "./token-store";

export type MobileSessionTokens = Readonly<{
  accessToken: string;
  refreshToken: string;
}>;

export type RefreshTransport = (refreshToken: string) => Promise<MobileSessionTokens>;

export type AuthRestoreState = "anonymous" | "authenticated" | "offline_auth_pending";

export class AuthSessionManager {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private readonly tokenStore: TokenStore,
    private readonly refreshTransport: RefreshTransport,
  ) {}

  getAccessToken(): string | null {
    return this.accessToken;
  }

  async acceptSession(tokens: MobileSessionTokens): Promise<void> {
    await this.tokenStore.writeRefreshToken(tokens.refreshToken);
    this.accessToken = tokens.accessToken;
  }

  async restore(): Promise<AuthRestoreState> {
    const refreshToken = await this.tokenStore.readRefreshToken();
    if (!refreshToken) {
      this.accessToken = null;
      return "anonymous";
    }

    try {
      await this.refresh();
      return "authenticated";
    } catch (error) {
      if (error instanceof ApiError && (error.kind === "network" || error.kind === "timeout")) {
        this.accessToken = null;
        return "offline_auth_pending";
      }
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

  async clearLocalSession(): Promise<void> {
    this.accessToken = null;
    await this.tokenStore.clearRefreshToken();
  }

  private async performRefresh(): Promise<string> {
    const refreshToken = await this.tokenStore.readRefreshToken();
    if (!refreshToken) {
      this.accessToken = null;
      throw new ApiError({
        kind: "unauthorized",
        status: 401,
        retryable: false,
        userMessage: "Reconnectez-vous pour continuer.",
      });
    }

    try {
      const next = await this.refreshTransport(refreshToken);
      // Rotation invariant: persist the successor refresh token before any
      // request can observe/replay with the new in-memory access token.
      await this.tokenStore.writeRefreshToken(next.refreshToken);
      this.accessToken = next.accessToken;
      return next.accessToken;
    } catch (error) {
      if (error instanceof ApiError && error.kind === "unauthorized") {
        await this.clearLocalSession();
      }
      throw error;
    }
  }
}
