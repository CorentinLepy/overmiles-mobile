import * as SecureStore from "expo-secure-store";

import type { LocalLockPreferences } from "./local-lock";

const LOCAL_LOCK_STORAGE_KEY = "overmiles.security.biometric-lock.v1";
const LOCAL_LOCK_KEYCHAIN_SERVICE = "app.overmiles.mobile.local-lock";

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: LOCAL_LOCK_KEYCHAIN_SERVICE,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export class SecureLocalLockPreferences implements LocalLockPreferences {
  async isEnabled(): Promise<boolean> {
    return (await SecureStore.getItemAsync(LOCAL_LOCK_STORAGE_KEY, SECURE_STORE_OPTIONS)) === "enabled";
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      await SecureStore.setItemAsync(LOCAL_LOCK_STORAGE_KEY, "enabled", SECURE_STORE_OPTIONS);
      return;
    }

    await SecureStore.deleteItemAsync(LOCAL_LOCK_STORAGE_KEY, SECURE_STORE_OPTIONS);
  }
}
