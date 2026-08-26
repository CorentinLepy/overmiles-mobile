import { getRandomBytesAsync } from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const DATABASE_KEY_STORAGE_KEY = "overmiles.storage.database-key.v1";
const DATABASE_KEYCHAIN_SERVICE = "app.overmiles.mobile.storage";
const DATABASE_KEY_BYTES = 32;
const HEX_KEY_PATTERN = /^[0-9a-f]{64}$/;

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: DATABASE_KEYCHAIN_SERVICE,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assertValidKey(key: string): void {
  if (!HEX_KEY_PATTERN.test(key)) {
    throw new Error("La clé locale chiffrée est invalide.");
  }
}

export class DatabaseKeyStore {
  async readKey(): Promise<string | null> {
    const existing = await SecureStore.getItemAsync(DATABASE_KEY_STORAGE_KEY, SECURE_STORE_OPTIONS);

    if (existing === null) return null;
    assertValidKey(existing);
    return existing;
  }

  async generateKey(): Promise<string> {
    return bytesToHex(await getRandomBytesAsync(DATABASE_KEY_BYTES));
  }

  async storeKey(key: string): Promise<void> {
    assertValidKey(key);
    await SecureStore.setItemAsync(DATABASE_KEY_STORAGE_KEY, key, SECURE_STORE_OPTIONS);
  }

  async hasKey(): Promise<boolean> {
    return (await this.readKey()) !== null;
  }

  async clearKey(): Promise<void> {
    await SecureStore.deleteItemAsync(DATABASE_KEY_STORAGE_KEY, SECURE_STORE_OPTIONS);
  }
}
