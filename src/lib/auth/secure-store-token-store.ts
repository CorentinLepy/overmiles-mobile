import * as SecureStore from "expo-secure-store";
import type { TokenStore } from "./token-store";

const REFRESH_TOKEN_KEY = "overmiles.auth.refresh-token.v1";
const KEYCHAIN_SERVICE = "app.overmiles.mobile.auth";
const MAX_REFRESH_TOKEN_LENGTH = 4096;

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: KEYCHAIN_SERVICE,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * Keychain/Keystore-backed persistence for the opaque mobile refresh token.
 *
 * The access token is intentionally excluded from this adapter and remains
 * memory-only in AuthSessionManager. `requireAuthentication` is deliberately
 * not enabled here: biometric app locking is handled separately and must not
 * break background/session refresh semantics.
 */
export class SecureStoreTokenStore implements TokenStore {
  async readRefreshToken(): Promise<string | null> {
    const token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY, SECURE_STORE_OPTIONS);
    return token && token.length <= MAX_REFRESH_TOKEN_LENGTH ? token : null;
  }

  async writeRefreshToken(token: string): Promise<void> {
    const normalized = token.trim();
    if (!normalized || normalized.length > MAX_REFRESH_TOKEN_LENGTH) {
      throw new Error("Refresh Token invalide pour le stockage sécurisé.");
    }

    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, normalized, SECURE_STORE_OPTIONS);
  }

  async clearRefreshToken(): Promise<void> {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, SECURE_STORE_OPTIONS);
  }
}

export function createSecureStoreTokenStore(): TokenStore {
  return new SecureStoreTokenStore();
}
