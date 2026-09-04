import type { MobileAuthUser } from "./mobile-auth-transport";
import { localDatabase, type LocalDatabase } from "../storage/local-database";

const CURRENT_USER_KEY = "auth.current-user.v1";

type AppStateRow = Readonly<{
  value_json: string;
}>;

export class LocalAuthProfileStore {
  constructor(private readonly database: LocalDatabase = localDatabase) {}

  async read(): Promise<MobileAuthUser | null> {
    const db = await this.database.open();
    const row = await db.getFirstAsync<AppStateRow>(
      "SELECT value_json FROM app_state WHERE key = ?",
      CURRENT_USER_KEY,
    );
    if (!row) return null;
    return parseUser(row.value_json);
  }

  async write(user: MobileAuthUser): Promise<void> {
    const db = await this.database.open();
    await db.runAsync(
      `INSERT INTO app_state (key, value_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = excluded.updated_at`,
      CURRENT_USER_KEY,
      JSON.stringify(user),
      new Date().toISOString(),
    );
  }
}

function parseUser(value: string): MobileAuthUser {
  const parsed = JSON.parse(value) as Partial<MobileAuthUser>;
  if (
    typeof parsed.id !== "string" ||
    typeof parsed.email !== "string" ||
    typeof parsed.displayName !== "string" ||
    typeof parsed.role !== "string"
  ) {
    throw new Error("Profil local invalide.");
  }

  return {
    id: parsed.id,
    email: parsed.email,
    displayName: parsed.displayName,
    firstName: typeof parsed.firstName === "string" ? parsed.firstName : null,
    lastName: typeof parsed.lastName === "string" ? parsed.lastName : null,
    dateOfBirth: typeof parsed.dateOfBirth === "string" ? parsed.dateOfBirth : null,
    nationalityCode: typeof parsed.nationalityCode === "string" ? parsed.nationalityCode : null,
    role: parsed.role,
  };
}

export const localAuthProfileStore = new LocalAuthProfileStore();
