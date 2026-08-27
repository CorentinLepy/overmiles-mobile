export type BiometricCapability =
  | "available"
  | "unavailable"
  | "not_enrolled"
  | "locked_out";

export type LocalLockState = "disabled" | "unlocked" | "locked" | "reauth_required";

export type BiometricUnlockResult =
  | Readonly<{ outcome: "success" }>
  | Readonly<{
      outcome: "cancelled" | "failed" | "locked_out" | "unavailable";
      errorCode?: string;
    }>;

export interface BiometricAdapter {
  getCapability(): Promise<BiometricCapability>;
  authenticate(): Promise<BiometricUnlockResult>;
}

export interface LocalLockPreferences {
  isEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
}

export type LocalLockSnapshot = Readonly<{
  state: LocalLockState;
  capability: BiometricCapability | null;
}>;

export class LocalLockController {
  private snapshot: LocalLockSnapshot = { state: "disabled", capability: null };

  constructor(
    private readonly biometrics: BiometricAdapter,
    private readonly preferences: LocalLockPreferences,
  ) {}

  getSnapshot(): LocalLockSnapshot {
    return this.snapshot;
  }

  async restore(): Promise<LocalLockSnapshot> {
    const enabled = await this.preferences.isEnabled();
    if (!enabled) {
      this.snapshot = { state: "disabled", capability: null };
      return this.snapshot;
    }

    const capability = await this.biometrics.getCapability();
    this.snapshot = {
      capability,
      state: capability === "available" ? "locked" : "reauth_required",
    };
    return this.snapshot;
  }

  async enable(): Promise<LocalLockSnapshot> {
    const capability = await this.biometrics.getCapability();
    if (capability !== "available") {
      this.snapshot = { state: "reauth_required", capability };
      return this.snapshot;
    }

    const result = await this.biometrics.authenticate();
    if (result.outcome !== "success") {
      this.snapshot = {
        state: result.outcome === "locked_out" ? "reauth_required" : "unlocked",
        capability,
      };
      return this.snapshot;
    }

    await this.preferences.setEnabled(true);
    this.snapshot = { state: "unlocked", capability };
    return this.snapshot;
  }

  async disable(): Promise<LocalLockSnapshot> {
    await this.preferences.setEnabled(false);
    this.snapshot = { state: "disabled", capability: null };
    return this.snapshot;
  }

  lockNow(): LocalLockSnapshot {
    if (this.snapshot.state === "unlocked") {
      this.snapshot = { ...this.snapshot, state: "locked" };
    }
    return this.snapshot;
  }

  async unlock(): Promise<LocalLockSnapshot> {
    if (this.snapshot.state === "disabled" || this.snapshot.state === "unlocked") {
      return this.snapshot;
    }

    const capability = await this.biometrics.getCapability();
    if (capability !== "available") {
      this.snapshot = { state: "reauth_required", capability };
      return this.snapshot;
    }

    const result = await this.biometrics.authenticate();
    if (result.outcome === "success") {
      this.snapshot = { state: "unlocked", capability };
      return this.snapshot;
    }

    this.snapshot = {
      state: result.outcome === "locked_out" || result.outcome === "unavailable" ? "reauth_required" : "locked",
      capability,
    };
    return this.snapshot;
  }

  requireServerReauthentication(): LocalLockSnapshot {
    if (this.snapshot.state !== "disabled") {
      this.snapshot = { ...this.snapshot, state: "reauth_required" };
    }
    return this.snapshot;
  }
}
