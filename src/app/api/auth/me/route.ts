import { NextResponse } from "next/server";
import { getDb, UserRow } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sql = await getDb();
  const { rows } = await sql`SELECT * FROM users WHERE id = ${session.userId}`;
  const user = rows[0] as UserRow | undefined;

  return NextResponse.json({
    email: session.email,
    createdAt: user ? Number(user.created_at) : null,
  });
}
