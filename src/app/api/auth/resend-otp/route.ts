import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, UserRow } from "@/lib/db";
import { generateOtpCode, hashOtp, OTP_TTL_MS } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

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

  // Always respond success-shaped to avoid leaking account existence.
  if (!user) return NextResponse.json({ success: true });

  const code = generateOtpCode();
  const otpHash = await hashOtp(code);
  await sql`UPDATE users SET otp_hash = ${otpHash}, otp_expires_at = ${Date.now() + OTP_TTL_MS}, otp_attempts = 0 WHERE id = ${user.id}`;

  await sendOtpEmail(user.email, code);

  return NextResponse.json({ success: true });
}
