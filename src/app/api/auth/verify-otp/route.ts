import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, UserRow } from "@/lib/db";
import { SESSION_COOKIE, signSessionToken } from "@/lib/auth";
import { verifyOtp, MAX_OTP_ATTEMPTS } from "@/lib/otp";

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const sql = await getDb();
  const email = parsed.data.email.toLowerCase().trim();
  const { rows } = await sql`SELECT * FROM users WHERE email = ${email}`;
  const user = rows[0] as UserRow | undefined;

  const fail = (message: string, status = 401) =>
    NextResponse.json({ error: message }, { status });

  if (!user || !user.otp_hash || !user.otp_expires_at) {
    return fail("No verification code pending. Please log in again.");
  }

  if (Date.now() > Number(user.otp_expires_at)) {
    await sql`UPDATE users SET otp_hash = NULL, otp_expires_at = NULL WHERE id = ${user.id}`;
    return fail("Verification code expired. Please log in again.");
  }

  if (user.otp_attempts >= MAX_OTP_ATTEMPTS) {
    await sql`UPDATE users SET otp_hash = NULL, otp_expires_at = NULL WHERE id = ${user.id}`;
    return fail("Too many incorrect attempts. Please log in again.");
  }

  const valid = await verifyOtp(parsed.data.code, user.otp_hash);
  if (!valid) {
    await sql`UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id = ${user.id}`;
    return fail("Incorrect verification code.");
  }

  await sql`UPDATE users SET otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0 WHERE id = ${user.id}`;

  const token = signSessionToken({ userId: user.id, email: user.email });
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
