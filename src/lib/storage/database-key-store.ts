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

export class DatabaseKeyStore {
  async readKey(): Promise<string | null> {
    const existing = await SecureStore.getItemAsync(DATABASE_KEY_STORAGE_KEY, SECURE_STORE_OPTIONS);

    if (existing === null) return null;
    if (!HEX_KEY_PATTERN.test(existing)) {
      throw new Error("La clé locale chiffrée est invalide.");
    }

    return existing;
  }

  async createKey(): Promise<string> {
    const generated = bytesToHex(await getRandomBytesAsync(DATABASE_KEY_BYTES));
    await SecureStore.setItemAsync(DATABASE_KEY_STORAGE_KEY, generated, SECURE_STORE_OPTIONS);
    return generated;
  }

  async hasKey(): Promise<boolean> {
    return (await this.readKey()) !== null;
  }

  async clearKey(): Promise<void> {
    await SecureStore.deleteItemAsync(DATABASE_KEY_STORAGE_KEY, SECURE_STORE_OPTIONS);
  }
}
