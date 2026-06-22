import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, UserRow } from "@/lib/db";
import { generateOtpCode, hashOtp, OTP_TTL_MS } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

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

  // Always respond success-shaped to avoid leaking account existence.
  if (!user) return NextResponse.json({ success: true });

  const code = generateOtpCode();
  const otpHash = await hashOtp(code);
  db.prepare(
    "UPDATE users SET otp_hash = ?, otp_expires_at = ?, otp_attempts = 0 WHERE id = ?"
  ).run(otpHash, Date.now() + OTP_TTL_MS, user.id);

  await sendOtpEmail(user.email, code);

  return NextResponse.json({ success: true });
}
