/**
 * Contract reserved for COR-55.
 *
 * Security invariant:
 * - the refresh token is persisted only through a Keychain/Keystore-backed implementation;
 * - the access token remains in memory and is never exposed through this interface.
 *
 * COR-253 adds an optional durable logout tombstone. Implementations backed by
 * SecureStore use it to make a user-requested logout fail closed across process
 * interruption: restore must reject a persisted session while the tombstone is
 * present, even if physical refresh-token deletion was interrupted.
 */
export interface TokenStore {
  readRefreshToken(): Promise<string | null>;
  writeRefreshToken(token: string): Promise<void>;
  clearRefreshToken(): Promise<void>;
  hasLogoutTombstone?(): Promise<boolean>;
  writeLogoutTombstone?(): Promise<void>;
  clearLogoutTombstone?(): Promise<void>;
}
