import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, UserRow } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
    | Pick<UserRow, "id">
    | undefined;
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  db.prepare(
    "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)"
  ).run(email, passwordHash, Date.now());

  return NextResponse.json({ success: true });
}
