import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "app.db");

function init(): Database.Database {
  const fs = require("fs");
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      otp_hash TEXT,
      otp_expires_at INTEGER,
      otp_attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      image_name TEXT,
      predicted_class TEXT NOT NULL,
      predicted_label TEXT NOT NULL,
      malignant_risk REAL NOT NULL,
      confidence REAL NOT NULL,
      probabilities TEXT NOT NULL,
      body_location TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);

    CREATE TABLE IF NOT EXISTS profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT,
      date_of_birth TEXT,
      sex TEXT,
      family_history_skin_cancer INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      updated_at INTEGER NOT NULL
    );
  `);

  // Migrate scans tables created before body_location/notes existed.
  const scanColumns = db.prepare("PRAGMA table_info(scans)").all() as { name: string }[];
  const scanColumnNames = new Set(scanColumns.map((c) => c.name));
  if (!scanColumnNames.has("body_location")) {
    db.exec("ALTER TABLE scans ADD COLUMN body_location TEXT");
  }
  if (!scanColumnNames.has("notes")) {
    db.exec("ALTER TABLE scans ADD COLUMN notes TEXT");
  }

  return db;
}

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

export const db = globalThis.__db ?? init();
if (process.env.NODE_ENV !== "production") {
  globalThis.__db = db;
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
  created_at: number;
}

export interface ProfileRow {
  user_id: number;
  full_name: string | null;
  date_of_birth: string | null;
  sex: string | null;
  family_history_skin_cancer: number;
  notes: string | null;
  updated_at: number;
}
