import type { BiometricUnlockResult } from "./biometric-lock";

export type BiometricLockState = "disabled" | "unlocked" | "locked" | "reauth_required";

export interface BiometricLockPort {
  isEnabled(): Promise<boolean>;
  unlockIfEnabled(): Promise<BiometricUnlockResult>;
}

export class BiometricLockController {
  private state: BiometricLockState = "disabled";

  constructor(private readonly biometricLock: BiometricLockPort) {}

  getState(): BiometricLockState {
    return this.state;
  }

  async restoreForAuthenticatedSession(): Promise<BiometricLockState> {
    try {
      this.state = (await this.biometricLock.isEnabled()) ? "locked" : "disabled";
    } catch {
      this.state = "reauth_required";
    }
    return this.state;
  }

  lock(): BiometricLockState {
    if (this.state === "unlocked") this.state = "locked";
    return this.state;
  }

  async unlock(): Promise<BiometricLockState> {
    if (this.state === "disabled" || this.state === "unlocked") return this.state;
    if (this.state === "reauth_required") return this.state;

    const result = await this.biometricLock.unlockIfEnabled();
    this.state = mapUnlockResult(result);
    return this.state;
  }

  requireServerReauthentication(): BiometricLockState {
    this.state = "reauth_required";
    return this.state;
  }

  clearAfterLogout(): BiometricLockState {
    this.state = "disabled";
    return this.state;
  }
}

function mapUnlockResult(result: BiometricUnlockResult): BiometricLockState {
  switch (result.status) {
    case "unlocked":
      return "unlocked";
    case "not_enabled":
      return "disabled";
    case "requires_reauth":
    case "unavailable":
      return "reauth_required";
    case "cancelled":
    case "failed":
      return "locked";
  }
}
