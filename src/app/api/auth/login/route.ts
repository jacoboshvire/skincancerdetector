import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, UserRow } from "@/lib/db";
import { SESSION_COOKIE, signSessionToken, verifyPassword } from "@/lib/auth";
import { generateOtpCode, hashOtp, OTP_TTL_MS } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";

// MFA is temporarily disabled (set MFA_ENABLED=true in .env to re-enable the email OTP step).
const MFA_ENABLED = process.env.MFA_ENABLED === "true";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as
    | UserRow
    | undefined;

  // Constant-shaped response whether or not the account exists, to avoid leaking which emails are registered.
  const genericError = NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  if (!user) return genericError;

  const valid = await verifyPassword(parsed.data.password, user.password_hash);
  if (!valid) return genericError;

  if (!MFA_ENABLED) {
    const token = signSessionToken({ userId: user.id, email: user.email });
    const res = NextResponse.json({ mfaRequired: false });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  }

  const code = generateOtpCode();
  const otpHash = await hashOtp(code);
  db.prepare(
    "UPDATE users SET otp_hash = ?, otp_expires_at = ?, otp_attempts = 0 WHERE id = ?"
  ).run(otpHash, Date.now() + OTP_TTL_MS, user.id);

  await sendOtpEmail(user.email, code);

  return NextResponse.json({ mfaRequired: true, email: user.email });
}
