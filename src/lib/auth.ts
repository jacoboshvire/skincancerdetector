import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const SESSION_COOKIE = "session_token";
const JWT_EXPIRES_IN = "12h";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable must be set in production");
    }
    console.warn(
      "[auth] JWT_SECRET is not set — using an insecure development default. Set JWT_SECRET in .env before deploying."
    );
    return "dev-only-insecure-secret-do-not-use-in-production";
  }
  return secret;
}

export interface SessionPayload {
  userId: number;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as SessionPayload;
  } catch {
    return null;
  }
}
