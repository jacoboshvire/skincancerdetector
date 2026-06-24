import { sql } from "@vercel/postgres";

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          otp_hash TEXT,
          otp_expires_at BIGINT,
          otp_attempts INTEGER NOT NULL DEFAULT 0,
          created_at BIGINT NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS scans (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          image_name TEXT,
          predicted_class TEXT NOT NULL,
          predicted_label TEXT NOT NULL,
          malignant_risk DOUBLE PRECISION NOT NULL,
          confidence DOUBLE PRECISION NOT NULL,
          probabilities TEXT NOT NULL,
          body_location TEXT,
          notes TEXT,
          favorite BOOLEAN NOT NULL DEFAULT FALSE,
          model TEXT NOT NULL DEFAULT 'mobilenetv2',
          created_at BIGINT NOT NULL
        )
      `;

      await sql`ALTER TABLE scans ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`ALTER TABLE scans ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'mobilenetv2'`;
      await sql`CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id)`;

      await sql`
        CREATE TABLE IF NOT EXISTS profiles (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          full_name TEXT,
          date_of_birth TEXT,
          sex TEXT,
          family_history_skin_cancer BOOLEAN NOT NULL DEFAULT FALSE,
          notes TEXT,
          updated_at BIGINT NOT NULL
        )
      `;
    })();
  }
  return schemaReady;
}

export async function getDb() {
  await ensureSchema();
  return sql;
}

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  otp_hash: string | null;
  otp_expires_at: number | null;
  otp_attempts: number;
  created_at: number;
}

export interface ScanRow {
  id: number;
  user_id: number;
  image_name: string | null;
  predicted_class: string;
  predicted_label: string;
  malignant_risk: number;
  confidence: number;
  probabilities: string;
  body_location: string | null;
  notes: string | null;
  favorite: boolean;
  model: string;
  created_at: number;
}

export interface ProfileRow {
  user_id: number;
  full_name: string | null;
  date_of_birth: string | null;
  sex: string | null;
  family_history_skin_cancer: boolean;
  notes: string | null;
  updated_at: number;
}
