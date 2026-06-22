import { NextResponse } from "next/server";
import { db, UserRow } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.userId) as
    | UserRow
    | undefined;

  return NextResponse.json({ email: session.email, createdAt: user?.created_at ?? null });
}
