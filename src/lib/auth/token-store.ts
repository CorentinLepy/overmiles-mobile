/**
 * Contract reserved for COR-55.
 *
 * Security invariant:
 * - the refresh token is persisted only through a Keychain/Keystore-backed implementation;
 * - the access token remains in memory and is never exposed through this interface.
 */
export interface TokenStore {
  readRefreshToken(): Promise<string | null>;
  writeRefreshToken(token: string): Promise<void>;
  clearRefreshToken(): Promise<void>;
}
