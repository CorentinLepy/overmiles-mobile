import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_LOCK_PREFERENCE_KEY = "overmiles.security.biometric-lock.v1";
const BIOMETRIC_LOCK_KEYCHAIN_SERVICE = "app.overmiles.mobile.biometric-lock";

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: BIOMETRIC_LOCK_KEYCHAIN_SERVICE,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type BiometricAvailability =
  | Readonly<{ status: "available"; types: readonly LocalAuthentication.AuthenticationType[] }>
  | Readonly<{
      status: "unavailable";
      reason: "no_hardware" | "not_enrolled" | "weak_only" | "unknown";
    }>;

export type BiometricUnlockResult =
  | Readonly<{ status: "unlocked" }>
  | Readonly<{ status: "not_enabled" }>
  | Readonly<{ status: "cancelled" }>
  | Readonly<{ status: "unavailable" }>
  | Readonly<{ status: "requires_reauth" }>
  | Readonly<{ status: "failed" }>;

export class BiometricLockService {
  async isEnabled(): Promise<boolean> {
    return (
      (await SecureStore.getItemAsync(BIOMETRIC_LOCK_PREFERENCE_KEY, SECURE_STORE_OPTIONS)) ===
      "enabled"
    );
  }

  async getAvailability(): Promise<BiometricAvailability> {
    try {
      const [hasHardware, isEnrolled, securityLevel, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.getEnrolledLevelAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);

      if (!hasHardware) return { status: "unavailable", reason: "no_hardware" };
      if (!isEnrolled) return { status: "unavailable", reason: "not_enrolled" };
      if (securityLevel !== LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) {
        return { status: "unavailable", reason: "weak_only" };
      }

      return { status: "available", types: Object.freeze([...types]) };
    } catch {
      return { status: "unavailable", reason: "unknown" };
    }
  }

  async enable(): Promise<BiometricUnlockResult> {
    const availability = await this.getAvailability();
    if (availability.status !== "available") return { status: "unavailable" };

    const result = await this.authenticate("Activer le verrou biométrique OverMiles");
    if (result.status !== "unlocked") return result;

    try {
      await SecureStore.setItemAsync(BIOMETRIC_LOCK_PREFERENCE_KEY, "enabled", SECURE_STORE_OPTIONS);
      return result;
    } catch {
      return { status: "failed" };
    }
  }

  async disable(): Promise<void> {
    await SecureStore.deleteItemAsync(BIOMETRIC_LOCK_PREFERENCE_KEY, SECURE_STORE_OPTIONS);
  }

  async unlockIfEnabled(): Promise<BiometricUnlockResult> {
    let enabled: boolean;
    try {
      enabled = await this.isEnabled();
    } catch {
      return { status: "requires_reauth" };
    }

    if (!enabled) return { status: "not_enabled" };

    const availability = await this.getAvailability();
    if (availability.status !== "available") return { status: "requires_reauth" };

    return this.authenticate("Déverrouiller OverMiles");
  }

  private async authenticate(promptMessage: string): Promise<BiometricUnlockResult> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: "Annuler",
        fallbackLabel: "",
        disableDeviceFallback: true,
        biometricsSecurityLevel: "strong",
      });

      if (result.success) return { status: "unlocked" };

      switch (result.error) {
        case "user_cancel":
        case "app_cancel":
        case "system_cancel":
          return { status: "cancelled" };
        case "not_available":
        case "not_enrolled":
        case "passcode_not_set":
          return { status: "unavailable" };
        case "lockout":
        case "user_fallback":
        case "invalid_context":
          return { status: "requires_reauth" };
        default:
          return { status: "failed" };
      }
    } catch {
      return { status: "failed" };
    }
  }
}

export const biometricLockService = new BiometricLockService();
